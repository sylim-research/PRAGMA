import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { TTS_VOICE_BY_LANG } from '../_shared/ttsVoicePolicy.ts';
import { synthesizeTts } from '../_shared/ttsProvider.ts';

const headers = { ...corsHeaders, 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    // Read-only credit monitoring for the instructor; no billing/account details exposed.
    if (req.method === 'GET' && new URL(req.url).searchParams.get('action') === 'usage') {
      const authorization = req.headers.get('Authorization');
      if (!authorization?.startsWith('Bearer ')) return json({ error: '관리자 로그인이 필요합니다.' }, 401);
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
      });
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) return json({ error: '로그인을 확인해 주세요.' }, 401);
      const { data: isAdmin, error: roleError } = await db.rpc('is_admin');
      if (roleError || isAdmin !== true) return json({ error: '관리자만 확인할 수 있습니다.' }, 403);
      const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
      if (!apiKey) return json({ error: 'ElevenLabs 키 등록이 필요합니다.', code: 'elevenlabs_key_missing' }, 503);
      const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return json({
        error: 'ElevenLabs 잔량을 조회할 수 없습니다. 키의 User 읽기 권한을 확인해 주세요.',
        code: 'usage_unavailable', providerStatus: response.status,
      }, 502);
      const subscription = await response.json();
      const used = subscription.character_count;
      const limit = subscription.character_limit;
      if (!Number.isFinite(used) || !Number.isFinite(limit) || used < 0 || limit <= 0) {
        return json({ error: 'ElevenLabs 잔량 응답을 확인해 주세요.', code: 'usage_invalid' }, 502);
      }
      return json({ provider: 'elevenlabs', tier: subscription.tier, used, limit,
        remaining: Math.max(0, limit - used),
        resetsAt: subscription.next_character_count_reset_unix ?? null,
        checkedAt: new Date().toISOString() });
    }
    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
    const { text, lang } = await req.json();
    if (typeof text !== 'string' || !text.trim()) return json({ error: 'text is required' }, 400);
    if (text.length > 4096) return json({ error: 'text too long (max 4096 chars)' }, 400);
    const language = lang === 'zh' ? 'zh' : 'ko';
    const result = await synthesizeTts(text, language, {
      elevenlabs: Deno.env.get('ELEVENLABS_API_KEY'), openai: Deno.env.get('OPENAI_API_KEY'),
    });
    if (!result.ok) return json({
      error: '음성을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      providerCode: result.code, providerStatus: result.status,
    }, 502);
    console.log('TTS success', { language, provider: result.provider, model: result.model,
      voice: result.voice, fallbackUsed: result.fallbackUsed, audioBytes: result.audio.byteLength });
    return new Response(result.audio, { headers: {
      ...headers, 'Content-Type': 'audio/mpeg',
      'Access-Control-Expose-Headers': 'Content-Type, X-TTS-Voice-Id, X-TTS-Requested-Voice-Id, X-TTS-Fallback-Used, X-TTS-Provider, X-TTS-Model',
      'X-TTS-Requested-Voice-Id': TTS_VOICE_BY_LANG[language],
      'X-TTS-Voice-Id': result.voice, 'X-TTS-Fallback-Used': result.fallbackUsed ? '1' : '0',
      'X-TTS-Provider': result.provider, 'X-TTS-Model': result.model,
    } });
  } catch {
    return json({ error: '음성 요청을 처리할 수 없습니다.' }, 500);
  }
});
