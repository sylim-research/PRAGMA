import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { ClassResponsePanel } from "./ClassResponsePanel";
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
  opLogs: vi.fn(),
  courseCounts: vi.fn(),
}));

vi.mock("@/lib/curriculum/api", () => ({
  listCurriculumOutlines: mocks.outlines,
  getCurriculumOutline: mocks.curriculum,
}));
vi.mock("@/lib/curriculum/composer", () => ({
  listCoreScenarios: mocks.cores,
  listWeekAssignments: mocks.assignments,
}));
vi.mock("@/lib/curriculum/courseOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/curriculum/courseOperations")>()),
  fetchCourseOperationLogs: mocks.opLogs,
}));
vi.mock("@/lib/mission/classResponseFetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mission/classResponseFetch")>()),
  fetchCountedResponsesByCourse: mocks.courseCounts,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/mission/classResponseRelease", () => ({
  getAdminClassResponseRelease: mocks.releaseState,
  closeClassResponses: vi.fn(),
  reopenClassResponses: vi.fn(),
  releaseClassResponses: vi.fn(),
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
  mocks.opLogs.mockResolvedValue([
    { mission_id: "mission-1", profile_id: "p1", mission_completed: true, completed_at: "2026-08-30T10:00:00Z", updated_at: null, context_judgment: { learner_dissent: { reason_ko: "x" } } },
    { mission_id: "mission-1", profile_id: "p2", mission_completed: true, completed_at: "2026-08-30T10:05:00Z", updated_at: null, context_judgment: {} },
  ]);
  mocks.courseCounts.mockResolvedValue(new Map());
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
        profiles: { role: "learner", consent_class_record_sharing: true },
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
        profiles: { role: "learner", consent_class_record_sharing: true },
        completed_at: "2026-08-30T10:05:00Z",
        context_judgment: {
          schema_version: "mpj_response_v2",
          responses: [{ item_id: 1, item_type: "scale4", scale_code: "very_inappropriate" }],
          learner_dissent: { reason_ko: "private dissent" },
        },
      },
      // 동의 이전 테스트 계정과 관리자 계정은 학급 집계에서 빠져야 한다.
      ...[
        { profile_id: "legacy-test", profiles: { role: "learner", consent_class_record_sharing: null } },
        { profile_id: "admin-test", profiles: { role: "admin", consent_class_record_sharing: true } },
      ].map((row) => ({
        ...row,
        mission_id: "mission-1",
        completed_at: "2026-09-17T10:00:00Z",
        context_judgment: {
          schema_version: "mpj_response_v2",
          responses: [{ item_id: 1, item_type: "scale4", scale_code: "very_appropriate" }],
          learner_dissent: { reason_ko: "test dissent" },
        },
      })),
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

function mount(entry = "/admin/decision-traces?tab=class&courseId=course-a&weekNo=2&missionId=mission-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <ClassResponsePanel />
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

describe("학습 수행 기록 › 학급 응답 분포", () => {
  it("교과목만 골라 들어와도 첫 미션 주차의 실제 분포를 바로 보여 준다", async () => {
    mount("/admin/decision-traces?tab=class&courseId=course-a");
    await expectCounts(2, 1);
    expect(screen.getByRole("heading", { level: 2, name: /2주차 · 미션 1/ })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "응답 교과목" })).toHaveValue("course-a");
    expect(screen.getByRole("button", { name: "2주차 · 요청" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("참여 2명 · 완료 2명 · 이견 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "판단 1 · 첫인상 판단" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/private-learner/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private dissent/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("응답 공개 단계")).toHaveTextContent("1 · 응답 수집");
    expect(screen.getByText(/학습자에게 분포를 공개하려면 5명 이상의 응답이 필요합니다/)).toBeVisible();
    expect(screen.queryByText(/수업자료|DEMO|예시/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "학습 미션 열기 ↗" })).toHaveAttribute("href", "/learner/course/course-a/week/2");
    expect(mocks.logRows).toHaveBeenCalledWith("mission_id", "mission-1");
  });

  it("교과목을 지정하지 않으면 집계 대상 응답이 있는 교과목을 먼저 연다", async () => {
    mocks.outlines.mockResolvedValue([{ ...outline, id: "course-empty", title: "응답 없는 강좌" }, outline]);
    mocks.courseCounts.mockResolvedValue(new Map([["course-a", 2]]));
    mount("/admin/decision-traces?tab=class");
    await expectCounts(2, 1);
    expect(screen.getByRole("combobox", { name: "응답 교과목" })).toHaveValue("course-a");
  });

  it("크게 보기는 익명 학급 집계로 열고 닫을 수 있다", async () => {
    mount();
    await expectCounts(2, 1);
    fireEvent.click(screen.getByRole("button", { name: "크게 보기" }));
    const dialog = within(screen.getByRole("dialog", { name: "학급 응답 크게 보기" }));
    expect(dialog.getByText("익명 학급 집계")).toBeVisible();
    fireEvent.click(dialog.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("응답이 없으면 예시 숫자 없이 안내 한 줄만 보인다", async () => {
    mocks.logRows.mockResolvedValue({ data: [], error: null });
    mount();
    expect(await screen.findByText("아직 집계된 응답이 없습니다. 응답이 쌓이면 문항별 판단 분포를 확인할 수 있습니다.")).toBeVisible();
    expect(screen.queryByLabelText("학급 응답 대시보드")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("응답 공개 단계")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "응답 마감" })).not.toBeInTheDocument();
    expect(screen.queryByText(/DEMO|예시|12명/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "크게 보기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "응답 새로고침" })).toBeVisible();
  });
});
