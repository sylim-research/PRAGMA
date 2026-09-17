// v6 후보를 운영 DB에 새 scenario 행으로 등록한다. 관리자 계정으로만 돈다.
//
//   node scripts/register-v6-candidate.mjs tmp/v6-conversion/<prefix>.v6.candidate.json
//
// 하는 일 (승격 경로와 같은 순서):
//   1. 원본 코어 행을 읽어 새 scenario_id로 복제한다(mission_content 비움, 편성 없음).
//      원본 행은 손대지 않는다 — 편성된 v5는 v6 승인 전까지 그대로 학습자에게 보인다.
//   2. AI 품질 점검(edge `quality_check`)을 돌려 quality_check를 받는다.
//   3. save_generated_mission으로 새 행에 미션을 저장한다(상태 generated).
// 그 뒤 규칙검사·최종검수·승인·편성은 관리자 화면에서 기존 절차대로 한다.
//
// 로그인 정보는 .env의 PRAGMA_BATCH_ADMIN_EMAIL / PRAGMA_BATCH_ADMIN_PASSWORD를 쓴다
// (scripts/check-tts-credits.mjs와 같은 방식).

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) throw new Error("사용법: node scripts/register-v6-candidate.mjs <candidate.json>");
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

// 1. 코어 행 복제
const { data: source, error: sourceError } = await db.from("scenarios").select("*").eq("scenario_id", candidate.source_scenario_id).single();
if (sourceError || !source) throw new Error(`원본 행을 읽지 못함: ${sourceError?.message}`);
const newId = randomUUID();
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const clone = {
  ...source,
  scenario_id: newId,
  title: candidate.title,
  mission_content: null,
  mission_status: null,
  mission_reviewed_by: null,
  mission_reviewed_at: null,
  target_feature: null,
  target_feature_version: null,
  review_status: "needs_review",
  usage_assignment: "archived_only",
  week_no: null,
  approval_basis: null,
  release_gate_mode: "legacy_reviewed",
  dataset_class: "test_only",
  released_lineage_version_id: null,
  final_corpus_generation_run_id: null,
  final_corpus_release_id: null,
  archived_at: null,
  archive_note: null,
  // rework_of가 있으면 앞서 등록한 v6 행을 잇는다(3bfec949 → b12b0549 → 새 행). 코어는 여전히 v5 원본에서 복제.
  supersedes_scenario_id: candidate.rework_of ?? candidate.source_scenario_id,
  generation_provider: "retained_source",
  generator_model: "retained_reviewed_v5_items",
  generation_prompt_version: candidate.mission_content.provenance.prompt_version,
  generation_run_id: `v6_conversion_${stamp}`,
  // 같은 원본을 다시 등록하면 (run, item_key) 유일 제약에 걸린다 → rework 접미사(supersede RPC와 같은 꼴).
  generation_item_key: `${source.speech_act}:${source.language_direction}:${source.learner_level}:${source.mode}:${candidate.source_scenario_id.slice(0, 8)}${candidate.rework_of ? `:rework:${newId.slice(0, 8)}` : ""}`,
  prompt_snapshot_hash: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
// 코어 오버라이드 — DCT PDR을 바꾼 후보는 코어도 같이 바꿔야 R23을 통과한다. 원본은 불변, 복제 행에만.
const co = candidate.core_overrides;
if (co) {
  if (co.scenario_d) clone.scenario_d = co.scenario_d;
  clone.core_content = { ...clone.core_content,
    ...(co.pdr_d ? { pdr: { ...clone.core_content.pdr, d: co.pdr_d } } : {}),
    ...(co.situation_ko ? { situation_ko: co.situation_ko } : {}),
    ...(co.relation_ko ? { relation_ko: co.relation_ko } : {}) };
  console.log(`0/3 코어 오버라이드 적용: ${Object.keys(co).join(", ")}`);
}
const { error: insertError } = await db.from("scenarios").insert(clone);
if (insertError) throw new Error(`복제 행 삽입 실패: ${insertError.message}`);
console.log(`1/3 복제 행 생성: ${newId}`);

// 2. AI 품질 점검
const { data: qc, error: qcError } = await db.functions.invoke("generate-scenario", {
  body: {
    action: "quality_check",
    telemetry: { scenario_id: newId, generation_run_id: clone.generation_run_id, generation_item_key: clone.generation_item_key, invocation_attempt: 1 },
    quality: { mission_content: candidate.mission_content, ...candidate.quality_request },
  },
});
const quality = qc?.quality_check;
if (qcError || !quality?.verdict) throw new Error(`품질 점검 실패: ${qcError?.message ?? JSON.stringify(qc).slice(0, 300)}`);
console.log(`2/3 품질 점검: ${quality.verdict} — ${quality.summary_ko ?? ""} (지적 ${quality.findings?.length ?? 0}건)`);

// 3. 저장
const { data: savedId, error: saveError } = await db.rpc("save_generated_mission", {
  p_scenario_id: newId,
  p_payload: {
    mission_content: { ...candidate.mission_content, quality_check: quality },
    validation_result: candidate.validation_result,
    lineage_meta: candidate.lineage_meta,
  },
});
if (saveError) throw new Error(`저장 실패: ${saveError.message}`);
console.log(`3/3 저장 완료: ${savedId} (상태 generated)\n다음: 관리자 화면 → 이 미션의 규칙검사·최종검수·승인. 편성은 승인 뒤에 바꾼다.`);
