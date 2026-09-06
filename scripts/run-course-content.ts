// Uses the app's existing generation/review pipeline. Never approves or assigns content.
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const phase = process.argv[2];
if (!["generate", "review", "report"].includes(phase ?? "")) throw new Error("Use generate|review|report [comma-separated slot ordinals]");
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  get length() { return memory.size; }, clear: () => memory.clear(), getItem: (k: string) => memory.get(k) ?? null,
  key: (i: number) => [...memory.keys()][i] ?? null, removeItem: (k: string) => memory.delete(k),
  setItem: (k: string, v: string) => memory.set(k, v),
} });
const [{supabase}, {runCoreCell,loadExistingCoreRunItems,coreGenerationItemKey}, {promoteCore},
  {prepareContentReview}, {contentReviewRequest}, {coreTerminalEvidence}, {CURRENT_CONTENT_RELEASE_ID}] = await Promise.all([
  import("../src/integrations/supabase/client"), import("../src/lib/pragma/coreBatchRun"),
  import("../src/lib/pragma/promoteMission"), import("../src/lib/pragma/reviewPreparation"),
  import("../src/lib/pragma/contentReviewApi"), import("../src/lib/pragma/batchTerminalEvidence"),
  import("../supabase/functions/_shared/contentRelease"),
]);
const dir = ".tmp/course-content";
const plan = JSON.parse(readFileSync(dir + "/plan.json", "utf8"));
const digest = createHash("sha256").update(JSON.stringify(plan.plan)).digest("hex");
if (digest !== plan.planHash || plan.release !== CURRENT_CONTENT_RELEASE_ID || plan.plan.length !== 54)
  throw new Error("Plan changed or incompatible release");
