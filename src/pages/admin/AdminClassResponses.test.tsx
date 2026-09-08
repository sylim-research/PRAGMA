import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import AdminClassResponses from "./AdminClassResponses";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

const mocks = vi.hoisted(() => ({
  outlines: vi.fn(),
  curriculum: vi.fn(),
  assignments: vi.fn(),
  cores: vi.fn(),
  from: vi.fn(),
  logRows: vi.fn(),
  missionRow: vi.fn(),
  releaseState: vi.fn(),
}));

vi.mock("@/lib/curriculum/api", () => ({
  listCurriculumOutlines: mocks.outlines,
  getCurriculumOutline: mocks.curriculum,
}));
vi.mock("@/lib/curriculum/composer", () => ({
  listCoreScenarios: mocks.cores,
  listWeekAssignments: mocks.assignments,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/mission/classResponseRelease", () => ({
  getAdminClassResponseRelease: mocks.releaseState,
  closeClassResponses: vi.fn(),
  reopenClassResponses: vi.fn(),
  releaseClassResponses: vi.fn(),
}));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children, title, description }: { children: React.ReactNode; title: string; description: string }) => <main><h1>{title}</h1><p>{description}</p>{children}</main>,
}));

const outline = {
  id: "course-a",
  title: "응답 보드 테스트",
  level: "intermediate",
  language_direction: "ko_zh",
  course_mode: "translation",
  target_interpreting_week_count: 0,
  status: "published",
};
const weeks = [{
  id: "week-2",
  outline_id: outline.id,
  week_no: 2,
  title: "요청",
  type: "regular",
  can_do: ["요청 표현을 판단한다"],
  speech_act: "request",
  review_released: false,
}];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.outlines.mockResolvedValue([outline]);
  mocks.curriculum.mockResolvedValue({ outline, weeks });
  mocks.assignments.mockResolvedValue([{ week_no: 2, scenario_id: "mission-1", position: 0 }]);
  mocks.cores.mockResolvedValue([{
    scenario_id: "mission-1",
    speech_act: "request", learner_level: "intermediate", direction: "ko_zh",
    mission_status: "reviewed",
    content_release_id: CURRENT_CONTENT_RELEASE_ID,
    mode: "translation",
    situation_ko: "거래처에 자료를 다시 요청하는 상황",
    target_feature: "request_mitigation_optionality",
  }]);
  mocks.logRows.mockResolvedValue({
    data: [
      {
        mission_id: "mission-1",
        profile_id: "private-learner-a",
        completed_at: "2026-08-30T10:00:00Z",
        context_judgment: {
          schema_version: "mpj_response_v2",
          responses: [{ item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" }],
          learner_dissent: null,
        },
      },
      {
        mission_id: "mission-1",
        profile_id: "private-learner-b",
        completed_at: "2026-08-30T10:05:00Z",
        context_judgment: {
          schema_version: "mpj_response_v2",
          responses: [{ item_id: 1, item_type: "scale4", scale_code: "very_inappropriate" }],
          learner_dissent: { reason_ko: "private dissent" },
        },
      },
    ],
    error: null,
  });
  mocks.missionRow.mockResolvedValue({ data: { mission_content: SAMPLE_MISSION_V5_NATIVE }, error: null });
  mocks.releaseState.mockResolvedValue({ status: "collecting", learnerCount: 0, closedAt: null, releasedAt: null, pattern: null });
  mocks.from.mockImplementation((table: string) => ({
    select: () => table === "learner_mission_logs"
      ? { eq: mocks.logRows }
      : { eq: () => ({ maybeSingle: mocks.missionRow }) },
  }));
});

afterEach(cleanup);

function mount(entry = "/admin/class-responses?courseId=course-a&weekNo=2&missionId=mission-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <AdminClassResponses />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function expectCounts(learners: number, dissents: number) {
  await waitFor(() => {
    expect(screen.getByText("집계 학습자").parentElement).toHaveTextContent(`${learners}명`);
    expect(screen.getByText("이견 제기").parentElement).toHaveTextContent(`${dissents}건`);
  });
}

