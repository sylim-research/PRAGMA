import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import AdminBrowser from "./AdminBrowser";

const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], ranges: [] as number[], failPage: false, preview: vi.fn() }));
vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ title, children }) => <><h1>{title}</h1>{children}</> }));
vi.mock("@/components/admin/MissionPreview", () => ({ MissionPreview: () => <p>검증용 미션 본문</p> }));
vi.mock("@/lib/mission/missionDb", () => ({ fetchMissionForReview: mocks.preview }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let from = 0, to = 499;
  const builder = {
    select: () => builder, eq: () => builder, is: () => builder, not: () => builder, order: () => builder, abortSignal: () => builder,
    range: (start: number, end: number) => { from = start; to = end; return builder; },
    then: (resolve) => {
      if (table === "scenarios") mocks.ranges.push(from);
      return Promise.resolve(table === "scenarios"
        ? mocks.failPage && from > 0 ? { data: null, error: { message: "후속 페이지 실패" } }
          : { data: mocks.rows.slice(from, to + 1), error: null }
        : { data: [{ scenario_id: "released" }], error: null }).then(resolve);
    },
  };
  return builder;
} } }));

const row = (id: string, status: string | null, release: string = CURRENT_CONTENT_RELEASE_ID, count = 5) => ({
  scenario_id: id, mission_status: status, speech_act: "request", learner_level: "intermediate",
  mode: "translation", domain: "daily", theme_code: null, mission_schema_version: status ? "mission_v5" : null,
  mission_mpj_items: status ? Array.from({ length: count }, () => ({})) : null,
  supersedes_scenario_id: null,
  authoring_stage: status === "reviewed" || status === "released" ? "professor_finalized" : null,
  core_content: { situation_ko: `상황 ${id}`, direction: "ko_zh", generation: { content_release_id: release } },
});
beforeEach(() => {
  mocks.rows = [row("reviewed", "reviewed"), row("released", "released"), { ...row("draft", "generated"), mission_schema_version: "mission_v6" },
    row("old", "reviewed", "pre_lock"), row("legacy-four", "reviewed", CURRENT_CONTENT_RELEASE_ID, 4), row("core", null)];
  mocks.ranges = []; mocks.failPage = false; mocks.preview.mockReset();
  mocks.preview.mockResolvedValue({ mission: {} });
});
afterEach(cleanup);
const show = () => render(<MemoryRouter><AdminBrowser /></MemoryRouter>);

describe("학습 미션 라이브러리", () => {
  it("현재 편성 범위의 reviewed와 released MJT5만 기본 표시하고 미션 ID를 인계한다", async () => {
    show();
    await screen.findByText("상황 released");
    expect(screen.getByText("상황 reviewed")).toBeInTheDocument();
    for (const id of ["draft", "old", "legacy-four", "core"]) expect(screen.queryByText(`상황 ${id}`)).not.toBeInTheDocument();
    const item = screen.getByText("상황 released").closest("li")!;
    expect(within(item).getByText("1곳 편성")).toBeInTheDocument();
    // 한 줄 표에서는 작업 화면 이동 버튼을 두지 않는다(편성·승인은 각 화면에서 한다).
    expect(within(item).queryByRole("link")).toBeNull();
    // Let the post-load effect that collapses previews settle first; otherwise it can run after the click and close it.
    await act(async () => {});
    fireEvent.click(within(item).getByRole("button"));
    await screen.findByText("검증용 미션 본문");
    // v6 저장본도 읽어야 상세가 열린다(2026-09-20).
    expect(mocks.preview).toHaveBeenCalledWith("released", { includeV6: true });
  });

  it("승인 전·과거 미션·재료를 분리하고 빈 셀은 생성기로 보내지 않는다", async () => {
    show(); await screen.findByText("상황 released");
    fireEvent.click(screen.getByRole("button", { name: /승인 전 미션/ }));
    expect(screen.getByText("상황 draft")).toBeInTheDocument();
    expect(screen.queryByText("상황 old")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /전체 미션/ }));
    expect(screen.getByText("상황 old")).toBeInTheDocument();
    expect(screen.queryByText("상황 core")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /미션 생성 전 시나리오/ }));
    expect(screen.getByText("상황 core")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /거절 · 중급 시나리오 0개 보기/ }));
    expect(screen.getByRole("status")).toHaveTextContent("이 조건의 시나리오가 없습니다");
  });

  it("1,000건 뒤에 있는 편성 가능 미션도 조회와 집계에 포함한다", async () => {
    mocks.rows = [...Array.from({ length: 1001 }, (_, i) => row(`material-${i}`, null)), row("oldest", "reviewed")];
    show(); await screen.findByText("상황 oldest");
    expect(mocks.ranges).toEqual([0, 500, 1000]);
    expect(screen.getByRole("button", { name: "편성 가능 미션 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("뒷페이지 조회가 실패하면 부분 건수를 전체인 것처럼 표시하지 않는다", async () => {
    mocks.rows = Array.from({ length: 501 }, (_, i) => row(`mission-${i}`, "reviewed"));
    mocks.failPage = true;
    show(); await screen.findByText(/후속 페이지 실패/);
    expect(screen.getByRole("button", { name: "편성 가능 미션 —" })).toBeInTheDocument();
    expect(screen.queryByText("상황 mission-0")).not.toBeInTheDocument();
    mocks.failPage = false;
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "편성 가능 미션 501" })).toBeInTheDocument());
  });
});