const chosen = process.argv[3] ? new Set(process.argv[3].split(",").map(Number)) : null;
const slots = plan.plan.filter((slot: any) => !chosen || chosen.has(slot.ordinal));
if (chosen && slots.length !== chosen.size) throw new Error("Unknown slot");
const runId = "course-a-20260906-" + plan.planHash.slice(0, 10);
const stateFile = dir + (phase === "generate" ? "/generation-state.json" : "/state.json");
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {runId,planHash:plan.planHash,slots:{}};
if (state.planHash !== plan.planHash || state.runId !== runId) throw new Error("Checkpoint belongs to another plan");
if (phase !== "generate" && existsSync(dir + "/generation-state.json")) {
  const generated = JSON.parse(readFileSync(dir + "/generation-state.json", "utf8"));
  if (generated.planHash !== plan.planHash) throw new Error("Generation checkpoint belongs to another plan");
  for (const [ordinal, value] of Object.entries(generated.slots)) {
    const previous = state.slots[ordinal] ?? {};
    if (previous.scenarioId && (value as any).scenarioId && previous.scenarioId !== (value as any).scenarioId)
      throw new Error("Scenario changed without a recorded disposition: " + ordinal);
    state.slots[ordinal] = {...value as any, ...previous};
  }
}
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const record = (entry: object) => appendFileSync(dir + "/execution.jsonl", JSON.stringify({at:new Date().toISOString(),runId,...entry}) + "\n");
const query = supabase as any;
let halted = false;
process.on("SIGINT", () => { halted = true; });
const login = await supabase.auth.signInWithPassword({email:process.env.PRAGMA_BATCH_ADMIN_EMAIL!,password:process.env.PRAGMA_BATCH_ADMIN_PASSWORD!});
if (login.error) throw login.error;
try {
  const admin = await supabase.rpc("is_admin");
  if (admin.error || admin.data !== true) throw new Error("Administrator access required");
  const existing = await loadExistingCoreRunItems(runId);
  let cursor = 0;
  const worker = async () => {
    while (!halted && cursor < slots.length) {
      const slot = slots[cursor++];
      const checkpoint = state.slots[slot.ordinal] ??= {};
      try {
        let id = checkpoint.scenarioId ?? slot.existingScenarioId;
        if (!id && slot.cell) id = existing.get(coreGenerationItemKey(slot.cell,slot.ordinal))?.scenarioId;
        if (!id && phase === "generate") {
          if (checkpoint.coreAttempted) { record({slot:slot.ordinal,phase,status:"held",reason:"Prior failed attempt needs explicit disposition"}); continue; }
          checkpoint.coreAttempted = true; save();
          console.log(JSON.stringify({slot:slot.ordinal,phase:"core",status:"started"}));
          const result = await runCoreCell(slot.cell,slot.ordinal,{runId});
          record({slot:slot.ordinal,phase:"core",result:coreTerminalEvidence(runId,result)});
          if (!result.ok || !result.scenarioId) { checkpoint.error = result.error ?? result.ruleFailFirst; save(); continue; }
          id = result.scenarioId;
        }
        if (!id) continue;
        checkpoint.scenarioId = id; save();
        const row = await query.from("scenarios").select("*").eq("scenario_id",id).single();
        if (row.error) throw row.error;
        const core = row.data;
        if (core.core_content?.generation?.content_release_id !== plan.release) throw new Error("Core release changed");
        if (phase === "generate" && !core.mission_content && !core.mission_status) {
          if (checkpoint.missionAttempted) { record({slot:slot.ordinal,phase,status:"held",reason:"Prior failed attempt needs explicit disposition"}); continue; }
          checkpoint.missionAttempted = true; save();
          console.log(JSON.stringify({slot:slot.ordinal,phase:"mission",status:"started",scenarioId:id}));
          const result = await promoteCore(core);
          const {mission,...evidence} = result;
          record({slot:slot.ordinal,phase:"mission",scenarioId:id,result:evidence});
          checkpoint.generated = result.ok; checkpoint.qualityVerdict = result.quality?.verdict ?? null;
          checkpoint.eligible = result.terminal?.finalOutcome === "eligible";
          checkpoint.terminal = result.terminal; checkpoint.error = result.error ?? null;
          if (mission) writeFileSync(dir + "/mission-attempt-" + slot.ordinal + ".json",JSON.stringify(mission));
          save();
          console.log(JSON.stringify({slot:slot.ordinal,phase:"mission",ok:result.ok,error:result.error,verdict:result.quality?.verdict}));
        } else if (phase === "review" && core.mission_content?.mpj_items?.length === 5) {
          if (checkpoint.reviewError) { record({slot:slot.ordinal,phase,status:"held",reason:checkpoint.reviewError}); continue; }
          const target = {kind:"mission" as const,targetId:id};
          const result = await prepareContentReview(target,{ request:contentReviewRequest,stopped:()=>halted,
            onStage: stage => { record({slot:slot.ordinal,phase:"review",stage,status:"started"}); console.log(JSON.stringify({slot:slot.ordinal,phase:"review",stage})); },
          });
          checkpoint.reviewStatus = result.status;
          checkpoint.reviewId = result.inspection?.run?.id;
          checkpoint.contentHash = result.inspection?.contentHash;
          checkpoint.sourceHash = result.inspection?.sourceHash;
          if (result.inspection) writeFileSync(dir + "/review-" + slot.ordinal + ".json",JSON.stringify(result.inspection));
          record({slot:slot.ordinal,phase:"review",status:result.status,reviewId:checkpoint.reviewId,message:result.message});
          save();
        } else if (phase === "report") {
          writeFileSync(dir + "/scenario-" + slot.ordinal + ".json",JSON.stringify(core));
          checkpoint.persistedMission = core.mission_content?.mpj_items?.length === 5;
          checkpoint.missionStatus = core.mission_status;
          checkpoint.qualityVerdict = core.mission_content?.quality_check?.verdict ?? null;
          if (checkpoint.persistedMission) {
            const inspection = await contentReviewRequest({kind:"mission",targetId:id},"inspect");
            writeFileSync(dir + "/review-" + slot.ordinal + ".json",JSON.stringify(inspection));
          }
          save();
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : JSON.stringify(cause);
        if (phase === "review") checkpoint.reviewError = message;
        else checkpoint.error = message;
        record({slot:slot.ordinal,phase,status:"error",error:message}); save();
        console.log(JSON.stringify({slot:slot.ordinal,phase,error:message}));
        if (/429|401|403|quota|rate.limit|insufficient|API_KEY/i.test(message)) halted = true;
      }
    }
  };
  mkdirSync(dir,{recursive:true});
  record({phase,status:"run_started",slots:slots.map((s:any)=>s.ordinal),planHash:plan.planHash});
  await Promise.all(Array.from({length:2},()=>worker()));
  save();console.log(JSON.stringify({phase,runId,halted,finished:slots.length}));
} finally { await supabase.auth.signOut({scope:"local"}); }