describe("학급 응답 현황", () => {
  it("미션을 지정하지 않은 일반 진입은 예시를 보여 주고 크게 볼 수 있다", async () => {
    mount("/admin/class-responses?courseId=course-a&weekNo=2");
    await expectCounts(12, 2);
    expect(screen.getByRole("heading", { name: "학급 응답 현황" })).toBeVisible();
    expect(screen.getByText("저장된 미션 응답을 확인하고, 수업 토론에 활용할 수 있습니다.")).toBeVisible();
    expect(screen.getByText("DEMO · 예시 데이터")).toBeVisible();
    expect(screen.getByRole("button", { name: "예시 데이터 보기" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("combobox", { name: "응답 교과목" })).not.toBeInTheDocument();
    expect(mocks.releaseState).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "판단 4 · 이유 찾기" }));
    expect(screen.getByRole("region", { name: "판단 4 · 이유 찾기" })).toHaveTextContent("최초 적절성 판단");
    fireEvent.click(screen.getByRole("button", { name: "크게 보기" }));
    expect(screen.getByRole("dialog", { name: "학급 응답 크게 보기" })).toBeVisible();
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "판단 4 · 이유 찾기" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(dialog.getByRole("button", { name: "판단 5 · 여러 초안 비교" }));
    expect(dialog.getByRole("region", { name: "판단 5 · 여러 초안 비교" })).toHaveTextContent("BEST로 고른 초안");
    expect(dialog.getByText(/가장 많이 선택된 응답이 정답을 의미하지는 않습니다/)).toBeVisible();
    fireEvent.click(dialog.getByRole("button", { name: "닫기" }));
    expect(screen.getByRole("button", { name: "판단 5 · 여러 초안 비교" })).toHaveAttribute("aria-pressed", "true");
  });

  it("실제 데이터를 선택하면 완료 응답을 익명 집계한다", async () => {
    mount("/admin/class-responses?courseId=course-a&weekNo=2");
    await expectCounts(12, 2);
    fireEvent.click(screen.getByRole("button", { name: "판단 5 · 여러 초안 비교" }));
    fireEvent.click(screen.getByRole("button", { name: "실제 데이터" }));
    await expectCounts(2, 1);
    expect(screen.getByRole("combobox", { name: "응답 교과목" })).toHaveValue("course-a");
    expect(screen.getByRole("combobox", { name: "응답 주차" })).toHaveValue("2");
    expect(screen.getByRole("combobox", { name: "응답 미션" })).toHaveValue("mission-1");
    expect(screen.getByRole("button", { name: "판단 1 · 첫인상 판단" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/private-learner/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private dissent/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("응답 공개 단계")).toHaveTextContent("1 · 응답 수집");
    expect(screen.getByText(/응답이 충분하지 않아도 주차 수업자료로 수업을 진행할 수 있습니다/)).toBeVisible();
    expect(screen.getByRole("link", { name: "주차 운영으로 돌아가기 →" })).toHaveAttribute(
      "href",
      "/admin/package?courseId=course-a&weekNo=2#weekly-material-detail",
    );
  });

  it("주차 운영의 미션 링크로 들어오면 해당 미션의 실제 응답을 바로 표시한다", async () => {
    mount();
    await expectCounts(2, 1);
    expect(screen.getByRole("button", { name: "실제 데이터" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("DEMO · 예시 데이터")).not.toBeInTheDocument();
    expect(mocks.logRows).toHaveBeenCalledWith("mission_id", "mission-1");
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터 보기" }));
    await expectCounts(12, 2);
  });

  it("선택 미션의 실제 응답이 없으면 예시로 대체하지 않고 수행 기록 없음을 표시한다", async () => {
    mocks.logRows.mockResolvedValue({ data: [], error: null });
    mount();
    expect(await screen.findByText(/아직 이 주차 미션의 수행 기록이 없습니다/)).toBeVisible();
    expect(screen.queryByText("DEMO · 예시 데이터")).not.toBeInTheDocument();
  });
});

