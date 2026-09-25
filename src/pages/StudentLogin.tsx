import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { supabase } from "@/integrations/supabase/client";
import { buildGoogleSignInUrl, readGoogleCallback } from "@/lib/auth/googleIdentity";
import Landing from "@/pages/Landing";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/lib/auth/useProfile";
import { safeLoginReturnPath } from "@/lib/auth/loginReturn";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { APP_ROLE } from "@/lib/auth/constants";

const StudentLogin = () => {
  const [busy, setBusy] = useState(false);
  const { loading, session, profile, isDevStub } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedPath = new URLSearchParams(location.search).get("next");
  const afterLoginPath = safeLoginReturnPath(requestedPath);

  // Google이 ID 토큰을 붙여 이 페이지로 돌려보낸 경우 세션으로 교환한다(googleIdentity.ts).
  // 개발 모드의 effect 이중 실행에서 보관값을 두 번 읽지 않도록 ref로 한 번만 처리한다.
  const [callbackNext, setCallbackNext] = useState<string | null>(null);
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (callbackHandled.current) return;
    callbackHandled.current = true;

    const callback = readGoogleCallback(window.location.hash);
    if (callback.kind === "none") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (callback.kind === "error") {
      if (callback.reason !== "denied") {
        toast.error("Google 로그인에 실패했습니다. 다시 시도해 주세요.");
      }
      return;
    }

    setBusy(true);
    setCallbackNext(safeLoginReturnPath(callback.next));
    void supabase.auth
      .signInWithIdToken({ provider: "google", token: callback.idToken, nonce: callback.nonce })
      .then(({ error }) => {
        if (error) {
          toast.error("Google 로그인에 실패했습니다. 다시 시도해 주세요.");
          setCallbackNext(null);
          setBusy(false);
        }
        // 성공하면 useProfile이 세션 변화를 받아 아래 Navigate가 다음 화면으로 보낸다.
      });
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const next = requestedPath ? afterLoginPath : "/home";
      window.location.assign(await buildGoogleSignInUrl(window.location.origin, next));
    } catch {
      toast.error("Google 로그인 화면을 열지 못했습니다. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  // 이미 인증된 학습자는 다시 Google 인증을 요구하지 않는다. 명시적 next가 있으면
  // 요청 화면으로 복귀하고, RequireApproved가 프로필 미완료 사용자를 /home으로 보낸다.
  if (!loading && session && profile?.role === APP_ROLE.ADMIN) {
    return <Navigate to="/learner/course" replace />;
  }

  if (!loading && (session || isDevStub)) {
    return <Navigate to={callbackNext ?? (requestedPath ? afterLoginPath : "/home")} replace />;
  }

  // 로그인은 별도 페이지가 아니라 시작 화면 위의 팝업으로 보인다(2026-09-25).
  // 주소 /student-login은 그대로 둔다 — Google 로그인 복귀 주소이자, 로그인이 필요한
  // 화면이 학생을 보내는 곳이다. 어느 경로로 오든 시작 화면 위에 같은 팝업이 뜬다.
  const closeToLanding = (open: boolean) => {
    if (!open && !busy) navigate("/", { replace: true });
  };

  return (
    <>
      <Landing />
      <Dialog open onOpenChange={closeToLanding}>
        <DialogPortal>
          <DialogOverlay className="bg-[#1E2226]/45 backdrop-blur-[3px] backdrop-saturate-[.15] ![animation-duration:450ms] ![animation-timing-function:cubic-bezier(0.16,1,0.3,1)]" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-l-[5px] border-[#E8E4D8] border-l-[#FAD338] bg-white shadow-[0_24px_60px_-20px_rgba(21,32,43,0.45)] ![animation-duration:450ms] ![animation-timing-function:cubic-bezier(0.16,1,0.3,1)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div className="px-7 pb-5 pt-7 sm:px-8">
              <DialogTitle className="break-keep text-[27px] font-bold leading-[1.25] tracking-[-0.025em] text-[#15202B]">
                학습 시작하기
              </DialogTitle>

              {loading ? (
                <p className="mt-6 text-[13.5px] text-muted-foreground" role="status">
                  로그인 상태를 확인하는 중…
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={busy}
                    aria-busy={busy}
                    className="mt-6 flex h-[54px] w-[272px] max-w-full items-center justify-center gap-3 rounded-xl bg-[#101318] px-5 text-[15px] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[#1B2028] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101318] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
                  >
                    <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center">
                      <svg viewBox="0 0 48 48" className="h-[19px] w-[19px]">
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
                    <span>
                      {busy ? (callbackNext ? "로그인하는 중…" : "Google로 이동하는 중…") : "Google 계정으로 로그인"}
                    </span>
                  </button>

                  <ul className="mt-4 grid gap-2 text-[13px] leading-snug text-[#5F5A50]">
                    {["학교·개인 Google 계정 모두 사용할 수 있습니다."].map((note) => (
                      <li key={note} className="flex items-start gap-2 break-keep">
                        <Check aria-hidden size={15} strokeWidth={2.2} className="mt-[1px] shrink-0 text-[#2F6B4F]" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#EEEAE0] bg-[#FBFAF6] px-7 py-2 text-[12.5px] text-[#8A8578] sm:px-8">
              <span>개인정보처리방침</span>
              <Link
                to="/privacy"
                aria-label="개인정보처리방침 보기"
                className="rounded-sm font-medium text-[#6B665C] underline underline-offset-2 transition-colors hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
              >
                보기
              </Link>
            </div>

            <DialogPrimitive.Close
              disabled={busy}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#8A8578] transition-colors hover:bg-[#F3F0E7] hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] disabled:opacity-40"
            >
              <X aria-hidden className="h-4 w-4" />
              <span className="sr-only">닫기</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
};

export default StudentLogin;
