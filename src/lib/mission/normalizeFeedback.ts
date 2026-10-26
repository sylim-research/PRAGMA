import {
  FeedbackDraftSchema,
  deriveRevisionScope,
  reconcileFeedback,
  repairPragmaticLeakIntoMeaning,
  stripPhantomAnchors,
  stripVacuousAlternatives,
  validatePragmaticCodes,
  FEEDBACK_HELD_AXES,
  type FeedbackHeldAxis,
  type RevisionScope,
  type RuntimeFeedback,
} from "@/lib/pragma/feedbackSchema";
import type { TargetFeature } from "@/lib/pragma/targetFeatures";

type FeedbackFeature = Pick<TargetFeature, "code" | "band_schema" | "within_band_code">;

export type FeedbackNormalizationResult =
  | { ok: true; feedback: RuntimeFeedback; issues: string[] }
  | { ok: false; error: string };

function missingPrimaryGuidance(
  scope: RevisionScope,
  blocks: {
    meaning_ko?: string;
    grammar?: Array<{ explanation_ko?: string }>;
    feature_ko?: string;
  },
): string | null {
  if (scope === "meaning" && !blocks.meaning_ko?.trim()) return "의미 판정 설명이 비어 있음";
  if (scope === "grammar" && !blocks.grammar?.[0]?.explanation_ko?.trim()) return "문법 판정 설명이 비어 있음";
  if (scope === "feature" && !blocks.feature_ko?.trim()) return "화용 판정 설명이 비어 있음";
  return null;
}

/** 서버 검수 결과의 보류 축. 검수 기록이 없는 응답(녹화된 데모·이전 판 서버)은 보류 없음으로 읽는다. */
function readHeldAxes(raw: unknown): FeedbackHeldAxis[] {
  const held = (raw as { review?: { held_axes?: unknown } } | null)?.review?.held_axes;
  if (!Array.isArray(held)) return [];
  return FEEDBACK_HELD_AXES.filter((axis) => held.includes(axis));
}

/**
 * Edge의 비신뢰 JSON을 학습자 화면에서 사용할 수 있는 runtime_feedback으로 바꾼다.
 * 네트워크와 분리해 모든 거부·교정 경로를 결정론적으로 회귀 테스트할 수 있게 한다.
 */
export function normalizeFeedbackResponse(
  raw: unknown,
  answer: string,
  feature: FeedbackFeature,
): FeedbackNormalizationResult {
  const parsed = FeedbackDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `피드백 형식 불일치: ${parsed.error.issues[0]?.message ?? ""}` };
  }

  const pragmaticCodeIssue = validatePragmaticCodes(
    parsed.data.verdicts,
    feature.code,
    feature.band_schema.map((band) => band.code),
  );
  if (pragmaticCodeIssue) {
    return { ok: false, error: `피드백 판정 코드 불일치: ${pragmaticCodeIssue}` };
  }

  const { verdicts, blocks, issues } = reconcileFeedback(parsed.data);
  const layerIssues = repairPragmaticLeakIntoMeaning(verdicts, blocks);
  const anchorIssues = stripPhantomAnchors(blocks, answer);
  const alternativeIssues = stripVacuousAlternatives(blocks, answer);
  // 검수에서 보류된 축은 수정 과업을 만들지 않는다(감점·재작성 강제 없음). 원 판정은 verdicts에 그대로 둔다.
  const held_axes = readHeldAxes(raw);
  const scopeVerdicts = {
    ...verdicts,
    ...(held_axes.includes("meaning") ? { semantic_fidelity: "preserved" as const } : {}),
    ...(held_axes.includes("grammar") ? { grammatical_accuracy: "clean" as const } : {}),
    ...(held_axes.includes("pragmatics")
      ? { pragmatic_appropriateness: { ...verdicts.pragmatic_appropriateness, band_code: feature.within_band_code } }
      : {}),
  };
  const revision_scope = deriveRevisionScope(scopeVerdicts, feature.within_band_code);
  const guidanceIssue = missingPrimaryGuidance(revision_scope, blocks);
  if (guidanceIssue) {
    // 핵심 카드가 빈 상태로 학습자에게 노출되는 것보다 카탈로그 원리문장 폴백이 안전하다.
    return { ok: false, error: `피드백 근거 불충분: ${guidanceIssue}` };
  }
  const envelope = raw as {
    rubric_version?: unknown;
    provenance?: { model?: unknown; prompt_version?: unknown; generated_at?: unknown };
  };
  const provenance = envelope?.provenance;

  return {
    ok: true,
    feedback: {
      schema_version: "feedback_v1",
      held_axes,
      rubric_version: typeof envelope?.rubric_version === "string" ? envelope.rubric_version : "",
      verdicts,
      revision_scope,
      blocks,
      uncertainty_flags: parsed.data.uncertainty_flags,
      provenance: {
        model: typeof provenance?.model === "string" ? provenance.model : "",
        prompt_version:
          typeof provenance?.prompt_version === "string" ? provenance.prompt_version : "feedback_v1",
        generated_at: typeof provenance?.generated_at === "string" ? provenance.generated_at : "",
      },
    },
    issues: [...issues, ...layerIssues, ...anchorIssues, ...alternativeIssues],
  };
}
