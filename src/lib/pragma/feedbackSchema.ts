// runtime_feedback (feedback_v1) — 학습자 산출에 대한 3층 진단. 생성계약 §4.
//
// 지위(0-q·95): **학습 지원용 질적 피드백**이다. 점수·총점을 산출하지 않고,
// 효과 측정에 쓰지 않는다. 화용층은 단정하지 않으며 복수의 적절한 표현을 전제한다.
//
// 설계상 반드시 지킬 것:
//  ① `revision_scope`는 **모델이 정하지 않는다** — verdicts에서 코드가 도출한다(§4).
//     모델에게 맡기면 "무엇을 고칠 차례인가"가 흔들려 피드백 화면이 일관성을 잃는다.
//  ② 교차 검증(D25) — clean이면 grammar 비어야 하고, impeding_errors면 1건 있어야 한다.
//  ③ 방향 중립 키 — alternatives[].text (계약 §4 원문의 `.zh`는 0-l 양방향 이전 표기.
//     zh_ko에서는 산출이 한국어이므로 언어 고정 키를 쓸 수 없다).
//  ④ uncertainty_flags는 **화면 비노출·로그 전용**(캘리브레이션 표본용, 삭제 금지).

import { z } from "zod";

export const SEMANTIC_FIDELITY = ["preserved", "minor_loss", "distorted"] as const;
export const GRAMMATICAL_ACCURACY = ["clean", "impeding_errors"] as const;
export const REVISION_SCOPES = ["meaning", "grammar", "feature", "clear"] as const;
export type RevisionScope = (typeof REVISION_SCOPES)[number];

const GrammarNoteSchema = z.object({
  // v1.4(0-d·33): error_type·anchor_text는 선택 필드.
  error_type: z
    .enum([
      "function_word",
      "word_order",
      "lexical_choice",
      "collocation",
      "missing_component",
      "redundant_component",
      "other",
    ])
    .optional(),
  /** 답안 내 실제 존재를 검증할 앵커(숫자 offset 없음) */
  anchor_text: z.string().trim().min(1).optional(),
  suggested_correction: z.string().trim().min(1),
  explanation_ko: z.string().trim().min(1),
});
export type GrammarNote = z.infer<typeof GrammarNoteSchema>;

export const FeedbackVerdictsSchema = z.object({
  semantic_fidelity: z.enum(SEMANTIC_FIDELITY),
  grammatical_accuracy: z.enum(GRAMMATICAL_ACCURACY),
  pragmatic_appropriateness: z.object({
    feature_code: z.string().min(1),
    band_code: z.string().min(1),
  }),
});
export type FeedbackVerdicts = z.infer<typeof FeedbackVerdictsSchema>;

/**
 * 모델이 요청한 화용 초점과 카탈로그 대역 안에서만 판정했는지 확인한다.
 * 형식상 문자열이어도 다른 초점·존재하지 않는 대역이면 해당 피드백 전체를 신뢰할 수 없다.
 */
export function validatePragmaticCodes(
  verdicts: FeedbackVerdicts,
  expectedFeatureCode: string,
  allowedBandCodes: readonly string[],
): string | null {
  const pragmatic = verdicts.pragmatic_appropriateness;
  if (pragmatic.feature_code !== expectedFeatureCode) {
    return `feature_code 불일치(${pragmatic.feature_code} ≠ ${expectedFeatureCode})`;
  }
  if (!allowedBandCodes.includes(pragmatic.band_code)) {
    return `허용되지 않은 band_code(${pragmatic.band_code})`;
  }
  return null;
}

/** 모델이 돌려주는 형태 — revision_scope 없음(코드가 도출한다). */
export const FeedbackDraftSchema = z.object({
  verdicts: FeedbackVerdictsSchema,
  blocks: z.object({
    meaning_ko: z.string().default(""),
    grammar: z.array(GrammarNoteSchema).max(1).default([]), // lite: 최대 1건(0-b·18)
    feature_ko: z.string().default(""),
    alternatives: z
      .array(z.object({ text: z.string().trim().min(1), note_ko: z.string().default("") }))
      .max(2)
      .default([]),
    /**
     * 미니 담화형 DCT 전용(mission_v5, DEC-20260730-01) — 담화 전체의 문장 연결·
     * 매체 자연성 **한 줄**. 길어지면 감량 원칙(0-r·103)이 무너지므로 한 줄로 제한한다.
     * 단문 DCT(v4 이하)에서는 빈 문자열이다.
     */
    discourse_ko: z.string().default(""),
    /**
     * 화용 집중 구간 밖 문장의 **심각한** 화용 부조화 경고(비점수). 문턱이 높다 —
     * 관계를 실제로 손상시킬 수준만. 이 값은 revision_scope에 영향을 주지 않는다
     * (완료 조건 불변). 최대 2건.
     */
    offfocus_warnings: z
      .array(z.object({ text: z.string().trim().min(1), note_ko: z.string().default("") }))
      .max(2)
      .default([]),
  }),
  uncertainty_flags: z
    .array(
      z.object({
        dimension: z.enum(["grammar", "pragmatic"]),
        reason: z.string().default(""),
      }),
    )
    .default([]),
});

