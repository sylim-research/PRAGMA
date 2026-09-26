import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { supabase } from "@/integrations/supabase/client";
import { APP_ROLE } from "@/lib/auth/constants";

// D1 (2026-07-21): 스켈레톤(아무 비번→대시보드) 제거.
// 실제 Supabase 인증 + profiles.role='admin' 확인만 통과시킨다.
// 계정은 Supabase 대시보드에서 생성/승격한다(자가 가입 없음).

// Supabase Auth는 이메일로만 로그인한다. 공유용 계정을 "admin / 비밀번호"처럼
// 쓸 수 있도록, @ 없는 입력은 아이디로 보고 이 도메인을 붙인다.
// (메일은 발송되지 않는다 — 계정은 대시보드에서 Auto Confirm으로 만든다.)
const ID_DOMAIN = "l2-pragmatics.app";

const INPUT_CLASS = "h-10 w-full rounded-lg border border-[#E1DCCD] bg-[#FBFAF6] pl-10 pr-3.5 text-sm text-[#15202B] placeholder:text-[#B3AC9C] transition-colors focus:border-[#15202B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15202B]/15";

function toEmail(input: string) {
  const v = input.trim();
  return v.includes("@") ? v : `${v}@${ID_DOMAIN}`;
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { data: signIn, error: signInError } =
      await supabase.auth.signInWithPassword({ email: toEmail(account), password: pw });
    if (signInError || !signIn.user) {
      // Supabase의 영문 메시지를 그대로 보이지 않는다.
      setError(signInError?.message === "Invalid login credentials"
        ? "아이디 또는 비밀번호가 맞지 않습니다."
        : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
      return;
    }

    // 관리자 권한 확인 — learner 계정은 관리자 화면에 들어갈 수 없다.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", signIn.user.id)
      .maybeSingle();

    if (profile?.role !== APP_ROLE.ADMIN) {
      await supabase.auth.signOut();
      setError("이 계정은 교수자 권한이 없습니다.");
      setBusy(false);
      return;
    }

    navigate("/admin/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      {/* 학습자 로그인 카드와 같은 틀: 제목과 입력을 한 장의 카드에 담고 화면 가운데에 둔다. */}
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 pb-20 pt-12">
        <form
          className="w-full max-w-[380px] rounded-2xl border border-l-[5px] border-[#E8E4D8] border-l-[#FAD338] bg-white px-7 pb-6 pt-6 shadow-[0_24px_60px_-28px_rgba(21,32,43,0.35)] sm:px-8"
          onSubmit={handleSubmit}
        >
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8B7324]">INSTRUCTOR</p>
          <h1 className="mt-1 text-[24px] font-bold leading-[1.25] tracking-[-0.025em] text-[#15202B]">교수자 로그인</h1>
          <div className="mt-5 flex flex-col gap-1.5">
            <label htmlFor="admin-account" className="text-[13px] font-medium text-[#4E5A63]">아이디</label>
            <div className="relative">
              <UserRound aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9383]" />
              <input
                id="admin-account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="off"
                className={INPUT_CLASS}
                placeholder="admin"
              />
            </div>
            <label htmlFor="admin-password" className="mt-2 text-[13px] font-medium text-[#4E5A63]">비밀번호</label>
            <div className="relative">
              <LockKeyhole aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9383]" />
              <input
                id="admin-password"
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="off"
                className={`${INPUT_CLASS} pr-11`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPw}
                className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#8A8578] transition-colors hover:bg-[#F3F0E7] hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]/30"
              >
                {showPw ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || !account.trim() || !pw}
            className="group mt-5 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#FAD338] px-4 text-[15px] font-semibold text-[#15202B] shadow-[0_1px_0_rgba(21,32,43,0.08)] transition-[filter,transform] hover:brightness-95 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? "로그인 중…" : <>입장<ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" /></>}
          </button>
          {error && <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p>}
        </form>
      </main>
    </div>
  );
};

export default AdminLogin;
