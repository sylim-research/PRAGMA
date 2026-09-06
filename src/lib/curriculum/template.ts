// Fixed 15-week curriculum template.
//
// Produces the default week-draft array for a new outline: week 1 is
// orientation, one midterm week, one final week, everything else regular.
// No pedagogical content is prefilled — speech acts, P·D·R, load bands,
// titles and can-do goals all stay at their empty-draft defaults
// (see createEmptyWeekDraft). Auto-placement/auto-calculation is
// deliberately out of scope.
//
// week_count is fixed at 15 by the DB CHECK (curriculum_outlines_week_count_check),
// so it is intentionally NOT an option here.

import type { CurriculumWeekDraft } from "./types";
import { createEmptyWeekDraft } from "./mappers";
import type { SpeechActUI } from "@/lib/pragma/enums";
import { REINFORCEMENT_TITLE } from "./weekGuidance";

const WEEK_COUNT = 15;
const ORIENTATION_WEEK = 1;
const DEFAULT_MIDTERM_WEEK = 8;
const DEFAULT_FINAL_WEEK = 15;

// ══════════════════════════════════════════════════════════════════════
// 공통 표준 15주 골격 (2026-07-25, 사용자 승인 — fable 판정)
// ══════════════════════════════════════════════════════════════════════
// 모든 수준·언어 방향·프리셋이 공유하는 매개변수형 템플릿. 공통인 것 = 주차의
// 교육적 역할·9화행 배치·통합/프로젝트 위치. 달라지는 것(원문 난도·테마·방향)은
// 편성 단계에서 배정되는 코어가 정본이다(week 행에 복사하지 않음).
//
// DB week_type은 orientation·regular·midterm·final 4종 고정(CHECK). 그래서
// 7·14주는 regular + speech_act=null, 13주는 regular + 교강사가 선택한 화행으로 저장한다.
// 13주의 초안은 선택 전까지 speech_act=null로 두며,
// "역할"은 아래 앱 층 상수(week_no→role)로 파생 표시한다(새 enum·컬럼 없음).

/** 주차의 교육적 역할(표시·검증 분기용 — DB 컬럼 아님). */
export type CurriculumWeekRole =
  | "orientation"
  | "foundation" // 기초 적용: 저부담 화행
  | "relationship" // 관계 조정: 고부담 화행
  | "integration" // 복합 화용 조정 — 복합 요구가 든 기존 미션 1개를 배정
  | "contextualization" // 선택한 한 화행 집중 보완(기존 역할 식별자 유지)
  | "project" // 통번역 의사결정 정리 — 기존 미션 1개, 설명 활동은 수업에서 운영
  | "metapragmatic" // 메타화용 토론 — 누적된 판단·산출 기록을 수업에서 다시 검토
  | "assessment"; // 중간·기말 수행 슬롯

/** 단계형 표기(구 '1/2/3순환' 대체 — 실제 반복 구조가 아니므로). */
export const STAGE_LABEL: Record<CurriculumWeekRole, string> = {
  orientation: "시작",
  foundation: "기초 적용",
  relationship: "관계 조정",
  integration: "통합 수행",
  contextualization: "집중 보완",
  project: "통합 수행",
  metapragmatic: "누적 검토",
  assessment: "수행 점검",
};

export const ROLE_LABEL: Record<CurriculumWeekRole, string> = {
  orientation: "오리엔테이션",
  foundation: "기초 적용",
  relationship: "관계 조정",
  integration: "통합·연쇄",
  contextualization: "선택 화행 보완",
  project: "프로젝트",
  metapragmatic: "메타화용 토론",
  assessment: "평가",
};

interface StandardWeekSpec {
  week_no: number;
  db_type: CurriculumWeekDraft["type"];
  role: CurriculumWeekRole;
  /** regular 중심 화행. 13주는 교강사가 선택하기 전까지 null. */
  speech_act: SpeechActUI | null;
  title: string;
}

/**
 * 공통 15주 골격 정본(2026-08-23 개정). 2~6·9~12주에 9화행을 각각 1회 배치하고,
 * 7·13·14주는 새 화행을 추가하지 않는 특별 주차로 둔다. 중간=8주, 기말=15주.
 *
 * 특별 주차 3개는 새 화행을 배우는 자리가 아니라 이미 수행한 판단·산출 기록을
 * 수업에서 다시 쓰는 자리다: 7주 중간 누적 검토 → 13주 선택한 한 화행의
 * 집중 보완 → 14주 전체 종합 검토. 학습효과를 별도로 검증하는
 * 처치가 아니라 운영 설계다.
 * 화행 연쇄(협상)는 이번 구현에서 제외하고 논문 6장 후속 연구로 남긴다.
 */
