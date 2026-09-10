import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import type { LearnerCourse, LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import LearnerCourseLive from "./LearnerCourseLive";
import LearnerCourseWeekRoute from "./LearnerCourseWeek";

vi.mock("@/lib/curriculum/useLearnerCourse", () => ({ useLearnerCourse: vi.fn() }));

const courseId = "course-menu";
const missionWeek = {
  week_no: 2, type: "regular", title: "요청", speech_act: "request", can_do: ["상황에 맞게 요청하기"],
  expected_mission_modes: ["translation", "stt_interpreting"],
  scenarios: [
    { scenario_id: "written", assignment_id: "assignment-written", mode: "translation", runnable: true,
      situation_ko: "길게 설명한 장면", brief_note_ko: "이웃에게 택배 수령을 부탁하는 글 메시지" },
    { scenario_id: "spoken", assignment_id: "assignment-spoken", mode: "stt_interpreting", runnable: true,
      situation_ko: "학습자 통역사 C인 당신은 A와 B 사이를 통역합니다.", brief_note_ko: "병원 예약 변경 요청" },
  ],
} as LearnerCourseWeek;
const orientation = { ...missionWeek, week_no: 1, type: "orientation", title: "오리엔테이션", speech_act: null, can_do: [], scenarios: [], expected_mission_modes: [] } as LearnerCourseWeek;
const thanksWeek = { ...missionWeek, week_no: 3, speech_act: "thanks", title: "감사", can_do: ["도움과 관계에 맞게 감사하기"] } as LearnerCourseWeek;

function show(weeks = [orientation, missionWeek, thanksWeek], entry = `/learner/course/${courseId}`) {
  vi.mocked(useLearnerCourse).mockReturnValue({ data: {
    outline: { id: courseId, title: "한중 통번역", course_mode: "mixed", language_direction: "ko_zh", level: "intermediate" }, weeks,
  } as LearnerCourse, error: null, isPending: false } as ReturnType<typeof useLearnerCourse>);
  render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/learner/course/:courseId" element={<LearnerCourseLive />} />
      <Route path="/learner/course/:courseId/week/:weekNo" element={<LearnerCourseWeekRoute />} />
    </Routes>
  </MemoryRouter>);
}

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe("주차를 펼쳐 보는 강의계획서", () => {
  it("첫 학습 주차만 펼치고 짧은 제목의 두 미션에 수행 귀속값을 전달한다", () => {
    show();
    expect(screen.getByRole("heading", { name: "주차별 학습계획" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2주차 요청 화행" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("region")).toHaveLength(2); // 열린 주차 + 학습 미션 영역
    const panel = within(screen.getByRole("region", { name: "2주차 요청 화행" }));
    for (const [index, scenario] of missionWeek.scenarios.entries()) {
      const link = panel.getByRole("link", { name: ["번역 미션 시작: 이웃에게 택배 부탁", "통역 미션 시작: 병원 예약 변경 요청"][index] });
      const url = new URL(link.getAttribute("href")!, "https://example.test");
      expect(url.pathname).toBe(`/learner/practice/${scenario.scenario_id}`);
      expect(Object.fromEntries(url.searchParams)).toEqual({ courseId, weekNo: "2", assignmentId: scenario.assignment_id });
    }
    expect(panel.queryByRole("link", { name: /DCT|만 연습/ })).not.toBeInTheDocument();
    expect(panel.getAllByRole("link", { name: /미션 시작/ })).toHaveLength(2);
    expect(panel.queryByRole("heading", { name: "중심 질문" })).not.toBeInTheDocument();
    expect(panel.queryByText(/이 상황에서 요청의 뜻을/)).not.toBeInTheDocument();
    expect(panel.getByText(/같은 요청 화행을 서로 다른 상황에서 번역과 통역으로 연습합니다/)).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "이번 주 수업자료" })).toHaveAttribute("href", `/learner/course/${courseId}/week/2/note`);
    expect(screen.queryByText(missionWeek.scenarios[0].brief_note_ko!)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/2|시작 전|예정|학기 일정|수업 활동|통역사 C|중심 질문은 수업의 방향/)).not.toBeInTheDocument();
  });

  it("다른 주차를 열면 앞 주차를 닫고 교과목별로 마지막 선택을 기억한다", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "3주차 감사 화행" }));
    expect(screen.getByRole("button", { name: "2주차 요청 화행" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "2주차 요청 화행" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "3주차 감사 화행" })).toBeVisible();
    expect(screen.queryByText(/중심 질문|이 상황의 도움과 관계에 맞게 감사의 뜻을/)).not.toBeInTheDocument();
    cleanup();
    show();
    expect(screen.getByRole("button", { name: "3주차 감사 화행" })).toHaveAttribute("aria-expanded", "true");
    cleanup();
    show(undefined, "/learner/course/another-course");
    expect(screen.getByRole("button", { name: "2주차 요청 화행" })).toHaveAttribute("aria-expanded", "true");
  });

  it("모두 접은 선택도 유지하고 잘못된 URL 주차는 첫 학습 주차로 복구한다", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "2주차 요청 화행" }));
    expect(screen.queryByRole("link", { name: /미션 시작/ })).not.toBeInTheDocument();
    cleanup();
    show();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    cleanup();
    show(undefined, `/learner/course/${courseId}?week=99`);
    expect(screen.getByRole("button", { name: "2주차 요청 화행" })).toHaveAttribute("aria-expanded", "true");
  });

  it("편성 ID가 없거나 실행 불가능한 미션은 시작 링크를 만들지 않는다", () => {
    show([{ ...missionWeek, scenarios: [
      { ...missionWeek.scenarios[0], assignment_id: undefined },
      { ...missionWeek.scenarios[1], runnable: false },
    ] }]);
    expect(screen.queryByRole("link", { name: /미션 시작/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("미션 준비 중")).toHaveLength(2);
  });

  it("토론 주차는 안내만 펼치고 13주에는 선택 화행의 두 미션을 연결한다", () => {
    show([
      { ...orientation, week_no: 7, type: "regular", title: "중간 메타화용 클리닉" },
      { ...missionWeek, week_no: 13 },
      { ...orientation, week_no: 14, type: "regular", title: "종합 메타화용 클리닉" },
    ]);
    const link = screen.getByRole("link", { name: /번역 미션 시작/ });
    expect(new URL(link.getAttribute("href")!, "https://example.test").searchParams.get("weekNo")).toBe("13");
    fireEvent.click(screen.getByRole("button", { name: "7주차 중간 메타화용 토론" }));
    expect(screen.getByRole("region", { name: "7주차 중간 메타화용 토론" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /미션 시작/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이번 주 수업자료" })).toHaveAttribute("href", `/learner/course/${courseId}/week/7/note`);
    expect(screen.getByRole("button", { name: "14주차 종합 메타화용 토론" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/클리닉/)).not.toBeInTheDocument();
  });

  it("기존 주차 상세·미션 복귀 주소는 선택 주차가 열린 통합 화면으로 연결한다", () => {
    show([missionWeek, { ...missionWeek, week_no: 13 }], `/learner/course/${courseId}/week/13`);
    expect(screen.getByRole("button", { name: "13주차 요청 화행 · 새 상황에 적용하기" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "2주차 요청 화행" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "이번 주 수업자료" })).toHaveAttribute("href", `/learner/course/${courseId}/week/13/note`);
  });
});
