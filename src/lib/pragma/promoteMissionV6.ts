// 코어 하나 → mission_v6 초안(generated). 설계안 v2(2026-09-21)의 최소 경로.
//
// 생성(mission_v6) → 조립·서버 주입 → 스키마·규칙·저작 검사 → 실패 시 수리 1회 → AI 점검(v6) →
// save_generated_mission. 저장본은 검수 대기 초안이며, 이후 검수·교수자 승인·편성은 기존 경로를 따른다.
// 생성기는 reviewed·professor_finalized를 만들지 않는다.

import { supabase } from "@/integrations/supabase/client";
import { MissionV6Schema } from "./missionV6";
import { checkCore, checkMission, type CheckContext } from "./missionRules";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT } from "./targetFeatures";
import { buildMissionLineageScope } from "./missionLineage";
import { normalizeCore } from "./coreSchema";
import { assembleMissionV6Draft, featureForV6Prompt } from "./missionV6Assemble";
import type { V6CoreForPrompt } from "../../../supabase/functions/_shared/missionV6Generation";
import { runQualityCheck, type PromotableCore } from "./promoteMission";
import type { QualityCheck } from "./missionSchema";
import type { Domain } from "./enums";
import type { ThemeCode } from "./scenarioTopics";

export type PromoteV6Stage = "preparing" | "generating" | "checking" | "repairing" | "quality" | "saving";

