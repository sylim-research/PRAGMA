import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceHealthPanel } from "./ServiceHealthPanel";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock("@/lib/admin/serviceHealthApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/serviceHealthApi")>();
  return { ...actual, runServiceHealthCheck: mocks.run };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

beforeEach(() => {
  mocks.run.mockReset();
  mocks.run.mockResolvedValue({
    checkedAt: "2026-09-07T12:04:00.000Z",
    statuses: [
      { id: "elevenlabs", tone: "ok", summary: "정상", detail: "잔량 9,558 / 10,000자 (95.6%) · free", latencyMs: 412 },
      { id: "openai", tone: "ok", summary: "정상", detail: "gpt-4o · gpt-4.1 · gpt-4o-transcribe", latencyMs: 331 },
      { id: "anthropic", tone: "fail", summary: "ANTHROPIC_API_KEY가 등록되지 않았습니다", detail: "claude-opus-5", latencyMs: null },
      { id: "supabase", tone: "ok", summary: "정상", detail: "로그인 세션이 있습니다" },
      { id: "app", tone: "ok", summary: "정상", detail: "이 화면이 열려 있습니다" },
    ],
  });
});

afterEach(cleanup);

describe("외부 서비스 연동 점검 패널", () => {
  it("진입 시에는 아무 호출도 하지 않고 다섯 줄 모두 미점검으로 둔다", () => {
    render(<ServiceHealthPanel />);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(screen.getByText(/시연·수업 전에 눌러 확인합니다/)).toBeVisible();
    expect(screen.queryByText(/마지막 점검/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "미점검" })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "지금 점검" })).toBeEnabled();
  });

  it("「지금 점검」을 누르면 한 번 점검하고 결과·잔량·마지막 점검 시각을 보여 준다", async () => {
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: "지금 점검" }));
    expect(screen.getByRole("button", { name: "점검 중…" })).toBeDisabled();

    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("잔량 9,558 / 10,000자 (95.6%) · free")).toBeVisible();
    expect(screen.getByText("ANTHROPIC_API_KEY가 등록되지 않았습니다")).toBeVisible();
    expect(screen.getAllByRole("img", { name: "정상" })).toHaveLength(4);
    expect(screen.getAllByRole("img", { name: "실패" })).toHaveLength(1);
    expect(screen.getByText(/마지막 점검 · 2026\. 9\. 7\./)).toBeVisible();
    expect(screen.getByRole("button", { name: "지금 점검" })).toBeEnabled();
  });

  it("잔액 안내는 행마다 반복하지 않고 목록 아래 한 줄로만 둔다", () => {
    render(<ServiceHealthPanel />);
    expect(screen.getByText(/선불 잔액은 콘솔의 자동 충전으로 관리합니다/)).toBeVisible();
    expect(screen.getByRole("link", { name: "OpenAI 콘솔" })).toHaveAttribute("href", expect.stringContaining("platform.openai.com"));
    expect(screen.getByRole("link", { name: "Anthropic 콘솔" })).toHaveAttribute("href", expect.stringContaining("platform.claude.com"));
    // 행에는 상태만 — 같은 안내를 되풀이하면 상태 목록이 사과문처럼 읽힌다.
    expect(screen.queryByText(/확인할 수 없습니다/)).not.toBeInTheDocument();
  });

  it("설정된 모델명을 각 줄에 보여 준다", async () => {
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: "지금 점검" }));
    expect(await screen.findByText("gpt-4o · gpt-4.1 · gpt-4o-transcribe")).toBeVisible();
    expect(screen.getByText("claude-opus-5")).toBeVisible();
  });

  it("점검이 실패해도 버튼은 다시 살아난다", async () => {
    mocks.run.mockRejectedValueOnce(new Error("boom"));
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: "지금 점검" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "지금 점검" })).toBeEnabled());
    expect(screen.getAllByText(/점검을 실행하지 못했습니다/)).toHaveLength(5);
    expect(screen.getAllByRole("img", { name: "실패" })).toHaveLength(5);
  });
});
