// 편성된 v5 승인본을 v6 변환 파이프라인 1단계 입력(.v5.json)으로 일괄 추출한다. 읽기 전용.
//
//   node scripts/v6-dump-v5-sources.mjs [출력폴더]        기본 tmp/v6-conversion
//
// 대상 = published 교과목 3개의 주차 편성 슬롯 중 저장본이 mission_v5인 것.
// 이미 v6인 슬롯과 이미 뽑아 둔 파일은 건너뛴다(집필분을 덮어쓰지 않기 위해 --force 없이는 재작성 안 함).
// 로그인 정보는 register-v6-candidate.mjs와 같게 .env의 배치 관리자 계정을 쓴다.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const outDir = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) ?? "tmp/v6-conversion";
const force = process.argv.includes("--force");

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

// 세션 간 표기를 고정한다 — 교과목 약칭은 이 순서로 쓴다.
const COURSE_LABEL = {
  "915fec24-cc38-4b00-a2a0-c3628abcd3f7": "c1 AI 한중 화용 통번역",
  "c3f9a2d7-6e84-4f61-a953-2b7d9c0e4a12": "c2 AI 중한 실전 통번역",
  "a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21": "c3 AI 한중 비즈니스 통번역",
};
const MODE_LABEL = { translation: "번역", stt_interpreting: "통역" };

const { data: outlines, error: outlineError } = await db.from("curriculum_outlines").select("id,title,status");
if (outlineError) throw outlineError;
const published = outlines.filter((o) => o.status === "published");

const { data: slots, error: slotError } = await db
  .from("curriculum_week_scenarios")
  .select("outline_id,week_no,position,scenario_id");
if (slotError) throw slotError;

const { data: scenarios, error: scenarioError } = await db
  .from("scenarios")
  .select(
    "scenario_id,title,mission_content,core_content,content_hash,learner_level,language_direction,mode,source_modality,domain,industry_sector,theme_code,topic_code,scenario_p,scenario_d,scenario_r",
  );
if (scenarioError) throw scenarioError;
const byId = new Map(scenarios.map((s) => [s.scenario_id, s]));

mkdirSync(outDir, { recursive: true });
const written = [];
const skipped = [];
for (const slot of slots
  .filter((s) => published.some((o) => o.id === s.outline_id))
  .sort((a, b) => a.outline_id.localeCompare(b.outline_id) || a.week_no - b.week_no || a.position - b.position)) {
  const row = byId.get(slot.scenario_id);
  const content = row?.mission_content;
  const prefix = slot.scenario_id.slice(0, 8);
  if (!content) { skipped.push(`${prefix} 저장본 없음`); continue; }
  if (content.schema_version !== "mission_v5") { skipped.push(`${prefix} 이미 ${content.schema_version}`); continue; }
  const file = `${outDir}/${prefix}.v5.json`;
  if (existsSync(file) && !force) { skipped.push(`${prefix} 파일 있음`); continue; }
  const courseName = COURSE_LABEL[slot.outline_id] ?? published.find((o) => o.id === slot.outline_id)?.title ?? slot.outline_id.slice(0, 8);
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        scenario_id: row.scenario_id,
        title: row.title,
        course: `${courseName} · ${slot.week_no}주차 · ${MODE_LABEL[row.mode] ?? row.mode}`,
        row: {
          learner_level: row.learner_level,
          language_direction: row.language_direction,
          mode: row.mode,
          source_modality: row.source_modality,
          domain: row.domain,
          industry_sector: row.industry_sector,
          theme_code: row.theme_code,
          topic_code: row.topic_code,
          scenario_p: row.scenario_p,
          scenario_d: row.scenario_d,
          scenario_r: row.scenario_r,
          core_snapshot_hash: row.content_hash,
        },
        content,
        core_content: row.core_content,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  written.push(`${prefix} ${courseName} ${slot.week_no}주차 ${MODE_LABEL[row.mode] ?? row.mode}`);
}
console.log(`새로 쓴 파일 ${written.length}개`);
for (const line of written) console.log("  +", line);
console.log(`건너뛴 슬롯 ${skipped.length}개: ${skipped.join(", ")}`);
