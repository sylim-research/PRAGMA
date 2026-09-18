// 이미 등록된 v6 행(generated)에 조립한 후보를 새 버전으로 저장한다. 관리자 계정으로만 돈다.
//
//   node scripts/revise-v6-row.mjs tmp/v6-conversion/<prefix>.v6.candidate.json <scenario_id>
//
// 품질 점검 → save_generated_mission_revision. 첫 저장(save_generated_mission)은 mission_content가 비어 있을 때만 쓰고,
// 이후 버전은 revision RPC가 lineage version을 쌓는다(앱의 repair 경로와 같다). 코어·계약 필드는 RPC가 동결한다.
// 행을 새로 만들지 않으므로 관리자 화면 링크·supersedes 연결은 그대로다. 내용이 바뀌면 검수 content hash가
// 바뀌어 규칙 검사부터 새 run으로 다시 시작한다. 승인된 행(reviewed/released)은 거부한다.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [file, scenarioId] = process.argv.slice(2);
if (!file || !scenarioId) throw new Error("사용법: node scripts/revise-v6-row.mjs <candidate.json> <scenario_id>");
const candidate = JSON.parse(readFileSync(file, "utf8"));

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.PRAGMA_ADMIN_EMAIL || process.env.PRAGMA_BATCH_ADMIN_EMAIL;
const password = process.env.PRAGMA_ADMIN_PASSWORD || process.env.PRAGMA_BATCH_ADMIN_PASSWORD;
if (!url || !key || !email || !password) throw new Error("PRAGMA 관리자 로그인 설정이 필요합니다.");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authError } = await db.auth.signInWithPassword({ email, password });
if (authError || !auth.session) throw new Error("PRAGMA 관리자 로그인에 실패했습니다.");

const { data: row, error: rowError } = await db.from("scenarios")
  .select("scenario_id,title,mission_status,supersedes_scenario_id,generation_run_id,generation_item_key,mission_content")
  .eq("scenario_id", scenarioId).single();
if (rowError || !row) throw new Error(`행을 읽지 못함: ${rowError?.message}`);
if (row.mission_status !== "generated") throw new Error(`승인 전 행만 고칠 수 있음 — 현재 ${row.mission_status}`);
// 등록 스크립트와 같은 규칙: rework 행은 앞선 v6 행을, 아니면 v5 원본을 잇는다.
if (row.supersedes_scenario_id !== (candidate.rework_of ?? candidate.source_scenario_id)) throw new Error("후보의 원본과 행의 supersedes가 다름");
const before = row.mission_content?.provenance?.mission_content_hash ?? "";
const after = candidate.mission_content.provenance.mission_content_hash;
if (before === after) { console.log("내용 해시가 같아 저장할 것이 없음"); process.exit(0); }
console.log(`0/2 ${row.title}\n    hash ${before.slice(0, 12)} → ${after.slice(0, 12)}`);

const { data: qc, error: qcError } = await db.functions.invoke("generate-scenario", {
  body: {
    action: "quality_check",
    telemetry: { scenario_id: scenarioId, generation_run_id: row.generation_run_id, generation_item_key: row.generation_item_key, invocation_attempt: 2 },
    quality: { mission_content: candidate.mission_content, ...candidate.quality_request },
  },
});
const quality = qc?.quality_check;
if (qcError || !quality?.verdict) throw new Error(`품질 점검 실패: ${qcError?.message ?? JSON.stringify(qc).slice(0, 300)}`);
console.log(`1/2 품질 점검: ${quality.verdict} — ${quality.summary_ko ?? ""} (지적 ${quality.findings?.length ?? 0}건)`);
for (const f of quality.findings ?? []) console.log(`    - ${f.severity} ${f.code} @${f.where}`);

const { data: savedId, error: saveError } = await db.rpc("save_generated_mission_revision", {
  p_scenario_id: scenarioId,
  p_payload: {
    mission_content: { ...candidate.mission_content, quality_check: quality },
    validation_result: candidate.validation_result,
    lineage_meta: candidate.lineage_meta,
  },
});
if (saveError) throw new Error(`저장 실패: ${saveError.message}`);
console.log(`2/2 새 버전 저장: ${savedId}\n다음: 관리자 화면에서 규칙 검사부터 다시(새 content hash).`);
