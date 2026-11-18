// feedback-lite 요청 비용 경계.
//
// answer만 제한하면 상황·원문·카탈로그 설명에 대용량 문자열을 넣어 프롬프트 비용을
// 증폭시킬 수 있다. Edge가 JSON을 파싱한 뒤 OpenAI를 호출하기 전에 전체 payload도
// 제한한다. 정상 mission_v2 요청보다 충분히 큰 값이라 기존 학습 흐름에는 영향이 없다.

export const FEEDBACK_MAX_ANSWER_CHARS = 4_000
export const FEEDBACK_MAX_PAYLOAD_CHARS = 32_000
// feedback_v1은 짧은 3층 진단 JSON이다. 모델 기본 최대치(수만 토큰)를 그대로
// 열어 두지 않고 출력 비용의 절대 상한을 둔다. 작성 모델 Astra는 추론 토큰도 이
// 한도에 포함되므로 피드백 검토 호출과 같은 12,000으로 둔다(2026-11-18).
export const FEEDBACK_MAX_COMPLETION_TOKENS = 12_000

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function feedbackPayloadIssue(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'feedback body required'
  }

  const request = body as Record<string, unknown>
  const answer = request.answer
  if (!isNonEmptyString(answer)) {
    return 'feedback body required (answer)'
  }
  if (answer.length > FEEDBACK_MAX_ANSWER_CHARS) {
    return `feedback answer too long (max ${FEEDBACK_MAX_ANSWER_CHARS} chars)`
  }

  const payloadChars = JSON.stringify(body).length
  if (payloadChars > FEEDBACK_MAX_PAYLOAD_CHARS) {
    return `feedback payload too large (max ${FEEDBACK_MAX_PAYLOAD_CHARS} chars)`
  }

  if (request.direction !== 'ko_zh' && request.direction !== 'zh_ko') {
    return 'feedback body required (direction)'
  }
  if (request.mode !== 'translation' && request.mode !== 'interpreting') {
    return 'feedback body required (mode)'
  }
  for (const field of ['situation_ko', 'relation_ko', 'source_text'] as const) {
    if (!isNonEmptyString(request[field])) {
      return `feedback body required (${field})`
    }
  }

  const pdr = request.pdr
  if (!pdr || typeof pdr !== 'object' || Array.isArray(pdr)) {
    return 'feedback body required (pdr)'
  }
  const pdrObject = pdr as Record<string, unknown>
  if (!isNonEmptyString(pdrObject.p) || !isNonEmptyString(pdrObject.d) || !isNonEmptyString(pdrObject.r)) {
    return 'feedback body required (pdr.p/d/r)'
  }

  const feature = request.feature
  if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
    return 'feedback body required (feature)'
  }
  const featureObject = feature as Record<string, unknown>
  if (
    !isNonEmptyString(featureObject.code) ||
    !isNonEmptyString(featureObject.operational_definition) ||
    !Array.isArray(featureObject.band_schema) ||
    featureObject.band_schema.length === 0
  ) {
    return 'feedback body required (feature definition/bands)'
  }
  return null
}
