// 학급 응답 토론 보드의 뷰 모델 — 「판단 분포 → 근거 비교 → 토론 질문」(논문 5.2.2) 순서로 읽히게 묶는다.
//
// 입력 = learner_mission_logs 행(context_judgment 봉투 + DCT형 통번역 과제 열)과 그 미션의 mission_content.
// 문항 성격에 맞는 모양으로만 다시 센다(척도·이유 교차표·후보별 범주·수정안·자유 수정문).
//
// 원칙:
// - 읽기 전용 집계다. 새 점수·판정을 만들지 않고, 다수 선택을 정답으로 표시하지 않는다.
// - 같은 학습자가 같은 미션을 여러 번 완료했으면 최신 행만 센다(aggregateMissionResponses와 같은 규칙).
// - 자유 수정문·산출·이견 사유는 익명 사례로만 옮긴다. 이름·계정·개별 ID는 모델에 넣지 않는다.
// - 「수정 여부」와 「이견 여부」는 따로 센다. 표현을 바꾼 사실을 AI 의견 수용으로 읽지 않는다.

import { SCOPE_LABEL, SEMANTIC_LABEL, GRAMMAR_LABEL } from "@/lib/pragma/feedbackSchema";
import { withinBandCodeFor } from "@/lib/pragma/missionV6";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import {
  aggregateMissionResponses,
  parseJudgmentEnvelope,
  type ClassResponseLogRow,
  type ItemChoiceGroup,
} from "./classResponsePatterns";

/** 토론 보드가 읽는 로그 행 — 분포 집계 열에 DCT형 통번역 과제 열을 더한다. */
export interface ClassDiscussionRow extends ClassResponseLogRow {
  first_response?: string | null;
  revised_response?: string | null;
  target_feature_observed?: unknown;
}

/** 막대 색 역할. 실제 색은 화면이 정한다. */
export type SliceTone = "navy" | "navyLight" | "amber" | "rust" | "teal" | "slate";

export interface Slice {
  key: string;
  label: string;
  count: number;
  tone: SliceTone;
}

interface ItemBase {
  itemId: number;
  /** 학습자 화면과 같은 활동명(단일 표현 판단·판단과 근거·…). */
  activity: string;
  title: string | null;
  source: string | null;
  target: string | null;
  relation: string | null;
  situation: string | null;
  /** 이 문항에 응답한 학습자 수. */
  total: number;
}

export interface ScaleItemView extends ItemBase {
  kind: "scale";
  /** 척도 순서 고정(매우 적절 → 매우 부적절). 0건도 남긴다. */
  slices: Slice[];
  reasons: {
    prompt: string | null;
    options: Array<{ id: string; text: string; count: number }>;
    /** 판단 × 이유 교차표. 행 = 척도, 열 = 이유 선택지. */
    cross: Array<{ key: string; label: string; tone: SliceTone; total: number; byReason: Record<string, number> }>;
    /** 이유를 본 뒤 판단을 바꾼 응답 수. */
    revised: number;
  } | null;
}

export interface CandidatesItemView extends ItemBase {
  kind: "candidates";
  bands: Array<{ code: string; label: string; tone: SliceTone }>;
  candidates: Array<{ index: number; text: string; total: number; slices: Slice[] }>;
}

export interface CorrectionsItemView extends ItemBase {
  kind: "corrections";
  corrections: Array<{ index: number; text: string; count: number }>;
}

export interface FreeItemView extends ItemBase {
  kind: "free";
  /** 익명 수정문. 같은 문장은 묶어 건수만 올린다(분류하지 않는다). */
  texts: Array<{ text: string; count: number }>;
}

/** v6 이전 문항 형식 — 기존 축별 분포를 그대로 보여 준다. */
export interface GenericItemView extends ItemBase {
  kind: "generic";
  groups: ItemChoiceGroup[];
}

export type DiscussionItemView = ScaleItemView | CandidatesItemView | CorrectionsItemView | FreeItemView | GenericItemView;

