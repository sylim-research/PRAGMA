import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurriculumOutlineRow } from "@/lib/curriculum/types";
import { useLearnerCourses } from "@/lib/curriculum/useLearnerCourse";
import { COURSE_PRESETS, courseDisplayTitle } from "@/lib/pragma/scenarioTopics";
import LearnerCourseList from "@/pages/learner/LearnerCourseList";

vi.mock("@/lib/curriculum/useLearnerCourse", () => ({ useLearnerCourses: vi.fn() }));

const courses = COURSE_PRESETS.map((preset) => ({
  id: preset.outline_id,
  title: preset.label,
  level: preset.target_level,
  language_direction: preset.language_direction,
  domain: preset.primary_domain,
  course_mode: preset.course_mode,
  target_interpreting_week_count: preset.target_interpreting_week_count,
  composition_theme_codes: preset.included_themes,
  target_speech_acts: ["request", "thanks", "compliment"],
})) as CurriculumOutlineRow[];

function mockCourses(data: CurriculumOutlineRow[], error: Error | null = null, isPending = false) {
  vi.mocked(useLearnerCourses).mockReturnValue({
    data, error, isPending,
  } as ReturnType<typeof useLearnerCourses>);
}

function renderCourses() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LearnerCourseList />
    </MemoryRouter>,
  );
}

beforeEach(() => mockCourses(courses));
afterEach(() => cleanup());

describe("LearnerCourseList", () => {
  it("orders courses by level and shows the information needed to choose a course", () => {
    const originalOrder = courses.map((course) => course.id);
    renderCourses();

    expect(screen.getByRole("heading", { level: 1, name: "교과목 선택" })).toBeInTheDocument();
    const list = within(screen.getByRole("list", { name: "교과목 목록" }));
    expect(list.getAllByRole("listitem")).toHaveLength(3);
    expect(list.getAllByText("중급")).toHaveLength(2);
    expect(list.getByText("고급")).toBeInTheDocument();
    expect(list.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual([courses[0].title, courses[2].title, courses[1].title]);
    expect(courses.map((course) => course.id)).toEqual(originalOrder);
    expect(list.getAllByText("한국어 → 중국어")).toHaveLength(2);
    expect(list.getByText("중국어 → 한국어")).toBeInTheDocument();
    expect(list.queryByText("영역")).not.toBeInTheDocument();
    expect(list.getAllByText("|")).toHaveLength(3);
    expect(list.getAllByText("통번역", { exact: true })).toHaveLength(3);
    expect(list.queryByText(/번역 \d+주|통역 \d+주/)).not.toBeInTheDocument();
    expect(list.getByText("대학생활, 유학·교류, 대인관계, 일상생활")).toBeInTheDocument();
    expect(list.getByText("콘텐츠·SNS, 취업·직장, 거래·고객응대, 대학생활 등")).toBeInTheDocument();
    expect(list.getByText("취업·직장, 거래·고객응대, 콘텐츠·SNS")).toBeInTheDocument();
    expect(list.getAllByText("주제")).toHaveLength(3);
    expect(list.queryByText(/개발 가성비|개 화행|%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/실제 학습 12주|교과목을 선택해|내 교과목/)).not.toBeInTheDocument();
  });

  it("uses the saved course type and themes without displaying legacy week counts", () => {
    mockCourses([{
      ...courses[0],
      target_interpreting_week_count: 2,
      composition_theme_codes: ["daily_living"],
    }]);
    renderCourses();

    const card = within(screen.getByRole("link", { name: courses[0].title }));
    expect(card.getByText("통번역", { exact: true })).toBeInTheDocument();
    expect(card.getByText("일상생활")).toBeInTheDocument();
    expect(card.queryByText(/유학·교류| 등$/)).not.toBeInTheDocument();
  });

  it("prioritizes selected topics without changing the stored selection", () => {
    const selectedThemes = ["daily_living", "relationship_social", "international_exchange", "campus_study"];
    mockCourses([{ ...courses[0], composition_theme_codes: selectedThemes }]);
    renderCourses();

    expect(screen.getByText("대학생활, 유학·교류, 대인관계, 일상생활")).toBeInTheDocument();
    expect(selectedThemes).toEqual(["daily_living", "relationship_social", "international_exchange", "campus_study"]);
  });

  it("normalizes previous standard titles but preserves custom names and source data", () => {
    const legacyCourses = courses.map((course) => ({
      ...course,
      title: `${course.title.replace(/^AI /, "AI 기반 ")}${course.language_direction === "ko_zh" ? " 실습" : ""}`,
    }));
    mockCourses(legacyCourses);
    renderCourses();

    for (const course of courses) {
      expect(screen.getByRole("link", { name: course.title })).toBeInTheDocument();
    }
    expect(legacyCourses.every((course) => course.title.startsWith("AI 기반 "))).toBe(true);
    expect(courseDisplayTitle({ ...courses[0], title: "교수자 지정 과목명" })).toBe("교수자 지정 과목명");
    expect(courseDisplayTitle({ id: "custom", title: legacyCourses[0].title })).toBe(legacyCourses[0].title);
  });

  it("links each full-title card to its existing weekly plan", () => {
    renderCourses();

    const list = within(screen.getByRole("list", { name: "교과목 목록" }));
    expect(list.getAllByText("주차별 학습계획 보기")).toHaveLength(3);
    for (const course of courses) {
      const link = list.getByRole("link", { name: course.title });
      expect(link).toHaveAttribute("href", `/learner/course/${course.id}`);
      expect(link).toHaveAccessibleDescription(/^수준: (중급|고급) 언어방향/);
      const title = within(link).getByRole("heading", { level: 2, name: course.title });
      expect(title).toHaveClass("sm:whitespace-nowrap", "break-keep");
      expect(title).not.toHaveClass("truncate");
    }
  });

  it.each([
    { state: "loading", pending: true, error: null, message: "교과목을 불러오는 중…" },
    { state: "empty", pending: false, error: null, message: "아직 게시된 교과목이 없습니다." },
    { state: "error", pending: false, error: new Error("교과목 조회 실패"), message: "교과목 조회 실패" },
  ])("preserves the $state state without inventing course cards", ({ pending, error, message }) => {
    mockCourses([], error, pending);
    renderCourses();

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "교과목 목록" })).not.toBeInTheDocument();
  });
});
