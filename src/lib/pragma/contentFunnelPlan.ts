import { STANDARD_15WEEK } from "@/lib/curriculum/template";
import type {
  BusinessFunction,
  Domain,
  GenMode,
  IndustrySector,
  LanguageDirection,
  LearnerLevel,
  PdrBurden,
  PdrDistance,
  PdrPower,
  SpeechActUI,
} from "@/lib/pragma/enums";
import { PDR_CONSTRUCT_CELLS, type BatchCell } from "@/lib/pragma/batchPlan";
import {
  COURSE_PRESETS,
  SCENARIO_TOPICS,
  topicSupportsContext,
  type CoursePreset,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";

/**
 * Scope Lock 콘텐츠 퍼널의 실행 정본.
 *
 * - 3개 강좌 × 20개 배치 슬롯 = 60
 * - 슬롯당 코어 후보 5개 = 교과목 우선 후보 300
 * - 최종 유효 완전 미션 후보 = 500
 * - 500의 방향·수행모드 최소치는 60슬롯 비율을 largest-remainder 방식으로 환산한다.
 */
export const CONTENT_FUNNEL_PLAN_VERSION = "scope_lock_500_60_12_4_v1" as const;
export const COURSE_SLOT_CANDIDATES_PER_SLOT = 5;
export const VALID_LOCK_CANDIDATE_TARGET = 500;
export const DEFENSE_REPRESENTATIVE_TARGET = 12;
export const SAME_ID_E2E_TARGET = 4;

export const MANIFEST_WEEK_NOS = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13] as const;

export interface CourseSlotRequirement {
  manifest_version: typeof CONTENT_FUNNEL_PLAN_VERSION;
  slot_id: string;
  outline_id: string;
  course_label: string;
  week_no: number;
  position: 1 | 2;
  learner_level: LearnerLevel;
  direction: LanguageDirection;
  mode: GenMode;
  speech_act: SpeechActUI;
  domain: Domain;
  theme_code: ThemeCode;
  topic_code: string;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
  industry: IndustrySector | null;
  business_function: BusinessFunction | null;
  /** 일반 화행 주차 A/B에서 B가 A와 달리도록 고정한 축. 13주는 A/B 계약 예외다. */
  changed_context_axes: Array<"distance" | "burden">;
  candidate_core_target: typeof COURSE_SLOT_CANDIDATES_PER_SLOT;
}

export interface CandidateQuota {
  direction: LanguageDirection;
  mode: GenMode;
  minimum: number;
}

const WEEK_13_ACTS: readonly [SpeechActUI, SpeechActUI] = ["request", "refusal"];
const POWERS: readonly PdrPower[] = ["equal", "higher", "lower"];

const WORK_INDUSTRY_BY_THEME: Partial<Record<ThemeCode, IndustrySector>> = {
  career_workplace: "trade_distribution",
  commerce_customer: "tourism_hospitality",
  digital_content: "culture_content_media",
};

const WORK_FUNCTION_BY_THEME: Partial<Record<ThemeCode, BusinessFunction>> = {
  career_workplace: "project_coordination",
  commerce_customer: "customer_partner_support",
  digital_content: "marketing_pr",
};

function speechActForSlot(weekNo: number, position: 1 | 2): SpeechActUI {
  if (weekNo === 13) return WEEK_13_ACTS[position - 1];
  const speechAct = STANDARD_15WEEK.find((week) => week.week_no === weekNo)?.speech_act;
  if (!speechAct) throw new Error(`${weekNo}주차의 화행이 고정되지 않았습니다.`);
  return speechAct;
}

function pdrForSlot(weekNo: number, position: 1 | 2): {
  power: PdrPower;
  distance: PdrDistance;
  burden: PdrBurden;
} {
  const power = POWERS[MANIFEST_WEEK_NOS.findIndex((value) => value === weekNo) % POWERS.length];
  if (weekNo === 13) {
    return {
      power,
      distance: position === 1 ? "acquaintance" : "formal",
      burden: "high",
    };
  }
  return position === 1
    ? { power, distance: "acquaintance", burden: "mid" }
    : { power, distance: "formal", burden: "high" };
}

function topicForSlot(
  preset: CoursePreset,
  speechAct: SpeechActUI,
  mode: GenMode,
  pdr: ReturnType<typeof pdrForSlot>,
  ordinal: number,
) {
  const candidates = SCENARIO_TOPICS.filter((topic) =>
    preset.included_themes.includes(topic.themeCode) &&
    topic.allowedDomains.some((domain) =>
      topicSupportsContext(topic, {
        speechAct,
        domain,
        power: pdr.power,
        distance: pdr.distance,
        mode,
      }),
    ),
  ).sort((left, right) => left.code.localeCompare(right.code));

  if (candidates.length === 0) {
    throw new Error(`${preset.preset_code}의 ${speechAct}/${mode} 호환 topic이 없습니다.`);
  }
  const topic = candidates[ordinal % candidates.length];
  const domain = topic.allowedDomains.includes(preset.primary_domain)
    ? preset.primary_domain
    : topic.allowedDomains[0];
  return { topic, domain };
}