export interface DctCaseView {
  /** 익명 번호(응답 1, 2, …). 계정과 무관하다. */
  id: string;
  first: string | null;
  final: string | null;
  decision: "revised" | "retained" | null;
  feedback: {
    bandCode: string | null;
    band: string | null;
    scope: string | null;
    semantic: string | null;
    grammar: string | null;
    feature: string | null;
    alternative: string | null;
  } | null;
  dissent: { conditions: string[]; reason: string | null } | null;
}

export interface DctView {
  mode: "translation" | "interpreting" | null;
  source: string | null;
  relation: string | null;
  situation: string | null;
  total: number;
  revised: number;
  retained: number;
  dissents: number;
  /** 1차 AI 피드백의 화용 판정 분포(기록이 있는 응답만). */
  verdicts: Slice[];
  cases: DctCaseView[];
}

export interface ClassDiscussion {
  missionId: string;
  schemaVersion: string | null;
  speechAct: string | null;
  direction: string | null;
  /** 학습 초점 이름(unit.learner_label). */
  focus: string | null;
  learners: number;
  dissents: number;
  /** 학습자 제시 순서(1 → 2 → 5 → 3 → 4). */
  items: DiscussionItemView[];
  dct: DctView;
}

export const SCALE_ORDER: Array<{ key: string; label: string; tone: SliceTone }> = [
  { key: "very_appropriate", label: "매우 적절", tone: "navy" },
  { key: "somewhat_appropriate", label: "다소 적절", tone: "navyLight" },
  { key: "somewhat_inappropriate", label: "다소 부적절", tone: "amber" },
  { key: "very_inappropriate", label: "매우 부적절", tone: "rust" },
];

/** 학습자 화면(v6 안내·진행 막대)과 같은 활동명. */
export const ACTIVITY_LABEL: Record<string, string> = {
  scale4: "단일 표현 판단",
  scale4_reason: "판단과 근거",
  multi_judge: "복수 표현 비교",
  fix_choice: "수정안 선택",
  free_correction: "직접 수정",
  judge3: "맥락 대비 판단",
  reason: "이유 찾기",
};

/** 학습자 제시 순서(2026-09-25 결정). 내부 ID는 그대로다. */
export const PRESENTATION_ORDER = [1, 2, 5, 3, 4];

export const DISSENT_LABELS: Record<string, string> = {
  relationship: "관계에 대한 다른 판단",
  burden: "행위의 부담 크기에 대한 다른 판단",
  preceding: "앞선 대화 흐름을 더 고려함",
  experience: "실제 사용 경험과 차이가 있음",
};

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** 대역 코드 → 짧은 라벨·색 역할. 가운데 범주는 teal, 나머지는 내용 순서대로 rust·slate. */
export function bandPalette(featureId: string | null): Array<{ code: string; label: string; tone: SliceTone }> {
  const feature = featureId ? getTargetFeature(featureId) : undefined;
  if (!feature) return [];
  const within = feature.within_band_code;
  const frozen = featureId ? withinBandCodeFor(featureId) : within;
  const outerTones: SliceTone[] = ["rust", "slate"];
  let outer = 0;
  const bands = feature.band_schema.map((band) => ({
    code: band.code,
    label: band.label_ko.replace(/\s*\([^)]*\)\s*$/, ""),
    tone: band.code === within ? ("teal" as SliceTone) : outerTones[outer++ % outerTones.length],
  }));
  // 요청 화행은 가운데 범주를 「appropriate」로 저장한다(동결 예외). 같은 범주로 읽는다.
  if (frozen !== within) {
    return bands.map((band) => (band.code === within ? { ...band, code: frozen } : band));
  }
  return bands;
}

/** 요청 화행은 콘텐츠·응답이 「appropriate」, AI 피드백은 「within_band」로 가운데 범주를 적는다 — 한 범주로 읽는다. */
function normalizeBand(featureId: string | null, code: string): string {
  const feature = featureId ? getTargetFeature(featureId) : undefined;
  if (!feature || !featureId) return code;
  return code === feature.within_band_code ? withinBandCodeFor(featureId) : code;
}

