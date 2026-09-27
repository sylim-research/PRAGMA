import { useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
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
        <button type="button" aria-label="내 계정" className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-[#D3DBE3] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD338]">
          <UserRound aria-hidden className="h-4 w-4" />
          계정
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">로그인한 계정</p>
          <p className="mt-1 break-all text-sm text-foreground">{email ?? "현재 계정"}</p>
        </div>
        <button type="button" onClick={handleSignOut} disabled={busy} aria-busy={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-wait disabled:opacity-60">
          <LogOut aria-hidden className="h-4 w-4" />
          {busy ? "로그아웃 중…" : "로그아웃"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
