// 학습자 피드백 검수(2026-10-26 UI 브리프 v2 승인). 실시간 피드백은 교수자 승인을 거칠 수 없으므로
// 작성 모델(Gemini)의 판정·설명을 다른 회사 모델(GPT-6 Astra)이 축마다 검수하고, 통과한 축만 학습자에게 보인다.
// 교차 검토는 오류를 발견할 기회를 늘리는 장치이며 오류 방지를 보장하지 않는다.
// - 통과 못 한 축 = 판정 보류(감점·재작성 강제 없음). 검수 실패·시간 초과 = 모든 축 보류.
// - 실시간 새 문장(대안 표현)은 내보내지 않는다. 화면은 미션에 저장된 참고 표현(T3 검토·교수자 승인본)을 쓴다.

export const FEEDBACK_REVIEW_PROMPT_VERSION = 'feedback_review_v1'
export const FEEDBACK_REVIEW_AXES = ['meaning', 'grammar', 'pragmatics'] as const
export type FeedbackReviewAxis = typeof FEEDBACK_REVIEW_AXES[number]

const axisSchema = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, reason_ko: { type: 'string' } },
  required: ['pass', 'reason_ko'],
  additionalProperties: false,
}

export const FEEDBACK_REVIEW_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'pragma_feedback_review',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        axes: {
          type: 'object',
          properties: { meaning: axisSchema, grammar: axisSchema, pragmatics: axisSchema },
          required: ['meaning', 'grammar', 'pragmatics'],
          additionalProperties: false,
        },
      },
      required: ['axes'],
      additionalProperties: false,
    },
  },
} as const

export function buildFeedbackReviewSystemPrompt(direction: 'ko_zh' | 'zh_ko') {
  const target = direction === 'zh_ko'
    ? '목표 언어는 한국어다. 중국어 원문의 뜻·의도가 학습자의 한국어 답안에 대응하는지, 높임·어미·자연스러움 판단이 맞는지 본다.'
    : '목표 언어는 중국어다. 한국어 원문의 뜻·의도가 학습자의 중국어 답안에 보존됐는지, 중국어 문법·연어·자연스러움 판단이 맞는지 본다.'
  return `너는 통번역 학습자에게 나갈 피드백의 검수자다. 다른 모델이 쓴 피드백을 학습자에게 보여도 되는지 축마다 판정한다.
축: meaning(의미적 충실성), grammar(문법적 정확성), pragmatics(화용적 적절성).
${target}
각 축에서 두 가지를 모두 확인한다.
1) 판정이 맞는가. 원문의 뜻과 의도가 답안에 보존됐는지를 먼저 본다.
2) 그 축의 설명에 틀린 말이 없는가. 답안에 없는 내용을 지적하거나, 틀린 언어 규칙을 말하거나, 관용적인 사과·감사 표현을 과도하게 해석하는 것은 틀린 말이다.
둘 다 맞으면 pass=true, 하나라도 틀렸거나 확신할 수 없으면 pass=false다. 표현 취향의 차이만으로 false를 주지 않는다.
reason_ko는 한국어 한 줄로 쓴다(pass=true면 빈 문자열 가능). JSON만 출력한다.`
}

export function buildFeedbackReviewUserPrompt(input: {
  direction: string; mode: string; situation_ko?: string; relation_ko?: string; source_text?: string;
  answer: string; feature?: { learner_label?: string; operational_definition?: string };
  feedback: Record<string, unknown>;
}) {
  const fb = input.feedback as { verdicts?: unknown; blocks?: Record<string, unknown> }
  const blocks = fb.blocks ?? {}
  return JSON.stringify({
    task: { direction: input.direction, mode: input.mode, situation_ko: input.situation_ko ?? '', relation_ko: input.relation_ko ?? '' },
    source_text: input.source_text ?? '',
    learner_answer: input.answer,
    target_feature: { label: input.feature?.learner_label ?? '', definition: input.feature?.operational_definition ?? '' },
    feedback_to_review: {
      verdicts: fb.verdicts ?? null,
      meaning_ko: blocks.meaning_ko ?? '',
      grammar: blocks.grammar ?? [],
      pragmatics_ko: blocks.feature_ko ?? '',
      discourse_ko: blocks.discourse_ko ?? '',
    },
  })
}

/** 검수 응답을 읽는다. 형식이 어긋나면 null(= 모든 축 보류). */
export function readFeedbackReview(value: unknown): Record<FeedbackReviewAxis, { pass: boolean; reason_ko: string }> | null {
  const axes = (value as { axes?: Record<string, unknown> })?.axes
  if (!axes || typeof axes !== 'object') return null
  const out = {} as Record<FeedbackReviewAxis, { pass: boolean; reason_ko: string }>
  for (const axis of FEEDBACK_REVIEW_AXES) {
    const a = axes[axis] as { pass?: unknown; reason_ko?: unknown } | undefined
    if (!a || typeof a.pass !== 'boolean') return null
    out[axis] = { pass: a.pass, reason_ko: typeof a.reason_ko === 'string' ? a.reason_ko : '' }
  }
  return out
}

/**
 * 검수 결과를 피드백에 반영한다. 보류된 축의 설명은 비우고, 실시간 대안 문장은 항상 비운다.
 * review = null 이면 검수 실패·시간 초과로 보고 모든 축을 보류한다.
 */
export function applyFeedbackReview(
  feedback: Record<string, unknown>,
  review: ReturnType<typeof readFeedbackReview>,
  reviewer: { model: string; status: 'reviewed' | 'unavailable' },
) {
  const held = review ? FEEDBACK_REVIEW_AXES.filter((axis) => !review[axis].pass) : [...FEEDBACK_REVIEW_AXES]
  const blocks = { ...((feedback.blocks as Record<string, unknown>) ?? {}) }
  blocks.alternatives = []
  if (held.includes('meaning')) blocks.meaning_ko = ''
  if (held.includes('grammar')) blocks.grammar = []
  if (held.includes('pragmatics')) {
    blocks.feature_ko = ''
    blocks.discourse_ko = ''
    blocks.offfocus_warnings = []
  }
  return {
    ...feedback,
    blocks,
    review: {
      prompt_version: FEEDBACK_REVIEW_PROMPT_VERSION,
      status: review ? reviewer.status : 'unavailable',
      model: reviewer.model,
      held_axes: held,
      reasons: review ? Object.fromEntries(FEEDBACK_REVIEW_AXES.map((axis) => [axis, review[axis].reason_ko])) : {},
    },
  }
}
