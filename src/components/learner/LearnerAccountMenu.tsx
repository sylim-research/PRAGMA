import { useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { devStubSignOut, useProfile } from "@/lib/auth/useProfile";

export function LearnerAccountMenu() {
  const { loading, session, profile, isDevStub } = useProfile();
  const [busy, setBusy] = useState(false);
  const signingOut = useRef(false);
  if (loading || (!session && !isDevStub)) return null;
  const email = session?.user.email ?? profile?.email;

  const handleSignOut = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setBusy(true);
    try {
      if (isDevStub) {
        devStubSignOut();
      } else {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
      // Reload so the next account does not inherit in-memory queries or screen state.
      window.location.replace("/student-login");
    } catch {
      toast.error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
      signingOut.current = false;
      setBusy(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="내 계정"
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-2.5 text-[14px] sm:pl-4 sm:pr-3 font-semibold tracking-[-0.01em] text-[#DCE3E9] transition-colors hover:border-white/30 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD338] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15202B] data-[state=open]:border-white/30 data-[state=open]:bg-white/[0.06] data-[state=open]:text-white"
        >
          <UserRound aria-hidden className="h-[17px] w-[17px] text-[#B9C4CE] transition-colors group-hover:text-white group-data-[state=open]:text-white" strokeWidth={2} />
          <span className="hidden sm:inline">내 계정</span>
          <ChevronDown aria-hidden className="hidden h-4 w-4 text-[#B9C4CE] transition-transform group-data-[state=open]:rotate-180 sm:block" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[248px] overflow-hidden rounded-xl border border-[#DED9CC] bg-white p-0 shadow-[0_16px_40px_-18px_rgba(21,32,43,0.45)]"
      >
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF4BF] text-[#15202B]">
            <UserRound aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7B776D]">로그인 계정</p>
            <p className="mt-1 truncate text-[13.5px] font-medium text-[#15202B]" title={email}>{email ?? "현재 계정"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          aria-busy={busy}
          className="flex h-11 w-full items-center gap-2.5 border-0 border-t border-[#EEEAE0] bg-[#FBFAF6] px-4 text-left text-[13px] font-semibold text-[#4F5A65] transition-colors hover:bg-[#F4F1E8] hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FAD338] disabled:cursor-wait disabled:opacity-60"
        >
          <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.9} />
          {busy ? "로그아웃 중…" : "로그아웃"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
