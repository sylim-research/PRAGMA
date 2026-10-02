// 「내 기록」의 시각화 모델 — 한 수행의 흐름(MJT → DCT)과 표현 변화, 학급 속 내 위치.
//
// 원칙(원고 4.3.5·5.2.3): 학습자 본인의 선택을 옮겨 보일 뿐 점수·정오·유형을 만들지 않는다.
// 참고 답(accepted codes)은 읽지 않는다. 학급 분포는 교수자가 「학습자 공개」한 것만 쓴다.

import { ACTIVITY_LABEL, bandPalette, PRESENTATION_ORDER, SCALE_ORDER, type Slice, type SliceTone } from "@/lib/mission/classDiscussion";
import type { MissionPattern } from "@/lib/mission/classResponsePatterns";
import { SCOPE_LABEL } from "@/lib/pragma/feedbackSchema";

export interface FlowStep {
  key: string;
  /** "MJT 1" · "DCT" */
  tag: string;
  activity: string;
  /** 대표 값(척도 이름·수정안 번호·결정). MJT5는 dots로 대신한다. */
  value: string | null;
  tone: SliceTone | null;
  /** MJT2에서 이유를 본 뒤 바꾼 판단. */
  changedTo: { value: string; tone: SliceTone } | null;
  /** MJT5 — 표현마다 고른 범주. */
  dots: Array<{ label: string; tone: SliceTone }>;
  /** DCT에서 이견을 남겼는가. */
  dissent: boolean;
}

export interface ChangeMap {
  band: { label: string; tone: SliceTone } | null;
  scope: string | null;
  feature: string | null;
}

/** 학급 속 내 위치 — 척도 문항(MJT1·MJT2)별 공개 분포와 내 선택. */
export interface ClassPosition {
  itemId: number;
  activity: string;
  slices: Slice[];
  total: number;
  mine: string | null;
}

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const scaleOf = (code: unknown) => SCALE_ORDER.find((scale) => scale.key === code) ?? null;

function responsesOf(contextJudgment: unknown): Obj[] {
  return arr(obj(contextJudgment)?.responses).map(obj).filter((item): item is Obj => item !== null);
}

/** 한 수행의 흐름 — 학습자 제시 순서(1 → 2 → 5 → 3 → 4) 뒤에 DCT형 통번역 과제. */
export function buildMissionFlow({ contextJudgment, featureId, decision, dissent }: {
  contextJudgment: unknown;
  featureId: string | null;
  decision: "최초 산출 유지" | "수정" | null;
  dissent: boolean;
}): FlowStep[] {
  const responses = responsesOf(contextJudgment);
  const bands = bandPalette(featureId);
  const ids = [...PRESENTATION_ORDER, ...responses.map((trace) => trace.item_id).filter((id): id is number => typeof id === "number" && !PRESENTATION_ORDER.includes(id))];
  const steps: FlowStep[] = [];
  for (const id of ids) {
    const trace = responses.find((candidate) => candidate.item_id === id);
    if (!trace) continue;
    const type = str(trace.item_type) ?? "";
    const base = { key: `mjt-${id}`, tag: `MJT ${id}`, value: null, tone: null, changedTo: null, dots: [], dissent: false } as FlowStep;
    if (type === "scale4") {
      const scale = scaleOf(trace.scale_code);
      const revised = scaleOf(trace.revised_scale_code);
      steps.push({
        ...base,
        activity: typeof trace.reason_id === "string" || id === 2 ? ACTIVITY_LABEL.scale4_reason : ACTIVITY_LABEL.scale4,
        value: scale?.label ?? null,
        tone: scale?.tone ?? null,
        changedTo: revised ? { value: revised.label, tone: revised.tone } : null,
      });
    } else if (type === "multi_judge") {
      const dots = arr(trace.candidate_band_codes).map((code) => {
        const band = bands.find((candidate) => candidate.code === code);
        return { label: band?.label ?? String(code), tone: band?.tone ?? ("slate" as SliceTone) };
      });
      steps.push({ ...base, activity: ACTIVITY_LABEL.multi_judge, dots, value: dots.length ? null : "응답함" });
    } else if (type === "fix_choice") {
      const index = arr(trace.correction_indexes).find((value) => typeof value === "number") as number | undefined;
      steps.push({ ...base, activity: ACTIVITY_LABEL.fix_choice, value: index !== undefined ? `수정안 ${index + 1}` : "응답함", tone: "navy" });
    } else if (type === "free_correction") {
      steps.push({ ...base, activity: ACTIVITY_LABEL.free_correction, value: str(trace.revised_text) ? "직접 고쳐 씀" : "응답함", tone: "navy" });
    } else {
      steps.push({ ...base, activity: ACTIVITY_LABEL[type] ?? type, value: "응답함", tone: "navy" });
    }
  }
  if (decision || steps.length > 0) {
    steps.push({
      key: "dct",
      tag: "DCT",
      activity: "통번역 · 최종 결정",
      value: decision === "수정" ? "수정" : decision === "최초 산출 유지" ? "최초 산출 유지" : null,
      tone: decision === "수정" ? "amber" : "navy",
      changedTo: null,
      dots: [],
      dissent,
    });
  }
  return steps;
}