export const FEEDBACK_HELD_AXES = ["meaning", "grammar", "pragmatics"] as const;
export type FeedbackHeldAxis = (typeof FEEDBACK_HELD_AXES)[number];

export const FeedbackSchema = FeedbackDraftSchema.extend({
  schema_version: z.literal("feedback_v1"),
  /** 검수 모델을 통과하지 못해 판정을 보류한 축(2026-10-26). 보류 축은 학습자에게 판정·설명을 보이지 않는다. */
  held_axes: z.array(z.enum(FEEDBACK_HELD_AXES)).default([]),
  rubric_version: z.string().default(""),
  revision_scope: z.enum(REVISION_SCOPES),
  provenance: z.object({
    model: z.string().default(""),
    prompt_version: z.string().default(""),
    /** 같은 후보 계약으로 생성된 코어·미션·피드백을 묶는 표식. */
    content_release_id: z.string().default(""),
    generated_at: z.string().default(""),
  }),
});
export type RuntimeFeedback = z.infer<typeof FeedbackSchema>;

/**
 * revision_scope 도출 — 코드 소관(§4). 수정 우선순위 = 의미 → 목표 화용 축 → 문법 → 없음.
 * 한 번의 수정 과업에서는 의미 전달을 먼저 회복하고, 의미가 보존됐다면 이번 미션이
 * 훈련하는 목표 화용 축을 문법보다 먼저 다룬다. 세 층의 독립 판정 자체는 유지한다.
 */
export function deriveRevisionScope(v: FeedbackVerdicts, withinBandCode: string): RevisionScope {
  if (v.semantic_fidelity !== "preserved") return "meaning";
  if (v.pragmatic_appropriateness.band_code !== withinBandCode) return "feature";
  if (v.grammatical_accuracy === "impeding_errors") return "grammar";
  return "clear";
}

/**
 * 교차 필드 정합(D25). 모델 응답의 흔한 모순을 **버리지 않고 교정**한다 —
 * 피드백 1건이 통째로 사라지는 것보다, 모순된 층만 정리하는 편이 학습자에게 낫다.
 * 반환된 issues는 로그·디버깅용(화면 비노출).
 */
export function reconcileFeedback(draft: z.infer<typeof FeedbackDraftSchema>): {
  verdicts: FeedbackVerdicts;
  blocks: z.infer<typeof FeedbackDraftSchema>["blocks"];
  issues: string[];
} {
  const issues: string[] = [];
  const verdicts = { ...draft.verdicts };
  // zod default()가 채우지만 strict:false 환경이라 타입상 optional — 방어적으로 편다.
  const blocks = { ...draft.blocks, grammar: [...(draft.blocks.grammar ?? [])] };

  if (verdicts.grammatical_accuracy === "clean" && blocks.grammar.length > 0) {
    // 문법이 깨끗하다면서 교정을 단 경우 — 교정을 버린다(감점 근거가 없으므로).
    issues.push("clean인데 grammar가 비어 있지 않아 제거함");
    blocks.grammar = [];
  }
  if (verdicts.grammatical_accuracy === "impeding_errors" && blocks.grammar.length === 0) {
    // 오류가 있다면서 무엇인지 못 대면 판정을 내린다 — 근거 없는 지적을 남기지 않는다.
    issues.push("impeding_errors인데 grammar가 비어 clean으로 강등함");
    verdicts.grammatical_accuracy = "clean";
  }
  return { verdicts, blocks, issues };
}

/**
 * 의미 층에 목표 화용 자원의 변화만 근거로 든 모델 응답을 결정론적으로 교정한다.
 *
 * 같은 명제를 더 직접적·간접적이거나 더 약하고 강하게 말했다는 차이는 의미 손실이
 * 아니다. 모델이 의미 판정을 낮췄더라도 구체적인 사실·참여자·시간·장소·조건·행위의
 * 차이를 설명하지 못하면 근거 없는 판정이므로 preserved로 되돌리고 화용 판정은
 * 그대로 유지한다.
 */
