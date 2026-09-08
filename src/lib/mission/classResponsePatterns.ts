// 학급 응답 분포 집계 — 수업자료·교실 화면의 「이 주차 응답 분포」 데이터.
//
// 입력 = learner_mission_logs의 context_judgment(mpj_response_v1/v2 봉투)와
// 해당 미션의 mission_content. 개인 식별 없이 문항×선택지 단위로만 세어,
// 교수자가 수업 중 "우리 반은 어떻게 판단했나"를 토론 재료로 쓰게 한다.
//
// 원칙:
// - 읽기 전용 집계다. 새 점수·판정을 만들지 않는다(비채점 trace 그대로).
// - 같은 학습자가 같은 미션을 여러 번 완료했으면 최신 행만 센다(재시도 중복 방지).
// - 이견(learner_dissent)은 건수만 집계한다. 원문·작성자는 여기서 다루지 않는다.

import type { MissionRuntime } from "@/lib/pragma/missionSchema";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

export interface ClassResponseCountRow {
  item_id: number;
  item_type: string;
  axis: "scale" | "band" | "initial_judgment" | "correction" | "reason" | "best" | "worst";
  choice_key: string;
  count: number;
}

/** 집계에 필요한 최소 로그 행 형태(learner_mission_logs 부분 선택). */
export interface ClassResponseLogRow {
  mission_id: string;
  profile_id: string;
  completed_at: string | null;
  context_judgment: unknown;
}

export interface ChoiceCount {
  key: string;
  label: string;
  count: number;
}

/** 한 문항 안의 응답 축(예: fix_choice = 판단 대역 + 수정안 선택 두 축). */
export interface ItemChoiceGroup {
  heading: string;
  total: number;
  choices: ChoiceCount[];
}

export interface ItemPattern {
  itemId: number;
  title: string;
  /** 학습자에게 보였던 대상 표현. multi_judge는 null. */
  targetPreview: string | null;
  groups: ItemChoiceGroup[];
}

export interface MissionPattern {
  missionId: string;
  /** 집계에 쓰인 학습자 수(미션별 최신 완료 1건씩). */
  learners: number;
  dissents: number;
  items: ItemPattern[];
}

const SCALE_LABELS: Record<string, string> = {
  very_appropriate: "매우 적절",
  somewhat_appropriate: "다소 적절",
  somewhat_inappropriate: "다소 부적절",
  very_inappropriate: "매우 부적절",
};

const ITEM_TITLES: Record<string, string> = {
  scale4: "첫인상 판단",
  judge3: "맥락 대비 판단",
  fix_choice: "판단하고 고쳐보기",
  reason: "이유 찾기",
  multi_judge: "여러 초안 비교",
};

interface TraceLike {
  item_id?: unknown;
  item_type?: unknown;
  scale_code?: unknown;
  band_code?: unknown;
  correction_indexes?: unknown;
  reason_id?: unknown;
  initial_judgment?: unknown;
  best_candidate_index?: unknown;
  worst_candidate_index?: unknown;
}

export type LearnerChoiceMap = Record<string, string[]>;

export const learnerChoiceMapKey = (itemId: number, heading: string) => `${itemId}:${heading}`;

/** 현재 학습자의 비채점 trace를 분포 막대의 choice key와 연결한다. */
export function learnerChoiceMapFromTraces(traces: TraceLike[]): LearnerChoiceMap {
  const choices: LearnerChoiceMap = {};
  const add = (itemId: number, heading: string, key: string) => {
    const mapKey = learnerChoiceMapKey(itemId, heading);
    choices[mapKey] = [...new Set([...(choices[mapKey] ?? []), key])];
  };
  for (const trace of traces) {
    const itemId = typeof trace.item_id === "number" ? trace.item_id : null;
    if (itemId === null) continue;
    if (typeof trace.scale_code === "string") add(itemId, "적절성 판단", trace.scale_code);
    if (typeof trace.band_code === "string") add(itemId, "조절 정도 판단", trace.band_code);
    if (typeof trace.initial_judgment === "string") add(itemId, "최초 적절성 판단", trace.initial_judgment);
    if (Array.isArray(trace.correction_indexes)) {
      for (const index of trace.correction_indexes) {
        if (typeof index === "number") add(itemId, "고른 수정안", String(index));
      }
    }
    if (typeof trace.reason_id === "string") add(itemId, "고른 이유", trace.reason_id);
    if (typeof trace.best_candidate_index === "number") add(itemId, "BEST로 고른 초안", String(trace.best_candidate_index));
    if (typeof trace.worst_candidate_index === "number") add(itemId, "WORST로 고른 초안", String(trace.worst_candidate_index));
  }
  return choices;
}

/** 봉투에서 문항 응답 배열과 이견 여부를 꺼낸다. legacy 이견 단독 형태도 읽는다. */
export function parseJudgmentEnvelope(raw: unknown): { responses: TraceLike[]; dissent: boolean } {
  if (!raw || typeof raw !== "object") return { responses: [], dissent: false };
  const value = raw as Record<string, unknown>;
  if (value.kind === "learner_dissent") return { responses: [], dissent: true };
  const responses = Array.isArray(value.responses)
    ? (value.responses.filter((item) => item && typeof item === "object") as TraceLike[])
    : [];
  return { responses, dissent: Boolean(value.learner_dissent) };
}

