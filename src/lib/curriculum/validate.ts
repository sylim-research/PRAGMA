// Pure pre-save validation for curriculum outline + weeks.
//
// errors   → block saving.
// warnings → saving allowed; surfaced to the instructor in the UI.
// No auto-fix / auto-placement / auto-calculation here — this module only
// reports; the instructor decides.
//
// Dependent-rule principle: when a prerequisite setting (midterm_week /
// final_week) is itself missing/out-of-range/conflicting, that setting's own
// error is enough — type-match checks that depend on it are skipped to avoid
// cascading duplicate errors.

import type { CurriculumOutlineDraft, CurriculumWeekDraft } from "./types";
import { isReinforcementWeek, previouslyLearnedActs } from "./weekGuidance";

export type CurriculumValidationIssue = {
  /** Stable machine-readable code — UI logic keys off this, not message. */
  code: string;
  /** Instructor-facing Korean message (one problem per issue). */
  message: string;
  week_no?: number;
  field?: string;
};

export type CurriculumValidationResult = {
  errors: CurriculumValidationIssue[];
  warnings: CurriculumValidationIssue[];
};

const WEEK_COUNT = 15;
const REGULAR_ONLY_FIELDS = [
  "speech_act",
  "channel",
  "pdr_power",
  "pdr_distance",
  "pdr_imposition",
  "curriculum_load_band",
  "domain",
  "industry",
  "scenario_slots",
] as const;

