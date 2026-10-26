import { isReasoningModel } from "./openaiRequestContract.ts";
import {
  buildReviewPrompt, CONTENT_REVIEW_VERSION, crossReviewFindings, DEEPSEEK_PROMPT_VERSION, routeDeepseekJudgments, materializeReviewEvidence, reviewHash, validateAdjudication, validateReviewResult,
  type Adjudication, type ContentReviewRun, type ModelReview, type ReviewResult,
} from "./contentReview.ts";

export async function callContentReviewer(options: {
  stage: "openai" | "claude" | "deepseek" | "adjudication"; run: ContentReviewRun;
  apiKey: string; model: string; fetcher?: typeof fetch;
}): Promise<ModelReview<ReviewResult | Adjudication>> {
  const { stage, run, apiKey, model, fetcher = fetch } = options;
  const prompt = buildReviewPrompt(stage, run.snapshot, run);
  const anthropic = stage === "claude";
  // DeepSeek speaks the OpenAI chat format but only guarantees a JSON object, not a strict schema, so the
  // schema travels in the prompt and the same server-side evidence validation decides what is saved.
  // 중국어 표현 검토 단계(stage 이름은 저장 형식상 "deepseek")는 2026-10-26부터 GPT-6 Astra가 맡는다.
  // DeepSeek 모델을 명시적으로 지정한 경우에만 DeepSeek API로 보낸다.
  const zhStage = stage === "deepseek";
  const deepseek = zhStage && model.startsWith("deepseek");
  const vendor = anthropic ? "Claude" : deepseek ? "DeepSeek" : "OpenAI";
  // Leave time for DB persistence before Supabase's 150s request limit.
  const reasoning = !anthropic && !deepseek && isReasoningModel(model);
  const timeoutMs = anthropic || deepseek || reasoning ? 130_000 : 90_000;
  const effort = anthropic && model.startsWith("claude-opus-5") ? "medium" : undefined;
  const signal = AbortSignal.timeout(timeoutMs);
  const request = anthropic ? {
    model, max_tokens: 7000, system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { ...(effort ? { effort } : {}), format: { type: "json_schema", schema: prompt.schema } },
  } : deepseek ? {
    model, max_tokens: 16000,
    messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
    response_format: { type: "json_object" },
  } : reasoning ? {
    // 추론 모델(GPT-6 Astra 등)은 temperature를 받지 않고, 사고 토큰이 출력 상한에 들어간다.
    model, max_completion_tokens: 23000,
    messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
    response_format: { type: "json_schema", json_schema: { name: stage === "adjudication" ? "pragma_adjudication" : "pragma_content_review", strict: true, schema: prompt.schema } },
  } : {
    model, temperature: 0, max_tokens: 7000,
    messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
    response_format: { type: "json_schema", json_schema: { name: stage === "adjudication" ? "pragma_adjudication" : "pragma_content_review", strict: true, schema: prompt.schema } },
  };
  let body: any;
  try {
    const response = await fetcher(anthropic ? "https://api.anthropic.com/v1/messages"
      : deepseek ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions", {
      method: "POST", signal,
      headers: anthropic ? { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
        : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(request),
    });
    // Do not return/log provider bodies containing prompts or credentials. On a client error keep only the
    // provider's short error type/message so the cause (schema, size, model) is diagnosable without a re-call.
    if (!response.ok) {
      let detail = "";
      try { const err = (await response.json())?.error; detail = [err?.type, err?.message].filter((v) => typeof v === "string").join(": ").slice(0, 200); } catch { /* keep status only */ }
      throw new Error(`${vendor} API 오류 (${response.status}${detail ? ` · ${detail}` : ""}). 자동 재호출하지 않았습니다.`);
    }
    body = await response.json();
  } catch (cause) {
    if (signal.aborted) throw new Error(`${vendor} 응답 대기 ${timeoutMs / 1000}초를 초과했습니다. 이전 단계 결과는 보존되며 자동 재호출은 없습니다. 과금 여부는 제공자 사용 내역에서 확인하세요.`);
    throw cause;
  }
  const completed = anthropic ? body.stop_reason === "end_turn" && !body.content?.some((block: any) => block.type === "refusal")
    : body.choices?.[0]?.finish_reason === "stop" && !body.choices[0].message?.refusal;
  if (!completed) throw new Error("모델 응답이 거절되었거나 잘렸습니다. 성공한 검수로 저장하지 않습니다.");
  const text = anthropic ? body.content.filter((block: any) => block.type === "text").map((block: any) => block.text).join("")
    : body.choices[0].message.content;
  if (typeof body.id !== "string" || typeof body.model !== "string") throw new Error("모델 호출 근거 메타데이터가 누락됐습니다.");
  if (typeof text !== "string" || !text.trim()) throw new Error("모델 응답이 비어 있습니다. 성공한 검수로 저장하지 않습니다.");
  const raw = JSON.parse(text);
  const grounded = materializeReviewEvidence(raw, run.snapshot, stage === "adjudication");
  const result = stage === "adjudication" ? validateAdjudication(grounded, crossReviewFindings(run), run.snapshot)
    : zhStage ? routeDeepseekJudgments(validateReviewResult(grounded, run.snapshot, stage))
    : validateReviewResult(grounded, run.snapshot, stage);
  return { result, provider: anthropic ? "anthropic" : deepseek ? "deepseek" : "openai", model: body.model, requested_model: model,
    response_id: body.id, usage: body.usage ?? {}, checked_at: new Date().toISOString(),
    // Adjudication provenance: under focused_v1 the primary basis is the reused generation quality check, never a copied openai_review.
    ...(stage === "adjudication" ? {
      primary_review_source: run.openai_review ? "openai_review" : "generation_quality",
      primary_review_ref: run.openai_review?.input_hash ?? run.generation_quality?.mission_content_hash ?? null,
    } : {}),
    // DB approval expects the criteria/stage version; wire format is separate.
    prompt_version: `${CONTENT_REVIEW_VERSION}:${stage}`,
    // The DB pins prompt_version to criteria:stage, so the DeepSeek operating-prompt revision travels separately.
    ...(zhStage ? { stage_prompt_version: DEEPSEEK_PROMPT_VERSION } : {}), output_format_version: "evidence_refs_v2", raw_result: raw,
    input_hash: await reviewHash({ system: prompt.system, user: prompt.user, schema: prompt.schema }),
    request_parameters: { max_tokens: "max_tokens" in request ? request.max_tokens : request.max_completion_tokens, timeout_ms: timeoutMs, ...(effort ? { effort } : {}) },
  };
}
