// v5 승인본 + 집필분 → v6 후보 JSON. 로컬에서만 돈다(DB 쓰기 없음).
//
//   npx vite-node scripts/v6-assemble-candidate.mts tmp/v6-conversion/<scenario_id 앞 8자리>
//
// 입력 = <prefix>.v5.json (저장본 그대로) + <prefix>.authored.json (변환기가 못 채운 자리).
// 출력 = <prefix>.v6.candidate.json — 등록 스크립트가 그대로 읽는다. 스키마와 규칙검사를
// 여기서 먼저 돌리고, 하나라도 fail이면 후보 파일을 쓰지 않는다.
//
// 해시는 promoteMission.contentHashForDraft와 같은 방식(provenance·quality_check·
// hsk_lexical_audit·authoring 제외, JSON.stringify 그대로 SHA-256)이다. 그래야 나중에
// 검수 기록의 hash 대조가 승격 경로와 같은 값을 본다.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { convertMissionV5ToV6 } from "@/lib/mission/missionV5ToV6";
import { MissionV6Schema } from "@/lib/pragma/missionV6";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { buildMissionLineageScope } from "@/lib/pragma/missionLineage";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

const prefix = process.argv[2];
if (!prefix) throw new Error("사용법: vite-node scripts/v6-assemble-candidate.mts tmp/v6-conversion/<prefix>");

const source = JSON.parse(readFileSync(`${prefix}.v5.json`, "utf8"));
const authored = JSON.parse(readFileSync(`${prefix}.authored.json`, "utf8"));
const row = source.row ?? {};

const { draft, gaps } = convertMissionV5ToV6(source.content);
const items = draft.mpj_items as Record<string, unknown>[];

// ── 집필분을 gap 자리에만 얹는다. 옮겨온 값은 건드리지 않는다. ──
const task = draft.production_task as Record<string, unknown>;
authored.titles.forEach((title: string, index: number) => { items[index].title = title; });
authored.learner_contexts.forEach((context: string, index: number) => { items[index].learner_context_ko = context; });
Object.assign(items[3], authored.mjt4);
draft.lesson_points = authored.lesson_points.map((point: { label: string; text: string }, index: number) => ({ item_id: index + 1, ...point }));
task.learner_context_ko = authored.dct_learner_context;
// 옛 통역 저장본의 A·B 장면을 다시 쓴 경우(선택). 있는 문항만 덮는다.
(authored.scenes ?? []).forEach((scene: { situation_ko?: string; relation_ko?: string } | null, index: number) => { if (scene) Object.assign(items[index], scene); });
if (authored.dct_scene) Object.assign(task, authored.dct_scene);
// 옮겨온 값을 자리별로 덮는다 — 한국어 목표문 자연화 패스(2026-09-17). 화행 이동·대역은 그대로 두고 표면만 바꾼다.
// 값이 {text} 객체인 자리에 문자열을 주면 text만 바꾼다(note_ko·band 등은 유지).
for (const [path, value] of Object.entries((authored.overrides ?? {}) as Record<string, unknown>)) {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  const last = keys.pop()!;
  const parent = keys.reduce<any>((node, key) => node?.[key], draft);
  if (parent == null || !(last in parent)) throw new Error(`override 자리가 없음: ${path}`);
  const existing = parent[last];
  if (value === null) delete parent[last];
  else if (typeof value === "string" && existing && typeof existing === "object" && "text" in existing) existing.text = value;
  else parent[last] = value;
}

const unfilled = gaps.filter(gap => {
  const [, index, field] = gap.path.match(/^mpj_items\[(\d)\]\.(\w+)$/) ?? [];
  const isEmpty = (value: unknown) => value === "" || (Array.isArray(value) && value.length === 0);
  if (index !== undefined) {
    const value = items[Number(index)][field];
    // 장면 gap은 집필분이 그 자리를 덮었으면 채워진 것으로 본다.
    if (gap.why.includes("A·B")) return !(authored.scenes?.[Number(index)]?.[field as "situation_ko" | "relation_ko"]);
    return isEmpty(value);
  }
  if (gap.path.startsWith("production_task.")) return !(authored.dct_scene?.[gap.path.slice("production_task.".length) as "situation_ko" | "relation_ko"]);
  if (gap.path.startsWith("lesson_points")) return false;
  return true;
});
if (unfilled.length) throw new Error(`집필분이 비어 있는 자리: ${unfilled.map(gap => gap.path).join(", ")}`);

// ── 출처와 기록. 해시는 승격 경로와 같은 방식. ──
draft.authoring = { schema_version: "mission_authoring_v1", stage: "ai_draft", lineage_status: "pending", repair_attempts: 0 };
const hashPayload = { ...draft };
delete hashPayload.provenance; delete hashPayload.quality_check; delete hashPayload.hsk_lexical_audit; delete hashPayload.authoring;
const mission_content_hash = createHash("sha256").update(new TextEncoder().encode(JSON.stringify(hashPayload))).digest("hex");
draft.provenance = {
  ...authored.provenance,
  generated_at: new Date().toISOString(),
  generation_attempt: 1,
  mission_content_hash,
};

// ── 검증: 스키마 → 규칙검사. fail이면 여기서 멈춘다. ──
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
const check = checkMission(draft, ctx, source.core_content ?? undefined);
for (const violation of check.violations) console.log(`[${violation.level}] ${violation.id} ${violation.message}`);
if (check.result === "fail") throw new Error("규칙검사 fail — 후보 파일을 쓰지 않음");

const direction = draft.direction as "ko_zh" | "zh_ko";
const zh = (base: unknown, variant: unknown) => (direction === "zh_ko" && variant ? variant : base);
const candidate = {
  source_scenario_id: source.scenario_id,
  title: `[v6 변환] ${source.title}`,
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
writeFileSync(`${prefix}.v6.candidate.json`, JSON.stringify(candidate, null, 2));
console.log(`\n후보 저장: ${prefix}.v6.candidate.json\n규칙검사: ${check.result} (warning ${check.violations.filter(v => v.level === "warning").length}건) · hash ${mission_content_hash.slice(0, 12)}`);
