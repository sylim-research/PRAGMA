import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import AdminTeachingMaterials from "./AdminTeachingMaterials";
import { REFUSAL_TEACHING_CASE } from "@/lib/curriculum/refusalTeachingCase";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import { parseMissionCourseLocation } from "@/lib/mission/missionCourseContext";

const mocks = vi.hoisted(() => ({
  outlines: vi.fn(),
  curriculum: vi.fn(),
  cores: vi.fn(),
  assignments: vi.fn(),
  from: vi.fn(),
  missionRows: vi.fn(),
  operationLogs: vi.fn(),
  approvedWeekly: vi.fn(),
  scrollIntoView: vi.fn(),
}));
vi.mock("@/lib/curriculum/api", () => ({ listCurriculumOutlines: mocks.outlines, getCurriculumOutline: mocks.curriculum }));
vi.mock("@/lib/curriculum/composer", () => ({ listCoreScenarios: mocks.cores, listWeekAssignments: mocks.assignments }));
vi.mock("@/lib/curriculum/courseOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/curriculum/courseOperations")>();
  return { ...actual, fetchCourseOperationLogs: mocks.operationLogs };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/pragma/contentReviewApi", () => ({ contentReviewRequest: vi.fn().mockResolvedValue({ run: null,
  contentHash: "hash", sourceHash: "source", snapshot: { instructor_only: "PRIVATE_REVIEW_SENTINEL" }, history: [], dependencies: [], models: { openai: "test", claude: null },
}), getApprovedWeeklyMaterial: mocks.approvedWeekly }));

const outline = { id: "course-a", title: "주차 자료 테스트", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0, status: "published" };
const courseWeeks = [2, 3].map((week_no) => ({ id: `week-${week_no}`, outline_id: outline.id, week_no, title: `${week_no}주차 요청`, type: "regular", can_do: [`${week_no}주차 목표`], speech_act: "request", review_released: false }));
const guide = buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "요청");

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = mocks.scrollIntoView;
  mocks.outlines.mockResolvedValue([outline]);
  mocks.curriculum.mockResolvedValue({ outline, weeks: courseWeeks });
  mocks.assignments.mockResolvedValue([{ week_no: 2, scenario_id: "mission-1", position: 0 }]);
  mocks.cores.mockResolvedValue([{ scenario_id: "mission-1", speech_act: "request", learner_level: "intermediate", direction: "ko_zh", mission_status: "reviewed", mode: "translation", situation_ko: "테스트 실습 상황입니다.", target_feature: "request_mitigation_optionality", content_release_id: CURRENT_CONTENT_RELEASE_ID }]);
  mocks.operationLogs.mockResolvedValue([
    { mission_id: "mission-1", profile_id: "learner-1", mission_completed: true, completed_at: "2026-08-31T01:00:00Z", updated_at: "2026-08-31T01:00:00Z", context_judgment: null },
    { mission_id: "mission-1", profile_id: "learner-2", mission_completed: true, completed_at: "2026-08-31T02:00:00Z", updated_at: "2026-08-31T02:00:00Z", context_judgment: { learner_dissent: { reason_ko: "다르게 판단함" } } },
  ]);
  mocks.approvedWeekly.mockImplementation(async (_courseId: string, weekNo: number) => weekNo === 2
    ? { reviewId: "review-2", contentHash: "hash-2", material: {} }
    : null);
  mocks.from.mockReturnValue({ select: () => ({ in: mocks.missionRows }) });
  mocks.missionRows.mockResolvedValue({ data: [{ scenario_id: "mission-1", speech_act: "request", mission_status: "reviewed", mission_content: SAMPLE_MISSION_V5_NATIVE }], error: null });
});
afterEach(cleanup);

