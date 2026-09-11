import {
  buildReviewPrompt, CONTENT_REVIEW_VERSION, materializeReviewEvidence, reviewHash, validateAdjudication, validateReviewResult,
  type Adjudication, type ContentReviewRun, type ModelReview, type ReviewResult,
} from "./contentReview.ts";

export async function callContentReviewer(options: {
  stage: "openai" | "claude" | "adjudication"; run: ContentReviewRun;
  apiKey: string; model: string; fetcher?: typeof fetch;
}): Promise<ModelReview<ReviewResult | Adjudication>> {
  const { stage, run, apiKey, model, fetcher = fetch } = options;
  const prompt = buildReviewPrompt(stage, run.snapshot, run);
  const anthropic = stage === "claude";
  // Leave time for DB persistence before Supabase's 150s request limit.
  const timeoutMs = anthropic ? 130_000 : 90_000;
  const effort = anthropic && model.startsWith("claude-opus-5") ? "medium" : undefined;
  const signal = AbortSignal.timeout(timeoutMs);
  const request = anthropic ? {
    model, max_tokens: 7000, system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { ...(effort ? { effort } : {}), format: { type: "json_schema", schema: prompt.schema } },
  } : {
    model, temperature: 0, max_tokens: 7000,
    messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
    response_format: { type: "json_schema", json_schema: { name: stage === "adjudication" ? "pragma_adjudication" : "pragma_content_review", strict: true, schema: prompt.schema } },
  };
  let body: any;
  try {
    const response = await fetcher(anthropic ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions", {
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
      throw new Error(`${anthropic ? "Claude" : "OpenAI"} API 오류 (${response.status}${detail ? ` · ${detail}` : ""}). 자동 재호출하지 않았습니다.`);
    }
    body = await response.json();
  } catch (cause) {
    if (signal.aborted) throw new Error(`${anthropic ? "Claude" : "OpenAI"} 응답 대기 ${timeoutMs / 1000}초를 초과했습니다. 이전 단계 결과는 보존되며 자동 재호출은 없습니다. 과금 여부는 제공자 사용 내역에서 확인하세요.`);
    throw cause;
  }
  const completed = anthropic ? body.stop_reason === "end_turn" && !body.content?.some((block: any) => block.type === "refusal")
    : body.choices?.[0]?.finish_reason === "stop" && !body.choices[0].message?.refusal;
  if (!completed) throw new Error("모델 응답이 거절되었거나 잘렸습니다. 성공한 검수로 저장하지 않습니다.");
  const text = anthropic ? body.content.filter((block: any) => block.type === "text").map((block: any) => block.text).join("")
    : body.choices[0].message.content;
  if (typeof body.id !== "string" || typeof body.model !== "string") throw new Error("모델 호출 근거 메타데이터가 누락됐습니다.");
  const raw = JSON.parse(text);
  const grounded = materializeReviewEvidence(raw, run.snapshot, stage === "adjudication");
  const result = stage === "adjudication" ? validateAdjudication(grounded, run.claude_review!.result, run.snapshot)
    : validateReviewResult(grounded, run.snapshot, stage);
  return { result, provider: anthropic ? "anthropic" : "openai", model: body.model, requested_model: model,
    response_id: body.id, usage: body.usage ?? {}, checked_at: new Date().toISOString(),
    // Adjudication provenance: under focused_v1 the primary basis is the reused generation quality check, never a copied openai_review.
    ...(stage === "adjudication" ? {
      primary_review_source: run.openai_review ? "openai_review" : "generation_quality",
      primary_review_ref: run.openai_review?.input_hash ?? run.generation_quality?.mission_content_hash ?? null,
    } : {}),
    // DB approval expects the criteria/stage version; wire format is separate.
    prompt_version: `${CONTENT_REVIEW_VERSION}:${stage}`, output_format_version: "evidence_refs_v2", raw_result: raw,
    input_hash: await reviewHash({ system: prompt.system, user: prompt.user, schema: prompt.schema }),
    request_parameters: { max_tokens: request.max_tokens, timeout_ms: timeoutMs, ...(effort ? { effort } : {}) },
  };
}