function bandLabels(mission: MissionRuntime | null): Map<string, string> {
  const labels = new Map<string, string>();
  const feature = mission ? getTargetFeature(mission.unit.target_feature) : null;
  for (const band of feature?.band_schema ?? []) {
    // 화면 선택지와 같은 규칙으로 괄호 보충설명을 떼어 짧게 보여 준다.
    labels.set(band.code, band.label_ko.replace(/\s*\([^)]*\)\s*$/, ""));
  }
  return labels;
}

function tally(counts: Map<string, { label: string; count: number }>, key: string, label: string) {
  const entry = counts.get(key);
  if (entry) entry.count += 1;
  else counts.set(key, { label, count: 1 });
}

function toGroup(heading: string, counts: Map<string, { label: string; count: number }>): ItemChoiceGroup | null {
  if (counts.size === 0) return null;
  const choices = [...counts.entries()]
    .map(([key, { label, count }]) => ({ key, label, count }))
    .sort((a, b) => b.count - a.count);
  return { heading, total: choices.reduce((sum, choice) => sum + choice.count, 0), choices };
}

/** 미션 1개의 로그 행들을 문항×선택지 분포로 집계한다. */
export function aggregateMissionResponses(
  missionId: string,
  rows: ClassResponseLogRow[],
  mission: MissionRuntime | null,
): MissionPattern {
  // 학습자별 최신 완료 행만 남긴다.
  const latestByLearner = new Map<string, ClassResponseLogRow>();
  for (const row of rows) {
    if (row.mission_id !== missionId) continue;
    const existing = latestByLearner.get(row.profile_id);
    if (!existing || (row.completed_at ?? "") > (existing.completed_at ?? "")) {
      latestByLearner.set(row.profile_id, row);
    }
  }

  const bands = bandLabels(mission);
  const bandLabel = (code: string) => bands.get(code) ?? code;
  const mpjItems = (mission?.mpj_items ?? []) as Array<Record<string, unknown>>;
  const itemMeta = (itemId: number) => mpjItems.find((item) => item.id === itemId) ?? null;

  let dissents = 0;
  // itemId → 축 이름 → 카운트
  const perItem = new Map<number, { itemType: string; groups: Map<string, Map<string, { label: string; count: number }>> }>();
  const groupOf = (itemId: number, itemType: string, heading: string) => {
    let item = perItem.get(itemId);
    if (!item) {
      item = { itemType, groups: new Map() };
      perItem.set(itemId, item);
    }
    let group = item.groups.get(heading);
    if (!group) {
      group = new Map();
      item.groups.set(heading, group);
    }
    return group;
  };

  for (const row of latestByLearner.values()) {
    const { responses, dissent } = parseJudgmentEnvelope(row.context_judgment);
    if (dissent) dissents += 1;
    for (const trace of responses) {
      const itemId = typeof trace.item_id === "number" ? trace.item_id : null;
      const itemType = typeof trace.item_type === "string" ? trace.item_type : null;
      if (itemId === null || itemType === null) continue;
      const meta = itemMeta(itemId);

      if (typeof trace.scale_code === "string") {
        tally(groupOf(itemId, itemType, "적절성 판단"), trace.scale_code, SCALE_LABELS[trace.scale_code] ?? trace.scale_code);
      }
      if (typeof trace.band_code === "string") {
        tally(groupOf(itemId, itemType, "조절 정도 판단"), trace.band_code, bandLabel(trace.band_code));
      }
      if (typeof trace.initial_judgment === "string") {
        tally(
          groupOf(itemId, itemType, "최초 적절성 판단"),
          trace.initial_judgment,
          trace.initial_judgment === "appropriate" ? "적절하다" : "적절하지 않다",
        );
      }
      if (Array.isArray(trace.correction_indexes)) {
        const corrections = Array.isArray(meta?.corrections) ? (meta.corrections as Array<{ text?: unknown }>) : [];
        for (const index of trace.correction_indexes) {
          if (typeof index !== "number") continue;
          const text = typeof corrections[index]?.text === "string" ? (corrections[index].text as string) : null;
          tally(
            groupOf(itemId, itemType, "고른 수정안"),
            String(index),
            text ? `수정안 ${index + 1} · ${text}` : `수정안 ${index + 1}`,
          );
        }
      }
      if (typeof trace.reason_id === "string") {
        const reasons = Array.isArray(meta?.reasons) ? (meta.reasons as Array<{ id?: unknown; text_ko?: unknown }>) : [];
        const reason = reasons.find((candidate) => candidate.id === trace.reason_id);
        const text = typeof reason?.text_ko === "string" ? reason.text_ko : null;
        tally(groupOf(itemId, itemType, "고른 이유"), trace.reason_id, text || trace.reason_id);
      }
      const candidates = Array.isArray(meta?.candidates) ? (meta.candidates as Array<{ text?: unknown }>) : [];
      const candidateLabel = (index: number) => {
        const text = typeof candidates[index]?.text === "string" ? (candidates[index].text as string) : null;
        return text ? `초안 ${index + 1} · ${text}` : `초안 ${index + 1}`;
      };
      if (typeof trace.best_candidate_index === "number") {
        tally(groupOf(itemId, itemType, "BEST로 고른 초안"), String(trace.best_candidate_index), candidateLabel(trace.best_candidate_index));
      }
      if (typeof trace.worst_candidate_index === "number") {
        tally(groupOf(itemId, itemType, "WORST로 고른 초안"), String(trace.worst_candidate_index), candidateLabel(trace.worst_candidate_index));
      }
    }
  }

  const items: ItemPattern[] = [...perItem.entries()]
    .sort(([a], [b]) => a - b)
    .map(([itemId, { itemType, groups }]) => {
      const meta = itemMeta(itemId);
      const target = typeof meta?.target === "string" ? (meta.target as string) : null;
      return {
        itemId,
        title: `판단 ${itemId} · ${ITEM_TITLES[itemType] ?? itemType}`,
        targetPreview: target,
        groups: [...groups.entries()]
          .map(([heading, counts]) => toGroup(heading, counts))
          .filter((group): group is ItemChoiceGroup => group !== null),
      };
    });

  return { missionId, learners: latestByLearner.size, dissents, items };
}

