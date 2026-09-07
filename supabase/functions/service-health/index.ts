import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// 관리자 전용 연동 점검. 시연·수업 전에 "키가 살아 있는가"만 답한다.
// - 토큰을 소비하지 않는 인증 호출(/v1/models)만 쓴다. 생성·검수 요청을 만들지 않는다.
// - 키·청구·조직 정보와 제공자 오류 본문은 절대 돌려주지 않는다. 정해진 코드만 옮긴다.
// - ElevenLabs 잔량은 여기서 다시 만들지 않는다. 기존 tts?action=usage를 그대로 쓴다.

const headers = { ...corsHeaders, 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json' },
});

export type ProviderCode = 'ok' | 'missing_key' | 'auth_failed' | 'unreachable' | 'provider_error';
export type ProviderHealth = { provider: 'openai' | 'anthropic'; code: ProviderCode; httpStatus: number | null; latencyMs: number | null };

const PROBE_TIMEOUT_MS = 10_000;

async function probe(
  provider: ProviderHealth['provider'], apiKey: string | undefined, fetcher: typeof fetch,
): Promise<ProviderHealth> {
  if (!apiKey) return { provider, code: 'missing_key', httpStatus: null, latencyMs: null };
  const request = provider === 'openai'
    ? { url: 'https://api.openai.com/v1/models', headers: { Authorization: `Bearer ${apiKey}` } }
    : { url: 'https://api.anthropic.com/v1/models', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } };
  const started = Date.now();
  try {
    const response = await fetcher(request.url, { headers: request.headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const latencyMs = Date.now() - started;
    if (response.ok) return { provider, code: 'ok', httpStatus: response.status, latencyMs };
    const code: ProviderCode = response.status === 401 || response.status === 403 ? 'auth_failed' : 'provider_error';
    return { provider, code, httpStatus: response.status, latencyMs };
  } catch {
    return { provider, code: 'unreachable', httpStatus: null, latencyMs: Date.now() - started };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'GET') return json({ error: 'GET required' }, 405);
  try {
    // tts?action=usage와 같은 가드. 관리자 세션이 아니면 아무 제공자도 호출하지 않는다.
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '관리자 로그인이 필요합니다.' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return json({ error: '로그인을 확인해 주세요.' }, 401);
    const { data: isAdmin, error: roleError } = await db.rpc('is_admin');
    if (roleError || isAdmin !== true) return json({ error: '관리자만 확인할 수 있습니다.' }, 403);

    const [openai, anthropic] = await Promise.all([
      probe('openai', Deno.env.get('OPENAI_API_KEY'), fetch),
      probe('anthropic', Deno.env.get('ANTHROPIC_API_KEY'), fetch),
    ]);
    return json({ providers: [openai, anthropic], checkedAt: new Date().toISOString() });
  } catch {
    return json({ error: '연동 점검 요청을 처리할 수 없습니다.' }, 500);
  }
});
