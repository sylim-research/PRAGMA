import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceHealthPanel } from "./ServiceHealthPanel";
import { STALE_AFTER_MS } from "@/lib/admin/serviceHealthApi";

const STORE_KEY = "pragma.admin.serviceHealth.v1";
const storeAgeMs = (ms: number, statuses: unknown[]) =>
  localStorage.setItem(STORE_KEY, JSON.stringify({ checkedAt: new Date(Date.now() - ms).toISOString(), statuses, authenticated: true }));

const ALL_OK = (["elevenlabs", "openai", "anthropic", "supabase", "app"] as const).map((id) => ({
  id, tone: "ok" as const, summary: "정상",
}));

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock("@/lib/admin/serviceHealthApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/serviceHealthApi")>();
  return { ...actual, runServiceHealthCheck: mocks.run };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

beforeEach(() => {
  localStorage.clear();
  mocks.run.mockReset();
  mocks.run.mockResolvedValue({
    checkedAt: "2026-09-07T12:04:00.000Z",
    authenticated: true,
    statuses: [
      { id: "elevenlabs", tone: "ok", summary: "정상", detail: "잔량 9,558 / 10,000자 (95.6%) · free", latencyMs: 412 },
      { id: "openai", tone: "ok", summary: "정상", detail: "gpt-4o · gpt-4.1 · gpt-4o-transcribe", latencyMs: 331 },
      { id: "anthropic", tone: "fail", summary: "ANTHROPIC_API_KEY가 등록되지 않았습니다", detail: "claude-opus-5", latencyMs: null },
      { id: "supabase", tone: "ok", summary: "정상", detail: "로그인 세션이 있습니다" },
      { id: "app", tone: "ok", summary: "정상", detail: "이 화면이 열려 있습니다" },
    ],
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("외부 서비스 연동 점검 패널", () => {
  it("보관된 결과가 없으면 화면을 열 때 한 번 확인한다 — 빈 목록으로 두지 않는다", async () => {
    render(<ServiceHealthPanel />);
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/마지막 점검/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(screen.queryAllByRole("img", { name: "미점검" })).toHaveLength(0);
  });

  it("모두 정상이면 한 줄로 접어 두고 요약만 보여 준다", () => {
    storeAgeMs(60_000, ALL_OK);
    render(<ServiceHealthPanel />);
    expect(screen.getByText("5개 서비스 모두 정상")).toBeVisible();
    expect(screen.queryByTestId("service-openai")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /펼쳐 보기/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("summary-dot")).toHaveClass("bg-emerald-500");
  });

  it("점검하지 못한 항목이 있어도 확인된 문제가 없으면 초록으로 두고 어디를 볼지 적는다", () => {
    storeAgeMs(60_000, [
      ...ALL_OK.slice(0, 1),
      { id: "openai", tone: "manual", summary: "", link: { label: "OpenAI 콘솔에서 확인", href: "https://x" } },
      { id: "anthropic", tone: "manual", summary: "", link: { label: "Anthropic 콘솔에서 확인", href: "https://y" } },
      ...ALL_OK.slice(3),
    ]);
    render(<ServiceHealthPanel />);
    // 「모르는 것」이 「나쁜 것」이 되지 않는다 — 살아 있음을 초록으로 보여 준다.
    expect(screen.getByText("3개 정상 · OpenAI·Anthropic 직접 확인")).toBeVisible();
    expect(screen.getByTestId("summary-dot")).toHaveClass("bg-emerald-500");
  });

  it("확인된 문제가 있으면 접혀 있어도 색과 이름으로 드러난다", () => {
    storeAgeMs(60_000, [
      { id: "elevenlabs", tone: "warn", summary: "잔량 20% 이하" },
      { id: "openai", tone: "fail", summary: "OPENAI_API_KEY가 등록되지 않았습니다" },
      ...ALL_OK.slice(2),
    ]);
    render(<ServiceHealthPanel />);
    expect(screen.getByText("실패 1건 · OpenAI")).toBeVisible();
    expect(screen.getByTestId("summary-dot")).toHaveClass("bg-rose-500");
    // 기본은 접힘 — 첫 화면의 주인공은 아래 콘텐츠 수치다.
    expect(screen.queryByTestId("service-openai")).not.toBeInTheDocument();
  });

  it("접힌 상태에서 눌러서 펼치고 다시 접을 수 있다", () => {
    storeAgeMs(60_000, ALL_OK);
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(screen.getByTestId("service-openai")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /접기/ }));
    expect(screen.queryByTestId("service-openai")).not.toBeInTheDocument();
  });

  it("최근 결과가 보관돼 있으면 그것을 먼저 보여 주고 다시 부르지 않는다", () => {
    storeAgeMs(60_000, [{ id: "elevenlabs", tone: "warn", summary: "잔량 50% 이하", detail: "잔량 9,008 / 10,000자 (90.1%)" }]);
    render(<ServiceHealthPanel />);
    expect(mocks.run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(screen.getByText("잔량 9,008 / 10,000자 (90.1%)")).toBeVisible();
    expect(screen.getByText(/마지막 점검/)).toBeVisible();
  });

  it("보관된 결과가 오래됐으면 조용히 다시 확인한다", async () => {
    storeAgeMs(STALE_AFTER_MS + 60_000, [{ id: "elevenlabs", tone: "warn", summary: "옛 상태", detail: "옛 결과" }]);
    render(<ServiceHealthPanel />);
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(await screen.findByText(/잔량 9,558/)).toBeVisible();
  });

  it("점검 결과를 보관해 다음에 열 때 쓴다", async () => {
    render(<ServiceHealthPanel />);
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(STORE_KEY)).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(STORE_KEY)!).statuses).toHaveLength(5);
  });

  it("「지금 점검」을 누르면 한 번 점검하고 결과·잔량·마지막 점검 시각을 보여 준다", async () => {
    storeAgeMs(60_000, [{ id: "elevenlabs", tone: "warn", summary: "옛 상태" }]);
    render(<ServiceHealthPanel />);
    expect(mocks.run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "지금 점검" }));
    expect(screen.getByRole("button", { name: "점검 중…" })).toBeDisabled();

    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(await screen.findByText("잔량 9,558 / 10,000자 (95.6%) · free")).toBeVisible();
    expect(screen.getByText("ANTHROPIC_API_KEY가 등록되지 않았습니다")).toBeVisible();
    expect(screen.getAllByRole("img", { name: "정상" })).toHaveLength(4);
    expect(screen.getAllByRole("img", { name: "실패" })).toHaveLength(1);
    expect(screen.getByText(/마지막 점검 · 2026\. 9\. 7\./)).toBeVisible();
    expect(screen.getByRole("button", { name: "지금 점검" })).toBeEnabled();
  });

  it("잔액 안내는 행마다 반복하지 않고 목록 아래 한 줄로만 둔다", async () => {
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    await screen.findByTestId("service-openai");
    expect(screen.getByText(/선불 잔액은 콘솔의 자동 충전으로 관리합니다/)).toBeVisible();
    expect(screen.getByRole("link", { name: "OpenAI 콘솔" })).toHaveAttribute("href", expect.stringContaining("platform.openai.com"));
    expect(screen.getByRole("link", { name: "Anthropic 콘솔" })).toHaveAttribute("href", expect.stringContaining("platform.claude.com"));
    // 행에는 상태만 — 같은 안내를 되풀이하면 상태 목록이 사과문처럼 읽힌다.
    expect(screen.queryByText(/확인할 수 없습니다/)).not.toBeInTheDocument();
  });

  it("점검 경로가 없을 때는 빨간불 대신 회색 「직접 확인」과 콘솔 링크를 보여 준다", async () => {
    mocks.run.mockResolvedValueOnce({
      checkedAt: "2026-09-07T12:04:00.000Z",
      authenticated: true,
      statuses: [
        { id: "elevenlabs", tone: "ok", summary: "정상" },
        { id: "openai", tone: "manual", summary: "", link: { label: "OpenAI 콘솔에서 확인", href: "https://platform.openai.com/x" } },
        { id: "anthropic", tone: "manual", summary: "", link: { label: "Anthropic 콘솔에서 확인", href: "https://platform.claude.com/x" } },
        { id: "supabase", tone: "ok", summary: "정상" },
        { id: "app", tone: "ok", summary: "정상" },
      ],
    });
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(await screen.findAllByRole("img", { name: "직접 확인" })).toHaveLength(2);
    expect(screen.queryByRole("img", { name: "실패" })).not.toBeInTheDocument();
    expect(screen.queryByText(/자동 점검을 쓸 수 없습니다/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OpenAI 콘솔에서 확인/ })).toHaveAttribute("href", "https://platform.openai.com/x");
  });

  it("설정된 모델명을 각 줄에 보여 준다", async () => {
    render(<ServiceHealthPanel />);
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(await screen.findByText("gpt-4o · gpt-4.1 · gpt-4o-transcribe")).toBeVisible();
    expect(screen.getByText("claude-opus-5")).toBeVisible();
  });

  it("점검이 실패해도 버튼은 다시 살아난다", async () => {
    mocks.run.mockRejectedValueOnce(new Error("boom"));
    render(<ServiceHealthPanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: "지금 점검" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /펼쳐 보기/ }));
    expect(screen.getAllByText(/점검을 실행하지 못했습니다/)).toHaveLength(5);
    expect(screen.getAllByRole("img", { name: "실패" })).toHaveLength(5);
  });
});
