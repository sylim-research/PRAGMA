import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CONTENT_REVIEW_VERSION, CONTENT_APPROVAL_POLICY, reusableGenerationQuality, nextReviewStage, reviewHash, type ContentReviewRun, type ReviewInspection, type ReviewTarget } from "../_shared/contentReview.ts";
import { callContentReviewer } from "../_shared/contentReviewProvider.ts";
import { OPENAI_MODEL_ROUTES } from "../_shared/openaiRequestContract.ts";
import { buildContentReviewDomain, missionFinalizationInput } from "./domain.generated.mjs";
import { prepareReviewFinalization } from "../_shared/contentReviewFinalization.ts";

const headers = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "관리자 로그인이 필요합니다." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: user, error: authError } = await userDb.auth.getUser();
    if (authError || !user.user) return json({ error: "로그인을 확인해 주세요." }, 401);
    const { data: isAdmin, error: roleError } = await userDb.rpc("is_admin");
    if (roleError || isAdmin !== true) return json({ error: "관리자만 콘텐츠 검수를 사용할 수 있습니다." }, 403);
    const rawBody = await req.text();
    if (rawBody.length > 4000) return json({ error: "요청이 너무 큽니다." }, 413);
    const { action, target, expectedVersion } = JSON.parse(rawBody) as {
      action: string; target: ReviewTarget; expectedVersion?: { contentHash: string; sourceHash: string };
    };
    if (!["inspect", "rules", "openai", "claude", "adjudication", "finalization", "request_independent"].includes(action)
      || !target || !["mission", "weekly_material"].includes(target.kind) || !uuid.test(target.targetId)
      || (target.kind === "weekly_material" && (!Number.isInteger(target.weekNo) || target.weekNo! < 1 || target.weekNo! > 15))) {
      return json({ error: "검수 대상·단계를 확인해 주세요." }, 400);
    }
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const weekNo = target.kind === "mission" ? 0 : target.weekNo!;
    const models = { openai: OPENAI_MODEL_ROUTES.critic.primary, claude: Deno.env.get("CLAUDE_AUDIT_MODEL") || null };
    const sourceFor = async (kind: string, id: string, week = 0) => {
      const { data, error } = await db.rpc("get_content_review_source", { p_kind: kind, p_target_id: id, p_week_no: week });
      if (error) throw new Error(`검수 원본 조회 실패: ${error.message}`);
      return data;
    };
    const inspect = async (): Promise<ReviewInspection & { rules: any }> => {
      const source = await sourceFor(target.kind, target.targetId, weekNo);
      const domain = buildContentReviewDomain(target.kind, source.source);
      if (JSON.stringify(domain.snapshot).length > 240_000) throw new Error("단일 검수 입력 한도를 초과했습니다. 운영자가 범위를 확인해야 합니다.");
      const contentHash = await reviewHash(domain.snapshot);
      const base = () => db.from("content_review_runs").select("*").eq("kind", target.kind).eq("target_id", target.targetId).eq("week_no", weekNo);
      const [current, history] = await Promise.all([
        // Only the active row is operational; a row replaced by a gate rebind stays readable as history below.
        base().eq("source_hash", source.source_hash).eq("content_hash", contentHash).eq("criteria_version", CONTENT_REVIEW_VERSION).is("superseded_by", null).maybeSingle(),
        db.from("content_review_runs").select("id,created_at,approved_at,content_hash,superseded_by,rebound_from").eq("kind", target.kind).eq("target_id", target.targetId).eq("week_no", weekNo).order("created_at", { ascending: false }).limit(12),
      ]);
      if (current.error || history.error) throw new Error("검수 저장소를 사용할 수 없습니다. content-review 마이그레이션·Edge 배포 상태를 확인해 주세요.");
      const dependencies = await Promise.all(domain.dependencies.map(async (id: string) => {
        const dependency = await sourceFor("mission", id);
        // Match SQL readiness: unchanged source keeps its historical approval even
        // when a newer rule catalog changes the computed review content hash.
        const { data, error } = await db.from("content_review_runs").select("id").eq("kind", "mission").eq("target_id", id)
          .eq("source_hash", dependency.source_hash).eq("criteria_version", CONTENT_REVIEW_VERSION).is("superseded_by", null).not("approved_at", "is", null).limit(1);
        if (error) throw new Error("연결된 미션의 검수 기록 조회 실패");
        return { id, approved: Boolean(data?.length) };
      }));
      return { run: current.data as ContentReviewRun | null, contentHash, sourceHash: source.source_hash,
        snapshot: domain.snapshot, rules: domain.rules, history: history.data ?? [], dependencies, models,
        reusableGenerationQuality: target.kind === "mission" ? reusableGenerationQuality(source.source.scenario.mission_content ?? {}) : null };
    };
    const state = await inspect();
    if (action === "inspect") return json(state);
    if (expectedVersion && (expectedVersion.contentHash !== state.contentHash || expectedVersion.sourceHash !== state.sourceHash)) {
      return json({ error: "검토 시작 후 콘텐츠가 변경되었습니다. 새 버전을 확인하고 다시 시작하세요." }, 409);
    }
    if (action === "rules") {
      if (!state.run) {
        // The review identity is unique among active rows only (partial index), so a concurrent insert is
        // tolerated here rather than declared as an ON CONFLICT target.
        const { error } = await db.from("content_review_runs").insert({ kind: target.kind, target_id: target.targetId, week_no: weekNo,
          source_hash: state.sourceHash, content_hash: state.contentHash, criteria_version: CONTENT_REVIEW_VERSION,
          snapshot: state.snapshot, rules: state.rules, created_by: user.user.id,
          approval_policy: CONTENT_APPROVAL_POLICY, generation_quality: state.reusableGenerationQuality,
        });
        if (error && error.code !== "23505") throw new Error(`규칙 검사 저장 실패: ${error.message}`);
      } else if (!state.run.approved_at && !state.run.running_stage) {
        const { error } = await db.from("content_review_runs").update({ approval_policy: CONTENT_APPROVAL_POLICY,
          generation_quality: state.reusableGenerationQuality }).eq("id", state.run.id).is("approved_at", null).is("running_stage", null);
        if (error) throw new Error(`기존 점검 연결 실패: ${error.message}`);
      }
      return json(await inspect());
    }
    const run = state.run;
    if (action === "finalization" && run?.prepared_finalization) return json(state);
    if (action === "request_independent") {
      if (!run || run.approval_policy !== CONTENT_APPROVAL_POLICY || run.approved_at || run.running_stage
        || run.rules.verdict === "fail" || (!run.openai_review && !run.generation_quality)) return json({error:"현재 기본 점검을 먼저 준비하세요."},409);
      const { error } = await db.from("content_review_runs").update({ independent_review_requested: true })
        .eq("id",run.id).is("approved_at",null).is("running_stage",null);
      if (error) throw new Error("추가 검토 선택 저장 실패");
      return json(await inspect());
    }
    if (!run || run.rules.verdict === "fail" || nextReviewStage(run) !== action) return json({ error: "선행 단계를 완료하거나 현재 콘텐츠의 규칙 오류를 수정해 주세요." }, 409);
    if (action === "finalization") {
      const token = crypto.randomUUID();
      const { data: claimed, error: claimError } = await db.from("content_review_runs").update({
        running_stage: "finalization", lease_token: token, lease_until: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: null,
      }).eq("id", run.id).is("prepared_finalization", null).is("approved_at", null)
        .or(`running_stage.is.null,lease_until.lt.${new Date().toISOString()}`).select("id").maybeSingle();
      if (claimError || !claimed) return json({ error: "최종 검수 자료가 이미 준비 중이거나 완료됐습니다. 결과를 새로고침하세요." }, 409);
      try {
        const source = await sourceFor("mission", target.targetId);
        if (source.source_hash !== state.sourceHash) throw new Error("원본이 변경되었습니다. 새 버전을 확인하세요.");
        const row = source.source.scenario;
        const prepared = await prepareReviewFinalization({
          run, currentMission: row.mission_content,
          finalize: async () => {
            const response = await fetch(`${url}/functions/v1/generate-scenario`, {
              method: "POST", headers: { Authorization: authorization, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" },
              body: JSON.stringify({ action: "finalize_mission", finalize_mission: missionFinalizationInput(row),
                telemetry: { scenario_id: target.targetId, invocation_attempt: 1 } }),
              signal: AbortSignal.timeout(240_000),
            });
            const body = await response.json();
            if (!response.ok || !body.mission_content) throw new Error(body.detail || body.error || "최종 검수 자료 생성 실패");
            return body.mission_content;
          },
          inspectFinalized: (mission) => buildContentReviewDomain("mission", { scenario: { ...row, mission_content: mission } }),
        });
        const { data: saved, error } = await db.from("content_review_runs").update({
          ...prepared, professor_decisions: [], running_stage: null, lease_token: null, lease_until: null,
        }).eq("id", run.id).eq("lease_token", token).is("prepared_finalization", null).select("id").maybeSingle();
        if (error || !saved) throw new Error("최종 검수 자료 저장 실패. 재실행 전 저장 결과를 확인하세요.");
      } catch (cause) {
        await db.from("content_review_runs").update({ running_stage: null, lease_token: null, lease_until: null,
          last_error: cause instanceof Error ? cause.message : "최종 검수 자료 준비 실패" }).eq("id", run.id).eq("lease_token", token);
        throw cause;
      }
      return json(await inspect());
    }
    const stage = action as "openai" | "claude" | "adjudication";
    const apiKey = Deno.env.get(stage === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY");
    const model = stage === "claude" ? models.claude : models.openai;
    if (!apiKey || !model) return json({ error: `${stage === "claude" ? "ANTHROPIC_API_KEY·CLAUDE_AUDIT_MODEL" : "OPENAI_API_KEY"} 설정이 필요합니다. 호출하지 않았습니다.` }, 503);
    const column = stage === "openai" ? "openai_review" : stage === "claude" ? "claude_review" : "adjudication";
    const token = crypto.randomUUID();
    const { data: claimed, error: claimError } = await db.from("content_review_runs").update({ running_stage: stage, lease_token: token,
      lease_until: new Date(Date.now() + 5 * 60_000).toISOString(), last_error: null,
    }).eq("id", run.id).is(column, null).is("approved_at", null)
      .or(`running_stage.is.null,lease_until.lt.${new Date().toISOString()}`).select("id").maybeSingle();
    if (claimError) throw new Error("검수 실행 잠금 실패");
    if (!claimed) return json({ error: "이미 실행 중이거나 완료된 단계입니다. 잠시 후 결과를 새로고침하세요." }, 409);
    try {
      const result = await callContentReviewer({ stage, run, apiKey, model });
      const { data: saved, error } = await db.from("content_review_runs").update({ [column]: result, running_stage: null, lease_token: null, lease_until: null })
        .eq("id", run.id).eq("lease_token", token).select("id").maybeSingle();
      if (error || !saved) throw new Error("응답 저장 실패. 재실행 전에 기존 호출 결과와 저장소 상태를 확인해 주세요.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "검수 실패";
      await db.from("content_review_runs").update({ running_stage: null, lease_token: null, lease_until: null, last_error: message }).eq("id", run.id).eq("lease_token", token);
      throw cause;
    }
    // If content changed while a model was running, retain that result as history
    // and return the new unreviewed version; never silently carry it forward.
    return json(await inspect());
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "검수 처리 실패" }, 400);
  }
});
