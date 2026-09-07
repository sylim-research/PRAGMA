import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleGenerateScenario } from '../generate-scenario/index.ts';
import { CURRENT_CONTENT_RELEASE_ID } from '../_shared/contentRelease.ts';
import { ASTRA_GENERATION_MODEL, BACKGROUND_GENERATION_VERSION, backgroundContext, createBackgroundContext,
  generationHash, canResumeGeneration, GenerationPending, GenerationStopped } from '../_shared/backgroundGeneration.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
type Job = Record<string, any>;
const view = (job: Job) => ({ id: job.id, status: job.status, model: job.model, error: job.error,
  can_resume: job.release_id === CURRENT_CONTENT_RELEASE_ID && canResumeGeneration(job as Parameters<typeof canResumeGeneration>[0]),
  created_at: job.created_at, updated_at: job.updated_at, scenario_id: job.request_body.telemetry?.scenario_id ?? null,
  label: job.request_body.mission?.core?.situation_ko ?? '',
  completed_steps: job.steps.filter((s: Job) => s.state === 'completed').length,
  provider_responses: job.steps.map((s: Job) => ({ id: s.responseId, model: s.model, state: s.state })),
  ...(job.status === 'completed' ? { result: job.result } : {}),
});

async function tick(database: ReturnType<typeof db>, jobId: string | null) {
  const { data: claimed, error: claimError } = await database.rpc('claim_generation_job', { p_job_id: jobId });
  if (claimError) throw new Error('생성 작업을 가져오지 못했습니다.');
  const job: Job | undefined = claimed?.[0];
  if (!job) return;
  const patch = async (values: Job) => {
    const { data, error } = await database.from('generation_jobs').update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', job.id).eq('lease_token', job.lease_token).select('id');
    if (error || data?.length !== 1) throw new Error('작업 저장 실패 또는 처리 권한 만료');
  };
  try {
    if (job.release_id !== CURRENT_CONTENT_RELEASE_ID) throw new GenerationStopped('생성 규칙이 업데이트되었습니다. 이전 작업 결과는 보존됩니다.');
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new GenerationStopped('OpenAI 키가 설정되지 않았습니다.');
    const context = createBackgroundContext({ jobId: job.id, steps: job.steps, apiKey,
      save: steps => patch({ steps }) });
    const response = await backgroundContext.run(context, async () => {
      const body = structuredClone(job.request_body);
      const invoke = (input: Job) => handleGenerateScenario(new Request('https://internal/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
      if (body.action === 'mission' && body.mission.core.focal_segments?.some((s: Job) => s.role === 'head') && !body.mission.frozen_topology) {
        const topologyResponse = await invoke({ ...body, action: 'mission_topology' });
        const topology = await topologyResponse.json();
        if (!topologyResponse.ok || topology.stop_code || !topology.frozen_topology) return json(topology, topologyResponse.status);
        body.mission.frozen_topology = topology.frozen_topology;
        body.mission.topology_evidence = topology.topology_evidence;
      }
      return invoke(body);
    });
    const result = await response.json();
    const failed = !response.ok || result.error || result.stop_code;
    await patch({ status: failed ? 'failed' : 'completed', result,
      error: failed ? String(result.error ?? result.stop_code ?? '생성 실패').slice(0, 500) : null,
      lease_token: null, lease_until: null });
  } catch (error) {
    if (error instanceof GenerationPending) {
      await patch({ status: 'running', next_run_at: new Date(Date.now() + 5000).toISOString(), lease_token: null, lease_until: null });
    } else {
      await patch({ status: 'failed', error: error instanceof GenerationStopped ? error.message : '작업 처리 오류 — 저장된 결과를 확인해 주세요.',
        lease_token: null, lease_until: null });
    }
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const database = db();
    const workerToken = req.headers.get('x-pragma-worker-token');
    if (workerToken) {
      const { data: allowed, error } = await database.rpc('authorize_generation_worker', { p_token: workerToken });
      if (error || allowed !== true) return json({ error: 'Unauthorized worker' }, 401);
      await Promise.all([tick(database, null), tick(database, null), tick(database, null)]);
      return json({ ok: true });
    }
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '관리자 로그인이 필요합니다.' }, 401);
    const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error: authError } = await userDb.auth.getUser();
    if (authError || !auth.user) return json({ error: '로그인을 확인해 주세요.' }, 401);
    const { data: admin, error: adminError } = await userDb.rpc('is_admin');
    if (adminError || admin !== true) return json({ error: '관리자만 생성할 수 있습니다.' }, 403);
    const raw = await req.text();
    if (raw.length > 500000) return json({ error: '입력 크기 초과' }, 413);
    const input = JSON.parse(raw);
    if (input.action === 'list') {
      const { data, error } = await database.from('generation_jobs').select('*').eq('owner_id', auth.user.id)
        .order('created_at', { ascending: false }).limit(12);
      if (error) throw error;
      return json({ jobs: data.map(view) });
    }
    let id = input.job_id;
    if (input.action === 'start') {
      const body = input.generation_request;
      if (!body?.mission?.core || !body.mission.feature || !['mission', 'mission_topology'].includes(body.action)) {
        return json({ error: '미션 생성 조건이 필요합니다.' }, 400);
      }
      let scenarioRevision: string | null = null;
      if (body.telemetry?.scenario_id) {
        const { data: scenario } = await database.from('scenarios').select('updated_at,mission_status')
          .eq('scenario_id', body.telemetry.scenario_id).maybeSingle();
        if (!scenario) return json({ error: '시나리오를 찾을 수 없습니다.' }, 404);
        if (scenario.mission_status) return json({ error: '이미 미션이 있습니다. 재조립하려면 먼저 반려해 주세요.' }, 409);
        scenarioRevision = scenario.updated_at;
      }
      const requestKey = await generationHash({ body, scenarioRevision, version: BACKGROUND_GENERATION_VERSION, release: CURRENT_CONTENT_RELEASE_ID });
      const { error } = await database.from('generation_jobs').upsert({ owner_id: auth.user.id, request_key: requestKey,
        request_body: body, release_id: CURRENT_CONTENT_RELEASE_ID, model: ASTRA_GENERATION_MODEL },
      { onConflict: 'owner_id,request_key', ignoreDuplicates: true });
      if (error) throw error;
      const { data, error: readError } = await database.from('generation_jobs').select('id')
        .eq('owner_id', auth.user.id).eq('request_key', requestKey).single();
      if (readError) throw readError;
      id = data.id;
    } else if (!['status', 'resume'].includes(input.action)) return json({ error: '지원하지 않는 작업' }, 400);
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: '잘못된 작업 ID' }, 400);
    const { data: owned } = await database.from('generation_jobs').select('*').eq('id', id).eq('owner_id', auth.user.id).maybeSingle();
    if (!owned) return json({ error: '작업을 찾을 수 없습니다.' }, 404);
    if (['status', 'resume'].includes(input.action) && input.generation_request &&
      await generationHash(input.generation_request) !== await generationHash(owned.request_body)) {
      return json({ error: '시나리오 조건이 바뀌어 이 결과를 적용할 수 없습니다. 기존 작업은 보존됩니다.' }, 409);
    }
    if (input.action === 'resume' && owned.status === 'failed') {
      if (owned.release_id !== CURRENT_CONTENT_RELEASE_ID || !canResumeGeneration(owned)) {
        return json({ error: '자동 복구할 수 없는 작업입니다. 저장된 응답 ID와 중단 이유를 확인해 주세요.' }, 409);
      }
      const { error } = await database.from('generation_jobs').update({ status: 'queued', error: null,
        next_run_at: new Date().toISOString(), lease_token: null, lease_until: null, updated_at: new Date().toISOString() })
        .eq('id', id).eq('owner_id', auth.user.id).eq('status', 'failed');
      if (error) throw error;
    }
    await tick(database, id);
    const { data: job, error } = await database.from('generation_jobs').select('*').eq('id', id).single();
    if (error) throw error;
    return json({ job: view(job) });
  } catch {
    return json({ error: '생성 작업 요청을 처리하지 못했습니다. 기존 작업 목록에서 상태를 확인해 주세요.' }, 500);
  }
});
