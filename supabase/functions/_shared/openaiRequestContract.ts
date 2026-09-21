export const OPENAI_MODEL_ROUTES = {
  default: {
    primary: 'gpt-4.1-mini',
    // 연구 콘텐츠는 실패를 숨기고 다른 모델로 강등하지 않는다.
    fallback: null,
  },
  mission: {
    primary: 'gpt-4o',
    fallback: null,
  },
  // mission_v6 초안 생성기(2026-09-21 파일럿: gpt-4o·4.1보다 원문 충실성·사건 다양성이 확연히 나음).
  mission_v6: {
    primary: 'gpt-5.5',
    fallback: null,
  },
  critic: {
    primary: 'gpt-4.1',
    fallback: null,
  },
  // 학습자 런타임 피드백은 연구 정본과 분리된 가용성 정책을 쓴다.
  feedback: {
    primary: 'gpt-4.1-mini',
    fallback: 'gpt-4o-mini',
  },
} as const

export type OpenAIUserContent = string | Array<Record<string, unknown>>
export type OpenAIResponseFormat = Readonly<Record<string, unknown>>

export interface OpenAIInvocationMetadata {
  responseId: string | null
  model: string | null
  finishReason: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  cachedTokens: number | null
  reasoningTokens: number | null
}

const nonNegativeInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null

/**
 * Chat Completions 응답에서 비용·재현성 메타데이터만 뽑는다.
 * 프롬프트와 모델 출력 본문은 연구 호출 장부에 복제하지 않는다.
 */
export function parseOpenAIInvocationMetadata(raw: string): OpenAIInvocationMetadata {
  let parsed: Record<string, unknown> = {}
  try {
    const candidate = JSON.parse(raw)
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>
    }
  } catch {
    // 전송 오류 본문이 JSON이 아니어도 호출 실패 행은 남길 수 있어야 한다.
  }

  const usage = parsed.usage && typeof parsed.usage === 'object' && !Array.isArray(parsed.usage)
    ? parsed.usage as Record<string, unknown>
    : {}
  const promptDetails = usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object'
    ? usage.prompt_tokens_details as Record<string, unknown>
    : {}
  const completionDetails = usage.completion_tokens_details && typeof usage.completion_tokens_details === 'object'
    ? usage.completion_tokens_details as Record<string, unknown>
    : {}
  const firstChoice = Array.isArray(parsed.choices) && parsed.choices[0] && typeof parsed.choices[0] === 'object'
    ? parsed.choices[0] as Record<string, unknown>
    : {}

  return {
    responseId: typeof parsed.id === 'string' ? parsed.id : null,
    model: typeof parsed.model === 'string' ? parsed.model : null,
    finishReason: typeof firstChoice.finish_reason === 'string' ? firstChoice.finish_reason : null,
    promptTokens: nonNegativeInteger(usage.prompt_tokens),
    completionTokens: nonNegativeInteger(usage.completion_tokens),
    totalTokens: nonNegativeInteger(usage.total_tokens),
    cachedTokens: nonNegativeInteger(promptDetails.cached_tokens),
    reasoningTokens: nonNegativeInteger(completionDetails.reasoning_tokens),
  }
}

export const OPENAI_JSON_OBJECT_RESPONSE_FORMAT = {
  type: 'json_object',
} as const satisfies OpenAIResponseFormat

// v2 = 미니 담화형 원문 + focal_segments(DEC-20260730-01). 이름을 올리면 코어
// 표면 해시 계열도 함께 바뀌므로 legacy 계열과 섞어 생성하지 않는다(0-v·125).
export const CORE_RESPONSE_SCHEMA_NAME = 'pragma_scenario_core_v2'
export const CORE_RESPONSE_FORMAT_LABEL = `json_schema:${CORE_RESPONSE_SCHEMA_NAME}`

export const CORE_STRUCTURED_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: CORE_RESPONSE_SCHEMA_NAME,
    strict: true,
    schema: {
      type: 'object',
      properties: {
        situation_ko: { type: 'string' },
        relation_ko: { type: 'string' },
        source_text: { type: 'string' },
        preceding_turn: { type: ['string', 'null'] },
        brief_note_ko: { type: 'string' },
        // 화용 집중 구간 — head 정확히 1 + support 0~2. 각 text는 source_text의
        // 정확한 부분문자열이어야 한다(클라 R29가 검사).
        focal_segments: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              role: { type: 'string', enum: ['head', 'support'] },
            },
            required: ['text', 'role'],
            additionalProperties: false,
          },
        },
      },
      required: [
        'situation_ko',
        'relation_ko',
        'source_text',
        'preceding_turn',
        'brief_note_ko',
        'focal_segments',
      ],
      additionalProperties: false,
    },
  },
} as const satisfies OpenAIResponseFormat

interface OpenAIChatRequestInput {
  model: string
  system: string
  user: OpenAIUserContent
  temperature: number
  maxCompletionTokens?: number
  responseFormat?: OpenAIResponseFormat
}

/** 추론 모델(gpt-5·o 계열)은 temperature를 받지 않는다(기본값만 허용). */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model)
}

export function buildOpenAIChatRequest(input: OpenAIChatRequestInput) {
  return {
    model: input.model,
    response_format: input.responseFormat ?? OPENAI_JSON_OBJECT_RESPONSE_FORMAT,
    ...(isReasoningModel(input.model) ? {} : { temperature: input.temperature }),
    ...(input.maxCompletionTokens
      ? { max_completion_tokens: input.maxCompletionTokens }
      : {}),
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
  }
}
