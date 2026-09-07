import { TTS_VOICE_BY_LANG, type TtsLang } from "../../supabase/functions/_shared/ttsVoicePolicy";
export type { TtsLang } from "../../supabase/functions/_shared/ttsVoicePolicy";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const DEFAULT_TTS_VOICE_BY_LANG = TTS_VOICE_BY_LANG;

type TtsSuccess = {
  ok: true;
  blob: Blob;
  requestedVoiceId: string;
  usedVoiceId: string;
  fallbackUsed: boolean;
  provider?: string;
  model?: string;
};

type TtsFailure = {
  ok: false;
  message: string;
  requestedVoiceId: string;
  providerCode?: string;
  fallback?: boolean;
  status?: number;
};

export type TtsResult = TtsSuccess | TtsFailure;

export const isTtsRelatedErrorMessage = (value: unknown) => {
  const text = typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? [
          (value as { message?: string }).message,
          (value as { error?: string }).error,
          (value as { reason?: string }).reason,
        ].filter(Boolean).join(" ")
      : "";

  return /functions\/v1\/tts|edge function returned|paid_plan_required|voice_not_found|unauthorized_free_user|detected_unusual_activity|tts/i.test(text);
};

export const requestTtsAudio = async ({
  text,
  lang,
  logPrefix = "[TTS]",
}: {
  text: string;
  lang: TtsLang;
  logPrefix?: string;
}): Promise<TtsResult> => {
  const requestedVoiceId = DEFAULT_TTS_VOICE_BY_LANG[lang];

  try {
    console.log(`${logPrefix} sending:`, { textLength: text.length, lang, requestedVoiceId });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text, lang, voiceId: requestedVoiceId }),
    });

    const contentType = response.headers.get("content-type") || "";
    console.log(`${logPrefix} status:`, response.status, "content-type:", contentType);

    if (contentType.includes("audio")) {
      const blob = await response.blob();
      const usedVoiceId = response.headers.get("X-TTS-Voice-Id") || requestedVoiceId;
      const fallbackUsed = response.headers.get("X-TTS-Fallback-Used") === "1";
      console.log(`${logPrefix} blob:`, { size: blob.size, type: blob.type, valid: blob.size > 0, usedVoiceId, fallbackUsed });

      if (blob.size === 0) {
        return {
          ok: false,
          message: "빈 오디오 응답입니다.",
          requestedVoiceId,
          status: response.status,
        };
      }

      return {
        ok: true,
        blob,
        requestedVoiceId,
        usedVoiceId,
        fallbackUsed,
        provider: response.headers.get("X-TTS-Provider") || undefined,
        model: response.headers.get("X-TTS-Model") || undefined,
      };
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const providerCode = typeof payload?.providerCode === "string" ? payload.providerCode : undefined;
    const message = typeof payload?.error === "string"
      ? payload.error
      : !response.ok
        ? `TTS 실패 (${response.status})`
        : "오디오 응답이 아닙니다.";

    console.warn(`${logPrefix} non-audio response:`, {
      status: response.status,
      providerCode,
      message,
      requestedVoiceId,
    });

    return {
      ok: false,
      message,
      requestedVoiceId,
      providerCode,
      fallback: Boolean(payload?.fallback),
      status: response.status,
    };
  } catch (error) {
    console.error(`${logPrefix} unexpected error:`, error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "음성 생성에 실패했습니다. 다시 시도해 주세요.",
      requestedVoiceId,
    };
  }
};