/** 저장된 AI 피드백에서 화용 판정 범주·다시 볼 곳·설명 한 덩이를 꺼낸다. */
export function buildChangeMap(feedbackRaw: unknown, featureId: string | null): ChangeMap | null {
  const feedback = obj(feedbackRaw);
  const verdicts = obj(feedback?.verdicts);
  if (!verdicts) return null;
  const pragmatic = obj(verdicts.pragmatic_appropriateness);
  const code = str(pragmatic?.band_code);
  const palette = bandPalette(featureId);
  const feature = featureId ? palette : [];
  // 피드백은 가운데 범주를 within_band로 적는다 — 내용 쪽 이름(요청은 appropriate)과 같은 범주로 읽는다.
  const band = code
    ? feature.find((candidate) => candidate.code === code) ?? (code === "within_band" ? feature.find((candidate) => candidate.tone === "teal") : undefined)
    : undefined;
  const scope = str(feedback?.revision_scope);
  return {
    band: band ? { label: band.label, tone: band.tone } : null,
    scope: scope ? SCOPE_LABEL[scope as keyof typeof SCOPE_LABEL] ?? scope : null,
    feature: str(obj(feedback?.blocks)?.feature_ko),
  };
}

/** 내 척도 선택(MJT1·MJT2). */
export function myScaleChoices(contextJudgment: unknown): Map<number, string> {
  const choices = new Map<number, string>();
  for (const trace of responsesOf(contextJudgment)) {
    if (typeof trace.item_id === "number" && trace.item_type === "scale4" && typeof trace.scale_code === "string") {
      choices.set(trace.item_id, trace.scale_code);
    }
  }
  return choices;
}

/** 공개된 학급 분포(MissionPattern)에서 척도 문항의 분포를 꺼내 내 선택과 잇는다. */
export function classPositionsFromPattern(pattern: MissionPattern, mine: Map<number, string>): ClassPosition[] {
  return [1, 2].flatMap((itemId) => {
    const item = pattern.items.find((candidate) => candidate.itemId === itemId);
    const group = item?.groups.find((candidate) => candidate.choices.some((choice) => scaleOf(choice.key)));
    if (!group) return [];
    const slices = SCALE_ORDER.map((scale) => ({ ...scale, count: group.choices.find((choice) => choice.key === scale.key)?.count ?? 0 }));
    return [{
      itemId,
      activity: itemId === 2 ? ACTIVITY_LABEL.scale4_reason : ACTIVITY_LABEL.scale4,
      slices,
      total: slices.reduce((sum, slice) => sum + slice.count, 0),
      mine: mine.get(itemId) ?? null,
    }];
  });
}