export function validateCurriculum(
  outline: CurriculumOutlineDraft,
  weeks: CurriculumWeekDraft[],
): CurriculumValidationResult {
  const errors: CurriculumValidationIssue[] = [];
  const warnings: CurriculumValidationIssue[] = [];

  // ── outline-level errors ──

  // (1) title
  if (outline.title.trim() === "") {
    errors.push({
      code: "OUTLINE_TITLE_REQUIRED",
      message: "커리큘럼 제목을 입력하세요.",
      field: "title",
    });
  }

  // (2)(3) target_speech_acts — 공통 표준 골격은 9화행 전부를 자동 배치하므로
  // "1개 이상 선택" 필수 오류는 제거(2026-07-25). 중복만 오류로 유지.
  {
    const seen = new Set<string>();
    for (const act of outline.target_speech_acts) {
      if (seen.has(act)) {
        errors.push({
          code: "DUPLICATE_TARGET_SPEECH_ACT",
          message: `선택한 화행 목록에 '${act}'가 중복되어 있습니다.`,
          field: "target_speech_acts",
        });
      }
      seen.add(act);
    }
  }

  // (4) week_count fixed at 15
  if (outline.week_count !== WEEK_COUNT) {
    errors.push({
      code: "WEEK_COUNT_INVALID",
      message: `총 주차 수는 ${WEEK_COUNT}주로 고정되어 있습니다.`,
      field: "week_count",
    });
  }

  // (5)–(9) midterm / final settings
  const midterm = outline.midterm_week;
  const final = outline.final_week;

  if (midterm === null) {
    errors.push({
      code: "MIDTERM_WEEK_REQUIRED",
      message: "중간평가 주차를 설정하세요.",
      field: "midterm_week",
    });
  } else if (midterm < 2 || midterm > 14) {
    errors.push({
      code: "MIDTERM_WEEK_OUT_OF_RANGE",
      message: `중간평가 주차는 2~14주 사이여야 합니다. (현재 ${midterm}주차)`,
      field: "midterm_week",
    });
  }

  if (final === null) {
    errors.push({
      code: "FINAL_WEEK_REQUIRED",
      message: "기말평가 주차를 설정하세요.",
      field: "final_week",
    });
  } else if (final < 2 || final > 15) {
    errors.push({
      code: "FINAL_WEEK_OUT_OF_RANGE",
      message: `기말평가 주차는 2~15주 사이여야 합니다. (현재 ${final}주차)`,
      field: "final_week",
    });
  }

  const midtermInRange = midterm !== null && midterm >= 2 && midterm <= 14;
  const finalInRange = final !== null && final >= 2 && final <= 15;
  const conflict = midtermInRange && finalInRange && midterm === final;

  if (conflict) {
    errors.push({
      code: "MIDTERM_FINAL_CONFLICT",
      message: `중간평가와 기말평가가 같은 주차(${midterm}주차)로 설정되어 있습니다.`,
      field: "final_week",
    });
  }

  // Dependent type-match checks run only on valid, non-conflicting settings
  // (a conflict makes BOTH positions ambiguous, so both are skipped — the
  // single MIDTERM_FINAL_CONFLICT error carries the cause).
  const midtermEvaluable = midtermInRange && !conflict;
  const finalEvaluable = finalInRange && !conflict;

  // ── weeks structure errors ──

  // (10) length
  if (weeks.length !== WEEK_COUNT) {
    errors.push({
      code: "WEEK_COUNT_MISMATCH",
      message: `주차 데이터가 ${WEEK_COUNT}개가 아닙니다. (현재 ${weeks.length}개)`,
    });
  }

  // (11)(12) week_no must cover 1..15 exactly once
  const byNo = new Map<number, CurriculumWeekDraft[]>();
  for (const w of weeks) {
    const list = byNo.get(w.week_no) ?? [];
    list.push(w);
    byNo.set(w.week_no, list);
  }
  for (const [no, list] of byNo) {
    if (list.length > 1) {
      errors.push({
        code: "DUPLICATE_WEEK_NO",
        message: `${no}주차가 ${list.length}번 중복되어 있습니다.`,
        week_no: no,
      });
    }
  }
  for (let no = 1; no <= WEEK_COUNT; no++) {
    if (!byNo.has(no)) {
      errors.push({
        code: "MISSING_WEEK_NO",
        message: `${no}주차 데이터가 없습니다.`,
        week_no: no,
      });
    }
  }

  const weekAt = (no: number): CurriculumWeekDraft | undefined => byNo.get(no)?.[0];

  // (13) week 1 must be orientation
  const week1 = weekAt(1);
  if (week1 && week1.type !== "orientation") {
    errors.push({
      code: "ORIENTATION_WEEK_INVALID",
      message: "1주차는 오리엔테이션이어야 합니다.",
      week_no: 1,
      field: "type",
    });
  }

  // (14) midterm position type — only when the setting is evaluable
  if (midtermEvaluable) {
    const w = weekAt(midterm);
    if (w && w.type !== "midterm") {
      errors.push({
        code: "MIDTERM_WEEK_TYPE_INVALID",
        message: `${midterm}주차는 중간평가 주차로 설정되어 있으나 유형이 midterm이 아닙니다.`,
        week_no: midterm,
        field: "type",
      });
    }
  }

  // (15) final position type — only when the setting is evaluable
  if (finalEvaluable) {
    const w = weekAt(final);
    if (w && w.type !== "final") {
      errors.push({
        code: "FINAL_WEEK_TYPE_INVALID",
        message: `${final}주차는 기말평가 주차로 설정되어 있으나 유형이 final이 아닙니다.`,
        week_no: final,
        field: "type",
      });
    }
  }

  // (16) every other position must be regular. Weeks typed midterm/final are
  // exempt while their governing setting is not evaluable (dependent-rule
  // principle — the setting's own error already explains the state).
  for (const w of weeks) {
    const isExpectedSpecialPosition =
      w.week_no === 1 ||
      (midtermEvaluable && w.week_no === midterm) ||
      (finalEvaluable && w.week_no === final);
    if (isExpectedSpecialPosition || w.type === "regular") continue;
    if (w.type === "midterm" && !midtermEvaluable) continue;
    if (w.type === "final" && !finalEvaluable) continue;
    errors.push({
      code: "REGULAR_WEEK_EXPECTED",
      message: `${w.week_no}주차는 정규 주차여야 합니다. (현재 유형: ${w.type})`,
      week_no: w.week_no,
      field: "type",
    });
  }

  // (17)(18)(19) at most one of each special type
  for (const type of ["orientation", "midterm", "final"] as const) {
    const count = weeks.filter((w) => w.type === type).length;
    if (count > 1) {
      errors.push({
        code: "SPECIAL_WEEK_DUPLICATED",
        message: `${type} 유형 주차가 ${count}개 있습니다. 1개만 허용됩니다.`,
        field: "type",
      });
    }
  }

  // ── per-week errors ──

  for (const w of weeks) {
    if (isReinforcementWeek(w) && w.speech_act && !previouslyLearnedActs(weeks).includes(w.speech_act)) {
      errors.push({ code: "REINFORCEMENT_ACT_NOT_LEARNED", week_no: w.week_no, field: "speech_act",
        message: "13주는 앞선 주차에 편성된 화행 중 하나를 선택하세요." });
    }
    if (w.type === "regular") {
      // (20)–(27) 정규 주차 필수 필드 요구 제거(2026-07-25 공통 골격 정비).
      // 화행 = 표준 골격 자동값 / P·D·R·채널·도메인·부담밴드·슬롯 = 배정 코어에서
      // 파생(week 행 미복사). 12·13·14주(통합·맥락화·프로젝트)는 화행 null이 정상.
      // 남은 검사 = 값이 들어온 경우의 범위·부호뿐(자동값·override 무결성).

      // (28) scenario_slots < 0 (0 is allowed: DB CHECK is >= 0 and a
      // no-scenario regular week is a legitimate operation)
      if (w.scenario_slots !== null && w.scenario_slots < 0) {
        errors.push({
          code: "SCENARIO_SLOTS_NEGATIVE",
          message: `${w.week_no}주차의 시나리오 수는 0 이상이어야 합니다.`,
          week_no: w.week_no,
          field: "scenario_slots",
        });
      }

      // (29) load band range
      if (
        w.curriculum_load_band !== null &&
        (w.curriculum_load_band < 1 || w.curriculum_load_band > 5)
      ) {
        errors.push({
          code: "LOAD_BAND_OUT_OF_RANGE",
          message: `${w.week_no}주차의 부담 밴드는 1~5 사이여야 합니다.`,
          week_no: w.week_no,
          field: "curriculum_load_band",
        });
      }
    } else {
      // special weeks: regular-only fields must all be empty
      // (title / can_do / competency_focus stay allowed).
      const filled = REGULAR_ONLY_FIELDS.filter((f) => w[f] !== null);
      if (filled.length > 0) {
        errors.push({
          code: "SPECIAL_WEEK_HAS_REGULAR_FIELDS",
          message: `${w.week_no}주차(${w.type})에는 정규 주차 전용 값(${filled.join(", ")})을 비워야 합니다.`,
          week_no: w.week_no,
          field: filled[0],
        });
      }
    }

    // can_do: 0~2 items, none blank (applies to every week)
    if (w.can_do.length > 2) {
      errors.push({
        code: "CAN_DO_TOO_MANY",
        message: `${w.week_no}주차의 Can-do 목표는 최대 2개까지 입력할 수 있습니다.`,
        week_no: w.week_no,
        field: "can_do",
      });
    }
    if (w.can_do.some((item) => item.trim() === "")) {
      errors.push({
        code: "CAN_DO_EMPTY_ITEM",
        message: `${w.week_no}주차의 Can-do 목표에 빈 항목이 있습니다.`,
        week_no: w.week_no,
        field: "can_do",
      });
    }
  }

  // ── warnings ──

  const regularWeeks = weeks.filter((w) => w.type === "regular");

  // (W1) selected-but-unplaced speech acts — one warning per unused act
  const placedActs = new Set(
    regularWeeks.map((w) => w.speech_act).filter((a): a is NonNullable<typeof a> => a !== null),
  );
  for (const act of outline.target_speech_acts) {
    if (!placedActs.has(act)) {
      warnings.push({
        code: "UNUSED_TARGET_SPEECH_ACT",
        message: `선택한 화행 '${act}'가 어느 정규 주차에도 배치되지 않았습니다.`,
        field: "target_speech_acts",
      });
    }
  }

  // (W2) speech act outside target — skipped entirely when target list is
  // empty (that state is already an error; per-week warnings would be noise)
  if (outline.target_speech_acts.length > 0) {
    const target = new Set(outline.target_speech_acts);
    for (const w of regularWeeks) {
      if (w.speech_act !== null && !target.has(w.speech_act)) {
        warnings.push({
          code: "SPEECH_ACT_OUTSIDE_TARGET",
          message: `${w.week_no}주차의 화행 '${w.speech_act}'는 학기 화행 목록에 없습니다.`,
          week_no: w.week_no,
          field: "speech_act",
        });
      }
    }
  }

  // (W3) late-term load notably lower than early-term.
  // Exact rule: regular weeks with non-null load only; early = week 2–7,
  // late = week 9–14; evaluate only when each segment has ≥2 values;
  // warn when lateAvg + 1 < earlyAvg.
  const loadsIn = (from: number, to: number): number[] =>
    regularWeeks
      .filter((w) => w.week_no >= from && w.week_no <= to && w.curriculum_load_band !== null)
      .map((w) => w.curriculum_load_band as number);
  const early = loadsIn(2, 7);
  const late = loadsIn(9, 14);
  if (early.length >= 2 && late.length >= 2) {
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const earlyAvg = avg(early);
    const lateAvg = avg(late);
    if (lateAvg + 1 < earlyAvg) {
      warnings.push({
        code: "LOAD_LATE_TERM_TOO_LOW",
        message: `학기 후반부의 평균 부담 밴드(${lateAvg.toFixed(1)})가 전반부(${earlyAvg.toFixed(1)})보다 현저히 낮습니다. 주차 배치를 확인하세요.`,
        field: "curriculum_load_band",
      });
    }
  }

  // (W4) sharp load drops. Exact rule: regular weeks in week_no order,
  // null loads excluded; count adjacent pairs where load falls by ≥2;
  // warn once when that count is ≥2. Monotonic increase is NOT enforced.
  const orderedLoads = regularWeeks
    .slice()
    .sort((a, b) => a.week_no - b.week_no)
    .filter((w) => w.curriculum_load_band !== null)
    .map((w) => w.curriculum_load_band as number);
  let sharpDrops = 0;
  for (let i = 1; i < orderedLoads.length; i++) {
    if (orderedLoads[i - 1] - orderedLoads[i] >= 2) sharpDrops++;
  }
  if (sharpDrops >= 2) {
    warnings.push({
      code: "LOAD_SHARP_DROPS",
      message: `부담 밴드가 2 이상 급락하는 구간이 ${sharpDrops}회 있습니다. 전체 흐름을 확인하세요.`,
      field: "curriculum_load_band",
    });
  }

  // (W5) scenario_slots differs from the outline default (0 is a valid value;
  // it still warns when it differs from the default — instructor confirmation)
  for (const w of regularWeeks) {
    if (w.scenario_slots !== null && w.scenario_slots !== outline.scenarios_per_week) {
      warnings.push({
        code: "SCENARIO_SLOTS_DIFFERS_FROM_DEFAULT",
        message: `${w.week_no}주차의 시나리오 수(${w.scenario_slots})가 학기 기본값(${outline.scenarios_per_week})과 다릅니다.`,
        week_no: w.week_no,
        field: "scenario_slots",
      });
    }
  }

  return { errors, warnings };
}
