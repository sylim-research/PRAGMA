import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeeklyOpeningLesson } from "./WeeklyOpeningLesson";
import { buildWeeklyOpening } from "@/lib/curriculum/weeklyOpening";
import type { LearnerCourse, LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";

const outline = { id: "course", title: "중한 통역", level: "intermediate", language_direction: "zh_ko", domain: "work", course_mode: "interpreting", target_interpreting_week_count: 12 } as LearnerCourse["outline"];
const week: LearnerCourseWeek = { week_no: 2, title: "요청", type: "regular", can_do: ["주차 목표"], competency_focus: null, speech_act: "request", channel: "facetoface", pdr_power: "equal", pdr_distance: "formal", pdr_imposition: "low", review_released: false, domain: "work", scenarios: [] };
const opening = buildWeeklyOpening(outline, week);
afterEach(cleanup);

describe("교수자 도입 수업 화면", () => {
  it("첫 장면에서 단서와 해설을 DOM에 넣지 않고 교수자 동작으로만 공개한다", () => {
    render(<WeeklyOpeningLesson opening={opening} />);
    fireEvent.click(screen.getByRole("button", { name: "도입 수업 화면 열기" }));
    const room = screen.getByRole("dialog");
    expect(within(room).getByText(opening.source!.text)).toHaveAttribute("lang", "zh");
    expect(within(room).getByText(opening.rendering!.text)).toHaveAttribute("lang", "ko");
    expect(screen.queryByText(opening.clues[0].fact)).not.toBeInTheDocument();
    expect(screen.queryByText(opening.connections[1].choice)).not.toBeInTheDocument();
    fireEvent.keyDown(room, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: /아직 정보가 더 필요해요/ }));
    expect(screen.getByRole("button", { name: /아직 정보가 더 필요해요/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(room, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: /두 사람의 관계/ }));
    expect(screen.getByText(opening.clues[0].fact)).toBeInTheDocument();
    expect(screen.queryByText(opening.clues[1].fact)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /두 사람의 관계/ }));
    expect(screen.queryByText(opening.clues[0].fact)).not.toBeInTheDocument();
    fireEvent.keyDown(room, { key: "ArrowRight" });
    expect(screen.queryByText(opening.connections[1].choice)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /의견을 들은 뒤/ }));
    expect(screen.getByText(opening.connections[1].choice)).toBeInTheDocument();
  });
  it("자유 이동·처음부터·닫은 뒤 재진입 시 공개 상태를 초기화한다", () => {
    render(<WeeklyOpeningLesson opening={opening} />);
    fireEvent.click(screen.getByRole("button", { name: "도입 수업 화면 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "03 단서 더하기" }));
    fireEvent.click(screen.getByRole("button", { name: /두 사람의 관계/ }));
    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시 시작" }));
    fireEvent.click(screen.getByRole("button", { name: "03 단서 더하기" }));
    expect(screen.queryByText(opening.clues[0].fact)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수업 화면 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "도입 수업 화면 열기" }));
    expect(screen.getByRole("heading", { name: opening.question })).toBeInTheDocument();
  });
  it("주차 조건이 맞지 않으면 시작할 수 없다", () => {
    render(<WeeklyOpeningLesson opening={{ ...opening, status: "unavailable", notice: "주차 설정을 확인하세요." }} />);
    expect(screen.getByRole("button", { name: "도입 수업 화면 열기" })).toBeDisabled();
    expect(screen.getByText("주차 설정을 확인하세요.")).toBeInTheDocument();
  });
});
