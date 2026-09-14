import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HomeBrand } from "@/components/HomeBrand";
import { useProfile } from "@/lib/auth/useProfile";
import { safeLoginReturnPath } from "@/lib/auth/loginReturn";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { APP_ROLE } from "@/lib/auth/constants";

const StudentLogin = () => {
  const [busy, setBusy] = useState(false);
  const { loading, session, profile, isDevStub } = useProfile();
  const location = useLocation();
  const requestedPath = new URLSearchParams(location.search).get("next");
  const afterLoginPath = safeLoginReturnPath(requestedPath);

  // Supabase가 Google OAuth를 직접 수행한다(Lovable 브로커 경유 없음) —
  // 그래서 로컬·Railway 어디서 열어도 동작한다. 성공하면 이 탭이 Google로
  // 이동하므로 호출 이후 코드는 실행되지 않는다.
  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + afterLoginPath },
      });
      if (error) {
        toast.error("Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setBusy(false);
      }
    } catch {
      toast.error("Google 로그인 중 오류가 발생했습니다.");
      setBusy(false);
    }
  };

  // 이미 인증된 학습자는 다시 Google 인증을 요구하지 않는다. 명시적 next가 있으면
  // 요청 화면으로 복귀하고, RequireApproved가 프로필 미완료 사용자를 /home으로 보낸다.
  if (!loading && session && profile?.role === APP_ROLE.ADMIN) {
    return <Navigate to="/learner/course" replace />;
  }

  if (!loading && (session || isDevStub)) {
    return <Navigate to={requestedPath ? afterLoginPath : "/home"} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-center px-5 py-10 sm:pb-[13vh] sm:pt-14">
        {loading ? (
          <p className="text-[13.5px] text-muted-foreground" role="status">
            로그인 상태를 확인하는 중…
          </p>
        ) : (
          <>
            {/* 로그인은 학습의 목적이 아니라 입구다. 왼쪽은 무엇을 하는 곳인지(학습 흐름),
                오른쪽은 인증 행동만 둔다. 인증 우회는 접근 정책에 따라 제공하지 않는다. */}
            <section className="grid w-full max-w-[760px] overflow-hidden rounded-2xl border border-[#E8E4D8] bg-white shadow-sm md:grid-cols-[1.05fr_1fr]">
              <div className="flex flex-col gap-5 bg-[#15202B] px-7 py-7 text-[#E9ECEF] sm:px-9 sm:py-10">
                <p className="text-[11.5px] font-bold tracking-[0.14em] text-[#FAD338]">학습자 영역</p>
                <h1 className="break-keep text-[28px] font-bold leading-[1.2] tracking-[-0.025em] text-white">
                  학습 시작하기
                </h1>
                <ol className="hidden gap-3.5 text-[14px] leading-snug text-[#C5CDD5] sm:grid">
                  {["표현을 비교해 판단합니다", "직접 번역·통역합니다", "피드백을 보고 다듬습니다"].map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#3E4C5A] text-[11.5px] font-bold text-[#FAD338]"
                      >
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="break-keep text-balance border-t border-[#2A3844] pt-4 text-[13px] leading-relaxed text-[#95A2B0] md:mt-auto">
                  그 과정이 학습 기록에 저장돼 다음에 이어서 할 수 있습니다.
                </p>
              </div>

              <div className="flex flex-col justify-center gap-4 px-7 py-7 sm:px-9 sm:py-10">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy}
                  aria-busy={busy}
                  className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[10px] bg-[#FAD338] px-5 py-3 text-[15px] font-bold text-[#15202B] shadow-[0_1px_0_rgba(21,32,43,0.12)] transition-colors hover:bg-[#F2C81F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                >
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white">
                    <svg viewBox="0 0 48 48" className="h-5 w-5">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  </span>
                  <span>{busy ? "Google로 이동하는 중…" : "Google 계정으로 로그인"}</span>
                </button>

                <ul className="grid gap-2 text-[13px] leading-snug text-[#5F5A50]">
                  {["학교·개인 Google 계정 모두 사용할 수 있습니다.", "같은 계정으로 로그인해야 기록이 이어집니다."].map((note) => (
                    <li key={note} className="flex items-start gap-2 break-keep">
                      <Check aria-hidden size={15} strokeWidth={2.2} className="mt-[1px] shrink-0 text-[#2F6B4F]" />
                      {note}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/privacy"
                  className="self-start rounded-sm text-[12.5px] text-[#8A8578] underline underline-offset-2 transition-colors hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
                >
                  개인정보처리방침
                </Link>
              </div>
            </section>

            <Link
              to="/"
              className="group mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D6D0C2] bg-white/70 px-5 text-[14px] font-semibold text-[#3E4C57] shadow-sm transition-colors hover:border-[#15202B] hover:bg-white hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
            >
              <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
                ←
              </span>
              시작 화면으로
            </Link>
          </>
        )}
      </main>
    </div>
  );
};

export default StudentLogin;
