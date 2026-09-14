// feedback-lite 런타임 호출 (계약 §4, 지위 = 0-q·95 학습 지원용 질적 피드백).
//
// 흐름: 학습자 제출 → edge action:'feedback' → 모델은 verdicts·blocks만 답한다
//       → **여기서 revision_scope를 도출**하고 교차 모순(D25)을 정리한다.
// 실패해도 미션 진행을 막지 않는다 — 피드백이 없으면 기존의 정직 표기로 되돌아간다.

import { supabase } from "@/integrations/supabase/client";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import {
  FEEDBACK_TIMEOUT_MS,
  feedbackInvokeErrorMessage,
} from "@/lib/mission/feedbackTransport";
import { normalizeFeedbackResponse } from "@/lib/mission/normalizeFeedback";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { MissionRuntime } from "@/lib/pragma/missionSchema";

export interface FeedbackRequestResult {
  ok: boolean;
  feedback?: RuntimeFeedback;
  /** 로그·디버깅용(화면 비노출) — 모델 응답에서 정리한 모순 목록. */
  issues?: string[];
  error?: string;
}

/**
 * 학습자 산출 1건에 대한 3층 진단을 받아온다.
 * @param answer 통역이면 **학습자가 확인한 전사**만 넘긴다(§4 제약 7).
 */
export async function requestFeedback(
  mission: Pick<MissionRuntime, "direction" | "unit" | "production_task">,
  answer: string,
): Promise<FeedbackRequestResult> {
  const feature = getTargetFeature(mission.unit.target_feature);
  if (!feature) return { ok: false, error: "화용 초점 카탈로그를 찾을 수 없습니다." };

  const pt = mission.production_task;
  const dir = mission.direction;
  const zhko = dir === "zh_ko";

  try {
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "feedback",
        feedback: {
          answer,
          direction: dir,
          mode: pt.mode,
          situation_ko: pt.situation_ko,
          relation_ko: pt.relation_ko,
          pdr: pt.pdr,
          source_text: pt.source_text,
          preceding_turn: pt.preceding_turn ?? null,
          usable_facts: pt.usable_facts ?? [],
          // 미니 담화형 DCT(mission_v5)만 존재. 화용 판정 범위를 이 구간으로 좁힌다.
          ...("focal_segments" in pt && Array.isArray(pt.focal_segments)
            ? { focal_segments: pt.focal_segments }
            : {}),
          feature: {
            code: feature.code,
            learner_label: feature.learner_label,
            operational_definition:
              zhko && feature.operational_definition_zh_ko
                ? feature.operational_definition_zh_ko
                : feature.operational_definition,
            band_schema: feature.band_schema,
            excluded_confounds:
              zhko && feature.excluded_confounds_zh_ko
                ? feature.excluded_confounds_zh_ko
                : feature.excluded_confounds,
          },
          rubric_version: `${feature.code}@${feature.version}`,
        },
      },
      timeout: FEEDBACK_TIMEOUT_MS,
    });
    if (error) return { ok: false, error: feedbackInvokeErrorMessage(error) };

    const raw = (data as { feedback?: unknown })?.feedback;
    return normalizeFeedbackResponse(raw, answer, feature);
  } catch (e) {
    return { ok: false, error: feedbackInvokeErrorMessage(e) };
  }
}