export function repairPragmaticLeakIntoMeaning(
  verdicts: FeedbackVerdicts,
  blocks: z.infer<typeof FeedbackDraftSchema>["blocks"],
): string[] {
  if (verdicts.semantic_fidelity === "preserved") return [];

  const explanation = blocks.meaning_ko ?? "";
  const pragmaticCue =
    /완화|완충|선택권|거절할 여지|명령(?:문|형)?|직접적|간접적|우회|공손|정중|부드럽|말투|질문형|의문형|표현의? 강도|감사 강도|칭찬 강도|평가 강도|과장|압박|장황|모호/.test(
      explanation,
    );
  const meaningUnit =
    "(?:사실|참여자|사람|상대|대상|장소|시간|날짜|조건|이유|행동|행위|요청 내용|요구 내용)";
  const concreteMeaningEvidence =
    new RegExp(
      [
        `${meaningUnit}.{0,24}(?:누락|빠졌|생략|추가|뒤바뀌|왜곡|전달되지)`,
        `(?:누락|빠졌|생략|추가|뒤바뀌|왜곡)(?:된|한)?\\s*${meaningUnit}`,
        `원문에 없(?:는|던)?.{0,12}${meaningUnit}`,
        `다른\\s*${meaningUnit}`,
        "요청(?:이|을).{0,24}(?:철회|수락|사실 진술|진술로|다른 행동|다른 행위)",
        "잘못 옮",
        "반대 의미",
      ].join("|"),
    ).test(explanation);

  if (!pragmaticCue || concreteMeaningEvidence) return [];

  verdicts.semantic_fidelity = "preserved";
  blocks.meaning_ko =
    "구체적인 사실·조건의 차이가 확인되지 않아 뜻은 유지된 것으로 봅니다. 표현의 강도·완화·선택권·명료성 같은 목표 화용 차이는 화용 층에서 살펴봅니다.";
  return ["목표 화용 차이만 근거로 한 의미 손실 판정을 preserved로 교정함"];
}

/** anchor_text가 실제 학습자 답안에 있는지 — 없으면 앵커만 떼고 설명은 남긴다. */
export function stripPhantomAnchors(blocks: { grammar?: GrammarNote[] }, answer: string): string[] {
  const issues: string[] = [];
  for (const g of blocks.grammar ?? []) {
    if (g.anchor_text && !answer.includes(g.anchor_text)) {
      issues.push(`anchor_text "${g.anchor_text}"가 답안에 없어 제거함`);
      delete g.anchor_text;
    }
  }
  return issues;
}

/**
 * 답안과 완전히 같거나 서로 중복된 대안은 학습자에게 새 선택지를 주지 못한다.
 * 모델 응답 전체를 버리지는 않고 해당 대안만 제거한다.
 */
export function stripVacuousAlternatives(
  blocks: { alternatives?: Array<{ text?: string; note_ko?: string }> },
  answer: string,
): string[] {
  const issues: string[] = [];
  const seen = new Set([answer.trim()]);
  blocks.alternatives = (blocks.alternatives ?? []).filter((alternative) => {
    const text = alternative.text?.trim() ?? "";
    if (!text) {
      issues.push("빈 alternative를 제거함");
      return false;
    }
    if (seen.has(text)) {
      issues.push(
        text === answer.trim()
          ? "학습자 답안과 동일한 alternative를 제거함"
          : `중복 alternative "${text}"를 제거함`,
      );
      return false;
    }
    seen.add(text);
    return true;
  });
  return issues;
}

// ── 학습자 화면 라벨 (내부 코드 비노출) ────────────────────────────────
export const SEMANTIC_LABEL: Record<string, string> = {
  preserved: "뜻이 그대로 전달됩니다",
  minor_loss: "일부 뉘앙스가 옅어졌습니다",
  distorted: "뜻이 달라진 부분이 있습니다",
};
export const GRAMMAR_LABEL: Record<string, string> = {
  clean: "이해를 막는 오류 없음",
  impeding_errors: "이해를 방해하는 부분이 있습니다",
};
/** 다듬기 단계에서 "무엇을 볼 차례인가"를 알려주는 라벨. */
export const SCOPE_LABEL: Record<RevisionScope, string> = {
  meaning: "뜻 전달",
  grammar: "이해를 막는 표현",
  feature: "상대에게 주는 인상",
  clear: "특별히 고칠 곳 없음",
};
