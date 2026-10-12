import { useEffect, useState, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { APPROVAL_STATUS, APP_ROLE, type Profile } from "./constants";

const DEV_STUB_KEY = "dev-stub-session";

// dev-only flag — exposed only in dev builds. Never reachable in production.
export const IS_DEV = import.meta.env.DEV;

// Secondary kill-switch: even in DEV, hide the test entry when
// VITE_ENABLE_TEST_ENTRY === 'false'. Primary gate is import.meta.env.DEV
// so production builds never expose the dev entry regardless of env.
export const IS_DEV_TEST_ENTRY_ENABLED =
  IS_DEV && import.meta.env.VITE_ENABLE_TEST_ENTRY !== "false";

// 시연 UI 모드 — 미션 검토 도구 등에만 사용한다. 인증 우회와는 분리한다.
export const IS_DEMO = IS_DEV || import.meta.env.VITE_ENABLE_DEMO === "true";

type DevStub = {
  user_id: string;
  email: string;
  approval_status: Profile["approval_status"];
  profile_completed?: boolean;
  full_name?: string;
};

function readDevStub(): DevStub | null {
  try {
    // 배포 환경에서는 과거 시연용 세션도 인증으로 인정하지 않는다.
    localStorage.removeItem(DEV_STUB_KEY);
    if (!IS_DEV_TEST_ENTRY_ENABLED) {
      sessionStorage.removeItem(DEV_STUB_KEY);
      return null;
    }
    const raw = sessionStorage.getItem(DEV_STUB_KEY);
    return raw ? (JSON.parse(raw) as DevStub) : null;
  } catch {
    return null;
  }
}

function writeDevStub(stub: DevStub | null) {
  if (!IS_DEV_TEST_ENTRY_ENABLED) return;
  if (stub) sessionStorage.setItem(DEV_STUB_KEY, JSON.stringify(stub));
  else sessionStorage.removeItem(DEV_STUB_KEY);
}

/**
 * 로컬 개발 전용 임시 학습자 로그인.
 * 기본은 승인 대기 상태(승인 플로우 테스트용). `ready: true`를 주면 승인·프로필
 * 완료 상태로 만들어 학습 화면까지 한 번에 들어간다.
 */
export function devStubSignIn(
  email = "dev.learner@example.com",
  opts?: { ready?: boolean },
) {
  if (!IS_DEV_TEST_ENTRY_ENABLED) return;
  const existing = readDevStub();
  const base: DevStub = existing ?? {
    user_id: `dev-${crypto.randomUUID()}`,
    email,
    approval_status: APPROVAL_STATUS.PENDING,
  };
  const stub: DevStub = opts?.ready
    ? {
        ...base,
        approval_status: APPROVAL_STATUS.APPROVED,
        profile_completed: true,
        full_name: base.full_name ?? "임시 학습자",
      }
    : base;
  writeDevStub(stub);
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export function devStubSignOut() {
  writeDevStub(null);
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export function devStubApproveCurrent() {
  if (!IS_DEV_TEST_ENTRY_ENABLED) return;
  const stub = readDevStub();
  if (!stub) return;
  writeDevStub({ ...stub, approval_status: APPROVAL_STATUS.APPROVED });
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export function devStubCompleteProfile(full_name: string) {
  if (!IS_DEV_TEST_ENTRY_ENABLED) return;
  const stub = readDevStub();
  if (!stub) return;
  writeDevStub({ ...stub, profile_completed: true, full_name });
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export type UseProfileResult = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isDevStub: boolean;
  refresh: () => Promise<void>;
};

export function useProfile(): UseProfileResult {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [devStub, setDevStub] = useState<DevStub | null>(() => readDevStub());

  // Supabase re-emits SIGNED_IN / TOKEN_REFRESHED when a tab regains focus; the profile only
  // needs reading again when the signed-in user actually changes.
  const loadedFor = useRef<string | null>(null);
  const loadProfile = useCallback(async (uid: string, force = false) => {
    if (!force && loadedFor.current === uid) return;
    loadedFor.current = uid;
    const { data } = await supabase
      .from("profiles")
      .select("id,user_id,role,approval_status,profile_completed,email,anonymous_participant_id")
      .eq("user_id", uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  const refresh = useCallback(async () => {
    // A real authenticated session always wins over the dev stub.
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user) {
      writeDevStub(null);
      setDevStub(null);
      setSession(s.session);
      await loadProfile(s.session.user.id, true);
      setLoading(false);
      return;
    }
    const stub = readDevStub();
    setDevStub(stub);
    if (stub) {
      loadedFor.current = null;
      setSession(null);
      setProfile({
        id: stub.user_id,
        user_id: stub.user_id,
        role: APP_ROLE.LEARNER,
        approval_status: stub.approval_status,
        profile_completed: !!stub.profile_completed,
        email: stub.email,
        anonymous_participant_id: null,
      });
      setLoading(false);
      return;
    }
    loadedFor.current = null;
    setSession(null);
    setProfile(null);
    setLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    // Listen first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (s?.user) {
        // Real sign-in supersedes any dev stub.
        writeDevStub(null);
        setDevStub(null);
        // Defer to avoid recursive supabase calls in callback
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        loadedFor.current = null;
        setProfile(null);
      }
    });
    void refresh();
    const onStub = () => void refresh();
    window.addEventListener("dev-stub-changed", onStub);
    window.addEventListener("profile-changed", onStub);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("dev-stub-changed", onStub);
      window.removeEventListener("profile-changed", onStub);
    };
  }, [loadProfile, refresh]);

  return { loading, session, profile, isDevStub: !!devStub, refresh };
}