const AXIS_HEADING: Record<ClassResponseCountRow["axis"], string> = {
  scale: "적절성 판단",
  band: "조절 정도 판단",
  initial_judgment: "최초 적절성 판단",
  correction: "고른 수정안",
  reason: "고른 이유",
  best: "BEST로 고른 초안",
  worst: "WORST로 고른 초안",
};

const AXIS_ORDER: ClassResponseCountRow["axis"][] = [
  "scale", "band", "initial_judgment", "correction", "reason", "best", "worst",
];

/** 서버가 반환한 익명 choice count를 기존 분포 뷰 모델로 바꾼다. */
export function missionPatternFromCounts({
  missionId,
  learners,
  dissents,
  counts,
  mission,
}: {
  missionId: string;
  learners: number;
  dissents: number;
  counts: ClassResponseCountRow[];
  mission: MissionRuntime | null;
}): MissionPattern {
  const bands = bandLabels(mission);
  const mpjItems = (mission?.mpj_items ?? []) as Array<Record<string, unknown>>;
  const itemMeta = (itemId: number) => mpjItems.find((item) => item.id === itemId) ?? null;
  const labelFor = (row: ClassResponseCountRow) => {
    const meta = itemMeta(row.item_id);
    if (row.axis === "scale") return SCALE_LABELS[row.choice_key] ?? row.choice_key;
    if (row.axis === "band") return bands.get(row.choice_key) ?? row.choice_key;
    if (row.axis === "initial_judgment") return row.choice_key === "appropriate" ? "적절하다" : "적절하지 않다";
    if (row.axis === "correction") {
      const index = Number(row.choice_key);
      const corrections = Array.isArray(meta?.corrections) ? meta.corrections as Array<{ text?: unknown }> : [];
      const text = typeof corrections[index]?.text === "string" ? corrections[index].text as string : null;
      return text ? `수정안 ${index + 1} · ${text}` : `수정안 ${index + 1}`;
    }
    if (row.axis === "reason") {
      const reasons = Array.isArray(meta?.reasons) ? meta.reasons as Array<{ id?: unknown; text_ko?: unknown }> : [];
      const reason = reasons.find((candidate) => candidate.id === row.choice_key);
      return typeof reason?.text_ko === "string" ? reason.text_ko : row.choice_key;
    }
    const index = Number(row.choice_key);
    const candidates = Array.isArray(meta?.candidates) ? meta.candidates as Array<{ text?: unknown }> : [];
    const text = typeof candidates[index]?.text === "string" ? candidates[index].text as string : null;
    return text ? `초안 ${index + 1} · ${text}` : `초안 ${index + 1}`;
  };

  const itemIds = [...new Set(counts.map((row) => row.item_id))].sort((a, b) => a - b);
  const items: ItemPattern[] = itemIds.map((itemId) => {
    const rows = counts.filter((row) => row.item_id === itemId);
    const meta = itemMeta(itemId);
    const itemType = rows[0]?.item_type ?? "judgment";
    const target = typeof meta?.target === "string" ? meta.target as string : null;
    const groups = AXIS_ORDER.flatMap((axis): ItemChoiceGroup[] => {
      const axisRows = rows.filter((row) => row.axis === axis);
      if (axisRows.length === 0) return [];
      const choices = axisRows
        .map((row) => ({ key: row.choice_key, label: labelFor(row), count: row.count }))
        .sort((a, b) => b.count - a.count);
      return [{ heading: AXIS_HEADING[axis], total: choices.reduce((sum, choice) => sum + choice.count, 0), choices }];
    });
    return {
      itemId,
      title: `판단 ${itemId} · ${ITEM_TITLES[itemType] ?? itemType}`,
      targetPreview: target,
      groups,
    };
  });

  return { missionId, learners, dissents, items };
}
