// Gemini generateContent를 OpenAI chat/completions 형식으로 감싼다(2026-10-26 역할 배정).
// 호출부는 OpenAI 응답 모양(choices[0].message.content · usage)만 읽으므로 응답을 같은 모양으로 바꿔 돌려준다.
// 형식 조정 규칙은 모델 비교 실험(2026-10-22~26)과 같다: 사고 토큰 여유분 추가, json_schema → responseJsonSchema,
// 스키마 거절 시 JSON 형식만 요구하고 1회 재전송, 응답 전체를 감싼 ``` 울타리는 벗긴다.
import type { OpenAIResponseFormat, OpenAIUserContent } from './openaiRequestContract.ts'

export const GEMINI_THINKING_EXTRA_TOKENS = 16_000
const GEMINI_MAX_OUTPUT_TOKENS = 65_536

export const isGeminiModel = (model: string) => model.startsWith('gemini-')

export interface GeminiChatInput {
  model: string
  system: string
  user: OpenAIUserContent
  temperature: number
  maxCompletionTokens?: number
  responseFormat?: OpenAIResponseFormat
}

const userText = (user: OpenAIUserContent) => typeof user === 'string'
  ? user
  : user.map((part) => typeof part.text === 'string' ? part.text : '').join('\n')

export function buildGeminiRequest(input: GeminiChatInput, withSchema = true) {
  const format = input.responseFormat as { type?: string; json_schema?: { schema?: unknown } } | undefined
  const schema = format?.type === 'json_schema' ? format.json_schema?.schema : undefined
  const generationConfig: Record<string, unknown> = {
    temperature: input.temperature,
    maxOutputTokens: Math.min((input.maxCompletionTokens ?? 4_000) + GEMINI_THINKING_EXTRA_TOKENS, GEMINI_MAX_OUTPUT_TOKENS),
    responseMimeType: 'application/json',
    ...(withSchema && schema ? { responseJsonSchema: schema } : {}),
  }
  return {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: 'user', parts: [{ text: userText(input.user) }] }],
    generationConfig,
  }
}

function stripFence(text: string) {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return m ? m[1] : text
}

/** Gemini 응답 → OpenAI chat completion JSON 문자열. 잘림은 finish_reason 'length'. */
export function geminiToChatEnvelope(body: any, requestedModel: string): string {
  const candidate = body?.candidates?.[0]
  const content = stripFence((candidate?.content?.parts ?? [])
    .filter((part: any) => !part.thought).map((part: any) => part.text ?? '').join(''))
  const usage = body?.usageMetadata ?? {}
  return JSON.stringify({
    id: body?.responseId ?? null,
    model: body?.modelVersion ?? requestedModel,
    choices: [{ index: 0, message: { role: 'assistant', content },
      finish_reason: candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop' }],
    usage: {
      prompt_tokens: usage.promptTokenCount ?? null,
      completion_tokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) || null,
      total_tokens: usage.totalTokenCount ?? null,
      prompt_tokens_details: { cached_tokens: usage.cachedContentTokenCount ?? null },
      completion_tokens_details: { reasoning_tokens: usage.thoughtsTokenCount ?? null },
    },
  })
}

export async function callGeminiChat(input: GeminiChatInput, apiKey: string, fetcher: typeof fetch = fetch) {
  const send = (withSchema: boolean) => fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiRequest(input, withSchema)),
    })
  let res = await send(true)
  let text = await res.text()
  if (res.status === 400 && /schema/i.test(text) && input.responseFormat) {
    res = await send(false)
    text = await res.text()
  }
  if (!res.ok) return { ok: false as const, status: res.status, raw: text, requestId: res.headers.get('x-request-id') }
  let body: unknown
  try { body = JSON.parse(text) } catch { return { ok: false as const, status: 502, raw: text, requestId: null } }
  return { ok: true as const, status: 200, raw: geminiToChatEnvelope(body, input.model), requestId: res.headers.get('x-request-id') }
}
