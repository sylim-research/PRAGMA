// 이미 v6로 저장된 행(tmp/rep_<prefix>.json)에 국소 수정을 덮어 rework 후보를 만든다. 로컬에서만 돈다(DB 쓰기 없음).
//
//   npx vite-node scripts/v6-rework-from-row.mts tmp/rep_<prefix>.json <patch.json>
//
// v5 원본 없이 만든 v6 행(예: 2026-09-16 요청 대표 3건)용이다. 원본 = 그 v6 행 자체, rework_of = 그 행.
// patch.json = { "set": { "<경로>": 값, ... }, "core_overrides": {...}?, "_note": "..." }
//   경로 예: "mpj_items[4].candidates[1].text", "production_task.reference_alternatives[0].text"
// 해시·스키마·규칙검사·후보 형식은 v6-assemble-candidate.mts와 같다. fail이면 후보를 쓰지 않는다.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { MissionV6Schema } from "@/lib/pragma/missionV6";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { buildMissionLineageScope } from "@/lib/pragma/missionLineage";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

const [rowFile, patchFile] = process.argv.slice(2);
if (!rowFile || !patchFile) throw new Error("사용법: vite-node scripts/v6-rework-from-row.mts tmp/rep_<prefix>.json <patch.json>");
const row = JSON.parse(readFileSync(rowFile, "utf8"));
const patch = JSON.parse(readFileSync(patchFile, "utf8")) as { set: Record<string, unknown>; core_overrides?: Record<string, unknown> };
if (row.mission_content?.schema_version !== "mission_v6") throw new Error("v6 행이 아님");
const draft = structuredClone(row.mission_content) as Record<string, unknown>;

// 경로에 값을 넣는다. 없는 경로는 오타로 보고 멈춘다.
for (const [path, value] of Object.entries(patch.set)) {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let node = draft as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    if (node[key] === undefined) throw new Error(`없는 경로: ${path}`);
    node = node[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (node[last] === undefined) throw new Error(`없는 경로: ${path}`);
  console.log(`- ${path}\n    전: ${JSON.stringify(node[last])}\n    후: ${JSON.stringify(value)}`);
  // null = 선택 필드 삭제(예: contrast). 필수 필드면 아래 스키마 검사가 막는다.
  if (value === null) delete node[last];
  else node[last] = value;
}

draft.authoring = { schema_version: "mission_authoring_v1", stage: "ai_draft", lineage_status: "pending", repair_attempts: 0 };
const hashPayload = { ...draft };
delete hashPayload.provenance; delete hashPayload.quality_check; delete hashPayload.hsk_lexical_audit; delete hashPayload.authoring;
const mission_content_hash = createHash("sha256").update(new TextEncoder().encode(JSON.stringify(hashPayload))).digest("hex");
draft.provenance = { ...(draft.provenance as object), generated_at: new Date().toISOString(), generation_attempt: 1, mission_content_hash };
delete draft.quality_check;

const parsed = MissionV6Schema.safeParse(draft);
if (!parsed.success) {
  console.error(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  throw new Error("MissionV6Schema 위반");
}
const feature = getTargetFeature(String((draft.unit as { target_feature: string }).target_feature));
if (!feature) throw new Error("카탈로그에 없는 초점");
const ctx: CheckContext = {
  speech_act: (draft.learning_goal as { speech_act: CheckContext["speech_act"] }).speech_act,
  level: row.learner_level ?? "intermediate",
  domain: row.domain ?? "daily",
  theme_code: row.theme_code,
  topic_code: row.topic_code,
  industry: row.industry_sector ?? null,
  mode: row.mode ?? "translation",
  source_modality: row.source_modality ?? "written",
  planned_target_feature: feature.code,
  direction: draft.direction as CheckContext["direction"],
};
const co = patch.core_overrides as { source_text?: string; focal_segments?: unknown } | undefined;
const coreForCheck = row.core_content ? { ...row.core_content, ...(co ?? {}) } : undefined;
const check = checkMission(draft, ctx, coreForCheck);
for (const violation of check.violations) console.log(`[${violation.level}] ${violation.id} ${violation.message}`);
if (check.result === "fail") throw new Error("규칙검사 fail — 후보 파일을 쓰지 않음");

const direction = draft.direction as "ko_zh" | "zh_ko";
const zh = (base: unknown, variant: unknown) => (direction === "zh_ko" && variant ? variant : base);
const candidate = {
  source_scenario_id: row.scenario_id,
  rework_of: row.scenario_id,
  title: row.title,
  ...(co ? { core_overrides: co } : {}),
  mission_content: draft,
  validation_result: { result: check.result, violations: check.violations.map(v => ({ id: v.id, level: v.level, message: v.message })), generation_attempts: 1, repair_attempts: 0 },
  lineage_meta: buildMissionLineageScope({ direction, speechAct: ctx.speech_act, targetFeature: feature.code }),
  quality_request: {
    feature: {
      code: feature.code, learner_label: feature.learner_label,
      band_codes: feature.band_schema.map(b => b.code),
      band_schema: feature.band_schema.map(b => ({ code: b.code, label_ko: b.label_ko })),
      within_band_code: feature.within_band_code,
      operational_definition: zh(feature.operational_definition, feature.operational_definition_zh_ko),
      excluded_confounds: zh(feature.excluded_confounds, feature.excluded_confounds_zh_ko),
      counter_rule_note: zh(feature.counter_rule_note, feature.counter_rule_note_zh_ko),
      fidelity_note: feature.fidelity_note,
    },
    direction, speech_act: ctx.speech_act,
  },
};
const out = rowFile.replace(/\.json$/, ".rework.candidate.json");
writeFileSync(out, JSON.stringify(candidate, null, 2));
console.log(`\n후보 저장: ${out}\n규칙검사: ${check.result} (warning ${check.violations.filter(v => v.level === "warning").length}건) · hash ${mission_content_hash.slice(0, 12)}`);
