import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminDecisionTraces from "./AdminDecisionTraces";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const log = (id: string, name: string, email: string, missionId: string, completed = true) => ({
  id,
  profile_id: `${id}-profile`,
  mission_id: missionId,
  speech_act: "request",
  task_type: "translation",
  mode: "학습",
  mission_completed: completed,
  updated_at: "2026-08-30T01:00:00Z",
  profiles: { full_name: name, email, anonymous_participant_id: null },
});

const LOGS = [
  log("1", "김학생", "kim@example.com", "00000000-0000-4000-8000-000000000001"),
  log("2", "이학생", "lee@example.com", "00000000-0000-4000-8000-000000000002", false),
];

/** select()를 그대로 await 하는 호출과 .order()로 잇는 호출을 모두 받는다. */
const result = <T,>(data: T) => {
  const promise = Promise.resolve({ data, error: null }) as Promise<{ data: T; error: null }> & {
    order: (...args: unknown[]) => typeof promise;
  };
  promise.order = () => promise;
  return promise;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation((table: string) => ({
    select: () => {
      if (table === "learner_mission_logs") return result(LOGS);
      if (table === "curriculum_outlines") return result([{ id: "course-a", title: "2026-2 통번역" }]);
      if (table === "scenarios") return { in: () => result([{ scenario_id: "00000000-0000-4000-8000-000000000001", core_content: { brief_note_ko: "교수님께 논문 개요 면담 요청 이메일을 작성한다" } }]) };
      return result([{ outline_id: "course-a", scenario_id: "00000000-0000-4000-8000-000000000001" }]);
    },
  }));
});
afterEach(cleanup);

const mountAt = (entry: string) =>
  render(<MemoryRouter initialEntries={[entry]}><AdminDecisionTraces /></MemoryRouter>);

describe("학습 수행 기록", () => {
  it("파라미터가 없으면 전체 기록을 보여 준다", async () => {
    mountAt("/admin/decision-traces");
    expect(await screen.findByText("총 2건")).toBeVisible();
    expect(within(screen.getByRole("table")).getByText("김학생")).toBeVisible();
    expect(within(screen.getByRole("table")).getByText("이학생")).toBeVisible();
  });

  it("표에는 코드값 대신 사람이 읽는 화행·과업·미션 이름을 보여 준다", async () => {
    mountAt("/admin/decision-traces");
    expect(await screen.findAllByText("논문 면담 요청")).not.toHaveLength(0);
    expect(screen.getAllByText("요청").length).toBeGreaterThan(0);
    expect(screen.getAllByText("번역").length).toBeGreaterThan(0);
    expect(screen.queryByText("request")).not.toBeInTheDocument();
    expect(screen.queryByText(/translation/)).not.toBeInTheDocument();
  });

  it("학습자 승인·관리에서 넘어온 ?q= 검색어로 목록이 좁혀진 채 열린다", async () => {
    mountAt("/admin/decision-traces?q=lee%40example.com");
    await waitFor(() => expect(screen.getByLabelText("학습자 필터")).toHaveValue("이학생"));
    expect(await screen.findByText("1건 표시 · 전체 2건")).toBeVisible();
    expect(within(screen.getByRole("table")).getByText("이학생")).toBeVisible();
    expect(within(screen.getByRole("table")).queryByText("김학생")).not.toBeInTheDocument();
  });

  it("조건에 맞는 기록이 없으면 안내를 보여 준다", async () => {
    mountAt("/admin/decision-traces?q=%EB%B0%95%ED%95%99%EC%83%9D");
    expect(await screen.findByText(/조건에 맞는 기록이 없습니다/)).toBeVisible();
  });
});
