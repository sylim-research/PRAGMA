import { describe, expect, it } from "vitest";

import {
  buildOpenAIChatRequest,
  CORE_RESPONSE_FORMAT_LABEL,
  CORE_RESPONSE_SCHEMA_NAME,
  CORE_STRUCTURED_RESPONSE_FORMAT,
  OPENAI_JSON_OBJECT_RESPONSE_FORMAT,
  OPENAI_MODEL_ROUTES,
  parseOpenAIInvocationMetadata,
} from "../../../supabase/functions/_shared/openaiRequestContract";

describe("OpenAI request contract", () => {
  it("keeps the current model roles explicit and centralized", () => {
    expect(OPENAI_MODEL_ROUTES).toEqual({
      default: {
        primary: "gpt-4.1-mini",
        fallback: null,
      },
      mission: {
        primary: "gpt-4o",
        fallback: null,
      },
      mission_v6: {
        primary: "gpt-5.5",
        fallback: null,
      },
      critic: {
        primary: "gpt-4.1",
        fallback: null,
      },
      feedback: {
        primary: "gpt-4.1-mini",
        fallback: "gpt-4o-mini",
      },
    });
  });

  it("omits temperature only for reasoning models", () => {
    const base = { system: "s", user: "u", temperature: 0.4 };
    expect(buildOpenAIChatRequest({ ...base, model: "gpt-5.5" })).not.toHaveProperty("temperature");
    expect(buildOpenAIChatRequest({ ...base, model: "o3" })).not.toHaveProperty("temperature");
    expect(buildOpenAIChatRequest({ ...base, model: "gpt-4.1" }).temperature).toBe(0.4);
  });

  it("extracts usage without retaining prompt or response content", () => {
    const metadata = parseOpenAIInvocationMetadata(JSON.stringify({
      id: "chatcmpl-test",
      model: "gpt-4.1-2026-01-01",
      choices: [{ finish_reason: "stop", message: { content: "private output" } }],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 80 },
        completion_tokens_details: { reasoning_tokens: 12 },
      },
    }));

    expect(metadata).toEqual({
      responseId: "chatcmpl-test",
      model: "gpt-4.1-2026-01-01",
      finishReason: "stop",
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      cachedTokens: 80,
      reasoningTokens: 12,
    });
    expect(metadata).not.toHaveProperty("content");
  });

  it("returns nullable usage fields for non-JSON error bodies", () => {
    expect(parseOpenAIInvocationMetadata("upstream timeout")).toEqual({
      responseId: null,
      model: null,
      finishReason: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      cachedTokens: null,
      reasoningTokens: null,
    });
  });

  it("uses JSON mode by default without changing existing non-core actions", () => {
    const request = buildOpenAIChatRequest({
      model: OPENAI_MODEL_ROUTES.default.primary,
      system: "system",
      user: "user",
      temperature: 0.2,
      maxCompletionTokens: 512,
    });

    expect(request.response_format).toBe(OPENAI_JSON_OBJECT_RESPONSE_FORMAT);
    expect(request.max_completion_tokens).toBe(512);
  });

  it("defines a strict, closed schema for core model output", () => {
    expect(CORE_RESPONSE_FORMAT_LABEL).toBe(
      `json_schema:${CORE_RESPONSE_SCHEMA_NAME}`,
    );
    expect(CORE_STRUCTURED_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(CORE_STRUCTURED_RESPONSE_FORMAT.json_schema.strict).toBe(true);

    const schema = CORE_STRUCTURED_RESPONSE_FORMAT.json_schema.schema;
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(
      Object.keys(schema.properties).sort(),
    );
    expect(schema.properties.preceding_turn.type).toEqual(["string", "null"]);
  });

  it("places the strict schema in an explicit core request", () => {
    const request = buildOpenAIChatRequest({
      model: OPENAI_MODEL_ROUTES.default.primary,
      system: "system",
      user: "user",
      temperature: 0.7,
      responseFormat: CORE_STRUCTURED_RESPONSE_FORMAT,
    });

    expect(request.response_format).toBe(CORE_STRUCTURED_RESPONSE_FORMAT);
    expect("max_completion_tokens" in request).toBe(false);
  });
});
