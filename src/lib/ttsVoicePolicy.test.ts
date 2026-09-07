import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { synthesizeTts } from '../../supabase/functions/_shared/ttsProvider';
import { TTS_VOICE_BY_LANG } from '../../supabase/functions/_shared/ttsVoicePolicy';

const audio = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } });
const failure = (status: number) => new Response(JSON.stringify({ error: { code: 'test_failure' } }), { status });
const body = (mock: ReturnType<typeof vi.fn>, index = 0) => JSON.parse(mock.mock.calls[index][1].body);
// jsdom 20 predates AbortSignal.timeout; network behavior itself is mocked below.
beforeEach(() => vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('language-specific designed TTS voices', () => {
  it.each([
    ['ko', 'beginner', 0.9],
    ['ko', 'intermediate', 0.9],
    ['ko', 'advanced', 0.9],
    ['zh', 'beginner', 0.9],
    ['zh', 'intermediate', 0.9],
    ['zh', 'advanced', 0.9],
  ] as const)('uses the chosen %s voice at %s pace', async (lang, level, speed) => {
    const request = vi.fn().mockResolvedValue(audio());
    const result = await synthesizeTts('sample', lang, { elevenlabs: 'test', openai: 'test' }, request, level);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain(TTS_VOICE_BY_LANG[lang]);
    expect(body(request).voice_settings).toMatchObject({ speed, style: 0.1 });
    expect(result).toMatchObject({ ok: true, provider: 'elevenlabs', voice: TTS_VOICE_BY_LANG[lang], fallbackUsed: false });
  });
  it('uses instructed OpenAI audio when ElevenLabs has no key', async () => {
    const request = vi.fn().mockResolvedValue(audio());
    expect(await synthesizeTts('中文', 'zh', { openai: 'test' }, request)).toMatchObject({
      ok: true, provider: 'openai', model: 'gpt-4o-mini-tts', voice: 'shimmer', fallbackUsed: true,
    });
    expect(body(request)).toMatchObject({ speed: 0.9, instructions: expect.stringContaining('Mandarin') });
  });
  it('falls back to the same language on ElevenLabs failure without trying the other designed voice', async () => {
    const request = vi.fn().mockResolvedValueOnce(failure(429)).mockResolvedValueOnce(audio());
    expect(await synthesizeTts('한국어', 'ko', { elevenlabs: 'test', openai: 'test' }, request)).toMatchObject({
      ok: true, provider: 'openai', voice: 'nova', fallbackUsed: true,
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe('https://api.openai.com/v1/audio/speech');
  });
  it('recovers a network failure through OpenAI', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(audio());
    expect(await synthesizeTts('한국어', 'ko', { elevenlabs: 'test', openai: 'test' }, request)).toMatchObject({ ok: true, provider: 'openai' });
  });
  it.each([400, 404])('retries legacy OpenAI once on model compatibility status %s', async status => {
    const request = vi.fn().mockResolvedValueOnce(failure(status)).mockResolvedValueOnce(audio());
    expect(await synthesizeTts('한국어', 'ko', { openai: 'test' }, request)).toMatchObject({ ok: true, model: 'tts-1-hd' });
    expect(body(request, 1).instructions).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not multiply quota/rate failures or attempt requests without keys', async () => {
    const request = vi.fn().mockResolvedValue(failure(429));
    expect(await synthesizeTts('한국어', 'ko', {}, request)).toMatchObject({ ok: false });
    expect(request).not.toHaveBeenCalled();
    expect(await synthesizeTts('한국어', 'ko', { openai: 'test' }, request)).toMatchObject({ ok: false });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
