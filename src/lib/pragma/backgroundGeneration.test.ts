import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { ASTRA_GENERATION_MODEL, backgroundRequest, completedChatEnvelope, createBackgroundContext,
  GenerationPending, generationHash, canResumeGeneration, type ProviderStep } from '../../../supabase/functions/_shared/backgroundGeneration';
import { invokeAstraMission, type GenerationJob } from './backgroundGenerationApi';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
beforeAll(() => vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal }));
afterAll(() => vi.unstubAllGlobals());
const input = { model: ASTRA_GENERATION_MODEL, system: 'JSON', user: 'mission', temperature: 0.3 };
const completed = { id: 'resp_1', model: ASTRA_GENERATION_MODEL, status: 'completed',
  output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
  usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300, output_tokens_details: { reasoning_tokens: 50 } } };

describe('durable background generation', () => {
  it('allows explicit recovery only when existing provider work can be preserved', () => {
    const step = { key: 'key', eventId: 'id', model: input.model, startedAt: '' };
    expect(canResumeGeneration({ status: 'failed', steps: [] })).toBe(true);
    expect(canResumeGeneration({ status: 'failed', steps: [{ ...step, state: 'waiting', responseId: 'resp_1' }] })).toBe(true);
    expect(canResumeGeneration({ status: 'failed', steps: [{ ...step, state: 'submitting' }] })).toBe(false);
    expect(canResumeGeneration({ status: 'failed', steps: [{ ...step, state: 'stopped' }] })).toBe(false);
    expect(canResumeGeneration({ status: 'failed', steps: [], result: { stop_code: 'quality_fail' } })).toBe(false);
  });
  it('resumes an explicit job with the current conditions, without starting a new job', async () => {
    const request = vi.fn().mockResolvedValue({ job: { id: 'job1', status: 'completed', result: { mission_content: {} } } });
    await invokeAstraMission({ action: 'mission' }, { resumeJobId: 'job1', request });
    expect(request).toHaveBeenCalledExactlyOnceWith({ action: 'resume', job_id: 'job1', generation_request: { action: 'mission' } });
  });
  it('preserves structured output and medium reasoning without unsupported temperature', () => {
    const request = backgroundRequest({ ...input, responseFormat: { type: 'json_schema', json_schema: { name: 'scene', strict: true, schema: { type: 'object' } } } });
    expect(request).toMatchObject({ model: ASTRA_GENERATION_MODEL, background: true, store: true,
      reasoning: { effort: 'medium' }, max_output_tokens: 16000,
      text: { format: { type: 'json_schema', name: 'scene', strict: true } } });
    expect(request).not.toHaveProperty('temperature');
    expect(backgroundRequest({ ...input, model: 'gpt-4.1' })).not.toHaveProperty('reasoning');
  });
  it('hashes object key order consistently but differentiates generation content', async () => {
    expect(await generationHash({ a: 1, b: 2 })).toBe(await generationHash({ b: 2, a: 1 }));
    expect(await generationHash({ a: 1 })).not.toBe(await generationHash({ a: 2 }));
  });
  it('saves before dispatch, recovers after a fresh worker, and never regenerates completed work', async () => {
    let persisted: ProviderStep[] = [];
    const save = vi.fn(async steps => { persisted = structuredClone(steps); });
    const fetcher = vi.fn(async (_url, request) => {
      if (request?.method === 'POST') {
        expect(persisted[0].state).toBe('submitting');
        return Response.json({ id: 'resp_1', status: 'queued' });
      }
      return Response.json(completed);
    });
    const make = () => createBackgroundContext({ jobId: 'job1', steps: structuredClone(persisted), apiKey: 'test', save, fetcher: fetcher as typeof fetch });
    await expect(make().call(input)).rejects.toBeInstanceOf(GenerationPending);
    expect(persisted[0]).toMatchObject({ responseId: 'resp_1', state: 'waiting' });
    const result = await make().call(input);
    expect(JSON.parse(result.raw).usage.completion_tokens_details.reasoning_tokens).toBe(50);
    expect((await make().call(input)).eventId).toBe(result.eventId);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not repeat a POST when its result was lost', async () => {
    let persisted: ProviderStep[] = [];
    const fetcher = vi.fn().mockRejectedValue(new Error('connection lost'));
    const args = { jobId: 'job1', apiKey: 'test', save: async steps => { persisted = structuredClone(steps); }, fetcher };
    await expect(createBackgroundContext({ ...args, steps: [] }).call(input)).rejects.toThrow('자동 재호출');
    await expect(createBackgroundContext({ ...args, steps: persisted }).call(input)).rejects.toThrow('중복 과금');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves a truncated response as failure instead of accepting a partial mission', () => {
    expect(() => completedChatEnvelope({ ...completed, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })).toThrow('max_output_tokens');
    expect(() => completedChatEnvelope({ ...completed, output: [] })).toThrow('본문');
  });
  it('rejects replay after a prompt change without a paid call', async () => {
    const fetcher = vi.fn();
    const context = createBackgroundContext({ jobId: 'job1', apiKey: 'test', save: async () => {}, fetcher,
      steps: [{ key: 'old', state: 'waiting', eventId: 'event', startedAt: '', model: input.model, responseId: 'resp_1' }] });
    await expect(context.call(input)).rejects.toThrow('생성 조건');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('polls the same job until completed and returns the existing response envelope', async () => {
    const job = { id: 'job1', status: 'running' } as GenerationJob;
    const request = vi.fn().mockResolvedValueOnce({ job }).mockResolvedValueOnce({ job: { ...job, status: 'completed', result: { mission_content: { id: 1 } } } });
    const result = await invokeAstraMission({ action: 'mission' }, { request, wait: async () => {} });
    expect(result).toEqual({ error: null, data: { mission_content: { id: 1 } } });
    expect(request.mock.calls[1][0]).toEqual({ action: 'status', job_id: 'job1' });
  });
  it('does not start a second generation after a polling connection failure', async () => {
    const request = vi.fn().mockResolvedValueOnce({ job: { id: 'job1', status: 'running' } }).mockRejectedValueOnce(new Error('lost connection'));
    const result = await invokeAstraMission({}, { request, wait: async () => {} });
    expect(result.error?.message).toBe('lost connection');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