function latestRows(missionId: string, rows: ClassDiscussionRow[]): ClassDiscussionRow[] {
  const latest = new Map<string, ClassDiscussionRow>();
  for (const row of rows) {
    if (row.mission_id !== missionId) continue;
    const existing = latest.get(row.profile_id);
    if (!existing || (row.completed_at ?? "") > (existing.completed_at ?? "")) latest.set(row.profile_id, row);
  }
  return [...latest.values()].sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""));
}

function itemBase(itemId: number, meta: Obj | null, type: string, total: number): ItemBase {
  const hasReason = type === "scale4" && itemId === 2 && obj(meta?.reason_choice) !== null;
  return {
    itemId,
    activity: hasReason ? ACTIVITY_LABEL.scale4_reason : ACTIVITY_LABEL[type] ?? type,
    title: str(meta?.title),
    source: str(meta?.source),
    target: str(meta?.target),
    relation: str(meta?.relation_ko),
    situation: str(meta?.situation_ko),
    total,
  };
}

function buildScaleItem(itemId: number, meta: Obj | null, traces: Obj[]): ScaleItemView {
  const counts = new Map<string, number>();
  for (const trace of traces) {
    if (typeof trace.scale_code === "string") counts.set(trace.scale_code, (counts.get(trace.scale_code) ?? 0) + 1);
  }
  const slices = SCALE_ORDER.map((scale) => ({ ...scale, count: counts.get(scale.key) ?? 0 }));
  const reasonChoice = obj(meta?.reason_choice);
  const options = arr(reasonChoice?.options).map(obj).filter((option): option is Obj => option !== null)
    .map((option) => ({ id: str(option.id) ?? "", text: str(option.text) ?? "", count: 0 }))
    .filter((option) => option.id);
  let reasons: ScaleItemView["reasons"] = null;
  if (options.length > 0) {
    const cross = SCALE_ORDER.map((scale) => ({
      key: scale.key, label: scale.label, tone: scale.tone, total: 0,
      byReason: Object.fromEntries(options.map((option) => [option.id, 0])) as Record<string, number>,
    }));
    let revised = 0;
    for (const trace of traces) {
      if (typeof trace.revised_scale_code === "string") revised += 1;
      const reasonId = typeof trace.reason_id === "string" ? trace.reason_id : null;
      const scaleKey = typeof trace.scale_code === "string" ? trace.scale_code : null;
      if (!reasonId) continue;
      const option = options.find((candidate) => candidate.id === reasonId);
      if (option) option.count += 1;
      const row = cross.find((candidate) => candidate.key === scaleKey);
      if (row && option) {
        row.byReason[reasonId] = (row.byReason[reasonId] ?? 0) + 1;
        row.total += 1;
      }
    }
    reasons = { prompt: str(reasonChoice?.prompt), options, cross, revised };
  }
  return { ...itemBase(itemId, meta, "scale4", traces.length), kind: "scale", slices, reasons };
}

function buildCandidatesItem(itemId: number, meta: Obj | null, traces: Obj[], featureId: string | null): CandidatesItemView {
  const bands = bandPalette(featureId);
  const texts = arr(meta?.candidates).map(obj).map((candidate) => str(candidate?.text) ?? "");
  const perCandidate = texts.map((text, index) => ({ index, text: text || `표현 ${index + 1}`, total: 0, counts: new Map<string, number>() }));
  for (const trace of traces) {
    arr(trace.candidate_band_codes).forEach((code, index) => {
      const candidate = perCandidate[index];
      if (!candidate || typeof code !== "string") return;
      const band = normalizeBand(featureId, code);
      candidate.total += 1;
      candidate.counts.set(band, (candidate.counts.get(band) ?? 0) + 1);
    });
  }
  const candidates = perCandidate.map(({ index, text, total, counts }) => {
    const known = new Set(bands.map((band) => band.code));
    const slices: Slice[] = bands.map((band) => ({ key: band.code, label: band.label, tone: band.tone, count: counts.get(band.code) ?? 0 }));
    for (const [code, count] of counts) {
      if (!known.has(code)) slices.push({ key: code, label: code, tone: "slate", count });
    }
    return { index, text, total, slices };
  });
  return { ...itemBase(itemId, meta, "multi_judge", traces.length), kind: "candidates", bands, candidates };
}

