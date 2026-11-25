// 실시간 AI 피드백의 표현 힌트 후보(판정 체계 v2, 2026-11-25 연구자 결정).
//
// 완성 문장 대신, 학습자가 앞선 MJT에서 이미 본 표현 가운데 교수자가 승인한 「적절」 표현만
// 힌트로 가리킨다. 모델은 번호만 고르고, 화면은 여기 저장된 문구를 그대로 보여 준다
// (모델이 고쳐 쓴 중국어는 승인된 문구로 취급하지 않는다).
//
// 넣지 않는 것:
// - 학습을 위해 일부러 덜 적절하게 만든 후보(승인됐어도 써도 좋은 표현이 아니다).
// - DCT의 추천 표현·대안 문장(이번 과제의 답이다).

import type { MissionQuest } from "@/lib/mission/canonicalMissionPreview";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { withinBandCodeFor } from "@/lib/pragma/missionV6";

export interface FeedbackHintReference {
  id: string;
  text: string;
  /** 학습자 화면의 문항 이름(예: 「판단 3」). */
  source_label: string;
}

const APPROPRIATE_SCALE = new Set(["very_appropriate", "somewhat_appropriate"]);
const MJT_KINDS = new Set<MissionQuest["kind"]>(["scale", "fix_choice", "free_correction", "spectrum", "best_worst", "reason"]);

function push(out: FeedbackHintReference[], seen: Set<string>, text: string | undefined, label: string) {
  const value = text?.trim();
  if (!value || seen.has(value)) return;
  seen.add(value);
  out.push({ id: `H${out.length + 1}`, text: value, source_label: label });
}

/**
 * 미션의 MJT 문항에서 「적절」로 승인된 표현을 모은다.
 * @param withinBandCodes 이 미션 화용 초점의 「알맞음」 대역 코드(요청 화행의 동결 코드 포함).
 */
export function buildFeedbackHintReferences(
  quests: readonly MissionQuest[],
  withinBandCodes: readonly string[],
): FeedbackHintReference[] {
  const out: FeedbackHintReference[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const quest of quests) {
    if (!MJT_KINDS.has(quest.kind)) continue;
    order += 1;
    const label = `판단 ${order}`;
    switch (quest.kind) {
      case "scale":
        if (APPROPRIATE_SCALE.has(quest.referenceAnswer)) push(out, seen, quest.target, label);
        for (const example of quest.revisionExamples ?? []) push(out, seen, example, label);
        break;
      case "fix_choice":
        for (const correction of quest.corrections) if (correction.valid) push(out, seen, correction.text, label);
        break;
      case "free_correction":
        for (const reference of quest.references) push(out, seen, reference, label);
        break;
      case "spectrum":
        for (const candidate of quest.candidates) {
          if (candidate.acceptedAnswers.some((code) => withinBandCodes.includes(code))) push(out, seen, candidate.text, label);
        }
        break;
      case "best_worst":
        push(out, seen, quest.candidates.find((candidate) => candidate.id === quest.bestId)?.text, label);
        break;
      default:
        break;
    }
  }
  // 프롬프트가 길어지지 않도록 앞에서부터 8개까지만 보낸다.
  return out.slice(0, 8);
}

/** 미션의 화용 초점으로 「알맞음」 코드를 찾아 힌트 후보를 만든다. 초점을 모르면 빈 목록이다. */
export function feedbackHintReferencesFor(quests: readonly MissionQuest[], featureCode: string | undefined): FeedbackHintReference[] {
  if (!featureCode) return [];
  const feature = getTargetFeature(featureCode);
  if (!feature) return [];
  return buildFeedbackHintReferences(quests, [...new Set([feature.within_band_code, withinBandCodeFor(featureCode)])]);
}
