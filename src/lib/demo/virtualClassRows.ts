// 가상 학급 20명의 응답 행 — 학급 응답 토론 보드의 「데모 응답」.
//
// - 실제 학습자 자료가 아니다. 계정·수행 기록·DB 행을 만들지 않고 화면에서만 계산한다.
// - 선택한 미션의 실제 문항·선택지·참고 표현에서만 응답을 조립한다. 중국어 문장을 지어내지 않는다:
//   자유 수정문(MJT4)은 그 문항의 reference_alternatives·contrast, DCT형 통번역 과제의 산출과 AI 피드백은
//   대표 미션에서 기록된 실제 수행(representativeDemoFeedback)만 쓴다. 다른 미션은 참고 표현을 최종 산출로 두고
//   피드백 기록 없이 둔다.
// - 분포는 설명 목적으로 정한 것이다(판단이 갈린 문항, 같은 판단에 다른 이유, AI 피드백에 근거를 든 이견을 함께 넣는다).
// - 모든 그래프·사례는 같은 20행에서 집계된다 — 운영 화면과 같은 buildClassDiscussion을 거친다.

import type { ClassDiscussionRow } from "@/lib/mission/classDiscussion";
import { withinBandCodeFor } from "@/lib/pragma/missionV6";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import {
  DEMO_FIRST_DRAFT,
  DEMO_MJT_ANSWERS,
  DEMO_REVISED_DRAFT,
  RECORDED_FIRST_FEEDBACK,
  RECORDED_RECHECK_FEEDBACK,
} from "./representativeDemoFeedback";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "./representativeMissionSnapshot";

export const VIRTUAL_CLASS_SIZE = 20;
/**
 * 대표 미션일 때 이 자리(응답 1)는 공개 시연 미션(/demo/mission)의 시연 답안과 글자까지 같은 학습자다 —
 * 논문 4.3의 미션 캡처와 「내 기록」·학급 보드 캡처가 한 사람의 같은 수행을 가리키게 한다.
 */
export const DEMO_LEARNER_ROW = 0;
export const VIRTUAL_CLASS_NOTICE = `데모 · 가상 학급 ${VIRTUAL_CLASS_SIZE}명 · 실제 학습자 자료 아님`;

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** 건수 배열을 학습자 순서대로 편다. 합이 20이 아니면 마지막 값으로 채우거나 자른다. */
function spread<T>(plan: Array<[T, number]>): T[] {
  const out: T[] = [];
  for (const [value, count] of plan) for (let i = 0; i < count; i += 1) out.push(value);
  while (out.length < VIRTUAL_CLASS_SIZE) out.push(plan[plan.length - 1][0]);
  return out.slice(0, VIRTUAL_CLASS_SIZE);
}

/** 같은 인덱스가 늘 같은 자리에 오지 않도록 자리만 섞는다(고정 순열 — 호출마다 같다). */
function interleave<T>(values: T[]): T[] {
  const out: T[] = [];
  const step = 7; // 20과 서로소라 20자리를 한 번씩 돈다.
  for (let i = 0; i < values.length; i += 1) out[(i * step) % values.length] = values[i];
  return out;
}

const SCALE = {
  va: "very_appropriate",
  sa: "somewhat_appropriate",
  si: "somewhat_inappropriate",
  vi: "very_inappropriate",
};