function buildCorrectionsItem(itemId: number, meta: Obj | null, traces: Obj[]): CorrectionsItemView {
  const texts = arr(meta?.corrections).map(obj).map((correction) => str(correction?.text) ?? "");
  const counts = texts.map(() => 0);
  for (const trace of traces) {
    for (const index of arr(trace.correction_indexes)) {
      if (typeof index !== "number") continue;
      while (counts.length <= index) { counts.push(0); texts.push(""); }
      counts[index] += 1;
    }
  }
  return {
    ...itemBase(itemId, meta, "fix_choice", traces.length),
    kind: "corrections",
    corrections: texts.map((text, index) => ({ index, text: text || `수정안 ${index + 1}`, count: counts[index] })),
  };
}

function buildFreeItem(itemId: number, meta: Obj | null, traces: Obj[]): FreeItemView {
  const counts = new Map<string, number>();
  for (const trace of traces) {
    const text = str(trace.revised_text)?.trim();
    if (!text) continue;
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  const texts = [...counts.entries()].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count);
  return { ...itemBase(itemId, meta, "free_correction", traces.length), kind: "free", texts };
}

function bandLabelFor(featureId: string | null, code: string | null): string | null {
  if (!code) return null;
  return bandPalette(featureId).find((band) => band.code === code)?.label ?? code;
}

function dctCase(index: number, row: ClassDiscussionRow, featureId: string | null): DctCaseView {
  const envelope = obj(row.context_judgment);
  const dissentRaw = envelope?.kind === "learner_dissent" ? envelope : obj(envelope?.learner_dissent);
  const first = str(row.first_response);
  const final = str(row.revised_response);
  const decision: DctCaseView["decision"] = dissentRaw?.final_decision === "retained_first_response"
    ? "retained"
    : dissentRaw?.final_decision === "revised_response"
      ? "revised"
      : first && final ? (first.trim() === final.trim() ? "retained" : "revised") : null;
  const feedbackRaw = obj(row.target_feature_observed);
  const verdicts = obj(feedbackRaw?.verdicts);
  const pragmatic = obj(verdicts?.pragmatic_appropriateness);
  const blocks = obj(feedbackRaw?.blocks);
  const alternative = obj(arr(blocks?.alternatives)[0]);
  const scope = str(feedbackRaw?.revision_scope);
  const rawBand = str(pragmatic?.band_code);
  const bandCode = rawBand ? normalizeBand(featureId, rawBand) : null;
  return {
    id: `응답 ${index + 1}`,
    first,
    final,
    decision,
    feedback: verdicts
      ? {
          bandCode,
          band: bandLabelFor(featureId, bandCode),
          scope: scope ? SCOPE_LABEL[scope as keyof typeof SCOPE_LABEL] ?? scope : null,
          semantic: typeof verdicts.semantic_fidelity === "string" ? SEMANTIC_LABEL[verdicts.semantic_fidelity] ?? verdicts.semantic_fidelity : null,
          grammar: typeof verdicts.grammatical_accuracy === "string" ? GRAMMAR_LABEL[verdicts.grammatical_accuracy] ?? verdicts.grammatical_accuracy : null,
          feature: str(blocks?.feature_ko),
          alternative: str(alternative?.text),
        }
      : null,
    dissent: dissentRaw
      ? {
          conditions: arr(dissentRaw.conditions).map((code) => (typeof code === "string" ? DISSENT_LABELS[code] ?? code : "")).filter(Boolean),
          reason: str(dissentRaw.reason_ko),
        }
      : null,
  };
}

