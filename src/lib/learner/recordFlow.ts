// 「내 기록」의 시각화 모델 — 표현 변화, 동료들의 판단(기준 판단 라벨), 핵심 정리.
//
// 원칙(원고 4.3.5·5.2.2): 학습자 본인의 선택을 옮겨 보일 뿐 점수·정오·유형·경향을 만들지 않는다.
// 기준 판단과 핵심 정리는 수행 당시와 같은 콘텐츠 판본(지문 일치)일 때만 미션 본문에서 그대로 읽는다.
// 학급 분포는 교수자가 「학습자 공개」한 것만 쓴다. AI 호출·새 진단 로직은 없다.

import { ACTIVITY_LABEL, bandPalette, SCALE_ORDER, type Slice, type SliceTone } from "@/lib/mission/classDiscussion";
import type { MissionPattern } from "@/lib/mission/classResponsePatterns";
import { SCOPE_LABEL } from "@/lib/pragma/feedbackSchema";

export interface ChangeMap {
  band: { label: string; tone: SliceTone } | null;
  scope: string | null;
  feature: string | null;
}

/** 동료들의 판단 — 문항별 공개 분포와 내 선택. scale = 4점 척도(단일 표현 판단·판단과 근거), choice = 수정안 선택. */
export interface ClassPosition {
  itemId: number;
  kind: "scale" | "choice";
  activity: string;
  slices: Slice[];
  total: number;
  mine: string | null;
}

/** 수행 당시 콘텐츠 판본의 기준 판단과 핵심 정리. */
export interface MissionReference {
  /** 문항 번호 → 기준 선택 키(척도 코드 또는 수정안 위치). */
  answers: Map<number, string>;
  lessonPoints: Array<{ itemId: number; label: string; text: string }>;
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
  // 요청 화행은 미션 피드백 화면과 같은 공통 상태(좋음/수정 권장)로 보여 준다. 설명과 다시 살펴볼 점은 그대로 둔다.
  const label = band && featureId === "request_mitigation_optionality"
    ? (band.tone === "teal" ? "좋음" : "수정 권장")
    : band?.label;
  return {
    band: band && label ? { label, tone: band.tone } : null,
    scope: scope ? SCOPE_LABEL[scope as keyof typeof SCOPE_LABEL] ?? scope : null,
    feature: str(obj(feedback?.blocks)?.feature_ko),
  };
}

/** 학급 비교에 쓰는 문항(학습자 제시 순서). 직접 수정은 자유 수정문이라, 복수 표현 비교는 공개 집계가 없어 뺀다. */
export const COMPARED_ITEMS = [1, 2, 3];

const CHOICE_TONES: SliceTone[] = ["navy", "navyLight", "slate"];
const choiceLabel = (key: string) => `수정안 ${Number(key) + 1}`;

/** 내 선택 — 척도 문항은 첫 판단(이유를 보기 전), 수정안 선택은 고른 수정안 위치. */
export function myChoices(contextJudgment: unknown): Map<number, string> {
  const choices = new Map<number, string>();
  for (const trace of responsesOf(contextJudgment)) {
    if (typeof trace.item_id !== "number") continue;
    if (trace.item_type === "scale4" && typeof trace.scale_code === "string") choices.set(trace.item_id, trace.scale_code);
    if (trace.item_type === "fix_choice") {
      const index = arr(trace.correction_indexes).find((value) => typeof value === "number");
      if (typeof index === "number") choices.set(trace.item_id, String(index));
    }
  }
  return choices;
}

/** 공개된 학급 분포(MissionPattern)에서 비교 문항의 분포를 꺼내 내 선택과 잇는다. */
export function classPositionsFromPattern(pattern: MissionPattern, mine: Map<number, string>): ClassPosition[] {
  return COMPARED_ITEMS.flatMap((itemId): ClassPosition[] => {
    const item = pattern.items.find((candidate) => candidate.itemId === itemId);
    const scaleGroup = item?.groups.find((candidate) => candidate.choices.some((choice) => scaleOf(choice.key)));
    if (scaleGroup) {
      const slices = SCALE_ORDER.map((scale) => ({ ...scale, count: scaleGroup.choices.find((choice) => choice.key === scale.key)?.count ?? 0 }));
      return [{
        itemId, kind: "scale",
        activity: itemId === 2 ? ACTIVITY_LABEL.scale4_reason : ACTIVITY_LABEL.scale4,
        slices, total: slices.reduce((sum, slice) => sum + slice.count, 0), mine: mine.get(itemId) ?? null,
      }];
    }
    const choiceGroup = item?.groups.find((candidate) => candidate.heading === "고른 수정안");
    if (!choiceGroup) return [];
    const keys = [...new Set(["0", "1", "2", ...choiceGroup.choices.map((choice) => choice.key)])].sort((a, b) => Number(a) - Number(b));
    const slices = keys.map((key, index) => ({
      key, label: choiceLabel(key), tone: CHOICE_TONES[index % CHOICE_TONES.length],
      count: choiceGroup.choices.find((choice) => choice.key === key)?.count ?? 0,
    }));
    return [{ itemId, kind: "choice", activity: ACTIVITY_LABEL.fix_choice, slices, total: choiceGroup.total, mine: mine.get(itemId) ?? null }];
  });
}

/**
 * 미션 본문에서 기준 판단과 핵심 정리를 읽는다. 수행 기록의 콘텐츠 지문과 본문의 지문이 같을 때만 돌려준다 —
 * 판본이 바뀐 뒤의 기준을 옛 수행에 붙이지 않는다.
 */
export function missionReference(mission: unknown, recordContentHash: string | null): MissionReference | null {
  const content = obj(mission);
  const hash = str(obj(content?.provenance)?.mission_content_hash);
  if (!content || !hash || !recordContentHash || hash !== recordContentHash) return null;
  const answers = new Map<number, string>();
  for (const item of arr(content.mpj_items).map(obj)) {
    const id = typeof item?.id === "number" ? item.id : null;
    if (id === null) continue;
    const scale = str(item?.reference_scale_code);
    if (item?.type === "scale4" && scale) answers.set(id, scale);
    if (item?.type === "fix_choice") {
      const valid = arr(item.corrections).findIndex((correction) => obj(correction)?.is_valid === true);
      if (valid >= 0) answers.set(id, String(valid));
    }
  }
  const lessonPoints = arr(content.lesson_points).map(obj).flatMap((point) => {
    const itemId = typeof point?.item_id === "number" ? point.item_id : null;
    const label = str(point?.label);
    const text = str(point?.text);
    return itemId !== null && label && text ? [{ itemId, label, text }] : [];
  });
  return { answers, lessonPoints };
}
