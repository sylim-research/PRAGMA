// Read-only audit of the named course; never writes to Supabase or invokes a model.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { coreLearnerSceneIssue } from "../../supabase/functions/_shared/coreSourceRepair";
const env = Object.fromEntries(readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(line => /^\w+=/.test(line)).map(line => {
  const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
}));
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = createClient(env.VITE_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get("Authorization") === `Bearer ${key}` && key.startsWith("sb_")) headers.delete("Authorization");
  return fetch(input, { ...init, headers });
} } });
const login = await db.auth.signInWithPassword({ email: env.PRAGMA_BATCH_ADMIN_EMAIL, password: env.PRAGMA_BATCH_ADMIN_PASSWORD });
if (login.error) throw new Error("Project administrator authentication failed");
const courseId = "915fec24-cc38-4b00-a2a0-c3628abcd3f7";
const assignments = await db.from("curriculum_week_scenarios").select("week_no,scenario_id").eq("outline_id", courseId);
if (assignments.error) throw new Error(assignments.error.message);
const ids = [...new Set(assignments.data.map(item => item.scenario_id))];
const missions = await db.from("scenarios").select("scenario_id,title,speech_act,mission_content,core_content,updated_at").in("scenario_id", ids);
if (missions.error) throw new Error(missions.error.message);
const result = missions.data.map(row => {
  const mission = row.mission_content as any;
  const scenes = [...(mission?.mpj_items ?? []).map((item: any, i: number) => ({ path: `mpj_items.${i}`, situation: item.situation_ko, relation: item.relation_ko, source: item.source, pdr: item.pdr })),
    { path: "production_task", situation: mission?.production_task?.situation_ko, relation: mission?.production_task?.relation_ko, source: mission?.production_task?.source_text, pdr: mission?.production_task?.pdr }];
  return { id: row.scenario_id, title: row.title, speechAct: row.speech_act, updatedAt: row.updated_at,
    weeks: assignments.data.filter(item => item.scenario_id === row.scenario_id).map(item => item.week_no),
    scenes: scenes.map(scene => ({ ...scene, reviewSignal: coreLearnerSceneIssue(scene.situation)?.code ?? null })) };
});
const directory = "docs/research-trail/evidence";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/2026-09-10-learner-scene-audit.json`, JSON.stringify({ at: new Date().toISOString(), courseId, source: "live read-only", count: result.length, missions: result }, null, 2) + "\n");
console.log(JSON.stringify({ missions: result.length, sceneCount: result.reduce((n,m) => n+m.scenes.length,0), signals: result.flatMap(m => m.scenes.filter(s => s.reviewSignal).map(s => ({id:m.id,path:s.path,situation:s.situation}))) }));
await db.auth.signOut({ scope: "local" });