/** 가상 학급 20명이 이 미션에 남긴 응답 행. v6 미션이 아니면 null. */
export function buildVirtualClassRows(missionId: string, mission: unknown): ClassDiscussionRow[] | null {
  const content = obj(mission);
  if (!content || content.schema_version !== "mission_v6") return null;
  const items = arr(content.mpj_items).map(obj);
  const item = (id: number) => items.find((candidate) => candidate?.id === id) ?? null;
  const featureId = str(obj(content.unit)?.target_feature) ?? "";
  const within = withinBandCodeFor(featureId);
  const outer = (getTargetFeature(featureId)?.band_schema ?? []).map((band) => band.code).filter((code) => code !== getTargetFeature(featureId)?.within_band_code);
  const [direct = within, indirect = within] = outer; // 요청: too_direct · too_indirect. 다른 화행도 내용 순서대로 두 범주.

  // MJT1 — 같은 표현을 다르게 판단: 3 · 7 · 8 · 2(논문 5장 가상 분포와 같다).
  const mjt1 = interleave(spread([[SCALE.va, 3], [SCALE.sa, 7], [SCALE.si, 8], [SCALE.vi, 2]]));

  // MJT2 — 판단은 부적절 쪽으로 몰리지만 이유가 갈린다. 같은 판단 안에서도 이유가 다르다.
  const reasonIds = arr(obj(item(2)?.reason_choice)?.options).map(obj).map((option) => str(option?.id) ?? "").filter(Boolean);
  const reason = (index: number) => reasonIds[index % Math.max(1, reasonIds.length)];
  const mjt2 = interleave(spread<{ scale: string; reason: string | undefined; revised?: string }>([
    [{ scale: SCALE.va, reason: reason(0) }, 2],
    [{ scale: SCALE.sa, reason: reason(0) }, 3],
    [{ scale: SCALE.sa, reason: reason(1) }, 1],
    [{ scale: SCALE.sa, reason: reason(1), revised: SCALE.si }, 2], // 이유를 본 뒤 판단을 바꾼 응답
    [{ scale: SCALE.si, reason: reason(1) }, 5],
    [{ scale: SCALE.si, reason: reason(2) }, 3],
    [{ scale: SCALE.si, reason: reason(0) }, 1],
    [{ scale: SCALE.vi, reason: reason(1) }, 2],
    [{ scale: SCALE.vi, reason: reason(2) }, 1],
  ]));

  // MJT5 — 네 후보 중 첫 후보에서 판단이 갈린다(완화 표지가 없으면 무례하다는 과잉 공손 오판을 담는다).
  const candidateCount = arr(item(5)?.candidates).length || 4;
  const plans: Array<Array<[string, number]>> = [
    [[within, 13], [direct, 6], [indirect, 1]],
    [[within, 17], [indirect, 3]],
    [[within, 15], [indirect, 4], [direct, 1]],
    [[direct, 16], [within, 4]],
  ];
  const mjt5 = Array.from({ length: candidateCount }, (_, index) => interleave(spread(plans[index % plans.length])));

  // MJT3 — 검수된 수정안을 고른 응답이 많지만 다른 수정안도 남는다.
  const corrections = arr(item(3)?.corrections).map(obj);
  const validIndex = Math.max(0, corrections.findIndex((correction) => correction?.is_valid === true));
  const others = corrections.map((_, index) => index).filter((index) => index !== validIndex);
  const mjt3 = interleave(spread<number>([[validIndex, 12], [others[0] ?? validIndex, 5], [others[1] ?? others[0] ?? validIndex, 3]]));

  // MJT4 — 수정문은 그 문항의 참고 표현·대비 표현에서만 가져온다. 대표 미션이면 연구자 실제 수정문도 한 자리 둔다.
  const free = item(4);
  const references = arr(free?.reference_alternatives).map(str).filter((text): text is string => text !== null);
  const contrast = str(obj(free?.contrast)?.target);
  const representativeFree = str(obj(arr(REPRESENTATIVE_MISSION_SNAPSHOT.mission_content.mpj_items)[3])?.target);
  const researcherText = free?.target === representativeFree ? DEMO_MJT_ANSWERS.A4?.text ?? null : null;
  const pool: Array<[string, number]> = [];
  if (references[0]) pool.push([references[0], 8]);
  if (references[1]) pool.push([references[1], 6]);
  if (contrast) pool.push([contrast, 4]);
  if (researcherText) pool.push([researcherText, 2]);
  const mjt4 = pool.length ? interleave(spread(pool)) : null;

  // DCT형 통번역 과제 — 대표 미션의 기록된 실제 수행(A → AI → B)만 사례로 쓴다.
  const task = obj(content.production_task);
  const representativeSource = str(obj(REPRESENTATIVE_MISSION_SNAPSHOT.mission_content.production_task)?.source_text);
  const recorded = str(task?.source_text) === representativeSource;
  const taskReferences = arr(task?.reference_alternatives).map(obj).map((alternative) => str(alternative?.text)).filter((text): text is string => text !== null);
  type Dct = { first: string; final: string; feedback: unknown; dissent: { conditions: string[]; reason: string; decision: "retained_first_response" | "revised_response" } | null };
  const dct: Dct[] = recorded
    ? interleave(spread<Dct>([
        [{ first: DEMO_FIRST_DRAFT, final: DEMO_REVISED_DRAFT, feedback: RECORDED_FIRST_FEEDBACK, dissent: null }, 9],
        [{ first: DEMO_FIRST_DRAFT, final: DEMO_FIRST_DRAFT, feedback: RECORDED_FIRST_FEEDBACK, dissent: {
          conditions: ["relationship"], decision: "retained_first_response",
          reason: "몇 차례 인사한 이웃이라 ‘麻烦您…了’ 정도면 충분히 공손하고, 더 돌려 말하면 오히려 어색하다고 봤습니다.",
        } }, 1],
        [{ first: DEMO_FIRST_DRAFT, final: DEMO_FIRST_DRAFT, feedback: RECORDED_FIRST_FEEDBACK, dissent: {
          conditions: ["burden"], decision: "retained_first_response",
          reason: "주말에 집을 비운 사정을 밝히고 ‘谢谢您’으로 감사도 표했으니 상대의 부담은 이미 덜었다고 생각합니다.",
        } }, 1],
        [{ first: DEMO_FIRST_DRAFT, final: DEMO_FIRST_DRAFT, feedback: RECORDED_FIRST_FEEDBACK, dissent: {
          conditions: ["experience"], decision: "retained_first_response",
          reason: "중국 친구들과 메시지를 주고받을 때 이렇게 부탁해도 문제가 없었습니다.",
        } }, 1],
        [{ first: DEMO_FIRST_DRAFT, final: DEMO_REVISED_DRAFT, feedback: RECORDED_FIRST_FEEDBACK, dissent: {
          conditions: ["preceding"], decision: "revised_response",
          reason: "선택권을 묻는 쪽으로 고치긴 했지만, 이미 몇 번 인사한 사이라 ‘给您添麻烦了’까지 붙일 필요는 없다고 봅니다.",
        } }, 1],
        [{ first: DEMO_FIRST_DRAFT, final: DEMO_FIRST_DRAFT, feedback: RECORDED_FIRST_FEEDBACK, dissent: null }, 1],
        [{ first: DEMO_REVISED_DRAFT, final: DEMO_REVISED_DRAFT, feedback: RECORDED_RECHECK_FEEDBACK, dissent: null }, 6],
      ]))
    : taskReferences.length
      ? interleave(spread<Dct>(taskReferences.map((text, index) => [{ first: text, final: text, feedback: null, dissent: null }, index === 0 ? 11 : 9])))
      : [];

  // 대표 미션이면 응답 1을 시연 답안으로 고정한다. 값을 바꾸지 않고 다른 자리와 맞바꿔 20명 분포는 그대로 둔다.
  if (recorded && researcherText) {
    const pin = <T>(list: T[], wanted: (value: T) => boolean) => {
      if (wanted(list[DEMO_LEARNER_ROW])) return;
      const j = list.findIndex((value, index) => index !== DEMO_LEARNER_ROW && wanted(value));
      if (j < 0) throw new Error("가상 학급에 시연 답안과 같은 응답이 없습니다.");
      [list[DEMO_LEARNER_ROW], list[j]] = [list[j], list[DEMO_LEARNER_ROW]];
    };
    const referenceScale = str(item(1)?.reference_scale_code) ?? SCALE.va;
    pin(mjt1, (value) => value === (DEMO_MJT_ANSWERS.A1?.pick ?? referenceScale)); // A1: 시연 답안(허용 판단), 없으면 기준 판단
    pin(mjt2, (value) => value.scale === DEMO_MJT_ANSWERS.A2?.pick && value.reason === DEMO_MJT_ANSWERS.A2?.reasonId && !value.revised);
    pin(mjt3, (value) => value === validIndex); // A3: 기준 수정안
    if (mjt4) pin(mjt4, (value) => value === researcherText);
    const candidates = arr(item(5)?.candidates).map(obj);
    mjt5.forEach((column, index) => {
      const picked = DEMO_MJT_ANSWERS.A5?.candidatePicks?.[`A5-${index}`] ?? str(arr(candidates[index]?.accepted_band_codes)[0]);
      pin(column, (value) => value === picked);
    });
    pin(dct, (value) => value.first === DEMO_FIRST_DRAFT && value.final === DEMO_REVISED_DRAFT && value.dissent === null);
  }

  const completedAt = (index: number) => new Date(Date.UTC(2026, 8, 30, 9, 0 + index)).toISOString();
  return Array.from({ length: VIRTUAL_CLASS_SIZE }, (_, index) => {
    const second = mjt2[index];
    const responses: Obj[] = [
      { item_id: 1, item_type: "scale4", completed_at: completedAt(index), scale_code: mjt1[index] },
      {
        item_id: 2, item_type: "scale4", completed_at: completedAt(index), scale_code: second.scale,
        ...(second.reason ? { reason_id: second.reason } : {}),
        ...(second.revised ? { revised_scale_code: second.revised } : {}),
      },
      { item_id: 3, item_type: "fix_choice", completed_at: completedAt(index), correction_indexes: [mjt3[index]] },
      ...(mjt4 ? [{ item_id: 4, item_type: "free_correction", completed_at: completedAt(index), revised_text: mjt4[index] }] : []),
      { item_id: 5, item_type: "multi_judge", completed_at: completedAt(index), candidate_band_codes: mjt5.map((candidate) => candidate[index]) },
    ];
    const production = dct[index];
    const dissent = production?.dissent
      ? {
          kind: "learner_dissent", at: "feedback", conditions: production.dissent.conditions,
          reason_ko: production.dissent.reason, final_decision: production.dissent.decision, created_at: completedAt(index),
        }
      : null;
    return {
      mission_id: missionId,
      profile_id: `virtual-${String(index + 1).padStart(2, "0")}`,
      completed_at: completedAt(index),
      context_judgment: {
        schema_version: "mpj_response_v2",
        mission_schema_version: "mission_v6",
        mission_content_hash: null,
        responses,
        production_support: null,
        learner_dissent: dissent,
      },
      first_response: production?.first ?? null,
      revised_response: production?.final ?? null,
      target_feature_observed: production?.feedback ?? null,
    };
  });
}
