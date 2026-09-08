import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { prepareTeachingMaterial } from "../content-review/domain.generated.mjs";
import { reviewHash } from "../_shared/contentReview.ts";
import { buildOpenAIChatRequest, OPENAI_MODEL_ROUTES } from "../_shared/openaiRequestContract.ts";
import { TEACHING_PROMPT_VERSION, SOURCE_TEACHING_PROMPT_VERSION, teachingResponseFormat, validateTeachingContent, validateTeachingEvidence, type TeachingConfig } from "../_shared/teachingMaterial.ts";

const headers = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "관리자 로그인이 필요합니다." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: user, error: authError } = await userDb.auth.getUser();
    if (authError || !user.user) return json({ error: "로그인을 확인해 주세요." }, 401);
    const { data: admin, error: roleError } = await userDb.rpc("is_admin");
    if (roleError || admin !== true) return json({ error: "관리자만 자료를 생성할 수 있습니다." }, 403);
    const raw = await req.text();
    if (raw.length > 180_000) return json({ error: "요청 한도를 초과했습니다." }, 413);
    const body = JSON.parse(raw);
    const { action, courseId, weekNo, expectedRevision = 0 } = body;
    if (!["preview", "generate", "edit"].includes(action) || !uuid.test(courseId)
      || !Number.isInteger(weekNo) || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return json({ error: "자료 대상과 작업을 확인해 주세요." }, 400);
    }
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(name, args);
      if (error) throw new Error(error.message === "Draft changed; reload before saving"
        ? "자료 버전이 변경되었습니다. 저장 상태를 확인한 뒤 다시 준비해 주세요."
        : error.message === "Source changed; prepare again"
          ? "근거 자료가 변경되었습니다. 저장 상태를 확인한 뒤 다시 준비해 주세요."
          : "자료 저장소를 확인하지 못했습니다. 서비스 연결과 편성 상태를 확인해 주세요.");
      return data;
    };
    const state = await rpc("get_teaching_material_state", { p_outline_id: courseId, p_week_no: weekNo });
    if ((state.draft?.revision ?? 0) !== expectedRevision) return json({ error: "자료 버전이 변경되었습니다. 새로 불러온 뒤 작업해 주세요." }, 409);
    const config: TeachingConfig = action === "edit" ? state.draft?.source_config : body.config;
    if (!config || !Array.isArray(config.missionIds) || !config.missionIds.every((id) => typeof id === "string" && uuid.test(id))) {
      return json({ error: "근거 미션을 확인해 주세요." }, 400);
    }
    const context = await rpc("get_teaching_material_context", { p_outline_id: courseId, p_week_no: weekNo, p_config: config });
    const prepared = prepareTeachingMaterial(context, config);
    const grounded = config.workflow === "source";
    const promptVersion = grounded ? SOURCE_TEACHING_PROMPT_VERSION : TEACHING_PROMPT_VERSION;
    const model = OPENAI_MODEL_ROUTES.mission.primary;
    const request = buildOpenAIChatRequest({ model, ...prepared.prompt, temperature: 0.4, maxCompletionTokens: 7000,
      responseFormat: teachingResponseFormat(prepared.kind, prepared.sources.map((source: { id: string }) => source.id), grounded) });
    const inputHash = await reviewHash({ version: promptVersion, sourceHash: context.source_hash, request });
    if (action === "preview") return json({ ...prepared.prompt, inputHash, sourceHash: context.source_hash,
      model, promptVersion, characters: prepared.prompt.system.length + prepared.prompt.user.length,
      sources: prepared.sources.map(({ id, label, text }: { id: string; label: string; text: string }) => ({ id, label, characters: text.length })) });
    let content; let provenance;
    if (action === "edit") {
      if (!state.draft || !state.current) return json({ error: "근거가 변경되었습니다. 자료를 다시 생성해 주세요." }, 409);
      content = validateTeachingContent(body.content, prepared.kind, prepared.sources.map((source: { id: string }) => source.id));
      provenance = { ...state.draft.provenance, edited: true };
    } else {
      if (body.inputHash !== inputHash) return json({ error: "근거 또는 생성 설정이 바뀌었습니다. 생성 내용을 다시 확인해 주세요." }, 409);
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) return json({ error: "자료 생성 서비스 설정이 필요합니다. 모델을 호출하지 않았습니다." }, 503);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(request), signal: AbortSignal.timeout(110_000),
      });
      if (!response.ok) return json({ error: "모델 호출이 실패했습니다. 기존 자료는 유지됩니다. 자동으로 재호출하지 않았습니다." }, 502);
      const result = await response.json();
      const choice = result.choices?.[0];
      if (choice?.finish_reason !== "stop" || choice?.message?.refusal || !choice?.message?.content || !result.id) {
        return json({ error: "완전한 자료를 받지 못해 저장하지 않았습니다. 근거 범위를 확인해 주세요." }, 502);
      }
      content = validateTeachingContent(JSON.parse(choice.message.content), prepared.kind, prepared.sources.map((source: { id: string }) => source.id));
      provenance = { model: result.model ?? model, prompt_version: promptVersion, response_id: result.id, input_hash: inputHash, request };
    }
    if (grounded) validateTeachingEvidence(content, prepared.sources);
    const draft = await rpc("save_teaching_material", { p_outline_id: courseId, p_week_no: weekNo,
      p_expected_revision: expectedRevision, p_source_hash: context.source_hash, p_config: config,
      p_sources: prepared.sources, p_content: content, p_provenance: provenance, p_actor: user.user.id });
    return json({ draft, current: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "자료 준비 중 오류가 발생했습니다.";
    return json({ error: message }, 400);
  }
});
