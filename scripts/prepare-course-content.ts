// Read-only planning against an exported current-generation inventory.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { COURSE_PRESETS, SCENARIO_TOPICS, topicSupportsContext } from "../src/lib/pragma/scenarioTopics";
import { STANDARD_15WEEK } from "../src/lib/curriculum/template";
import { TARGET_SPEECH_ACT_WEEK_NOS, WEEKLY_LEARNING_CONTRACT } from "../src/lib/curriculum/courseModePolicy";
import { checkCore, checkMission } from "../src/lib/pragma/missionRules";
import { DEFAULT_FEATURE_BY_ACT } from "../src/lib/pragma/targetFeatures";
import { CURRENT_CONTENT_RELEASE_ID } from "../supabase/functions/_shared/contentRelease";
import type { BatchCell } from "../src/lib/pragma/batchPlan";

const inventory = JSON.parse(readFileSync(".tmp/course-content-inventory.json", "utf8"));
if (inventory.release !== CURRENT_CONTENT_RELEASE_ID) throw new Error("Inventory release mismatch");
const used = new Set<string>();
const themeUses = new Map<string, number>();
const topicUses = new Map<string, number>();
const rejectReasons: Record<string, string[]> = {};
const viable = inventory.rows.filter((row: any) => {
  const ctx = { speech_act: row.speech_act, level: row.learner_level, domain: row.domain,
    theme_code: row.theme_code, topic_code: row.topic_code, industry: row.industry_sector,
    mode: row.mode, source_modality: row.source_modality, direction: row.core_content.direction,
    require_context_spec: true, planned_target_feature: DEFAULT_FEATURE_BY_ACT[row.speech_act] };
  const core = checkCore(row.core_content, ctx);
  const failures = core.violations.filter(v => v.level === "fail").map(v => v.id);
  if (row.mission_content) {
    failures.push(...checkMission(row.mission_content, ctx, row.core_content).violations.filter(v => v.level === "fail").map(v => v.id));
    if (row.mission_content.mpj_items?.length !== 5) failures.push("not_native_mjt5");
    if (row.mission_content.quality_check?.verdict === "fail") failures.push("semantic_fail");
    if (row.mission_content.provenance?.content_release_id !== CURRENT_CONTENT_RELEASE_ID) failures.push("mission_release");
  }
  if (failures.length) { rejectReasons[row.scenario_id] = [...new Set(failures)]; return false; }
  return true;
});
const normalize = (s: string) => s.replace(/[\s\p{P}]/gu, "");
const plan: any[] = [];
for (const [courseIndex, preset] of COURSE_PRESETS.entries()) {
  const outline = inventory.outlines.find((o: any) => o.id === preset.outline_id);
  if (!outline || outline.level !== preset.target_level || outline.language_direction !== preset.language_direction || outline.course_mode !== "mixed")
    throw new Error("Current course differs from approved preset: " + preset.preset_code);
  for (const [weekIndex, weekNo] of TARGET_SPEECH_ACT_WEEK_NOS.entries()) {
    const speechAct = STANDARD_15WEEK.find(w => w.week_no === weekNo)!.speech_act!;
    let firstScene = "";
    for (const [modeIndex, mode] of (["translation", "stt_interpreting"] as const).entries()) {
      const ordinal = plan.length;
      const candidates = viable.filter((r: any) => !used.has(r.scenario_id) && r.speech_act === speechAct &&
        r.learner_level === outline.level && r.core_content.direction === outline.language_direction &&
        r.mode === mode && outline.composition_theme_codes.includes(r.theme_code) &&
        (preset.primary_domain !== "work" || r.domain === "work") &&
        (!firstScene || normalize(r.core_content.situation_ko) !== firstScene))
        .sort((a: any, b: any) => Number(Boolean(b.mission_content)) - Number(Boolean(a.mission_content)) ||
          (a.mission_content?.quality_check?.findings?.length ?? 0) - (b.mission_content?.quality_check?.findings?.length ?? 0) ||
          a.scenario_id.localeCompare(b.scenario_id));
      const existing = candidates[0];
      let cell: BatchCell | null = null;
      if (existing) {
        used.add(existing.scenario_id);
        if (modeIndex === 0) firstScene = normalize(existing.core_content.situation_ko);
        const themeKey = preset.preset_code + ":" + existing.theme_code;
        themeUses.set(themeKey, (themeUses.get(themeKey) ?? 0) + 1);
        topicUses.set(existing.topic_code, (topicUses.get(existing.topic_code) ?? 0) + 1);
      } else {
        const power = (["equal", "higher", "lower"] as const)[(weekIndex + modeIndex + courseIndex) % 3];
        const distance = (["close", "acquaintance", "formal"] as const)[(weekIndex + 2 * modeIndex + courseIndex) % 3];
        const burden = (["low", "mid", "high"] as const)[(2 * weekIndex + modeIndex + courseIndex) % 3];
        const topics = SCENARIO_TOPICS.flatMap(topic => {
          if (!outline.composition_theme_codes.includes(topic.themeCode)) return [];
          const domains = topic.allowedDomains.filter(domain => (preset.primary_domain !== "work" || domain === "work") &&
            topicSupportsContext(topic, {speechAct, domain, power, distance, mode}));
          if (!domains.length) return [];
          const domain = domains.includes(preset.primary_domain) ? preset.primary_domain : domains[0];
          return [{topic, domain}];
        }).sort((a, b) =>
          (themeUses.get(preset.preset_code + ":" + a.topic.themeCode) ?? 0) - (themeUses.get(preset.preset_code + ":" + b.topic.themeCode) ?? 0) ||
          (topicUses.get(a.topic.code) ?? 0) - (topicUses.get(b.topic.code) ?? 0) ||
          Number(Boolean(b.topic.allowedSpeechActs)) - Number(Boolean(a.topic.allowedSpeechActs)) ||
          a.topic.code.localeCompare(b.topic.code));
        if (!topics.length) throw new Error("No compatible topic: " + speechAct + "/" + mode);
        const {topic, domain} = topics[0];
        cell = { speech_act_ui: speechAct, level: preset.target_level, direction: preset.language_direction,
          domain, mode, pdr_power: power, pdr_distance: distance, pdr_burden: burden,
          industry: domain === "work" ? (topic.themeCode === "digital_content" ? "culture_content_media" : topic.themeCode === "commerce_customer" ? "tourism_hospitality" : "trade_distribution") : null,
          business_function: domain === "work" ? (topic.themeCode === "digital_content" ? "marketing_pr" : topic.themeCode === "commerce_customer" ? "customer_partner_support" : "project_coordination") : null,
          theme_code: topic.themeCode, topic_code: topic.code, situation_seed_ko: topic.situationSeedKo, count: 1 };
        const themeKey = preset.preset_code + ":" + topic.themeCode;
        themeUses.set(themeKey, (themeUses.get(themeKey) ?? 0) + 1);
        topicUses.set(topic.code, (topicUses.get(topic.code) ?? 0) + 1);
      }
      plan.push({ ordinal, slotId: preset.preset_code + ":w" + weekNo + ":" + mode, courseId: outline.id,
        courseTitle: outline.title, weekNo, speechAct, mode, level: outline.level, direction: outline.language_direction,
        existingScenarioId: existing?.scenario_id ?? null, stage: existing?.mission_content ? "review" : existing ? "mission" : "core",
        cell, existingScene: existing?.core_content.situation_ko ?? null });
    }
  }
}
const planHash = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
const result = { version: "course_content_a_v1", learningContract: WEEKLY_LEARNING_CONTRACT,
  lifecycle: "candidate_for_professor_review", release: CURRENT_CONTENT_RELEASE_ID, planHash,
  inventoryAt: inventory.checkedAt, scope: "3 courses × 9 speech-act weeks × 2 modes; week 13 selected during teaching",
  plan, rejectedExisting: rejectReasons };
mkdirSync(".tmp/course-content", {recursive:true});
writeFileSync(".tmp/course-content/plan.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify({ planHash, slots: plan.length, readyForReview: plan.filter(x=>x.stage==="review").length,
  needMission: plan.filter(x=>x.stage==="mission").length, needCore: plan.filter(x=>x.stage==="core").length, excludedExisting: Object.keys(rejectReasons).length }));
