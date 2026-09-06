import type { LearnerCourse, LearnerCourseWeek } from "./learnerCourse";
import { buildWeeklyLearnerNote } from "./learnerNote";
import { expectedCoreModeForWeek, type CourseMode } from "./courseModePolicy";
import { LEVEL } from "@/lib/pragma/enums";
import { courseDisplayTitle } from "@/lib/pragma/scenarioTopics";
import { weekRole } from "./template";
import { CENTRAL_QUESTION_GUIDANCE, isReinforcementWeek, REINFORCEMENT_DESCRIPTION, weekActivityLabel, weekCentralQuestion } from "./weekGuidance";

export interface WeeklyMaterialSection {
  id: string;
  title: string;
  paragraphs: string[];
  items: string[];
}

/** 공용 출력에 허용한 필드만 포함한다. 교수자 메모·미션 정답은 이 모델에 넣지 않는다. */
export interface WeeklyCourseMaterial {
  courseId: string;
  courseTitle: string;
  weekNo: number;
  title: string;
  contextLabel: string;
  preparationLabel: string;
  preparationNote: string;
  sections: WeeklyMaterialSection[];
  missions: Array<{ id: string; label: string; summary: string }>;
}

export function missionSituationSummary(situation: string, maxLength = 78): string {
  const text = situation.replace(/\s+/g, " ").trim();
  const firstSentence = text.match(/^.*?[.!?。！？](?:\s|$)/u)?.[0].trim() ?? text;
  return firstSentence.length > maxLength
    ? `${firstSentence.slice(0, maxLength).trimEnd()}…`
    : firstSentence;
}

/** 주차 목표를 틀로 삼고 현재 편성의 상황·원문을 반영한다. 미편성은 계획 미리보기다. */
export function buildWeeklyCourseMaterial(
  outline: LearnerCourse["outline"],
  week: LearnerCourseWeek,
): WeeklyCourseMaterial {
  const direction = outline.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
  const note = buildWeeklyLearnerNote(week, direction);
  const expectedMissions = week.speech_act || weekRole(week.week_no) === "contextualization" ? 2 : 0;
  const pending = week.scenarios.length < expectedMissions;
  const preparationLabel = pending
    ? `계획 미리보기 · 미션 ${week.scenarios.length}/${expectedMissions}개 편성`
    : week.scenarios.length ? `편성 미션 ${week.scenarios.length}개 반영` : "주차 계획 미리보기";
  const preparationNote = pending
    ? "아직 완성된 주차 수업자료가 아닙니다. 미션 편성 후 실제 상황·원문과 해설을 기준으로 자료를 구성합니다."
    : week.scenarios.length
      ? "현재 편성의 상황·기본 원문과 기존 설명을 함께 구성했습니다. 수업 전 교수자가 내용의 적합성을 확인해 주세요."
      : "이번 주는 교수자 수업 안내와 기존 수행 기록을 활용합니다. 이 화면은 주차 계획이며 완성된 강의자료를 뜻하지 않습니다.";
  const mode = expectedCoreModeForWeek({
    courseMode: outline.course_mode as CourseMode,
    interpretingWeekCount: outline.target_interpreting_week_count,
  }, week.week_no);
  const sections: WeeklyMaterialSection[] = [{
    id: "goals",
    title: "이번 주 학습목표",
    paragraphs: note.competencyFocus ? [note.competencyFocus] : [],
    items: note.canDos,
  }];
  const centralQuestion = weekCentralQuestion(week);
  if (centralQuestion) sections.push({
    id: "central-question",
    title: "중심 질문",
    paragraphs: [centralQuestion, CENTRAL_QUESTION_GUIDANCE],
    items: isReinforcementWeek(week) ? [REINFORCEMENT_DESCRIPTION] : [],
  });
  if (note.contextCues.length) sections.push({
    id: "context",
    title: "상황을 읽는 기준",
    paragraphs: [],
    items: note.contextCues.map((cue) => `${cue.label} · ${cue.value}`),
  });
  for (const feature of note.features) sections.push({
    id: `principle-${feature.code}`,
    title: feature.label,
    paragraphs: [feature.principle],
    items: [...feature.resources],
  });
  if (!note.features.length) sections.push({
    id: "preparation",
    title: "수업 안내",
    paragraphs: ["주차 계획에 따라 수업을 진행합니다. 상세 설명과 사례는 자료 검토 후 보완됩니다."],
    items: [],
  });
  const missions = week.scenarios.map((scenario, index) => ({
    id: scenario.scenario_id,
    label: `미션 ${index + 1}`,
    summary: missionSituationSummary(scenario.situation_ko),
  }));
  week.scenarios.forEach((scenario, index) => sections.push({
    id: `mission-${scenario.scenario_id}`,
    title: `미션 ${index + 1} · 상황과 기본 원문`,
    // 본문의 관계·부담·선행 사건을 보존한다. 첫 문장 요약은 연결된 미션 목록에만 쓴다.
    paragraphs: [scenario.situation_ko],
    items: scenario.source_text ? [scenario.source_text] : [],
  }));
  sections.push({
    id: "practice",
    title: "이번 주 실습",
    paragraphs: missions.length
      ? ["각 미션은 표현 판단 5개와 통번역 산출 1개로 진행합니다. 답안과 피드백은 웹앱 수행 기록에서 확인합니다."]
      : [expectedMissions ? "학습 미션 편성 후 주차 수업자료를 구성합니다." : "교수자 안내에 따라 이번 주 학습 활동을 진행합니다."],
    items: [],
  });
  return {
    courseId: outline.id,
    courseTitle: courseDisplayTitle(outline),
    weekNo: week.week_no,
    title: weekActivityLabel(week),
    preparationLabel,
    preparationNote,
    contextLabel: [LEVEL[outline.level], note.directionLabel, mode ? (mode === "stt_interpreting" ? "통역" : "번역") : null].filter(Boolean).join(" · "),
    sections,
    missions,
  };
}

export function weeklyMaterialsPath(courseId: string, weekNo: number): string {
  return `/admin/package?courseId=${encodeURIComponent(courseId)}&weekNo=${weekNo}`;
}