function mount(weekNo = 2) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/admin/package?courseId=course-a&weekNo=${weekNo}`]}><AdminTeachingMaterials /></MemoryRouter></QueryClientProvider>);
}

function mountAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><AdminTeachingMaterials /></MemoryRouter></QueryClientProvider>);
}

describe("교과목·주차 수업자료 연결", () => {
  it("수업자료 버튼은 선택 주차의 상세를 열고 같은 링크 재클릭에도 이동한다", async () => {
    mount();
    await screen.findByText("2주차 목표");
    expect(screen.queryByRole("region", { name: "주차 도입 수업" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "도입 수업 화면 열기" })).not.toBeInTheDocument();
    expect(screen.getByText("이 주차 수업자료 승인").closest("details")).not.toHaveAttribute("open");
    const week3Row = screen.getByRole("button", { name: "3주차 · 요청" }).closest("article")!;
    fireEvent.click(within(week3Row).getByRole("link", { name: "수업자료" }));
    await screen.findByText("3주차 목표");
    const detail = screen.getByText("이 주차 수업자료 승인").closest("details")!;
    await waitFor(() => expect(detail).toHaveAttribute("open"));
    await waitFor(() => expect(mocks.scrollIntoView).toHaveBeenCalled());
    expect(detail).toHaveFocus();

    fireEvent.click(screen.getByText("이 주차 수업자료 승인"));
    await waitFor(() => expect(detail).not.toHaveAttribute("open"));
    mocks.scrollIntoView.mockClear();
    fireEvent.click(within(week3Row).getByRole("link", { name: "수업자료" }));
    await waitFor(() => expect(detail).toHaveAttribute("open"));
    await waitFor(() => expect(mocks.scrollIntoView).toHaveBeenCalled());
  });

  it("외부 상세 링크도 비동기 자료 조회 후 열고 이동한다", async () => {
    mountAt("/admin/package?courseId=course-a&weekNo=2#weekly-material-detail");
    const summary = await screen.findByText("이 주차 수업자료 승인");
    await waitFor(() => expect(summary.closest("details")).toHaveAttribute("open"));
    await waitFor(() => expect(mocks.scrollIntoView).toHaveBeenCalled());
  });

  it("운영 목록과 두 미션의 실행 링크는 각각 실제 배정 ID를 포함한다", async () => {
    const courseId = "915fec24-cc38-4b00-a2a0-c3628abcd3f7";
    const ids = ["c2c5b885-7e39-4c85-a764-9252ed2e4f24", "ebc8c340-0a2a-4491-9708-55d6a27b5b12"];
    mocks.outlines.mockResolvedValue([{ ...outline, id: courseId }]);
    mocks.curriculum.mockResolvedValue({ outline: { ...outline, id: courseId }, weeks: courseWeeks });
    mocks.assignments.mockResolvedValue(ids.map((id, position) => ({ id, week_no: 2, scenario_id: `mission-${position + 1}`, position })));
    mocks.cores.mockResolvedValue(ids.map((_, position) => ({ scenario_id: `mission-${position + 1}`, speech_act: "request", learner_level: "intermediate", direction: "ko_zh", mission_status: "reviewed", mode: "translation", situation_ko: "테스트 상황입니다.", target_feature: "request_mitigation_optionality", content_release_id: CURRENT_CONTENT_RELEASE_ID })));
    mountAt(`/admin/package?courseId=${courseId}&weekNo=2`);
    const overviewLink = await screen.findByRole("link", { name: "미션" });
    const missionLinks = [overviewLink, screen.getByRole("link", { name: "미션 1 · 번역 열기 ↗" }), screen.getByRole("link", { name: "미션 2 · 번역 열기 ↗" })];
    missionLinks.forEach((link, index) => {
      const url = new URL(link.getAttribute("href")!, "https://pragma.test");
      expect(parseMissionCourseLocation(url.search)).toEqual({ ok: true, context: { courseId, weekNo: 2, assignmentId: ids[index === 2 ? 1 : 0] } });
    });
  });

  it("배정 ID가 없으면 불완전한 수행 주소 대신 해당 교과목 주차로 연결한다", async () => {
    mount();
    expect(await screen.findByRole("link", { name: "미션" })).toHaveAttribute("href", "/learner/course/course-a/week/2");
    expect(screen.getByRole("link", { name: "미션 1 · 번역 열기 ↗" })).toHaveAttribute("href", "/learner/course/course-a/week/2");
  });

  it("선택 거절 미션의 전체 상황과 사후 지도안을 분리하고 프로젝터에 답안을 내보내지 않는다", async () => {
    const example = REFUSAL_TEACHING_CASE;
    mocks.curriculum.mockResolvedValue({ outline, weeks: [{ ...courseWeeks[0], week_no: 6, title: "거절", speech_act: "refusal" }] });
    mocks.assignments.mockResolvedValue([{ week_no: 6, scenario_id: example.scenarioId, position: 0 }]);
    mocks.cores.mockResolvedValue([{ scenario_id: example.scenarioId, speech_act: "refusal", learner_level: "intermediate", direction: "ko_zh", mission_status: "reviewed", mode: "translation", content_release_id: CURRENT_CONTENT_RELEASE_ID,
      situation_ko: example.situationKo, source_text_ko: example.sourceText, target_feature: "refusal_softening" }]);
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.production_task.situation_ko = example.situationKo;
    mission.production_task.source_text = example.sourceText;
    mission.production_task.reference_alternatives[0].text = example.referenceText;
    mocks.missionRows.mockResolvedValue({ data: [{ scenario_id: example.scenarioId, speech_act: "refusal", mission_status: "reviewed", mission_content: mission }], error: null });
    mount(6);
    expect(await screen.findByText(example.situationKo)).toBeVisible();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.queryByText(example.title)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "교수자 전용 메모" }));
    const title = await screen.findByText(example.title);
    fireEvent.click(screen.getByText("미션 1 · 거절"));
    fireEvent.click(title);
    expect(screen.getByText(example.boundaries[0].text)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "프로젝터 화면" }));
    expect(screen.queryByText(example.title)).not.toBeInTheDocument();
    expect(screen.queryByText(example.referenceText)).not.toBeInTheDocument();
    expect(screen.queryByText(example.boundaries[0].text)).not.toBeInTheDocument();
    expect(screen.getByText(example.situationKo)).toBeInTheDocument();
  });

  it("공통 자료에는 해설을 조회하지 않고 교수자 메모에서만 조회한다", async () => {
    mount();
    await screen.findByText("2주차 목표");
    expect(mocks.from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "교수자 전용 메모" }));
    const notes = await screen.findByRole("region", { name: "교수자 전용 메모" });
    await waitFor(() => expect(notes.textContent).toContain(guide.dct.alternatives[0].text));
    expect(mocks.missionRows).toHaveBeenCalledWith("scenario_id", ["mission-1"]);
    fireEvent.click(screen.getByText("이 주차 수업자료 승인"));
    await screen.findByText(/PRIVATE_REVIEW_SENTINEL/);

    fireEvent.click(screen.getByRole("button", { name: "프로젝터 화면" }));
    const projector = screen.getByRole("dialog", { name: "주차 프로젝터" });
    expect(screen.queryByRole("region", { name: "교수자 전용 메모" })).not.toBeInTheDocument();
    expect(projector.textContent).not.toContain(guide.dct.alternatives[0].text);
    expect(projector.textContent).not.toContain("PRIVATE_REVIEW_SENTINEL");
    expect(screen.queryByRole("region", { name: "콘텐츠 5단계 검수" })).not.toBeInTheDocument();
    expect(within(projector).getByText("이번 주 학습목표")).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(projector).getByText("이번 주 학습목표")).not.toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "교수자 전용 메모" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("미편성 주차는 계획 미리보기로 열리고 이전 주차 메모를 가져오지 않는다", async () => {
    mount();
    await screen.findByText("2주차 목표");
    fireEvent.click(screen.getByRole("button", { name: "교수자 전용 메모" }));
    await waitFor(() => expect(mocks.missionRows).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("combobox", { name: "수업자료 주차" }), { target: { value: "3" } });
    await screen.findByText("3주차 목표");
    expect(screen.queryByRole("region", { name: "교수자 전용 메모" })).not.toBeInTheDocument();
    expect(screen.getByText("계획 미리보기 · 미션 0/2개 편성")).toBeInTheDocument();
    expect(mocks.missionRows).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "프로젝터 화면" })).toBeEnabled();
  });

  it("선택 없이 들어오면 첫 교과목·첫 주차를 기본으로 채워 보여 준다", async () => {
    mountAt("/admin/package");
    await screen.findByText("2주차 목표");
    expect(screen.getByRole("combobox", { name: "수업자료 교과목" })).toHaveValue("course-a");
    expect(screen.getByRole("combobox", { name: "수업자료 주차" })).toHaveValue("2");
    expect(screen.queryByText(/교과목과 주차를 선택해 주세요/)).not.toBeInTheDocument();
  });

  it("미션 단독 주소로 들어오면 교과목을 자동 선택하지 않는다", async () => {
    mountAt("/admin/package?mission=mission-1");
    expect(await screen.findByText(/미션 단독 주소로 들어왔습니다/)).toBeVisible();
    expect(screen.getByRole("combobox", { name: "수업자료 교과목" })).toHaveValue("");
  });

  it("선택 주차 상세 하단에 실시간 학급 응답 카드를 중복 표시하지 않는다", async () => {
    mount();
    await screen.findByText("2주차 목표");
    expect(screen.queryByRole("heading", { name: "실시간 학급 응답" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "응답 보드 열기 →" })).not.toBeInTheDocument();
  });

  it("15주 운영 현황에 확정 상태와 비채점 수행 집계를 표시한다", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "15주 운영 현황" })).toBeVisible();
    expect(await screen.findByText("자료 확정")).toBeVisible();
    expect(screen.getByText("참여 2명 · 완료 2명")).toBeVisible();
    expect(screen.getByText("이견 1건")).toBeVisible();
    expect(screen.getByRole("link", { name: "응답 분포" })).toHaveAttribute(
      "href",
      "/admin/class-responses?courseId=course-a&weekNo=2&missionId=mission-1",
    );
    expect(screen.getByText("확인 · 미션 2개 미배정")).toBeVisible();
  });
});