export const STANDARD_15WEEK: readonly StandardWeekSpec[] = [
  { week_no: 1, db_type: "orientation", role: "orientation", speech_act: null, title: "오리엔테이션 · 출발점 확인" },
  { week_no: 2, db_type: "regular", role: "foundation", speech_act: "request", title: "요청" },
  { week_no: 3, db_type: "regular", role: "foundation", speech_act: "thanks", title: "감사" },
  { week_no: 4, db_type: "regular", role: "foundation", speech_act: "compliment", title: "칭찬" },
  { week_no: 5, db_type: "regular", role: "foundation", speech_act: "agreement", title: "초대" },
  { week_no: 6, db_type: "regular", role: "relationship", speech_act: "refusal", title: "거절" },
  { week_no: 7, db_type: "regular", role: "metapragmatic", speech_act: null, title: "중간 메타화용 토론" },
  { week_no: 8, db_type: "midterm", role: "assessment", speech_act: null, title: "중간 통합 점검" },
  { week_no: 9, db_type: "regular", role: "relationship", speech_act: "apology", title: "사과" },
  { week_no: 10, db_type: "regular", role: "relationship", speech_act: "proposal", title: "제안" },
  { week_no: 11, db_type: "regular", role: "relationship", speech_act: "opposition", title: "반대" },
  { week_no: 12, db_type: "regular", role: "relationship", speech_act: "complaint", title: "불만" },
  { week_no: 13, db_type: "regular", role: "contextualization", speech_act: null, title: REINFORCEMENT_TITLE },
  { week_no: 14, db_type: "regular", role: "metapragmatic", speech_act: null, title: "종합 메타화용 토론" },
  { week_no: 15, db_type: "final", role: "assessment", speech_act: null, title: "기말 통합 수행 점검" },
] as const;

export const STANDARD_MIDTERM_WEEK = 8;
export const STANDARD_FINAL_WEEK = 15;
/** 표준 골격이 2~6·9~12주에 배치하는 9화행(자동 목표 화행 세팅용). */
export const STANDARD_TARGET_ACTS: readonly SpeechActUI[] = STANDARD_15WEEK
  .map((w) => w.speech_act)
  .filter((a): a is SpeechActUI => a !== null);

/** week_no → 역할(파생 표시용). 범위 밖이면 regular 기본. */
export function weekRole(weekNo: number): CurriculumWeekRole {
  return STANDARD_15WEEK.find((w) => w.week_no === weekNo)?.role ?? "foundation";
}

/**
 * 공통 표준 15주 draft 배열을 만든다. 각 주차의 type·speech_act·title을 채우되
 * P·D·R·채널·도메인·부담밴드·슬롯은 비운다(배정 코어에서 파생 — week 행 미복사).
 * 매 호출 새 객체(공유 참조 없음).
 */
export function createStandard15WeekTemplate(): CurriculumWeekDraft[] {
  return STANDARD_15WEEK.map((spec) => {
    const draft = createEmptyWeekDraft(spec.week_no);
    draft.type = spec.db_type;
    draft.speech_act = spec.speech_act;
    draft.title = spec.title;
    return draft;
  });
}

export interface CurriculumWeekTemplateOptions {
  /** Midterm exam week (2–14, ≠ finalWeek). Default: 8. */
  midtermWeek?: number;
  /** Final exam week (2–15, ≠ midtermWeek). Default: 15. */
  finalWeek?: number;
}

/**
 * Build the default 15-week draft array.
 *
 * Callers are expected to pass valid options (midtermWeek 2–14,
 * finalWeek 2–15, the two distinct, neither colliding with week 1);
 * validation lives in a later module, not here.
 *
 * Every call returns fresh objects/arrays — no references are shared with
 * previous calls or with the options object (which is never mutated).
 */
export function createCurriculumWeekTemplate(
  options?: CurriculumWeekTemplateOptions,
): CurriculumWeekDraft[] {
  const midtermWeek = options?.midtermWeek ?? DEFAULT_MIDTERM_WEEK;
  const finalWeek = options?.finalWeek ?? DEFAULT_FINAL_WEEK;

  return Array.from({ length: WEEK_COUNT }, (_, i) => {
    const weekNo = i + 1;
    const draft = createEmptyWeekDraft(weekNo);
    // Explicit week-number → type decision (valid input presumed, so the
    // branches are mutually exclusive; order mirrors the calendar).
    if (weekNo === ORIENTATION_WEEK) {
      draft.type = "orientation";
    } else if (weekNo === midtermWeek) {
      draft.type = "midterm";
    } else if (weekNo === finalWeek) {
      draft.type = "final";
    }
    // otherwise: keep the factory default "regular"
    return draft;
  });
}
