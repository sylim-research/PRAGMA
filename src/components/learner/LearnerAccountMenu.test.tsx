import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth/useProfile";
import { LearnerAccountMenu } from "./LearnerAccountMenu";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/lib/auth/useProfile", () => ({ useProfile: vi.fn(), devStubSignOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const profile = () => ({ loading: false, session: { user: { email: "current@example.com" } },
  profile: { email: "old@example.com" }, isDevStub: false, refresh: vi.fn() }) as unknown as ReturnType<typeof useProfile>;

beforeEach(() => { vi.clearAllMocks(); vi.mocked(useProfile).mockReturnValue(profile()); });
afterEach(cleanup);
const open = () => { render(<LearnerAccountMenu />); fireEvent.click(screen.getByRole("button", { name: "내 계정" })); };

describe("learner account switching", () => {
  it("identifies the actual authenticated account, even while a previous profile is still present", () => {
    open();
    expect(screen.getByText("current@example.com")).toBeInTheDocument();
    expect(screen.queryByText("old@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled();
  });

  it("does not offer logout when there is no authenticated account", () => {
    vi.mocked(useProfile).mockReturnValue({ ...profile(), session: null, profile: null });
    render(<LearnerAccountMenu />);
    expect(screen.queryByRole("button", { name: "내 계정" })).not.toBeInTheDocument();
  });

  it("reports a server rejection and lets the user retry without presenting a successful logout", async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: new Error("offline") } as never);
    open(); fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("로그아웃하지 못했습니다. 다시 시도해 주세요."));
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled();
    expect(screen.getByText("current@example.com")).toBeInTheDocument();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not submit a second logout while the first request is pending", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(supabase.auth.signOut).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    open(); const button = screen.getByRole("button", { name: "로그아웃" });
    fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByRole("button", { name: "로그아웃 중…" })).toBeDisabled();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    reject(new Error("offline"));
    await waitFor(() => expect(screen.getByRole("button", { name: "로그아웃" })).toBeEnabled());
  });
});
