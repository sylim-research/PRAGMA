import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurriculumSyllabus } from "@/components/admin/CurriculumSyllabus";
import type { ComposerCore } from "@/lib/curriculum/composer";
import type { AssignMap } from "@/lib/curriculum/composerPlanning";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import type { CurriculumSyllabusSettings } from "@/lib/curriculum/syllabusSettings";
import { createStandard15WeekTemplate } from "@/lib/curriculum/template";

const outline = {
  id: "outline-1",
  title: "화행 기반 한중 번역",
  semester_goal: "맥락에 맞는 화행 번역을 수행한다.",
  level: "intermediate",
  language_direction: "ko_zh",
  course_mode: "translation",
  week_count: 15,
  scenarios_per_week: 2,
  domain: "daily",
  target_speech_acts: ["request"],
} as CurriculumOutlineRow;

const weeks = [
  {
    id: "week-1",
    week_no: 2,
    type: "regular",
    title: "요청",
    speech_act: "request",
    can_do: ["관계와 부담에 맞는 요청을 번역할 수 있다."],
  },
] as CurriculumWeekRow[];

const assignments: AssignMap = {
  2: [
    { scenario_id: "scenario-a", slot_role: "A" },
    { scenario_id: "scenario-b", slot_role: "B" },
  ],
};

const coreById = {
  "scenario-a": { scenario_id: "scenario-a", mode: "translation", situation_ko: "교수자에게 기한 연장을 요청한다." },
  "scenario-b": { scenario_id: "scenario-b", mode: "translation", situation_ko: "친구에게 도움을 요청한다." },
} as unknown as Record<string, ComposerCore>;

const settings: CurriculumSyllabusSettings = {
  instructorName: "홍길동",
  scheduleLocation: "화 3–4교시 · 101호",
  attendanceAssignmentPolicy: "배정 미션은 해당 주차 안에 완료한다.",
  materials: "PRAGMA 승인 미션과 학생 활동지",
  evaluationWeights: { mpj: 30, dct: 40, completion: 20, participation: 10 },
};

describe("CurriculumSyllabus", () => {
  it("두 글자 화행·유연한 중심 질문과 선택 화행 보완을 저장된 과거 제목보다 우선 표시한다", () => {
    const plan = createStandard15WeekTemplate().map((week) => ({ ...week, id: `week-${week.week_no}` })) as CurriculumWeekRow[];
    plan[4].title = "초대 · 공동행동 권유";
    plan[12].title = "고부담 맥락 집중 실전";
    plan[12].speech_act = "request";
    render(<CurriculumSyllabus outline={outline} weeks={plan} assignments={{}} coreById={{}} />);
    const table = screen.getByRole("columnheader", { name: "화행·활동" }).closest("table")!;
    const rows = within(table).getAllByRole("row");
    for (const weekNo of [2, 3, 4, 5, 6, 9, 10, 11, 12]) {
      expect(within(rows[weekNo]).getAllByRole("cell")[1].textContent).toHaveLength(2);
    }
    expect(within(rows[13]).getByText("선택 화행 집중 보완")).toBeInTheDocument();
    expect(within(rows[13]).getByText("요청")).toBeInTheDocument();
    expect(screen.getByText(/구체화하거나 바꿔 사용할 수 있습니다/)).toBeInTheDocument();
    expect(screen.queryByText("고부담 맥락 집중 실전")).not.toBeInTheDocument();
    expect(plan[12].title).toBe("고부담 맥락 집중 실전");
  });

  it("projects the current course and both weekly mission sets without inventing policy", () => {
    render(
      <CurriculumSyllabus
        outline={outline}
        weeks={weeks}
        assignments={assignments}
        coreById={coreById}
        settings={settings}
      />,
    );

    expect(screen.getByRole("heading", { name: outline.title })).toBeInTheDocument();
    expect(screen.getByText(/교수자에게 기한 연장을 요청한다/)).toBeInTheDocument();
    expect(screen.getByText(/친구에게 도움을 요청한다/)).toBeInTheDocument();
    expect(screen.getByText("번역 2개 · 각 미션의 판단 → 산출 → 피드백·수정")).toBeInTheDocument();
    expect(screen.getByText("배정 미션 완료 · 주차 학습노트 정리")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "학습목표–평가 근거 대응" })).toBeInTheDocument();
    expect(screen.getByText("최초 산출, 최소 피드백 반영, 수정본")).toBeInTheDocument();
    expect(screen.getByText("배정 미션은 해당 주차 안에 완료한다.")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("통번역형 계획은 과거 9/3 주수 대신 같은 화행의 번역·통역 미션을 표시한다", () => {
    render(<CurriculumSyllabus outline={{ ...outline, course_mode: "mixed", target_interpreting_week_count: 3 }}
      weeks={weeks} assignments={assignments}
      coreById={{ ...coreById, "scenario-b": { ...coreById["scenario-b"], mode: "stt_interpreting" } }} />);
    expect(screen.getByText("번역 1개 · 통역 1개 · 각 미션의 판단 → 산출 → 피드백·수정")).toBeInTheDocument();
    expect(screen.queryByText(/번역 9주|통역 3주/)).not.toBeInTheDocument();
  });
});
