// 학습자 피드백 구체성 검사(2026-10-27 연구자 결정, 1안).
// 설명은 학습자가 실제로 쓴 표현을 인용하고 고칠 행동 하나를 말한다. 일반론·추상적 제안은 내보내지 않는다.
// 새 목표어 문장·표현은 만들지 않는다 — 설명 속 한자(중국어)는 학습자 답안이나 원문에 그대로 있는 것만 허용한다.
// 결정론으로 잡을 수 있는 것만 본다. 「구체적인 행동인가」의 나머지 판단은 검수 모델이 한다.

import type { FeedbackReviewAxis } from './feedbackReview.ts'

/** 고칠 방향을 말하지 않고 점검만 권하는 문구. 들어 있으면 그 설명은 일반론으로 본다. */
export const GENERIC_FEEDBACK_PHRASES = [
  '검토할 필요',
  '검토해 보',
  '고려해 보',
  '고려할 필요',
  '살펴보',
  '다시 확인해',
  '보완이 필요',
  '보완할 필요',
  '개선이 필요',
  '개선할 필요',
  '더 자연스러운 표현',
  '더 적절한 표현',
] as const

const TEXT_BLOCKS: Array<{ key: 'meaning_ko' | 'feature_ko' | 'discourse_ko'; axis: FeedbackReviewAxis }> = [
  { key: 'meaning_ko', axis: 'meaning' },
  { key: 'feature_ko', axis: 'pragmatics' },
  { key: 'discourse_ko', axis: 'pragmatics' },
]

const HAN_RUN = /[㐀-䶿一-鿿豈-﫿]+/g
const compact = (text: string) => text.replace(/\s+/g, '')

export interface ConcretenessIssue {
  axis: FeedbackReviewAxis
  block: string
  kind: 'generic_phrase' | 'new_target_text'
  detail: string
}

/** 설명 블록의 일반 문구와, 답안·원문에 없는 한자 표현을 찾는다. 문법 수정 제안(grammar)은 기존 계약대로 보지 않는다. */
export function findConcretenessIssues(
  feedback: Record<string, unknown>,
  answer: string,
  sourceText: string,
): ConcretenessIssue[] {
  const blocks = (feedback.blocks as Record<string, unknown> | undefined) ?? {}
  const allowed = compact(`${answer}\n${sourceText}`)
  const issues: ConcretenessIssue[] = []
  for (const { key, axis } of TEXT_BLOCKS) {
    const text = typeof blocks[key] === 'string' ? (blocks[key] as string) : ''
    if (!text.trim()) continue
    for (const phrase of GENERIC_FEEDBACK_PHRASES) {
      if (text.includes(phrase)) issues.push({ axis, block: key, kind: 'generic_phrase', detail: phrase })
    }
    for (const run of text.match(HAN_RUN) ?? []) {
      if (!allowed.includes(run)) issues.push({ axis, block: key, kind: 'new_target_text', detail: run })
    }
  }
  return issues
}

/** 한 번 다시 쓰게 할 때 모델에 덧붙이는 교정 지시. */
export function concretenessRetryNote(issues: ConcretenessIssue[]): string {
  const lines = issues.map((issue) => issue.kind === 'generic_phrase'
    ? `- ${issue.block}: 「${issue.detail}」 같은 일반 권고를 쓰지 마라. 학습자 답안의 해당 표현을 그대로 인용하고, 무엇을 어떻게 바꿀지 행동 하나를 말하라.`
    : `- ${issue.block}: 「${issue.detail}」는 학습자 답안·원문에 없는 새 목표어 표현이다. 새 표현을 만들지 말고 학습자 답안이나 원문의 표현만 그대로 인용하라.`)
  return `[직전 출력 교정 — 아래만 고치고 판정은 근거가 바뀌지 않는 한 유지하라]\n${lines.join('\n')}`
}

/** 재생성 뒤에도 남은 문제의 축. 이 축은 판정 보류로 내보낸다. */
export function concretenessHeldAxes(issues: ConcretenessIssue[]): FeedbackReviewAxis[] {
  return [...new Set(issues.map((issue) => issue.axis))]
}
