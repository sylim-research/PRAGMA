import type { MpjResponseTrace } from "@/lib/mission/missionAttemptRow";
import type { MissionRuntime } from "@/lib/pragma/missionSchema";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

export interface MpjSummaryRow {
  label: string;
  comment: string;
}

export const MPJ_SUMMARY_DIVERGENCE_COPY =
  "내 선택은 참고 판정과 달랐습니다. 왜 다르게 느꼈는지 수업에서 비교해 보세요.";

function sameNumberSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every((value) => expected.has(value));
}

/**
 * MPJ 응답을 정답 개수 대신 판단 기능과 학습자가 가져갈 개념으로 정리한다.
 * 방향·모드와 무관한 화용 구인 문구는 target feature 카탈로그에서 가져온다.
 */
export function buildMpjSummaryRows(
  mission: MissionRuntime,
  responses: MpjResponseTrace[],
): MpjSummaryRow[] {
  const feature = getTargetFeature(mission.unit.target_feature);
  const withinBandCode = feature?.within_band_code ?? "within_band";
  const lowBandCode = feature?.band_schema[0]?.code;
  const highBandCode = feature?.band_schema[feature.band_schema.length - 1]?.code;
  const summary = feature?.handoff_summary;

  return mission.mpj_items.map((item) => {
    const response = responses.find((saved) => saved.item_id === item.id);

    switch (item.type) {
      case "scale4": {
        const sameDirection =
          !!response?.scale_code &&
          (item.accepted_scale_codes as readonly string[]).includes(response.scale_code);
        return {
          label: "첫인상 판단",
          comment: sameDirection
            ? summary?.first_impression ??
              `상황과 관계에 비춰 「${mission.unit.learner_label}」의 정도를 살폈습니다.`
            : MPJ_SUMMARY_DIVERGENCE_COPY,
        };
      }
      case "judge3": {
        const sameDirection =
          !!response?.band_code &&
          (item.accepted_band_codes as readonly string[]).includes(response.band_code);
        return {
          label: "맥락 대비 판단",
          comment: sameDirection
            ? summary?.context_contrast ??
              "맥락이 달라지면 같은 표현 전략의 적절성도 달라질 수 있음을 확인했습니다."
            : MPJ_SUMMARY_DIVERGENCE_COPY,
        };
      }
      case "fix_choice": {
        const selected = response?.correction_indexes ?? [];
        const valid = item.corrections
          .map((correction, index) => (correction.is_valid ? index : -1))
          .filter((index) => index >= 0);
        const sameJudgment =
          !!response?.band_code &&
          (item.accepted_band_codes as readonly string[]).includes(response.band_code);
        const sameCorrections = sameNumberSet(selected, valid);
        return {
          label: "판단하고 고쳐보기",
          comment:
            sameJudgment && sameCorrections
              ? summary?.correction ?? "관계와 부담에 맞게 표현을 조절했습니다."
              : sameCorrections
                ? "고친 방향은 알맞았지만, 첫 판단은 참고 판정과 달랐습니다."
                : sameJudgment
                  ? "조절이 필요하다는 점은 찾았지만, 고친 방향은 참고안과 달랐습니다."
                  : MPJ_SUMMARY_DIVERGENCE_COPY,
        };
      }
      case "reason": {
        const sameReason = response?.reason_id === item.accepted_reason_id;
        return {
          label: "이유 찾기",
          comment: sameReason
            ? summary?.reason ?? "표현이 어긋난 가장 큰 이유를 찾았습니다."
            : MPJ_SUMMARY_DIVERGENCE_COPY,
        };
      }
      case "reason_conf": {
        const selected = response?.reason_ids ?? [];
        const accepted = item.accepted_reason_ids as readonly string[];
        const sameReason =
          selected.length === accepted.length &&
          selected.every((reasonId) => accepted.includes(reasonId));
        return {
          label: "이유 찾기",
          comment: sameReason
            ? summary?.reason ?? "표현이 어긋난 핵심 이유를 찾았습니다."
            : MPJ_SUMMARY_DIVERGENCE_COPY,
        };
      }
      case "multi_judge": {
        const bestIndex = response?.best_candidate_index;
        const worstIndex = response?.worst_candidate_index;
        const bestBands =
          bestIndex !== undefined ? item.candidates[bestIndex]?.accepted_band_codes ?? [] : [];
        const worstBands =
          worstIndex !== undefined ? item.candidates[worstIndex]?.accepted_band_codes ?? [] : [];
        const sameDirection =
          bestBands.includes(withinBandCode) &&
          worstBands.length > 0 &&
          !worstBands.includes(withinBandCode);
        const comparison =
          lowBandCode && worstBands.includes(lowBandCode)
            ? summary?.compare_low
            : highBandCode && worstBands.includes(highBandCode)
              ? summary?.compare_high
              : undefined;
        return {
          label: "여러 초안 비교",
          comment: sameDirection
            ? comparison ?? "상황에 잘 맞는 안과 가장 아쉬운 안을 구분했습니다."
            : MPJ_SUMMARY_DIVERGENCE_COPY,
        };
      }
    }
  });
}
