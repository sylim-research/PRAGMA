// 학습자용 — 게시된 커리큘럼의 편성본(주차별 배정 시나리오)을 읽어온다.
//
// 편성기(관리자)가 curriculum_week_scenarios에 저장한 것을 학습자 화면이 소비한다.
// 기존 조회 함수(curriculum/api·composer)를 재사용하므로 새 쿼리는 없다.
// 조회 결과에 legacy 편성이 섞여 있어도 학습자 조립층에서 reviewed 미션만 남긴다.
//
// RLS 공개 경계(20260727190000): 프로필 작성을 마친 learner는 published 강좌와
// 그 편성 중 reviewed 미션만 읽는다. admin은 검수·시연을 위해 전체를 읽는다.

import {
  getCurriculumOutline,
  listCurriculumOutlines,
} from "@/lib/curriculum/api";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import type { ComposerCore } from "@/lib/curriculum/composer";
import type {
  ChannelUI,
  Domain,
  PdrBurden,
  PdrDistance,
  PdrPower,
  SpeechActUI,
} from "@/lib/pragma/enums";
import { assembleLearnerCourse } from "./learnerCourseProjection";
import { DEFENSE_COURSE_IDS } from "@/lib/pragma/scenarioTopics";

export interface LearnerWeekScenario {
  assignment_id?: string;
  scenario_id: string;
  situation_ko: string;
  /** 편성된 코어의 기본 원문. DCT 참고 답안이 아니다. */
  source_text?: string;
  /** 수업 도입에 참조할 편성 코어의 맥락. 주차 공통 조건으로 저장하지 않는다. */
  context?: ComposerCore["context"];
  domain?: Domain | null;
  speech_act?: SpeechActUI;
  mission_status: string | null;
  target_feature: string | null;
  mode: ComposerCore["mode"];
  /** 이 배열에는 검토 완료 미션만 들어오므로 항상 true. */
  runnable: boolean;
}

export interface LearnerCourseWeek {
  week_no: number;
  title: string;
  type: string;
  can_do: string[];
  speech_act: SpeechActUI | null;
  channel: ChannelUI | null;
  pdr_power: PdrPower | null;
  pdr_distance: PdrDistance | null;
  pdr_imposition: PdrBurden | null;
  review_released: boolean;
  competency_focus: string | null;
  domain: Domain | null;
  scenarios: LearnerWeekScenario[];
}

export interface LearnerCourse {
  outline: CurriculumOutlineRow;
  weeks: LearnerCourseWeek[];
}

export interface LearnerCourseSource {
  outline: CurriculumOutlineRow;
  weeks: CurriculumWeekRow[];
  assignments: Awaited<ReturnType<typeof listWeekAssignments>>;
  cores: ComposerCore[];
}

/** 학습자에게 공개된 교과목 목록. RLS에만 기대지 않고 앱에서도 published만 남긴다. */
export async function listPublishedCourseOutlines(): Promise<CurriculumOutlineRow[]> {
  const outlines = await listCurriculumOutlines();
  const displayOrder = new Map(DEFENSE_COURSE_IDS.map((id, index) => [id, index]));
  return outlines
    .filter((outline) => outline.status === "published" && displayOrder.has(outline.id))
    .sort((left, right) => (displayOrder.get(left.id) ?? 99) - (displayOrder.get(right.id) ?? 99));
}

/**
 * 편성 원천을 학습자 강좌로 투영한다.
 * 기존 DB에 남은 core-only/generated 배정과 삭제된 코어는 상황 문구조차 노출하지 않는다.
 */
export { assembleLearnerCourse } from "./learnerCourseProjection";

/** 선택한 게시 강좌를 학습자 시점으로 조립한다. id가 없으면 구 주소 호환용 최신 강좌를 쓴다. */
export async function getPublishedCourse(courseId?: string): Promise<LearnerCourse | null> {
  const outlines = await listPublishedCourseOutlines();
  const published = courseId
    ? outlines.find((outline) => outline.id === courseId)
    : outlines[0];
  if (!published) return null;

  const [{ outline, weeks }, assignments, cores] = await Promise.all([
    getCurriculumOutline(published.id),
    listWeekAssignments(published.id),
    listCoreScenarios(),
  ]);

  return assembleLearnerCourse({ outline, weeks, assignments, cores });
}
