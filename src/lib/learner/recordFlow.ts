// 「내 기록」의 시각화 모델 — 표현 변화와 학급 속 내 위치.
//
// 원칙(원고 4.3.5·5.2.3): 학습자 본인의 선택을 옮겨 보일 뿐 점수·정오·유형을 만들지 않는다.
// 참고 답(accepted codes)은 읽지 않는다. 학급 분포는 교수자가 「학습자 공개」한 것만 쓴다.

import { ACTIVITY_LABEL, bandPalette, SCALE_ORDER, type Slice, type SliceTone } from "@/lib/mission/classDiscussion";
import type { MissionPattern } from "@/lib/mission/classResponsePatterns";
import { SCOPE_LABEL } from "@/lib/pragma/feedbackSchema";

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
