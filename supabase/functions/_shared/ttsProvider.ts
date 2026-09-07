import { OPENAI_TTS_INSTRUCTIONS, TTS_VOICE_BY_LANG, ttsSpeed, type TtsLang, type TtsLevel } from './ttsVoicePolicy.ts';

type AudioResult =
  | { ok: true; audio: ArrayBuffer; provider: string; model: string; voice: string; fallbackUsed: boolean }
  | { ok: false; code: string; status: number };

export async function synthesizeTts(
  text: string,
  lang: TtsLang,
  keys: { elevenlabs?: string; openai?: string },
  request: typeof fetch = fetch,
  level: TtsLevel = 'intermediate',
): Promise<AudioResult> {
  const post = async (url: string, headers: Record<string, string>, body: unknown) => {
    try {
      const response = await request(url, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        return { ok: false as const, status: response.status,
          code: String(error?.detail?.status ?? error?.error?.code ?? `http_${response.status}`) };
      }
      const audio = await response.arrayBuffer();
      return audio.byteLength > 0
        ? { ok: true as const, audio }
        : { ok: false as const, status: 502, code: 'empty_audio' };
    } catch {
      return { ok: false as const, status: 502, code: 'provider_unavailable' };
    }
  };

  let failure: AudioResult = { ok: false, status: 503, code: 'tts_key_missing' };
  if (keys.elevenlabs) {
    const attempt = await post(
      `https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_BY_LANG[lang]}?output_format=mp3_44100_128`,
      { 'xi-api-key': keys.elevenlabs },
      { text, model_id: 'eleven_multilingual_v2', voice_settings: {
        stability: 0.5, similarity_boost: 0.75, style: 0.1,
        use_speaker_boost: true, speed: ttsSpeed(lang, level),
      } },
    );
    if (attempt.ok === true) return { ...attempt, provider: 'elevenlabs', model: 'eleven_multilingual_v2',
      voice: TTS_VOICE_BY_LANG[lang], fallbackUsed: false };
    failure = attempt;
    console.warn('ElevenLabs TTS unavailable; trying same-language OpenAI audio', { code: attempt.code });
  }

  if (!keys.openai) return failure;
  const voice = lang === 'zh' ? 'shimmer' : 'nova';
  for (const model of ['gpt-4o-mini-tts', 'tts-1-hd']) {
    const attempt = await post('https://api.openai.com/v1/audio/speech',
      { Authorization: `Bearer ${keys.openai}` },
      { model, voice, input: text, response_format: 'mp3', speed: ttsSpeed(lang, level),
        ...(model === 'gpt-4o-mini-tts' ? { instructions: OPENAI_TTS_INSTRUCTIONS[lang] } : {}) });
    if (attempt.ok === true) return { ...attempt, provider: 'openai', model, voice, fallbackUsed: true };
    failure = attempt;
    // One compatibility retry; quota/rate/network errors must not multiply requests.
    if (![400, 404].includes(attempt.status)) break;
  }
  return failure;
}
