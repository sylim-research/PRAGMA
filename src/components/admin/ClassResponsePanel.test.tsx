import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { REPRESENTATIVE_MISSION_SNAPSHOT } from "@/lib/demo/representativeMissionSnapshot";
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
    expect(screen.getByText("이견 제시").parentElement).toHaveTextContent(`${dissents}건`);
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
    expect(screen.getByRole("button", { name: "MJT 1 · 단일 표현 판단" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/private-learner/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private dissent/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("응답 공개 단계")).toHaveTextContent("1 · 응답 수집");
    expect(screen.getByText(/학습자에게 분포를 공개하려면 5명 이상의 응답이 필요합니다/)).toBeVisible();
    expect(screen.queryByText(/수업자료|데모|가상 학급/)).not.toBeInTheDocument();
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
    expect(screen.queryByLabelText("학급 응답 토론 보드")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("응답 공개 단계")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "응답 마감" })).not.toBeInTheDocument();
    expect(screen.queryByText(/데모|가상 학급|12명/)).not.toBeInTheDocument();
    // v6 이전 미션은 가상 학급을 만들 수 없어 데모 입구도 없다.
    expect(screen.queryByRole("button", { name: "데모로 살펴보기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "크게 보기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "응답 새로고침" })).toBeVisible();
  });

  it("v6 미션에 응답이 없으면 「데모로 살펴보기」로 가상 학급 20명을 열고, 실제 응답으로 되돌릴 수 있다", async () => {
    mocks.logRows.mockResolvedValue({ data: [], error: null });
    mocks.missionRow.mockResolvedValue({ data: { mission_content: REPRESENTATIVE_MISSION_SNAPSHOT.mission_content }, error: null });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "데모로 살펴보기" }));
    expect(await screen.findByText("데모 · 가상 학급 20명 · 실제 학습자 자료 아님")).toBeVisible();
    expect(screen.getByRole("radio", { name: "데모 응답" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("집계 학습자").parentElement).toHaveTextContent("20명");
    // 학습자 제시 순서(1 → 2 → 5 → 3 → 4)로 다섯 문항이 늘어선다.
    const cards = within(screen.getByLabelText("MJT 판단 문항")).getAllByRole("button");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "MJT 1 · 단일 표현 판단", "MJT 2 · 판단과 이유", "MJT 5 · 복수 표현 비교", "MJT 3 · 수정안 선택", "MJT 4 · 직접 수정",
    ]);
    // 데모에서는 마감·공개 운영 단계가 없다.
    expect(screen.queryByLabelText("응답 공개 단계")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "응답 마감" })).not.toBeInTheDocument();
    // MJT2 교차표
    fireEvent.click(cards[1]);
    expect(screen.getByText("판단 × 선택 이유")).toBeVisible();
    // DCT형 통번역 과제 — 수정 여부와 이견 여부를 따로 세고, 사례 비교에서만 이견 사유가 보인다.
    const dct = within(screen.getByLabelText("DCT형 통번역 과제"));
    const decisionLegend = dct.getByText("초안 유지").closest("ul")!;
    expect(decisionLegend).toHaveTextContent("초안 유지10");
    expect(decisionLegend).toHaveTextContent("수정10");
    expect(screen.queryByText(/이웃이라/)).not.toBeInTheDocument();
    fireEvent.click(dct.getByRole("button", { name: "이견 사례 열기" }));
    expect(dct.getByRole("tab", { name: "사례 비교" })).toHaveAttribute("aria-selected", "true");
    expect(dct.getAllByRole("article")).toHaveLength(2);
    expect(dct.getByText(/이웃이라/)).toBeVisible();
    expect(screen.queryByText(/virtual-/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "실제 응답" }));
    expect(await screen.findByText("아직 집계된 응답이 없습니다. 응답이 쌓이면 문항별 판단 분포를 확인할 수 있습니다.")).toBeVisible();
    expect(screen.queryByText("데모 · 가상 학급 20명 · 실제 학습자 자료 아님")).not.toBeInTheDocument();
  });
});
