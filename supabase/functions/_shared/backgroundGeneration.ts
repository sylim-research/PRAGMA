import { AsyncLocalStorage } from 'node:async_hooks';

export const ASTRA_GENERATION_MODEL = 'gpt-6-astra';
export const BACKGROUND_GENERATION_VERSION = 'astra_background_v1';
export class GenerationPending extends Error {}
export class GenerationStopped extends Error {}

export type ProviderStep = {
  key: string; eventId: string; model: string; startedAt: string;
  state: 'submitting' | 'waiting' | 'completed' | 'stopped';
  responseId?: string; raw?: string; error?: string; durationMs?: number; providerResponse?: Record<string, unknown>;
};
export type GenerationCall = {
  model: string; system: string; user: unknown;
  temperature: number; maxCompletionTokens?: number; responseFormat?: Record<string, unknown>;
};
export type BackgroundContext = {
  jobId: string;
  call: (input: GenerationCall) => Promise<{ raw: string; eventId: string; durationMs: number }>;
};
// Recovery may replay completed calls or retrieve a known response, never resend an ambiguous submission.
export function canResumeGeneration(job: { status: string; result?: unknown; steps: ProviderStep[] }): boolean {
  return job.status === 'failed' && !job.result && job.steps.every(step =>
    (step.state === 'completed' && Boolean(step.raw)) || (step.state === 'waiting' && Boolean(step.responseId)));
}
export const backgroundContext = new AsyncLocalStorage<BackgroundContext>();

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function generationHash(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export function backgroundRequest(input: GenerationCall) {
  const format = input.responseFormat ?? { type: 'json_object' };
  const textFormat = format.type === 'json_schema'
    ? { type: 'json_schema', ...(format.json_schema as Record<string, unknown>) } : format;
  if (typeof input.user !== 'string') throw new GenerationStopped('비동기 미션은 텍스트 입력만 지원합니다.');
  return {
    model: input.model, background: true, store: true,
    input: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }],
    text: { format: textFormat },
    max_output_tokens: input.maxCompletionTokens ?? 16000,
    ...(input.model === ASTRA_GENERATION_MODEL
      ? { reasoning: { effort: 'medium' } } : { temperature: input.temperature }),
  };
}

// Preserve the existing parser/ledger contract, including reasoning usage and actual model.
export function completedChatEnvelope(response: Record<string, any>): string {
  if (response.status !== 'completed') {
    throw new GenerationStopped(`Astra 응답 미완료: ${response.status} (${response.incomplete_details?.reason ?? response.error?.code ?? 'unknown'})`);
  }
  const content = (response.output ?? []).filter((item: any) => item.type === 'message')
    .flatMap((item: any) => item.content ?? []).filter((part: any) => part.type === 'output_text')
    .map((part: any) => part.text).join('');
  if (!content) throw new GenerationStopped('생성 응답에 완성된 본문이 없습니다.');
  return JSON.stringify({
    id: response.id, model: response.model, choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: response.usage?.input_tokens, completion_tokens: response.usage?.output_tokens,
      total_tokens: response.usage?.total_tokens, prompt_tokens_details: response.usage?.input_tokens_details,
      completion_tokens_details: response.usage?.output_tokens_details },
  });
}

/** Replays already completed calls, then yields at the next pending provider response.
 * No Edge invocation waits for a long generation. No ambiguous POST is sent twice.
 */
export function createBackgroundContext(args: {
  jobId: string; steps: ProviderStep[]; apiKey: string;
  save: (steps: ProviderStep[]) => Promise<void>; fetcher?: typeof fetch;
}): BackgroundContext {
  let cursor = 0;
  const fetcher = args.fetcher ?? fetch;
  return { jobId: args.jobId, async call(input) {
    const index = cursor++;
    const request = backgroundRequest(input);
    const key = await generationHash(request);
    let step = args.steps[index];
    if (step && step.key !== key) throw new GenerationStopped('생성 조건이 바뀌어 기존 작업을 이어갈 수 없습니다.');
    if (step?.state === 'submitting') throw new GenerationStopped('요청 접수 여부를 확인할 수 없습니다. 중복 과금을 막기 위해 자동 재호출하지 않습니다.');
    if (step?.state === 'stopped') throw new GenerationStopped(step.error ?? '제공자가 생성을 중단했습니다. 이전 결과는 보존됩니다.');
    if (step?.raw) return { raw: step.raw, eventId: step.eventId, durationMs: step.durationMs ?? 0 };
    const headers = { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' };
    if (!step) {
      if (index >= 16) throw new GenerationStopped('미션당 호출 한도에 도달했습니다. 이전 결과는 보존됩니다.');
      step = { key, eventId: crypto.randomUUID(), model: input.model, startedAt: new Date().toISOString(), state: 'submitting' };
      args.steps.push(step);
      // Persist intent BEFORE dispatch. A lost create response requires explicit reconciliation.
      await args.save(args.steps);
      try {
        const response = await fetcher('https://api.openai.com/v1/responses', {
          method: 'POST', headers,
          body: JSON.stringify({ ...request, metadata: { pragma_job_id: args.jobId, pragma_step: String(index) } }),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new GenerationStopped(`생성 요청 오류 HTTP ${response.status}`);
        const body = await response.json();
        if (typeof body.id !== 'string' || !body.id.startsWith('resp_')) throw new GenerationStopped('응답 ID를 받지 못했습니다.');
        step.responseId = body.id; step.state = 'waiting';
        await args.save(args.steps);
      } catch (error) {
        // Even a timeout may have incurred cost. Never restart this step automatically.
        throw new GenerationStopped(error instanceof GenerationStopped ? error.message : '요청 접수 여부 확인 필요 — 자동 재호출하지 않습니다.');
      }
      throw new GenerationPending();
    }
    let response: Response;
    try { response = await fetcher(`https://api.openai.com/v1/responses/${step.responseId}`, {
      headers, signal: AbortSignal.timeout(20000),
    }); } catch { throw new GenerationPending(); }
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) throw new GenerationPending();
      throw new GenerationStopped(`생성 결과 조회 오류 HTTP ${response.status}`);
    }
    const body = await response.json();
    if (body.status === 'queued' || body.status === 'in_progress') throw new GenerationPending();
    // Keep failed/incomplete output and billed usage as well as completed output.
    step.providerResponse = body;
    try { step.raw = completedChatEnvelope(body); step.state = 'completed'; }
    catch (error) { step.state = 'stopped'; step.error = (error as Error).message; await args.save(args.steps); throw error; }
    step.durationMs = Date.now() - Date.parse(step.startedAt);
    await args.save(args.steps);
    return { raw: step.raw, eventId: step.eventId, durationMs: step.durationMs };
  }};
}
