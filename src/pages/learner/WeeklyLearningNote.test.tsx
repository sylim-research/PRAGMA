import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyLearningNote from "./WeeklyLearningNote";
import { buildWeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";
import type { LearnerCourse } from "@/lib/curriculum/learnerCourse";

const mocks = vi.hoisted(() => ({ course: vi.fn(), material: vi.fn() }));
vi.mock("@/lib/curriculum/useLearnerCourse", () => ({ useLearnerCourse: mocks.course }));
vi.mock("@/lib/pragma/contentReviewApi", () => ({ getApprovedWeeklyMaterial: mocks.material }));
vi.mock("@/components/learner/LearnerJourneyShell", () => ({ LearnerJourneyShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setupCourse(reviewReleased = false) {
  const course = {
    outline: { id: "course-a", title: "검증용 교과목", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 },
    weeks: [{ week_no: 5, title: "초대", type: "regular", speech_act: "agreement", can_do: ["저장된 주차 목표"], review_released: reviewReleased, scenarios: [] }],
  } as unknown as LearnerCourse;
  mocks.course.mockReturnValue({ isPending: false, error: null, data: course });
  return course;
}
function showNote() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/learner/course/course-a/week/5/note"]}><Routes>
      <Route path="/learner/course/:courseId/week/:weekNo/note" element={<WeeklyLearningNote />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>);
}

describe("단일 주차 강의 유인물", () => {
  it.each([false, true])("기존 review_released=%s와 무관하게 승인 스냅샷만 인쇄한다", async (reviewReleased) => {
    const course = setupCourse(reviewReleased);
    const material = buildWeeklyCourseMaterial(course.outline, course.weeks[0]);
    material.title = "승인된 유인물 제목";
    mocks.material.mockResolvedValue({ reviewId: "review-a", contentHash: "hash-a", material });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    showNote();

    expect(await screen.findByText("승인된 유인물 제목")).toBeVisible();
    expect(screen.getByText("저장된 주차 목표")).toBeVisible();
    expect(screen.getByText("참여 선택권과 약속 명료성")).toBeVisible();
    expect(screen.queryByText(/복습 자료|교수자 전용 메모|too_pressuring/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /주차로 돌아가기/ })).toHaveAttribute("href", "/learner/course/course-a/week/5");
    fireEvent.click(screen.getByRole("button", { name: "인쇄·PDF" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it.each(["unapproved", "unavailable"])("%s일 때 미리보기 내용이나 인쇄 버튼을 노출하지 않는다", async (state) => {
    setupCourse();
    if (state === "unapproved") mocks.material.mockResolvedValue(null);
    else mocks.material.mockRejectedValue(new Error("DB unavailable"));
    showNote();
    await screen.findByText(state === "unapproved" ? /교수자 최종 승인 후 공개됩니다/ : /승인된 수업자료를 확인하지 못했습니다/);
    expect(screen.queryByText("저장된 주차 목표")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "인쇄·PDF" })).not.toBeInTheDocument();
  });
});
