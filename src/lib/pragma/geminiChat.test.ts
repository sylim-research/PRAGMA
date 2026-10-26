import { describe, expect, it } from "vitest";
import { buildGeminiRequest, callGeminiChat, geminiToChatEnvelope, GEMINI_THINKING_EXTRA_TOKENS } from "../../../supabase/functions/_shared/geminiChat";

const schemaFormat = { type: "json_schema", json_schema: { name: "x", strict: true, schema: { type: "object" } } };
const input = { model: "gemini-3.1-pro-preview", system: "S", user: "U", temperature: 0.3, maxCompletionTokens: 1200, responseFormat: schemaFormat };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const reply = { modelVersion: "gemini-3.1-pro-preview", candidates: [{ finishReason: "STOP",
  content: { parts: [{ text: "thinking", thought: true }, { text: "```json\n{\"a\":1}\n```" }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 7, totalTokenCount: 22 } };

describe("Gemini chat adapter", () => {
  it("passes the JSON schema and adds thinking headroom to the output cap", () => {
    const req = buildGeminiRequest(input);
    expect(req.generationConfig.responseJsonSchema).toEqual({ type: "object" });
    expect(req.generationConfig.maxOutputTokens).toBe(1200 + GEMINI_THINKING_EXTRA_TOKENS);
    expect(req.systemInstruction.parts[0].text).toBe("S");
  });

  it("wraps the reply as an OpenAI chat completion without thought parts or fences", () => {
    const env = JSON.parse(geminiToChatEnvelope(reply, input.model));
    expect(env.choices[0].message.content).toBe('{"a":1}');
    expect(env.choices[0].finish_reason).toBe("stop");
    expect(env.usage.completion_tokens).toBe(12);
    expect(JSON.parse(geminiToChatEnvelope({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }, "m")).choices[0].finish_reason).toBe("length");
  });

  it("retries once without the schema when Gemini rejects it", async () => {
    const bodies: any[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1 ? new Response('{"error":{"message":"Invalid schema"}}', { status: 400 }) : ok(reply);
    }) as typeof fetch;
    const result = await callGeminiChat(input, "key", fetcher);
    expect(result.ok).toBe(true);
    expect(bodies[0].generationConfig.responseJsonSchema).toBeDefined();
    expect(bodies[1].generationConfig.responseJsonSchema).toBeUndefined();
  });
});
