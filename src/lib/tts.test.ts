import { afterEach, expect, it, vi } from 'vitest';
import { requestTtsAudio, DEFAULT_TTS_VOICE_BY_LANG } from './tts';

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });
it('keeps the selected language voice after a transient provider fallback and ignores old disabled voices', async () => {
  sessionStorage.setItem('tts-disabled-voices', JSON.stringify([DEFAULT_TTS_VOICE_BY_LANG.ko]));
  const request = vi.fn()
    .mockResolvedValueOnce(new Response(new Uint8Array([1]), { headers: {
      'Content-Type': 'audio/mpeg', 'X-TTS-Voice-Id': 'nova', 'X-TTS-Provider': 'openai',
      'X-TTS-Model': 'gpt-4o-mini-tts', 'X-TTS-Fallback-Used': '1',
    } }))
    .mockResolvedValueOnce(new Response(new Uint8Array([2]), { headers: {
      'Content-Type': 'audio/mpeg', 'X-TTS-Voice-Id': DEFAULT_TTS_VOICE_BY_LANG.ko,
      'X-TTS-Provider': 'elevenlabs', 'X-TTS-Model': 'eleven_multilingual_v2', 'X-TTS-Fallback-Used': '0',
    } }));
  vi.stubGlobal('fetch', request);
  expect(await requestTtsAudio({ text: '안녕하세요.', lang: 'ko' })).toMatchObject({
    ok: true, provider: 'openai', model: 'gpt-4o-mini-tts', fallbackUsed: true,
  });
  expect(await requestTtsAudio({ text: '안녕하세요.', lang: 'ko' })).toMatchObject({
    ok: true, provider: 'elevenlabs', fallbackUsed: false,
  });
  for (const call of request.mock.calls) expect(JSON.parse(call[1].body).voiceId).toBe(DEFAULT_TTS_VOICE_BY_LANG.ko);
});