function buildCourseSlots(preset: CoursePreset): CourseSlotRequirement[] {
  // Scope Lock v1의 고정 생성 계획은 역사적 실행 인덱스·할당량을 보존한다.
  // 현행 강좌 편성(A안)은 courseModePolicy의 미션별 모드를 사용하며 이 계획으로 결정하지 않는다.
  const historicalLearningWeeks = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14];
  const historicalInterpretingWeeks = preset.course_mode === "translation" ? []
    : preset.course_mode === "interpreting" ? historicalLearningWeeks
      : historicalLearningWeeks.slice(-preset.target_interpreting_week_count);

  return MANIFEST_WEEK_NOS.flatMap((weekNo, weekIndex) => {
    const mode: GenMode = historicalInterpretingWeeks.includes(weekNo) ? "stt_interpreting" : "translation";

    return ([1, 2] as const).map((position) => {
      const speechAct = speechActForSlot(weekNo, position);
      const pdr = pdrForSlot(weekNo, position);
      const { topic, domain } = topicForSlot(
        preset,
        speechAct,
        mode,
        pdr,
        weekIndex * 2 + position - 1,
      );
      return {
        manifest_version: CONTENT_FUNNEL_PLAN_VERSION,
        slot_id: `${preset.preset_code}:w${String(weekNo).padStart(2, "0")}:${position}`,
        outline_id: preset.outline_id,
        course_label: preset.label,
        week_no: weekNo,
        position,
        learner_level: preset.target_level,
        direction: preset.language_direction,
        mode,
        speech_act: speechAct,
        domain,
        theme_code: topic.themeCode,
        topic_code: topic.code,
        pdr_power: pdr.power,
        pdr_distance: pdr.distance,
        pdr_burden: pdr.burden,
        industry: domain === "work"
          ? (WORK_INDUSTRY_BY_THEME[topic.themeCode] ?? "trade_distribution")
          : null,
        business_function: domain === "work"
          ? (WORK_FUNCTION_BY_THEME[topic.themeCode] ?? "project_coordination")
          : null,
        changed_context_axes:
          weekNo === 13 || position === 1 ? [] : ["distance", "burden"],
        candidate_core_target: COURSE_SLOT_CANDIDATES_PER_SLOT,
      } satisfies CourseSlotRequirement;
    });
  });
}

export const COURSE_SLOT_MANIFEST: readonly CourseSlotRequirement[] = COURSE_PRESETS.flatMap(
  buildCourseSlots,
);

