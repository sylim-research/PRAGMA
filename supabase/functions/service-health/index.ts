import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { OPENAI_MODEL_ROUTES } from '../_shared/openaiRequestContract.ts';

// 관리자 전용 연동 점검. 시연·수업 전에 "키가 살아 있는가"만 답한다.
// - 토큰을 소비하지 않는 인증 호출(/v1/models)만 쓴다. 생성·검수 요청을 만들지 않는다.
// - 키·청구·조직 정보와 제공자 오류 본문은 절대 돌려주지 않는다. 정해진 코드만 옮긴다.
// - ElevenLabs 잔량은 여기서 다시 만들지 않는다. 기존 tts?action=usage를 그대로 쓴다.
// - 어떤 모델을 부르도록 설정돼 있는지도 함께 알린다. 모델명은 비밀값이 아니고, 설정 변경이 실제로
//   반영됐는지 확인하는 데 필요하다(예: CLAUDE_AUDIT_MODEL 교체 후).

const headers = { ...corsHeaders, 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json' },
});

export type ProviderCode = 'ok' | 'missing_key' | 'auth_failed' | 'unreachable' | 'provider_error';
export type ProviderHealth = {
  provider: 'openai' | 'anthropic'; code: ProviderCode; httpStatus: number | null; latencyMs: number | null;
  /** 이 제공자로 실제 호출하도록 설정된 모델. 비어 있으면 화면에 표시하지 않는다. */
  models: string[];
};

// STT는 stt 함수가 고정 모델을 쓴다(같은 값을 두 곳에 두지 않도록 여기서만 표기용으로 적는다).
const OPENAI_STT_MODEL = 'gpt-4o-transcribe';

const PROBE_TIMEOUT_MS = 10_000;

async function probe(
  provider: ProviderHealth['provider'], apiKey: string | undefined, models: string[], fetcher: typeof fetch,
): Promise<ProviderHealth> {
  if (!apiKey) return { provider, code: 'missing_key', httpStatus: null, latencyMs: null, models };
  const request = provider === 'openai'
    ? { url: 'https://api.openai.com/v1/models', headers: { Authorization: `Bearer ${apiKey}` } }
    : { url: 'https://api.anthropic.com/v1/models', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } };
  const started = Date.now();
  try {
    const response = await fetcher(request.url, { headers: request.headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const latencyMs = Date.now() - started;
    if (response.ok) return { provider, code: 'ok', httpStatus: response.status, latencyMs, models };
    const code: ProviderCode = response.status === 401 || response.status === 403 ? 'auth_failed' : 'provider_error';
    return { provider, code, httpStatus: response.status, latencyMs, models };
  } catch {
    return { provider, code: 'unreachable', httpStatus: null, latencyMs: Date.now() - started, models };
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

    const claudeModel = Deno.env.get('CLAUDE_AUDIT_MODEL');
    const [openai, anthropic] = await Promise.all([
      probe('openai', Deno.env.get('OPENAI_API_KEY'),
        [OPENAI_MODEL_ROUTES.mission.primary, OPENAI_MODEL_ROUTES.critic.primary, OPENAI_STT_MODEL], fetch),
      probe('anthropic', Deno.env.get('ANTHROPIC_API_KEY'), claudeModel ? [claudeModel] : [], fetch),
    ]);
    return json({ providers: [openai, anthropic], checkedAt: new Date().toISOString() });
  } catch {
    return json({ error: '연동 점검 요청을 처리할 수 없습니다.' }, 500);
  }
});