export interface PromoteV6Result {
  ok: boolean;
  savedId?: string;
  ruleResult?: "pass" | "warning" | "fail";
  qualityVerdict?: QualityCheck["verdict"];
  repaired?: boolean;
  error?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

type Finding = { level: string; path: string; message: string };

export async function promoteCoreV6(core: PromotableCore, onStage?: (stage: PromoteV6Stage) => void): Promise<PromoteV6Result> {
  onStage?.("preparing");
  const featureCode = DEFAULT_FEATURE_BY_ACT[core.speech_act];
  const feature = featureCode ? getTargetFeature(featureCode) : undefined;
  if (!feature) return { ok: false, error: "이 화행은 화용 초점 카탈로그가 없어 생성할 수 없습니다." };
  const normalized = normalizeCore(core.core_content ?? {});
  if (!normalized.ok) return { ok: false, error: "코어를 읽을 수 없어 생성하지 않았습니다." };
  const coreData = normalized.data;
  const direction = coreData.direction === "zh_ko" ? "zh_ko" : "ko_zh";
  // 행 mode는 통역을 stt_interpreting으로 저장한다(미션 DCT는 interpreting). 코어의 원문 형태와 어긋나면 생성 전에 멈춘다.
  const mode = core.mode === "stt_interpreting" ? "interpreting" : "translation";
  if ((mode === "interpreting") !== (coreData.source_modality === "spoken")) {
    return { ok: false, error: "행의 수행 방식과 코어의 원문 형태가 맞지 않아 생성하지 않았습니다." };
  }
  const ctx: CheckContext = {
    speech_act: core.speech_act,
    level: core.learner_level,
    domain: (core.domain ?? "daily") as Domain,
    theme_code: (core.theme_code ?? "daily_living") as ThemeCode,
    topic_code: core.topic_code ?? "",
    industry: core.industry_sector ?? null,
    mode: core.mode ?? "translation",
    source_modality: (core.source_modality ?? coreData.source_modality) as "written" | "spoken",
    planned_target_feature: feature.code,
    direction,
  };
  // DCT는 코어를 그대로 계승하므로 코어가 규칙을 못 넘으면 미션 생성으로 고칠 수 없다(유료 호출 전 차단).
  const coreCheck = checkCore(core.core_content ?? {}, ctx);
  if (coreCheck.result === "fail") return { ok: false, ruleResult: "fail", error: "코어 규칙검사 실패 — 생성하지 않았습니다." };

  const promptCore: V6CoreForPrompt = {
    source_text: coreData.source_text,
    focal_segments: (coreData.focal_segments ?? []) as V6CoreForPrompt["focal_segments"],
    situation_ko: coreData.situation_ko,
    relation_ko: coreData.relation_ko,
    pdr: coreData.pdr as V6CoreForPrompt["pdr"],
    channel: coreData.channel,
    usable_facts: coreData.usable_facts,
    context_spec: (core.core_content as { context_spec?: unknown } | null)?.context_spec,
  };
  if (!promptCore.focal_segments.some(segment => segment.role === "head")) {
    return { ok: false, error: "핵심 구간(head)이 없는 옛 코어라 v6로 생성할 수 없습니다." };
  }
  const row = {
    learner_level: core.learner_level,
    domain: core.domain ?? "daily",
    theme_code: core.theme_code,
    topic_code: core.topic_code,
    industry: core.industry_sector ?? null,
  };
  const telemetry = {
    scenario_id: core.scenario_id,
    generation_run_id: core.generation_run_id ?? null,
    generation_item_key: core.generation_item_key ?? null,
  };
  const request = {
    act: core.speech_act, direction, mode,
    feature: featureForV6Prompt(feature.code, direction),
    core: promptCore, row,
  };
  const generate = async (attempt: number, repair?: { previous_draft: unknown; violations: Finding[] }) => {
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: { action: "mission_v6", telemetry: { ...telemetry, invocation_attempt: attempt }, mission_v6: { ...request, ...(repair ? { repair } : {}) } },
    });
    const body = data as { draft?: unknown; model?: string; error?: string } | null;
    if (error || !body?.draft) throw new Error(body?.error ?? (error as { message?: string } | null)?.message ?? "생성 응답 없음");
    return { raw: body.draft, model: body.model ?? "unknown" };
  };
  const evaluate = async (raw: unknown, model: string, attempt: number, repaired: boolean) => {
    const { draft, issues } = await assembleMissionV6Draft({
      raw, core: promptCore, act: core.speech_act, direction, mode, featureCode: feature.code,
      model, generationAttempt: attempt, repaired, sha256Hex,
    });
    const findings: Finding[] = [...issues];
    const parsed = MissionV6Schema.safeParse(draft);
    let check: ReturnType<typeof checkMission> | null = null;
    if (!parsed.success) {
      findings.push(...parsed.error.issues.map(issue => ({ level: "fail", path: issue.path.join("."), message: issue.message })));
    } else {
      check = checkMission(draft, ctx, core.core_content ?? undefined);
      findings.push(...check.violations.map(v => ({ level: v.level, path: v.id, message: v.message })));
    }
    return { draft, check, fails: findings.filter(f => f.level === "fail") };
  };

  let raw: unknown;
  let model: string;
  let result: Awaited<ReturnType<typeof evaluate>>;
  let repaired = false;
  try {
    onStage?.("generating");
    ({ raw, model } = await generate(1));
    onStage?.("checking");
    result = await evaluate(raw, model, 1, false);
    if (result.fails.length) {
      onStage?.("repairing");
      const repair = await generate(2, { previous_draft: raw, violations: result.fails });
      repaired = true;
      result = await evaluate(repair.raw, repair.model, 2, true);
    }
  } catch (e) {
    return { ok: false, error: `생성 실패: ${(e as Error).message}` };
  }
  if (result.fails.length || !result.check) {
    return { ok: false, ruleResult: "fail", repaired, error: `검사 실패(수리 후): ${result.fails.slice(0, 3).map(f => f.message).join(" · ")}` };
  }

  // AI 점검 실패는 자동 통과가 아니다 — 기존 경로처럼 unavailable 기록을 붙여 교수자 확인으로 넘긴다.
  onStage?.("quality");
  const qualityResult = await runQualityCheck({
    missionContent: result.draft, feature, direction, speechAct: core.speech_act,
    scenarioId: core.scenario_id, generationRunId: core.generation_run_id, generationItemKey: core.generation_item_key,
  });
  const quality: QualityCheck = qualityResult.ok
    ? qualityResult.quality
    : {
        verdict: "fail",
        summary_ko: "AI 점검을 완료하지 못해 교수자 확인이 필요합니다.",
        findings: [{ code: "critic_unavailable", severity: "fail", where: "", note_ko: "error" in qualityResult ? qualityResult.error : "AI 점검 실패" }],
        model: "unavailable",
        prompt_version: "quality_unavailable_v1",
        checked_at: new Date().toISOString(),
      };

  onStage?.("saving");
  const { data: savedId, error: saveError } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    "save_generated_mission",
    {
      p_scenario_id: core.scenario_id,
      p_payload: {
        mission_content: { ...result.draft, quality_check: quality },
        validation_result: {
          result: result.check.result,
          violations: result.check.violations.map(v => ({ id: v.id, level: v.level, message: v.message })),
          generation_attempts: 1,
          repair_attempts: repaired ? 1 : 0,
        },
        lineage_meta: buildMissionLineageScope({ direction, speechAct: core.speech_act, targetFeature: feature.code }),
      },
    },
  );
  if (saveError) return { ok: false, repaired, error: `저장 실패: ${(saveError as { message?: string }).message ?? String(saveError)}` };
  return { ok: true, savedId: String(savedId ?? core.scenario_id), ruleResult: result.check.result as "pass" | "warning", qualityVerdict: quality.verdict, repaired };
}
