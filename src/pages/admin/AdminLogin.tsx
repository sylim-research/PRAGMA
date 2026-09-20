import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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

function toEmail(input: string) {
  const v = input.trim();
  return v.includes("@") ? v : `${v}@${ID_DOMAIN}`;
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { data: signIn, error: signInError } =
      await supabase.auth.signInWithPassword({ email: toEmail(account), password: pw });
    if (signInError || !signIn.user) {
      setError(signInError?.message ?? "로그인에 실패했습니다.");
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
      <main className="mx-auto flex max-w-md flex-col px-6 py-16">
        <div className="flex items-stretch gap-3">
          <span aria-hidden className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">교수자 로그인</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              발급받은 아이디로 로그인하세요. 교수자 권한이 있는 계정만 입장할 수 있습니다.
            </p>
          </div>
        </div>
        <form
          className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
          onSubmit={handleSubmit}
        >
          <label className="text-sm font-medium">아이디</label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            autoComplete="off"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="admin"
          />
          <label className="mt-1 text-sm font-medium">비밀번호</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="off"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="••••••••"
          />
          <button
            type="submit"
            disabled={busy || !account.trim() || !pw}
            className="mt-2 rounded-md bg-[#FAD338] px-4 py-2 text-sm font-medium text-[#15202B] hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "로그인 중…" : "입장"}
          </button>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </form>
      </main>
    </div>
  );
};

export default AdminLogin;