function largestRemainderQuotas(
  slots: readonly CourseSlotRequirement[],
  target: number,
): CandidateQuota[] {
  const counts = new Map<string, { direction: LanguageDirection; mode: GenMode; slots: number }>();
  for (const slot of slots) {
    const key = `${slot.direction}|${slot.mode}`;
    const current = counts.get(key) ?? { direction: slot.direction, mode: slot.mode, slots: 0 };
    current.slots += 1;
    counts.set(key, current);
  }

  const apportion = <T extends { slots: number }>(cells: T[], subtotal: number) => {
    const slotTotal = cells.reduce((sum, cell) => sum + cell.slots, 0);
    const raw = cells.map((cell) => {
      const exact = (cell.slots / slotTotal) * subtotal;
      return { ...cell, minimum: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let unallocated = subtotal - raw.reduce((sum, cell) => sum + cell.minimum, 0);
    raw.sort((left, right) => right.remainder - left.remainder);
    for (const cell of raw) {
      if (unallocated <= 0) break;
      cell.minimum += 1;
      unallocated -= 1;
    }
    return raw;
  };

  // 500개의 333/167 언어방향 경계를 먼저 보존한 뒤 각 방향 안에서 수행모드를 배분한다.
  // 한 번에 4개 셀을 반올림하면 동률 잔여치 때문에 방향 총계가 334/166으로 바뀔 수 있다.
  const directionCells = (["ko_zh", "zh_ko"] as const).map((direction) => ({
    direction,
    slots: [...counts.values()]
      .filter((cell) => cell.direction === direction)
      .reduce((sum, cell) => sum + cell.slots, 0),
  }));
  const directionMinimums = apportion(directionCells, target);
  const quotas = directionMinimums.flatMap((directionCell) => apportion(
    [...counts.values()].filter((cell) => cell.direction === directionCell.direction),
    directionCell.minimum,
  ));
  return quotas
    .map(({ direction, mode, minimum }) => ({ direction, mode, minimum }))
    .sort((left, right) =>
      left.direction.localeCompare(right.direction) || left.mode.localeCompare(right.mode),
    );
}

export const VALID_LOCK_CANDIDATE_QUOTAS: readonly CandidateQuota[] = largestRemainderQuotas(
  COURSE_SLOT_MANIFEST,
  VALID_LOCK_CANDIDATE_TARGET,
);

export const DIRECTION_MINIMUMS: Readonly<Record<LanguageDirection, number>> = {
  ko_zh: VALID_LOCK_CANDIDATE_QUOTAS
    .filter((quota) => quota.direction === "ko_zh")
    .reduce((sum, quota) => sum + quota.minimum, 0),
  zh_ko: VALID_LOCK_CANDIDATE_QUOTAS
    .filter((quota) => quota.direction === "zh_ko")
    .reduce((sum, quota) => sum + quota.minimum, 0),
};

export interface LockCorePlanItem {
  itemIndex: number;
  cell: BatchCell;
  source: "course_priority" | "range_expansion";
  slotId: string;
}

function batchCellFromSlot(
  slot: CourseSlotRequirement,
  overrides?: {
    pdr?: { p: PdrPower; d: PdrDistance; r: PdrBurden };
    topicOrdinal?: number;
  },
): BatchCell {
  const preset = COURSE_PRESETS.find((item) => item.outline_id === slot.outline_id);
  if (!preset) throw new Error(`${slot.outline_id} 프리셋을 찾지 못했습니다.`);
  const pdr = overrides?.pdr ?? {
    p: slot.pdr_power,
    d: slot.pdr_distance,
    r: slot.pdr_burden,
  };
  const { topic, domain } = overrides?.pdr
    ? topicForSlot(
        preset,
        slot.speech_act,
        slot.mode,
        { power: pdr.p, distance: pdr.d, burden: pdr.r },
        overrides.topicOrdinal ?? 0,
      )
    : {
        topic: SCENARIO_TOPICS.find((item) => item.code === slot.topic_code)!,
        domain: slot.domain,
      };
  if (!topic) throw new Error(`${slot.topic_code} topic을 찾지 못했습니다.`);
  return {
    speech_act_ui: slot.speech_act,
    level: slot.learner_level,
    domain,
    mode: slot.mode,
    industry: domain === "work"
      ? (WORK_INDUSTRY_BY_THEME[topic.themeCode] ?? "trade_distribution")
      : null,
    business_function: domain === "work"
      ? (WORK_FUNCTION_BY_THEME[topic.themeCode] ?? "project_coordination")
      : null,
    pdr_power: pdr.p,
    pdr_distance: pdr.d,
    pdr_burden: pdr.r,
    theme_code: topic.themeCode,
    topic_code: topic.code,
    situation_seed_ko: topic.situationSeedKo,
    direction: slot.direction,
    count: 1,
  };
}

const priorityItems: LockCorePlanItem[] = COURSE_SLOT_MANIFEST.flatMap((slot, slotIndex) =>
  Array.from({ length: COURSE_SLOT_CANDIDATES_PER_SLOT }, (_, candidateIndex) => ({
    itemIndex: slotIndex * COURSE_SLOT_CANDIDATES_PER_SLOT + candidateIndex,
    cell: batchCellFromSlot(slot),
    source: "course_priority" as const,
    slotId: slot.slot_id,
  })),
);

/** 30 pilot은 각 강좌의 10개 대상 주차 position 1을 한 건씩 뽑아 전체 계획 index를 유지한다. */
export const LOCK_PILOT_CORE_PLAN: readonly LockCorePlanItem[] = priorityItems.filter(
  (item) => item.itemIndex % COURSE_SLOT_CANDIDATES_PER_SLOT === 0 &&
    COURSE_SLOT_MANIFEST[item.itemIndex / COURSE_SLOT_CANDIDATES_PER_SLOT]?.position === 1,
);

export const LOCK_COURSE_PRIORITY_CORE_PLAN: readonly LockCorePlanItem[] = priorityItems;

const EXPANSION_MODE_TARGETS: ReadonlyArray<{
  outlineId: string;
  mode: GenMode;
  count: number;
}> = [
  { outlineId: COURSE_PRESETS[0].outline_id, mode: "translation", count: 34 },
  { outlineId: COURSE_PRESETS[0].outline_id, mode: "stt_interpreting", count: 33 },
  { outlineId: COURSE_PRESETS[1].outline_id, mode: "translation", count: 33 },
  { outlineId: COURSE_PRESETS[1].outline_id, mode: "stt_interpreting", count: 33 },
  { outlineId: COURSE_PRESETS[2].outline_id, mode: "translation", count: 54 },
  { outlineId: COURSE_PRESETS[2].outline_id, mode: "stt_interpreting", count: 13 },
] as const;

const expansionItems: LockCorePlanItem[] = [];
for (const target of EXPANSION_MODE_TARGETS) {
  const slotPool = COURSE_SLOT_MANIFEST.filter(
    (slot) => slot.outline_id === target.outlineId && slot.mode === target.mode,
  );
  if (slotPool.length === 0) throw new Error(`${target.outlineId}/${target.mode} 확장 슬롯이 없습니다.`);
  for (let ordinal = 0; ordinal < target.count; ordinal += 1) {
    const slot = slotPool[ordinal % slotPool.length];
    const pdr = PDR_CONSTRUCT_CELLS[ordinal % PDR_CONSTRUCT_CELLS.length];
    expansionItems.push({
      itemIndex: priorityItems.length + expansionItems.length,
      cell: batchCellFromSlot(slot, { pdr, topicOrdinal: ordinal }),
      source: "range_expansion",
      slotId: slot.slot_id,
    });
  }
}

export const LOCK_EXPANSION_CORE_PLAN: readonly LockCorePlanItem[] = expansionItems;
export const LOCK_FULL_CORE_PLAN: readonly LockCorePlanItem[] = [
  ...LOCK_COURSE_PRIORITY_CORE_PLAN,
  ...LOCK_EXPANSION_CORE_PLAN,
];

export function assertContentFunnelPlan(): void {
  if (COURSE_SLOT_MANIFEST.length !== 60) throw new Error("교과목 manifest는 정확히 60슬롯이어야 합니다.");
  if (new Set(COURSE_SLOT_MANIFEST.map((slot) => slot.slot_id)).size !== 60) {
    throw new Error("교과목 manifest slot_id가 중복되었습니다.");
  }
  if (COURSE_SLOT_MANIFEST.some((slot) => slot.week_no === 13 && slot.pdr_burden !== "high")) {
    throw new Error("13주 두 미션은 모두 고부담이어야 합니다.");
  }
  for (const preset of COURSE_PRESETS) {
    const slots = COURSE_SLOT_MANIFEST.filter((slot) => slot.outline_id === preset.outline_id);
    if (slots.length !== 20) throw new Error(`${preset.preset_code}는 정확히 20슬롯이어야 합니다.`);
    const week13Acts = new Set(slots.filter((slot) => slot.week_no === 13).map((slot) => slot.speech_act));
    if (week13Acts.size !== 2) throw new Error(`${preset.preset_code} 13주는 서로 다른 두 화행이어야 합니다.`);
  }
  const quotaTotal = VALID_LOCK_CANDIDATE_QUOTAS.reduce((sum, quota) => sum + quota.minimum, 0);
  if (quotaTotal !== VALID_LOCK_CANDIDATE_TARGET) throw new Error("500개 후보 최소치 합계가 맞지 않습니다.");
  if (DIRECTION_MINIMUMS.ko_zh !== 333 || DIRECTION_MINIMUMS.zh_ko !== 167) {
    throw new Error("방향별 최소치는 한→중 333, 중→한 167이어야 합니다.");
  }
  if (LOCK_PILOT_CORE_PLAN.length !== 30) throw new Error("파일럿 계획은 정확히 30개여야 합니다.");
  if (LOCK_COURSE_PRIORITY_CORE_PLAN.length !== 300) throw new Error("교과목 우선 계획은 정확히 300개여야 합니다.");
  if (LOCK_EXPANSION_CORE_PLAN.length !== 200) throw new Error("범위 확장 계획은 정확히 200개여야 합니다.");
  if (LOCK_FULL_CORE_PLAN.length !== VALID_LOCK_CANDIDATE_TARGET) throw new Error("전체 시나리오 계획은 정확히 500개여야 합니다.");
  for (const quota of VALID_LOCK_CANDIDATE_QUOTAS) {
    const actual = LOCK_FULL_CORE_PLAN.filter(
      (item) => item.cell.direction === quota.direction && item.cell.mode === quota.mode,
    ).length;
    if (actual !== quota.minimum) {
      throw new Error(`${quota.direction}/${quota.mode} 계획은 ${quota.minimum}개여야 합니다.`);
    }
  }
}

assertContentFunnelPlan();