/** 미션 1개의 로그 행을 토론 보드 뷰 모델로 바꾼다. mission은 normalize 전 원본 JSON이어도 된다. */
export function buildClassDiscussion(missionId: string, rows: ClassDiscussionRow[], mission: unknown): ClassDiscussion {
  const content = obj(mission);
  const rowsLatest = latestRows(missionId, rows);
  const featureId = str(obj(content?.unit)?.target_feature);
  const mpjItems = arr(content?.mpj_items).map(obj).filter((item): item is Obj => item !== null);
  const itemMeta = (itemId: number) => mpjItems.find((item) => item.id === itemId) ?? null;

  const tracesByItem = new Map<number, { type: string; traces: Obj[] }>();
  let dissents = 0;
  for (const row of rowsLatest) {
    const { responses, dissent } = parseJudgmentEnvelope(row.context_judgment);
    if (dissent) dissents += 1;
    for (const trace of responses as Obj[]) {
      const itemId = typeof trace.item_id === "number" ? trace.item_id : null;
      const type = str(trace.item_type);
      if (itemId === null || !type) continue;
      const entry = tracesByItem.get(itemId) ?? { type, traces: [] };
      entry.traces.push(trace);
      tracesByItem.set(itemId, entry);
    }
  }

  // v6 이전 형식은 기존 축별 분포를 그대로 쓴다.
  const legacy = aggregateMissionResponses(missionId, rowsLatest, mission as Parameters<typeof aggregateMissionResponses>[2]);
  const items: DiscussionItemView[] = [];
  const ids = [...PRESENTATION_ORDER.filter((id) => tracesByItem.has(id)), ...[...tracesByItem.keys()].filter((id) => !PRESENTATION_ORDER.includes(id)).sort((a, b) => a - b)];
  for (const itemId of ids) {
    const { type, traces } = tracesByItem.get(itemId)!;
    const meta = itemMeta(itemId);
    if (type === "scale4") items.push(buildScaleItem(itemId, meta, traces));
    else if (type === "multi_judge" && traces.some((trace) => Array.isArray(trace.candidate_band_codes))) items.push(buildCandidatesItem(itemId, meta, traces, featureId));
    else if (type === "fix_choice" && !traces.some((trace) => typeof trace.band_code === "string")) items.push(buildCorrectionsItem(itemId, meta, traces));
    else if (type === "free_correction") items.push(buildFreeItem(itemId, meta, traces));
    else {
      const pattern = legacy.items.find((item) => item.itemId === itemId);
      items.push({ ...itemBase(itemId, meta, type, traces.length), kind: "generic", groups: pattern?.groups ?? [] });
    }
  }

  const task = obj(content?.production_task);
  const cases = rowsLatest.map((row, index) => dctCase(index, row, featureId)).filter((item) => item.first || item.final);
  const verdictCounts = new Map<string, number>();
  for (const item of cases) {
    if (item.feedback?.bandCode) verdictCounts.set(item.feedback.bandCode, (verdictCounts.get(item.feedback.bandCode) ?? 0) + 1);
  }
  const palette = bandPalette(featureId);
  const verdicts: Slice[] = palette.map((band) => ({ key: band.code, label: band.label, tone: band.tone, count: verdictCounts.get(band.code) ?? 0 }));
  for (const [code, count] of verdictCounts) {
    if (!palette.some((band) => band.code === code)) verdicts.push({ key: code, label: code, tone: "slate", count });
  }
  const mode = str(task?.mode);

  return {
    missionId,
    schemaVersion: str(content?.schema_version),
    speechAct: str(obj(content?.learning_goal)?.speech_act),
    direction: str(content?.direction),
    focus: str(obj(content?.unit)?.learner_label),
    learners: rowsLatest.length,
    dissents,
    items,
    dct: {
      mode: mode === "interpreting" ? "interpreting" : mode === "translation" ? "translation" : null,
      source: str(task?.source_text),
      relation: str(task?.relation_ko),
      situation: str(task?.situation_ko),
      total: cases.length,
      revised: cases.filter((item) => item.decision === "revised").length,
      retained: cases.filter((item) => item.decision === "retained").length,
      dissents: cases.filter((item) => item.dissent !== null).length,
      verdicts,
      cases,
    },
  };
}
