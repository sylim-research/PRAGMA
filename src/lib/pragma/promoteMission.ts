import { invokeAstraMission, type GenerationJob } from './backgroundGenerationApi';
// 코어 → 미션 승격 (관리자 UI 배선). 골든 테스트 경로를 앱으로 옮긴 것.
//   엣지함수 action:'mission'(게이트1·provenance 반영본) → checkMission(R1~R24)
//   → 전체 초안 1회 → R27 국소 결함/critic 지목 문항만 1회 수리 → 유효 초안 격리 저장.
// review_mission RPC = generated → reviewed(학습자 실행 게이트, 계약 0-b·17).
//
// 9개 화행 모두 사람 작성 기본 화용 초점으로 승격할 수 있다.
// compliment_response는 카탈로그에 보존하지만 response subtype 코어 경로 전까지
// 자동 기본값으로 선택하지 않는다.

import { supabase } from "@/integrations/supabase/client";
import {
  checkCore,
  checkMission,
  type CheckContext,
  type RuleViolation,
} from "@/lib/pragma/missionRules";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT, type TargetFeature } from "@/lib/pragma/targetFeatures";
import { errorPatternsForAct } from "@/lib/pragma/errorPatterns";
import {
  buildMissionLineageScope,
  type MissionLineagePromptScope,
} from "@/lib/pragma/missionLineage";
import {
  normalizeMission,
  QualityCheckSchema,
  type MissionRuntime,
  type QualityCheck,
} from "@/lib/pragma/missionSchema";
import { normalizeCore, coreDirection } from "@/lib/pragma/coreSchema";
import {
  SPEECH_ACT_UI,
  LEVEL,
  DIRECTION_LABEL,
  type Domain,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import {
  candidateRegenerationMax,
  candidateRegenerationTotal,
  canonicalCandidatePath,
  normalizeCandidateRegenerationCounts,
  recordCandidateRegeneration,
  type CandidateRegenerationCounts,
} from "../../../supabase/functions/_shared/missionCandidateRecovery";

export const LEVEL_POLICY: Record<LearnerLevel, string> = {
  beginner_intermediate: "입문: 단문 중심, 종속절 제한. 자원 조합 1개. 원문 1~2문장.",
  intermediate: "중급: 복문 1~2개, 이유·조건 표현 사용. 자원 조합 2개. 원문 2~4문장.",
  advanced: "고급: 담화 조직·복합 전략. 자원 선택 배열. 원문 3~5문장(통역은 짧은 구두 담화).",
};

const isResponseAct = (act: SpeechActUI) => act === "refusal" || act === "opposition";

// 방향에 맞는 카탈로그 변형을 골라 엣지에 보낸다(0-l·86). zh_ko는 _zh_ko 필드,
// 없으면 ko_zh 기본값(하지만 승격 전 가드가 zh_ko 변형 부재를 막는다).
export function featureForGen(
  f: TargetFeature,
  dir: LanguageDirection,
  lineageScope: MissionLineagePromptScope = buildMissionLineageScope({
    direction: dir,
    speechAct: f.speech_act,
    targetFeature: f.code,
  }),
) {
  const zhko = dir === "zh_ko";
  return {
    code: f.code,
    version: f.version,
    learner_label: f.learner_label,
    operational_definition:
      zhko && f.operational_definition_zh_ko ? f.operational_definition_zh_ko : f.operational_definition,
    band_schema: f.band_schema,
    within_band_code: f.within_band_code,
    relevant_resources: zhko && f.relevant_resources_zh_ko ? f.relevant_resources_zh_ko : f.relevant_resources,
    excluded_confounds: zhko && f.excluded_confounds_zh_ko ? f.excluded_confounds_zh_ko : f.excluded_confounds,
    closing_principle_ko: f.closing_principle_ko,
    counter_rule_note: zhko && f.counter_rule_note_zh_ko ? f.counter_rule_note_zh_ko : f.counter_rule_note,
    ...(lineageScope.coverage_status === "covered" ? { lineage_scope: lineageScope } : {}),
  };
}

/** 승격 대상 코어(브라우저·편성기 조회 결과의 부분집합). */
export interface PromotableCore {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  industry_sector?: string | null;
  mode: GenMode | null;
  source_modality: string | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  /** 행 태그(0-l·82) — core_content.direction이 정본, 이건 조회 필터용. 없으면 ko_zh */
  language_direction?: LanguageDirection | null;
  generation_run_id?: string | null;
  generation_item_key?: string | null;
  core_content: Record<string, unknown> | null;
}

export interface PromoteResult {
  ok: boolean;
  /** 생성된 미션(검사 통과 여부와 무관 — 눈검사용으로 항상 반환 시도). 정규화 v2 형태. */
  mission?: MissionRuntime;
  ruleResult?: "pass" | "warning" | "fail";
  violations?: RuleViolation[];
  attempts?: number;
  savedId?: string;
  /** 검증②(0-n·94) 결과. 유효한 결과가 없으면 미션은 저장하지 않는다. */
  quality?: QualityCheck;
  firstPassQualityVerdict?: "pass" | "warning" | "fail";
  repaired?: boolean;
  candidateRegenerationCount?: number;
  candidateRegenerationMaxPerCandidate?: number;
  repairError?: string;
  error?: string;
  terminal?: PromotionTerminalEvidence;
}

export interface PromotionTerminalEvidence {
  terminalStage:
    | "preparing"
    | "topology"
    | "mission_generation"
    | "relative_boundary"
    | "schema"
    | "deterministic"
    | "critic"
    | "saving"
    | "eligible"
    | "unknown";
  itemCandidatePaths: string[];
  deterministicFailureCodes: string[];
  criticVerdict: "pass" | "warning" | "fail" | "UNKNOWN";
  criticFindingCodes: Array<{ code: string; path: string }>;
  criticFindings?: Array<{ code: string; path: string; severity: string; finding: string }>;
  topology?: {
    firstPassResult: "pass" | "fail" | "UNKNOWN";
    finalResult: "pass" | "fail" | "UNKNOWN";
    attempts: number;
    regenerationCount: number;
    findings: Array<{ attempt: number; code: string; path: string; message: string }>;
  } | null;
  initialR27Findings?: Array<{ code: string; path: string; message: string }>;
  r27RepairAttempted?: boolean;
  postRepairDeterministicResult?: "pass" | "fail" | "not_attempted" | "UNKNOWN";
  postRepairDeterministicFindings?: Array<{ code: string; path: string; message: string }>;
  attemptNo: number;
  regenerationCount: number;
  operation: string;
  operationResult: "not_attempted" | "succeeded" | "failed" | "UNKNOWN";
  operationError?: string;
  infrastructureError: boolean;
  providerStatus: number | "UNKNOWN";
  finalOutcome: "eligible" | "quality_fail_draft" | "terminal_dropout" | "UNKNOWN";
  stopCode?: string;
  boundaryFallback?: Record<string, unknown> | null;
}

function providerStatusFromError(error: unknown): number | "UNKNOWN" {
  const status = (error as { context?: { status?: unknown }; status?: unknown })?.context?.status ??
    (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : "UNKNOWN";
}

function qualityFindingSummary(quality: QualityCheck | undefined) {
  return quality?.findings.map((finding) => ({ code: finding.code, path: finding.where })) ?? [];
}

function qualityFindingEvidence(quality: QualityCheck | undefined) {
  return quality?.findings.map((finding) => ({
    code: finding.code,
    path: finding.where,
    severity: finding.severity,
    finding: finding.note_ko,
  })) ?? [];
}

function topologyEvidence(value: unknown): PromotionTerminalEvidence["topology"] {
  if (!isRecord(value)) return null;
  const findings = Array.isArray(value.findings)
    ? value.findings.filter(isRecord).map((finding) => ({
        attempt: typeof finding.attempt === "number" ? finding.attempt : 0,
        code: typeof finding.code === "string" ? finding.code : "UNKNOWN",
        path: typeof finding.path === "string" ? finding.path : "UNKNOWN",
        message: typeof finding.message === "string" ? finding.message : "UNKNOWN",
      }))
    : [];
  return {
    firstPassResult: value.first_pass_result === "pass" || value.first_pass_result === "fail"
      ? value.first_pass_result
      : "UNKNOWN",
    finalResult: value.final_result === "pass" || value.final_result === "fail"
      ? value.final_result
      : "UNKNOWN",
    attempts: typeof value.attempts === "number" ? value.attempts : 0,
    regenerationCount: typeof value.regeneration_count === "number" ? value.regeneration_count : 0,
    findings,
  };
}

function r27FindingEvidence(violations: MissionRuleViolation[]) {
  return violations
    .filter((violation) => violation.id === "R27")
    .map((violation) => ({
      code: violation.id,
      path: repairFindingsForRuleViolations([violation])[0]?.where ?? "UNKNOWN",
      message: violation.message,
    }));
}

function bandTargetingFromContent(content: Record<string, unknown>): Record<string, unknown> {
  const provenance = isRecord(content.provenance) ? content.provenance : {};
  return isRecord(provenance.band_targeting) ? provenance.band_targeting : {};
}

function candidateCountsFromContent(content: Record<string, unknown>): CandidateRegenerationCounts {
  return normalizeCandidateRegenerationCounts(bandTargetingFromContent(content).candidate_regeneration_counts);
}

/** 관리자 조립 UI에 노출하는 실제 처리 경계. 퍼센트 추정에는 쓰지 않는다. */
export type PromoteStage =
  | { phase: "preparing" }
  | { phase: "generating"; attempt: number; maxAttempts: number }
  | { phase: "checking"; attempt: number; maxAttempts: number }
  | { phase: "quality" }
  | { phase: "repairing" }
  | { phase: "rechecking" }
  | { phase: "saving" };

export interface PromoteOptions {
  generationModel?: "existing" | "astra";
  generationJobId?: string;
  onGenerationJob?: (job: GenerationJob) => void;
  onProgress?: (stage: PromoteStage) => void;
}

/** 전체 미션은 한 번만 생성한다. 이후 수정은 실패 item block 1회로 제한한다. */
export const MISSION_GENERATION_MAX_ATTEMPTS = 1;

type MissionRuleViolation = { id: string; level: string; message: string };

const ITEM_BLOCK_REPAIRABLE_RULES = new Set([
  "R2", "R3", "R4", "R5", "R6", "R7", "R10", "R11", "R18", "R21", "R27", "R28",
]);
const PDR_FROZEN_ITEM_RULES = new Set(["R2", "R3", "R4", "R5"]);

/** 허용 operation 안에서 고칠 수 있는 결정론 결함만 문항 단위 수리로 보낸다. */
export function repairFindingsForRuleViolations(
  violations: MissionRuleViolation[],
): QualityCheck["findings"] {
  const findings: QualityCheck["findings"] = [];
  const seen = new Set<string>();
  for (const violation of violations) {
    if (violation.level !== "fail") continue;
    if (violation.id === "R33") {
      const where = "diagnostic_dimensions";
      if (!seen.has(where)) {
        seen.add(where);
        findings.push({ code: "rule_R33_diagnostics", severity: "fail", where, note_ko: violation.message });
      }
      continue;
    }
    if (violation.id === "R11" && violation.message.startsWith("reference_alternatives")) {
      const where = "production_task.reference_alternatives";
      if (!seen.has(where)) {
        seen.add(where);
        findings.push({ code: "rule_R11_references", severity: "fail", where, note_ko: violation.message });
      }
      continue;
    }
    if (violation.id === "R27") {
      const itemNumber = Number(violation.message.match(/문항\s+(\d+)/)?.[1]);
      const where = violation.message.includes("[slot:DCT]")
        ? "production_task.situation_ko"
        : Number.isInteger(itemNumber) && itemNumber >= 1 && itemNumber <= 5
          ? `mpj_items[${itemNumber - 1}].situation_ko`
          : null;
      if (where && !seen.has(where)) {
        seen.add(where);
        findings.push({
          code: "rule_R27_situation",
          severity: "fail",
          where,
          note_ko: violation.message,
        });
      }
      continue;
    }
    if (!ITEM_BLOCK_REPAIRABLE_RULES.has(violation.id)) continue;
    if (PDR_FROZEN_ITEM_RULES.has(violation.id) && /PDR/i.test(violation.message)) continue;
    const itemGroup = violation.message.match(/문항\s+([0-9·]+)/)?.[1];
    const itemNumbers = itemGroup
      ?.split("·")
      .map(Number)
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
    const repairItemNumbers = itemNumbers ?? [];
    for (const itemNumber of repairItemNumbers) {
      const where = `mpj_items[${itemNumber - 1}]`;
      if (seen.has(where)) continue;
      seen.add(where);
      findings.push({
        code: `rule_${violation.id}_item`,
        severity: "fail",
        where,
        note_ko: violation.message,
      });
    }
  }
  return findings;
}

/**
 * 검증② — 규칙검사 통과분을 **생성과 분리된 모델**로 비평(계약 0-n·94, 세칙 0-q·99).
 * 관리자 품질관리 장치이며 학습자에게 노출되지 않는다. 호출·스키마 검증이 실패해도
 * 구조상 유효한 초안은 generated 격리 상태로 저장해 교수자가 이어서 처리한다.
 */
async function runQualityCheck(args: {
  missionContent: unknown;
  feature: TargetFeature;
  direction: LanguageDirection;
  speechAct: SpeechActUI;
  scenarioId: string;
  generationRunId?: string | null;
  generationItemKey?: string | null;
}): Promise<{ ok: true; quality: QualityCheck } | { ok: false; error: string }> {
  const { missionContent, feature, direction, speechAct } = args;
  try {
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "quality_check",
        telemetry: {
          scenario_id: args.scenarioId,
          generation_run_id: args.generationRunId ?? null,
          generation_item_key: args.generationItemKey ?? null,
          invocation_attempt: 1,
        },
        quality: {
          mission_content: missionContent,
          feature: {
            code: feature.code,
            learner_label: feature.learner_label,
            band_codes: feature.band_schema.map((b) => b.code),
            band_schema: feature.band_schema.map((band) => ({ code: band.code, label_ko: band.label_ko })),
            within_band_code: feature.within_band_code,
            operational_definition:
              direction === "zh_ko" && feature.operational_definition_zh_ko
                ? feature.operational_definition_zh_ko
                : feature.operational_definition,
            excluded_confounds:
              direction === "zh_ko" && feature.excluded_confounds_zh_ko
                ? feature.excluded_confounds_zh_ko
                : feature.excluded_confounds,
            counter_rule_note:
              direction === "zh_ko" && feature.counter_rule_note_zh_ko
                ? feature.counter_rule_note_zh_ko
                : feature.counter_rule_note,
          },
          direction,
          speech_act: speechAct,
        },
      },
    });
    if (error) {
      console.warn("[quality_check] 호출 실패 — 저장하지 않습니다:", error);
      return { ok: false, error: `품질점검 호출 실패: ${(error as { message?: string }).message ?? String(error)}` };
    }
    const parsed = QualityCheckSchema.safeParse((data as { quality_check?: unknown })?.quality_check);
    if (!parsed.success) {
      console.warn("[quality_check] 응답 형식 불일치 — 저장하지 않습니다:", parsed.error.message);
      return { ok: false, error: `품질점검 응답 형식 불일치: ${parsed.error.message}` };
    }
    if (!parsed.data.model.trim() || !parsed.data.prompt_version.trim() || !parsed.data.checked_at.trim()) {
      console.warn("[quality_check] 필수 메타데이터 누락 — 저장하지 않습니다.");
      return { ok: false, error: "품질점검 응답 형식 불일치: 모델·프롬프트 버전·점검 시각이 필요합니다." };
    }
    return { ok: true, quality: parsed.data };
  } catch (e) {
    console.warn("[quality_check] 예외 — 저장하지 않습니다:", e);
    return { ok: false, error: `품질점검 예외: ${(e as Error).message ?? String(e)}` };
  }
}

// 엣지는 연구 산출물의 모델을 바꾸지 않는다. 일시 전송 오류만 같은 모델·같은 계약으로
// 잠시 기다렸다 재호출해 배치 안의 생성 모델과 품질 수준을 고정한다.
const TRANSIENT_STATUSES = new Set([429, 502, 503]);

async function invokeMissionWithBackoff(
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: unknown }> {
  let last: { data: unknown; error: unknown } = { data: null, error: null };
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) await new Promise((r) => setTimeout(r, 15_000 * i));
    last = await supabase.functions.invoke("generate-scenario", { body });
    if (!last.error) return last;
    const status = (last.error as { context?: { status?: number } })?.context?.status;
    if (!status || !TRANSIENT_STATUSES.has(status)) return last;
  }
  return last;
}

const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    fn,
    args,
  );

const MPJ_AUTHORING_SLOTS = [
  [1, "scale4", "appropriate_counterexample"],
  [2, "judge3", "anchor_non_within"],
  [3, "fix_choice", "anchor_non_within_then_repair"],
  [4, "reason", "anchor_non_within_primary_reason"],
  [5, "multi_judge", "within_2_adjustment_needed_2"],
] as const;

export function buildContrastPlan(speechAct: SpeechActUI, itemFocus: string) {
  return {
    version: "contrast_plan_v1" as const,
    speech_act: speechAct,
    mission_goal: "integrated_speech_act" as const,
    item_slots: MPJ_AUTHORING_SLOTS.map(([item_id, item_type, intended_band_profile]) => ({
      item_id,
      item_type,
      item_focus: itemFocus,
      intended_band_profile,
    })),
  };
}

export type MissionRepairOperation =
  | { operation: "replace_situation"; path: string; situation_ko: string }
  | { operation: "replace_item_block"; item_index: number; item: Record<string, unknown> }
  | { operation: "replace_fix_choice_candidate"; item_index: number; candidate_index: number; candidate: Record<string, unknown> }
  | { operation: "replace_multi_judge_candidate"; item_index: number; candidate_index: number; candidate: Record<string, unknown> }
  | { operation: "replace_reference_alternatives"; reference_alternatives: unknown[] }
  | { operation: "replace_diagnostic_dimensions"; diagnostic_dimensions: unknown[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function promotionTerminal(
  overrides: Partial<PromotionTerminalEvidence> & Pick<PromotionTerminalEvidence, "terminalStage" | "finalOutcome">,
): PromotionTerminalEvidence {
  return {
    terminalStage: overrides.terminalStage,
    itemCandidatePaths: overrides.itemCandidatePaths ?? [],
    deterministicFailureCodes: overrides.deterministicFailureCodes ?? [],
    criticVerdict: overrides.criticVerdict ?? "UNKNOWN",
    criticFindingCodes: overrides.criticFindingCodes ?? [],
    criticFindings: overrides.criticFindings ?? [],
    topology: overrides.topology ?? null,
    initialR27Findings: overrides.initialR27Findings ?? [],
    r27RepairAttempted: overrides.r27RepairAttempted ?? false,
    postRepairDeterministicResult: overrides.postRepairDeterministicResult ?? "not_attempted",
    postRepairDeterministicFindings: overrides.postRepairDeterministicFindings ?? [],
    attemptNo: overrides.attemptNo ?? 1,
    regenerationCount: overrides.regenerationCount ?? 0,
    operation: overrides.operation ?? "none",
    operationResult: overrides.operationResult ?? "not_attempted",
    ...(overrides.operationError ? { operationError: overrides.operationError } : {}),
    infrastructureError: overrides.infrastructureError ?? false,
    providerStatus: overrides.providerStatus ?? "UNKNOWN",
    finalOutcome: overrides.finalOutcome,
    ...(overrides.stopCode ? { stopCode: overrides.stopCode } : {}),
    ...(overrides.boundaryFallback !== undefined
      ? { boundaryFallback: overrides.boundaryFallback }
      : {}),
  };
}

export function applyMissionRepairOperations(
  missionContent: Record<string, unknown>,
  operations: MissionRepairOperation[],
): Record<string, unknown> {
  const patched = structuredClone(missionContent);
  const items = Array.isArray(patched.mpj_items) ? [...patched.mpj_items] : [];
  const productionTask = isRecord(patched.production_task)
    ? { ...patched.production_task }
    : {};
  for (const operation of operations) {
    if (operation.operation === "replace_situation") {
      const itemMatch = operation.path.match(/^mpj_items\[(\d+)\]\.situation_ko$/);
      if (itemMatch) {
        const itemIndex = Number(itemMatch[1]);
        const item = isRecord(items[itemIndex]) ? items[itemIndex] as Record<string, unknown> : null;
        if (item) items[itemIndex] = { ...item, situation_ko: operation.situation_ko };
      } else if (operation.path === "production_task.situation_ko") {
        productionTask.situation_ko = operation.situation_ko;
      }
    } else if (operation.operation === "replace_item_block") {
      if (operation.item_index >= 0 && operation.item_index < items.length) {
        items[operation.item_index] = operation.item;
      }
    } else if (
      operation.operation === "replace_fix_choice_candidate" ||
      operation.operation === "replace_multi_judge_candidate"
    ) {
      const item = isRecord(items[operation.item_index]) ? items[operation.item_index] as Record<string, unknown> : null;
      const collection = operation.operation === "replace_fix_choice_candidate" ? "corrections" : "candidates";
      const candidates = item && Array.isArray(item[collection]) ? [...item[collection] as unknown[]] : [];
      const originalCandidate = isRecord(candidates[operation.candidate_index])
        ? candidates[operation.candidate_index] as Record<string, unknown>
        : null;
      if (item && originalCandidate && typeof operation.candidate.text === "string" &&
          typeof operation.candidate.note_ko === "string") {
        candidates[operation.candidate_index] = {
          ...originalCandidate,
          text: operation.candidate.text,
          note_ko: operation.candidate.note_ko,
        };
        items[operation.item_index] = { ...item, [collection]: candidates };
      }
    } else if (operation.operation === "replace_reference_alternatives") {
      productionTask.reference_alternatives = operation.reference_alternatives;
    } else if (operation.operation === "replace_diagnostic_dimensions") {
      patched.diagnostic_dimensions = operation.diagnostic_dimensions;
    }
  }
  patched.mpj_items = items;
  patched.production_task = productionTask;
  delete patched.item_lineage;
  delete patched.hsk_lexical_audit;
  patched.authoring = {
    schema_version: "mission_authoring_v1",
    stage: "ai_repaired",
    lineage_status: "pending",
    repair_attempts: 1,
  };
  return patched;
}

export function canPersistRepairQuality(quality: QualityCheck): boolean {
  return quality.verdict !== "fail";
}

const CANDIDATE_REGENERATION_CODES = new Set(["band_mismatch", "implausible_distractor"]);
const CANDIDATE_PATH = /^mpj_items\[(2|4)\]\.(corrections|candidates)\[(\d+)\](?:\.|$)/;
const CANDIDATE_GENERATION_PROMPT_VERSION = "mission_candidate_band_v4_zhko_bidirectional";

/** attempt=1 중 첫 1건은 최초 boundary 생성이고, 두 번째부터는 이미 후보 regeneration을 실행한 흔적이다. */
export function candidateRetryAlreadyAttempted(attemptOneSuccessfulCalls: number): boolean {
  return attemptOneSuccessfulCalls > 1;
}

export function candidateRegenerationFindings(quality: QualityCheck): QualityCheck["findings"] {
  return quality.findings.filter((finding) =>
    finding.severity === "fail" &&
    CANDIDATE_REGENERATION_CODES.has(finding.code) &&
    CANDIDATE_PATH.test(finding.where));
}

type CandidateBandCheck = {
  path: string;
  severity: "pass" | "warning" | "fail";
  actual_band_code?: string;
  direction_from_anchor?: string;
  boundary_crossed?: boolean | null;
  semantic_defect?: string;
  note_ko?: string;
};

/** 재생성한 후보의 국소 검사로 해소된 finding만 제거하며, 기존 비대상 판정은 보존한다. */
export function qualityAfterCandidateRegeneration(
  quality: QualityCheck,
  resolvedPaths: readonly string[],
  checks: readonly CandidateBandCheck[],
  meta: { model: string; promptVersion: string; checkedAt: string; missionContentHash: string },
  recheckedQuality?: QualityCheck,
): QualityCheck {
  const resolved = new Set(resolvedPaths);
  const retained = quality.findings.filter((finding) => {
    if (!CANDIDATE_REGENERATION_CODES.has(finding.code)) return true;
    const match = finding.where.match(CANDIDATE_PATH);
    const basePath = match ? finding.where.slice(0, finding.where.indexOf("]", finding.where.indexOf("]") + 1) + 1) : finding.where;
    return !resolved.has(basePath) && !resolved.has(finding.where);
  });
  const warnings = checks
    .filter((check) => check.severity === "warning")
    .map((check) => ({
      code: "band_mismatch",
      severity: "warning" as const,
      where: check.path,
      note_ko: `[candidate_boundary_uncertain] ${check.note_ko ?? "대역 경계가 불확실해 교수자 확인이 필요합니다."}`.slice(0, 400),
    }));
  const findings = [...retained, ...warnings, ...(recheckedQuality?.findings ?? [])]
    .filter((finding, index, all) => all.findIndex((other) =>
      other.code === finding.code && other.where === finding.where &&
      other.severity === finding.severity && other.note_ko === finding.note_ko) === index);
  const verdict = findings.some((finding) => finding.severity === "fail")
    ? "fail" as const
    : findings.length > 0 ? "warning" as const : "pass" as const;
  return {
    verdict,
    summary_ko: verdict === "pass"
      ? recheckedQuality
        ? "후보 재생성과 수정본의 전체 품질점검을 통과했습니다."
        : "실패 후보를 within 기준 최소대조로 재생성하고 국소 검사를 통과했습니다."
      : "후보 재생성 뒤 남은 지적과 수정본 재검수 결과를 보존했습니다.",
    findings,
    model: recheckedQuality?.model ?? meta.model,
    prompt_version: recheckedQuality?.prompt_version ?? meta.promptVersion,
    checked_at: recheckedQuality?.checked_at ?? meta.checkedAt,
    mission_content_hash: meta.missionContentHash,
  };
}

async function contentHashForDraft(content: Record<string, unknown>): Promise<string> {
  const hashPayload = { ...content };
  delete hashPayload.provenance;
  delete hashPayload.quality_check;
  delete hashPayload.hsk_lexical_audit;
  delete hashPayload.authoring;
  const bytes = new TextEncoder().encode(JSON.stringify(hashPayload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function repairMissionOnce(args: {
  missionContent: Record<string, unknown>;
  quality: QualityCheck;
  feature: TargetFeature;
  direction: LanguageDirection;
  speechAct: SpeechActUI;
  scenarioId: string;
  generationRunId?: string | null;
  generationItemKey?: string | null;
  ctx: CheckContext;
  coreContent: Record<string, unknown> | null;
}): Promise<
  | { ok: true; missionContent: Record<string, unknown>; mission: MissionRuntime; quality: QualityCheck; check: ReturnType<typeof checkMission> }
  | { ok: false; error: string; quality?: QualityCheck; check?: ReturnType<typeof checkMission> }
> {
  const reparable = args.quality.findings.some((finding) =>
    /^(mpj_items\[\d+\]|production_task\.reference_alternatives|diagnostic_dimensions)/.test(finding.where));
  if (!reparable) return { ok: false, error: "AI 결함에 자동 수리 가능한 문항 경로가 없습니다." };
  const { data, error } = await supabase.functions.invoke("generate-scenario", {
    body: {
      action: "mission_repair",
      telemetry: {
        scenario_id: args.scenarioId,
        generation_run_id: args.generationRunId ?? null,
        generation_item_key: args.generationItemKey ?? null,
        invocation_attempt: 1,
      },
      mission_repair: {
        mission_content: args.missionContent,
        findings: args.quality.findings,
        feature: featureForGen(args.feature, args.direction),
        direction: args.direction,
        speech_act: args.speechAct,
        speech_act_ko: SPEECH_ACT_UI[args.speechAct],
      },
    },
  });
  if (error) return { ok: false, error: `문항 수리 호출 실패: ${(error as { message?: string }).message ?? String(error)}` };
  const rawOperations = (data as { operations?: unknown })?.operations;
  if (!Array.isArray(rawOperations) || rawOperations.length === 0) {
    return { ok: false, error: "AI가 안전하게 적용할 문항 수리를 반환하지 않았습니다." };
  }
  const operations = rawOperations.filter(isRecord) as MissionRepairOperation[];
  const patched = applyMissionRepairOperations(args.missionContent, operations);
  patched.authoring = {
    schema_version: "mission_authoring_v1",
    stage: "ai_repaired",
    lineage_status: "pending",
    repair_attempts: 1,
  };
  const provenance = isRecord(patched.provenance) ? patched.provenance : {};
  patched.provenance = {
    ...provenance,
    mission_content_hash: await contentHashForDraft(patched),
  };
  const parsed = normalizeMission(patched);
  if (!parsed.ok || !parsed.data) return { ok: false, error: "수리된 문항이 미션 스키마를 통과하지 못했습니다." };
  const check = checkMission(patched, args.ctx, args.coreContent ?? undefined);
  if (check.result === "fail") {
    return {
      ok: false,
      error: `수리된 문항이 구조검사를 통과하지 못했습니다: ${check.violations.filter((v) => v.level === "fail").map((v) => v.id).join(", ")}`,
      check,
    };
  }
  const checked = await runQualityCheck({
    missionContent: patched,
    feature: args.feature,
    direction: args.direction,
    speechAct: args.speechAct,
    scenarioId: args.scenarioId,
    generationRunId: args.generationRunId,
    generationItemKey: args.generationItemKey,
  });
  if (checked.ok === false) return { ok: false, error: checked.error };
  if (!canPersistRepairQuality(checked.quality)) {
    return {
      ok: false,
      error: "수리 후보가 AI 품질점검을 다시 통과하지 못해 revision으로 저장하지 않았습니다.",
      quality: checked.quality,
      check,
    };
  }
  patched.quality_check = checked.quality;
  return { ok: true, missionContent: patched, mission: parsed.data, quality: checked.quality, check };
}

async function regenerateMissionCandidatesOnce(args: {
  missionContent: Record<string, unknown>;
  quality: QualityCheck;
  feature: TargetFeature;
  direction: LanguageDirection;
  speechAct: SpeechActUI;
  scenarioId: string;
  generationRunId?: string | null;
  generationItemKey?: string | null;
  ctx: CheckContext;
  coreContent: Record<string, unknown> | null;
}): Promise<
  | { ok: true; missionContent: Record<string, unknown>; mission: MissionRuntime; quality: QualityCheck; check: ReturnType<typeof checkMission>; regenerationCount: number }
  | { ok: false; error: string; stopCode?: string }
> {
  const findings = candidateRegenerationFindings(args.quality);
  if (findings.length === 0) return { ok: false, error: "재생성할 band/현실성 후보가 없습니다." };
  const currentCounts = candidateCountsFromContent(args.missionContent);
  const eligibleFindings = findings.filter((finding) => {
    const path = canonicalCandidatePath(finding.where);
    return Boolean(path) && (currentCounts[path!] ?? 0) < 1;
  });
  if (eligibleFindings.length === 0) {
    return {
      ok: false,
      stopCode: "candidate_regeneration_attempt_exhausted",
      error: "BAND_TARGETING_STOP:candidate_regeneration_attempt_exhausted:대상 후보는 전체 생명주기에서 regeneration을 이미 1회 실행했습니다.",
    };
  }
  const { data, error } = await supabase.functions.invoke("generate-scenario", {
    body: {
      action: "mission_candidate_regenerate",
      telemetry: {
        scenario_id: args.scenarioId,
        generation_run_id: args.generationRunId ?? null,
        generation_item_key: args.generationItemKey ?? null,
        invocation_attempt: 1,
      },
      mission_candidate_regenerate: {
        mission_content: args.missionContent,
        findings: eligibleFindings,
        feature: featureForGen(args.feature, args.direction),
        direction: args.direction,
        speech_act: args.speechAct,
        speech_act_ko: SPEECH_ACT_UI[args.speechAct],
        regeneration_attempt: 1,
      },
    },
  });
  if (error) return { ok: false, error: `후보 재생성 호출 실패: ${(error as { message?: string }).message ?? String(error)}` };
  const response = isRecord(data) ? data : {};
  const stopCode = typeof response.stop_code === "string" ? response.stop_code : undefined;
  if (stopCode) {
    return {
      ok: false,
      stopCode,
      error: `BAND_TARGETING_STOP:${stopCode}:${typeof response.error === "string" ? response.error : "후보 재생성을 중단했습니다."}`,
    };
  }
  const rawOperations = Array.isArray(response.operations) ? response.operations : [];
  if (rawOperations.length === 0) return { ok: false, error: "후보 재생성 결과가 없습니다." };
  const operations = rawOperations.filter(isRecord) as MissionRepairOperation[];
  const patched = applyMissionRepairOperations(args.missionContent, operations);
  const provenance = isRecord(patched.provenance) ? patched.provenance : {};
  const contentHash = await contentHashForDraft(patched);
  patched.provenance = { ...provenance, mission_content_hash: contentHash };
  const parsed = normalizeMission(patched);
  if (!parsed.ok || !parsed.data) return { ok: false, error: "재생성 후보가 미션 스키마를 통과하지 못했습니다." };
  const check = checkMission(patched, args.ctx, args.coreContent ?? undefined);
  if (check.result === "fail") {
    return {
      ok: false,
      error: `재생성 후보가 결정론 검사를 통과하지 못했습니다: ${check.violations.filter((violation) => violation.level === "fail").map((violation) => violation.id).join(", ")}`,
    };
  }
  const checks = Array.isArray(response.candidate_checks)
    ? response.candidate_checks.filter(isRecord) as CandidateBandCheck[]
    : [];
  const resolvedPaths = operations.map((operation) =>
    operation.operation === "replace_fix_choice_candidate"
      ? `mpj_items[${operation.item_index}].corrections[${operation.candidate_index}]`
      : operation.operation === "replace_multi_judge_candidate"
        ? `mpj_items[${operation.item_index}].candidates[${operation.candidate_index}]`
        : "").filter(Boolean);
  if (checks.length !== resolvedPaths.length) return { ok: false, error: "후보 국소 검사 결과 수가 재생성 후보 수와 다릅니다." };
  const nextCounts = recordCandidateRegeneration(currentCounts, resolvedPaths);
  const nextProvenance = isRecord(patched.provenance) ? patched.provenance : {};
  const nextBandTargeting = isRecord(nextProvenance.band_targeting) ? nextProvenance.band_targeting : {};
  patched.provenance = {
    ...nextProvenance,
    band_targeting: {
      ...nextBandTargeting,
      candidate_regeneration_counts: nextCounts,
    },
  };
  const meta = isRecord(response.meta) ? response.meta : {};
  // A locally valid replacement can invalidate the unchanged item explanation.
  // Recheck the completed revision and retain unrelated unresolved findings.
  const rechecked = await runQualityCheck({
    missionContent: patched,
    feature: args.feature,
    direction: args.direction,
    speechAct: args.speechAct,
    scenarioId: args.scenarioId,
    generationRunId: args.generationRunId,
    generationItemKey: args.generationItemKey,
  });
  if (rechecked.ok === false) return { ok: false, error: rechecked.error };
  const quality = qualityAfterCandidateRegeneration(args.quality, resolvedPaths, checks, {
    model: typeof meta.critic_model === "string" ? meta.critic_model : "candidate_band_critic",
    promptVersion: typeof meta.critic_prompt_version === "string" ? meta.critic_prompt_version : "quality_candidate_band_v3_zhko_bidirectional",
    checkedAt: typeof meta.generated_at === "string" ? meta.generated_at : new Date().toISOString(),
    missionContentHash: contentHash,
  }, rechecked.quality);
  // 대상 후보의 국소 검사와 deterministic 검사가 통과했으면 revision은 격리 저장한다.
  // 비대상 기존 fail은 quality에 그대로 남아 후보 은행 적격 승격을 계속 차단한다.
  patched.quality_check = quality;
  return { ok: true, missionContent: patched, mission: parsed.data, quality, check, regenerationCount: resolvedPaths.length };
}

/**
 * 코어 하나를 미션으로 승격 생성 → 검사 → save_generated_mission.
 * 계획 초점 = DEFAULT_FEATURE_BY_ACT[화행](R24). reviewed 승격은 별도(reviewMission).
 */
export async function promoteCore(
  core: PromotableCore,
  options: PromoteOptions = {},
): Promise<PromoteResult> {
  options.onProgress?.({ phase: "preparing" });
  const featureCode = DEFAULT_FEATURE_BY_ACT[core.speech_act];
  const feature = featureCode ? getTargetFeature(featureCode) : undefined;
  if (!feature) {
    return {
      ok: false,
      error: `'${SPEECH_ACT_UI[core.speech_act]}'는 아직 화용 초점 카탈로그가 없어 승격할 수 없습니다.`,
      terminal: promotionTerminal({ terminalStage: "preparing", finalOutcome: "terminal_dropout" }),
    };
  }
  // 방향 = core_content.direction(정본, 0-l·82) 우선, 없으면 행 태그, 없으면 ko_zh.
  const direction: LanguageDirection =
    coreDirection(core.core_content) === "zh_ko" || core.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
  // zh_ko 승격은 카탈로그 방향 변형이 있는 초점만(0-l·86·91).
  if (direction === "zh_ko" && !feature.operational_definition_zh_ko) {
    return {
      ok: false,
      error: `'${SPEECH_ACT_UI[core.speech_act]}'는 아직 ${DIRECTION_LABEL.zh_ko} 카탈로그 변형이 없어 승격할 수 없습니다.`,
      terminal: promotionTerminal({ terminalStage: "preparing", finalOutcome: "terminal_dropout" }),
    };
  }
  // core_content를 정규화(v1/v2 모두) 후 현 배포 엣지가 기대하는 v1 이름으로 전달.
  // (라운드2 엣지가 방향·중립 이름을 읽도록 갱신되면 함께 재조정한다.)
  const nc = normalizeCore(core.core_content ?? {});
  const normCore = nc.ok ? nc.data : undefined;
  const missionCore = {
    situation_ko: normCore?.situation_ko,
    relation_ko: normCore?.relation_ko,
    source_text_ko: normCore?.source_text,
    preceding_turn_zh: normCore?.preceding_turn ?? null,
    pdr: normCore?.pdr,
    channel: normCore?.channel,
    source_modality: core.source_modality,
    usable_facts: normCore?.usable_facts ?? [],
    // scenario_core_v3의 화용 집중 구간. 있으면 엣지가 mission_v5로 승격한다.
    // legacy 단문 코어는 부재 → mission_v4 경로 유지(DEC-20260730-01).
    ...(normCore?.focal_segments?.length
      ? { focal_segments: normCore.focal_segments }
      : {}),
  };
  const lineageScope = buildMissionLineageScope({
    direction,
    speechAct: core.speech_act,
    targetFeature: feature.code,
  });
  const ctx: CheckContext = {
    speech_act: core.speech_act,
    level: core.learner_level,
    domain: (core.domain ?? "daily") as Domain,
    theme_code: (core.theme_code ?? "daily_living") as ThemeCode,
    topic_code: core.topic_code ?? "",
    industry: core.industry_sector ?? null,
    mode: core.mode ?? "translation",
    source_modality: (core.source_modality ?? "written") as "written" | "spoken",
    planned_target_feature: feature.code, // R24
    direction, // 0-l·85 — 생성 미션의 방향이 요청과 일치하는지 검사
  };

  // production_task는 모델 출력이 아니라 코어를 그대로 계승한다. 따라서 현재 규칙을
  // 통과할 수 없는 코어는 미션 재생성으로 고칠 수 없으며, 유료 호출 전에 차단해야 한다.
  const coreCheck = checkCore(core.core_content ?? {}, ctx);
  if (coreCheck.result === "fail") {
    return {
      ok: false,
      ruleResult: "fail",
      violations: coreCheck.violations.map((violation) => ({
        id: violation.id,
        level: violation.level,
        message: violation.message,
      })),
      attempts: 0,
      error: "코어 규칙검사 실패 — 미션 생성은 실행하지 않았습니다.",
      terminal: promotionTerminal({
        terminalStage: "deterministic",
        deterministicFailureCodes: coreCheck.violations.filter((violation) => violation.level === "fail").map((violation) => violation.id),
        attemptNo: 0,
        finalOutcome: "terminal_dropout",
      }),
    };
  }

  const attempts = 1;
  options.onProgress?.({ phase: "generating", attempt: 1, maxAttempts: 1 });
  const telemetry = {
    scenario_id: core.scenario_id,
    generation_run_id: core.generation_run_id ?? null,
    generation_item_key: core.generation_item_key ?? null,
    invocation_attempt: 1,
  };
  const missionRequest: Record<string, unknown> = {
    direction,
    learner_level: core.learner_level,
    speech_act: core.speech_act,
    speech_act_ko: SPEECH_ACT_UI[core.speech_act],
    level_ko: LEVEL[core.learner_level],
    level_policy_ko: LEVEL_POLICY[core.learner_level],
    feature: featureForGen(feature, direction, lineageScope),
    core: missionCore,
    contrast_plan: buildContrastPlan(core.speech_act, feature.code),
    error_pattern_hints_ko: errorPatternsForAct(core.speech_act, direction).map(
      (pattern) => `${pattern.description} (예: ${pattern.approvedExample})`,
    ),
    is_response_act: isResponseAct(core.speech_act),
  };
  let frozenTopologyEvidence: PromotionTerminalEvidence["topology"] = null;
  const currentNative = normCore?.focal_segments?.some((segment) => segment.role === "head") ?? false;
  if (currentNative && options.generationModel !== "astra") {
    const topologyCall = await supabase.functions.invoke("generate-scenario", {
      body: { action: "mission_topology", telemetry, mission: missionRequest },
    });
    if (topologyCall.error) {
      const providerStatus = providerStatusFromError(topologyCall.error);
      return {
        ok: false,
        attempts: 0,
        error: `Topology 생성 호출 실패: ${(topologyCall.error as { message?: string }).message ?? String(topologyCall.error)}`,
        terminal: promotionTerminal({
          terminalStage: "topology",
          operation: "mission_topology",
          operationResult: "failed",
          infrastructureError: true,
          providerStatus,
          finalOutcome: "terminal_dropout",
        }),
      };
    }
    const topologyResponse = isRecord(topologyCall.data) ? topologyCall.data : {};
    frozenTopologyEvidence = topologyEvidence(topologyResponse.topology_evidence);
    const topologyStopCode = typeof topologyResponse.stop_code === "string" ? topologyResponse.stop_code : null;
    const frozenTopology = isRecord(topologyResponse.frozen_topology) ? topologyResponse.frozen_topology : null;
    if (topologyStopCode || !frozenTopology || frozenTopologyEvidence?.finalResult !== "pass") {
      const providerStatus = typeof topologyResponse.provider_status === "number"
        ? topologyResponse.provider_status
        : "UNKNOWN";
      return {
        ok: false,
        attempts: 0,
        error: typeof topologyResponse.error === "string" ? topologyResponse.error : "Topology generation failed.",
        terminal: promotionTerminal({
          terminalStage: "topology",
          topology: frozenTopologyEvidence,
          regenerationCount: frozenTopologyEvidence?.regenerationCount ?? 0,
          operation: "mission_topology_regeneration",
          operationResult: "failed",
          infrastructureError: topologyStopCode === "topology_provider_failure",
          providerStatus,
          stopCode: topologyStopCode ?? "topology_contract_invalid",
          finalOutcome: "terminal_dropout",
        }),
      };
    }
    missionRequest.frozen_topology = frozenTopology;
    missionRequest.topology_evidence = topologyResponse.topology_evidence;
  }
  const generationBody = { action: "mission", telemetry, mission: missionRequest };
  const { data, error } = options.generationModel === "astra"
    ? await invokeAstraMission(generationBody, { onJob: options.onGenerationJob, resumeJobId: options.generationJobId })
    : await invokeMissionWithBackoff(generationBody);
  if (error) {
    const msg = (error as { message?: string })?.message ?? String(error);
    const providerStatus = providerStatusFromError(error);
    return {
      ok: false,
      error: `미션 생성 호출 실패: ${msg}`,
      attempts,
      terminal: promotionTerminal({
        terminalStage: "mission_generation",
        topology: frozenTopologyEvidence,
        infrastructureError: providerStatus !== "UNKNOWN",
        providerStatus,
        finalOutcome: "terminal_dropout",
      }),
    };
  }
  const generationResponse = isRecord(data) ? data : {};
  if (options.generationModel === "astra" && isRecord(generationResponse.mission_content)) {
    const provenance = generationResponse.mission_content.provenance;
    if (isRecord(provenance)) frozenTopologyEvidence = topologyEvidence(provenance.scene_topology);
  }
  if (typeof generationResponse.stop_code === "string") {
    const candidateResults = Array.isArray(generationResponse.candidate_results)
      ? generationResponse.candidate_results.filter(isRecord)
      : [];
    const boundaryFallback = isRecord(generationResponse.boundary_fallback)
      ? generationResponse.boundary_fallback
      : null;
    const providerStatus = typeof boundaryFallback?.provider_status === "number"
      ? boundaryFallback.provider_status
      : "UNKNOWN";
    return {
      ok: false,
      attempts,
      error: `BAND_TARGETING_STOP:${generationResponse.stop_code}:${typeof generationResponse.error === "string" ? generationResponse.error : "후보 생성이 중단됐습니다."}`,
      terminal: promotionTerminal({
        terminalStage: generationResponse.stop_code.startsWith("relative_boundary")
          ? "relative_boundary"
          : "mission_generation",
        topology: frozenTopologyEvidence,
        itemCandidatePaths: candidateResults
          .map((result) => typeof result.path === "string" ? result.path : "")
          .filter(Boolean),
        regenerationCount: (() => {
          const fallback = isRecord(generationResponse.boundary_fallback) ? generationResponse.boundary_fallback : {};
          return Array.isArray(fallback.attempted_paths) ? fallback.attempted_paths.length : 0;
        })(),
        operation: generationResponse.stop_code.startsWith("relative_boundary")
          ? "relative_boundary_candidate_fallback"
          : "candidate_generation",
        operationResult: "failed",
        infrastructureError: providerStatus !== "UNKNOWN" &&
          (providerStatus === 429 || providerStatus >= 500),
        providerStatus,
        stopCode: generationResponse.stop_code,
        boundaryFallback,
        finalOutcome: "terminal_dropout",
      }),
    };
  }
  const rawContent = generationResponse.mission_content;
  const parsed = normalizeMission(rawContent);
  if (!parsed.ok || !parsed.data || !isRecord(rawContent)) {
    return {
      ok: false,
      error: "생성된 전체 초안이 미션 스키마를 통과하지 못했습니다.",
      attempts,
      terminal: promotionTerminal({
        terminalStage: "schema",
        topology: frozenTopologyEvidence,
        finalOutcome: "terminal_dropout",
      }),
    };
  }
  let mission = parsed.data;
  options.onProgress?.({ phase: "checking", attempt: 1, maxAttempts: 1 });
  let check = checkMission(rawContent, ctx, core.core_content ?? undefined);
  const initialViolations = check.violations.map((x) => ({ id: x.id, level: x.level, message: x.message }));
  const initialR27Evidence = r27FindingEvidence(initialViolations);
  let repaired = false;
  let r27RepairAttempted = false;
  let postRepairDeterministicResult: PromotionTerminalEvidence["postRepairDeterministicResult"] = "not_attempted";
  let postRepairDeterministicFindings: PromotionTerminalEvidence["postRepairDeterministicFindings"] = [];
  const rawProvenance = isRecord(rawContent.provenance) ? rawContent.provenance : {};
  const rawBandTargeting = isRecord(rawProvenance.band_targeting) ? rawProvenance.band_targeting : {};
  const initialCandidateCounts = normalizeCandidateRegenerationCounts(
    rawBandTargeting.candidate_regeneration_counts,
  );
  let candidateRegenerationCount = Object.keys(initialCandidateCounts).length > 0
    ? candidateRegenerationTotal(initialCandidateCounts)
    : typeof rawBandTargeting.within_regeneration_count === "number"
      ? Math.max(0, Math.trunc(rawBandTargeting.within_regeneration_count))
      : 0;
  let candidateRegenerationMaxCount = candidateRegenerationMax(initialCandidateCounts);
  let repairError: string | undefined;
  let quality: QualityCheck;
  let contentToSave: Record<string, unknown> = rawContent;

  if (check.result === "fail") {
    const findings = repairFindingsForRuleViolations(initialViolations);
    const hasOnlyRepairableFailures = check.violations
      .filter((violation) => violation.level === "fail")
      .every((violation) => findings.some((finding) => finding.note_ko === violation.message));
    if (!findings.length || !hasOnlyRepairableFailures) {
      return {
        ok: false,
        mission,
        ruleResult: "fail",
        violations: initialViolations,
        attempts,
        error: "규칙검사 실패 — 저장하지 않았습니다.",
        terminal: promotionTerminal({
          terminalStage: "deterministic",
          topology: frozenTopologyEvidence,
          initialR27Findings: initialR27Evidence,
          deterministicFailureCodes: initialViolations.filter((violation) => violation.level === "fail").map((violation) => violation.id),
          finalOutcome: "terminal_dropout",
        }),
      };
    }
    options.onProgress?.({ phase: "repairing" });
    r27RepairAttempted = initialR27Evidence.length > 0;
    const structuralRepair = await repairMissionOnce({
      missionContent: rawContent,
      quality: {
        verdict: "fail",
        summary_ko: "결정론 규칙이 지목한 중복 상황 문항을 국소 수리합니다.",
        findings,
        model: "deterministic_rules",
        prompt_version: "mission_rules_r27_v1",
        checked_at: new Date().toISOString(),
      },
      feature,
      direction,
      speechAct: core.speech_act,
      scenarioId: core.scenario_id,
      generationRunId: core.generation_run_id,
      generationItemKey: core.generation_item_key,
      ctx,
      coreContent: core.core_content,
    });
    if (structuralRepair.ok === false) {
      return {
        ok: false,
        mission,
        ruleResult: "fail",
        violations: initialViolations,
        attempts,
        repairError: structuralRepair.error,
        error: `규칙검사 실패 · 문항 수리 실패 — 저장하지 않았습니다: ${structuralRepair.error}`,
        terminal: promotionTerminal({
          terminalStage: structuralRepair.quality ? "critic" : "deterministic",
          topology: frozenTopologyEvidence,
          initialR27Findings: initialR27Evidence,
          r27RepairAttempted: initialR27Evidence.length > 0,
          postRepairDeterministicResult: structuralRepair.check
            ? structuralRepair.check.result === "fail" ? "fail" : "pass"
            : "UNKNOWN",
          postRepairDeterministicFindings: structuralRepair.check
            ? r27FindingEvidence(structuralRepair.check.violations.map((violation) => ({
                id: violation.id,
                level: violation.level,
                message: violation.message,
              })))
            : [],
          criticVerdict: structuralRepair.quality?.verdict ?? "UNKNOWN",
          criticFindingCodes: qualityFindingSummary(structuralRepair.quality),
          criticFindings: qualityFindingEvidence(structuralRepair.quality),
          deterministicFailureCodes: initialViolations.filter((violation) => violation.level === "fail").map((violation) => violation.id),
          operation: "mission_item_repair",
          operationResult: "failed",
          finalOutcome: "terminal_dropout",
        }),
      };
    }
    repaired = true;
    postRepairDeterministicResult = "pass";
    postRepairDeterministicFindings = r27FindingEvidence(structuralRepair.check.violations.map((violation) => ({
      id: violation.id,
      level: violation.level,
      message: violation.message,
    })));
    mission = structuralRepair.mission;
    quality = structuralRepair.quality;
    check = structuralRepair.check;
    contentToSave = structuralRepair.missionContent;
    options.onProgress?.({ phase: "rechecking" });
  } else {
    options.onProgress?.({ phase: "quality" });
    const qualityResult = await runQualityCheck({
      missionContent: rawContent,
      feature,
      direction,
      speechAct: core.speech_act,
      scenarioId: core.scenario_id,
      generationRunId: core.generation_run_id,
      generationItemKey: core.generation_item_key,
    });
    quality = qualityResult.ok
      ? qualityResult.quality
      : {
          verdict: "fail",
          summary_ko: "AI critic을 완료하지 못해 교수자 확인이 필요합니다.",
          findings: [{ code: "critic_unavailable", severity: "fail", where: "", note_ko: "error" in qualityResult ? qualityResult.error : "AI critic을 완료하지 못했습니다." }],
          model: "unavailable",
          prompt_version: "quality_unavailable_v1",
          checked_at: new Date().toISOString(),
        };
    contentToSave = { ...rawContent, quality_check: quality };
  }

  const firstPassQualityVerdict = quality.verdict;

  // 구조 통과 초안은 critic fail 여부와 무관하게 먼저 격리 저장한다(필요하면 R27 국소 수리 후).
  options.onProgress?.({ phase: "saving" });
  const { data: savedId, error: saveErr } = await rpc("save_generated_mission", {
    p_scenario_id: core.scenario_id,
    p_payload: {
      mission_content: contentToSave,
      validation_result: {
        result: check.result,
        violations: check.violations.map((violation) => ({
          id: violation.id,
          level: violation.level,
          message: violation.message,
        })),
        generation_attempts: attempts,
        repair_attempts: repaired ? 1 : 0,
      },
      lineage_meta: lineageScope,
    },
  });
  if (saveErr) {
    return {
      ok: false,
      mission,
      ruleResult: check.result as "pass" | "warning",
      violations: check.violations.map((violation) => ({
        id: violation.id,
        level: violation.level,
        message: violation.message,
      })),
      attempts,
      quality,
      error: `저장 실패: ${(saveErr as { message?: string }).message ?? saveErr}`,
      terminal: promotionTerminal({
        terminalStage: "saving",
        topology: frozenTopologyEvidence,
        initialR27Findings: initialR27Evidence,
        r27RepairAttempted,
        postRepairDeterministicResult,
        postRepairDeterministicFindings,
        deterministicFailureCodes: initialViolations.filter((violation) => violation.level === "fail").map((violation) => violation.id),
        criticVerdict: quality.verdict,
        criticFindingCodes: qualityFindingSummary(quality),
        criticFindings: qualityFindingEvidence(quality),
        operation: "save_generated_mission",
        operationResult: "failed",
        finalOutcome: "terminal_dropout",
      }),
    };
  }

  const hasRepairableRelationalWarning = quality.findings.some((finding) =>
    finding.severity === "warning" &&
    (finding.code === "feedback_quality_mismatch" || finding.code === "comparison_quality_mismatch") &&
    /^mpj_items\[\d+\]/.test(finding.where),
  );
  if ((quality.verdict === "fail" || hasRepairableRelationalWarning) && !repaired) {
    options.onProgress?.({ phase: "repairing" });
    const sharedArgs = {
      missionContent: contentToSave,
      quality,
      feature,
      direction,
      speechAct: core.speech_act,
      scenarioId: core.scenario_id,
      generationRunId: core.generation_run_id,
      generationItemKey: core.generation_item_key,
      ctx,
      coreContent: core.core_content,
    };
    const repair = candidateRegenerationFindings(quality).length > 0
      ? await regenerateMissionCandidatesOnce(sharedArgs)
      : await repairMissionOnce(sharedArgs);
    if (repair.ok) {
      options.onProgress?.({ phase: "rechecking" });
      const repairedViolations = repair.check.violations.map((violation) => ({
        id: violation.id,
        level: violation.level,
        message: violation.message,
      }));
      const { error: revisionError } = await rpc("save_generated_mission_revision", {
        p_scenario_id: core.scenario_id,
        p_payload: {
          mission_content: repair.missionContent,
          validation_result: {
            result: repair.check.result,
            violations: repairedViolations,
            generation_attempts: 1,
            repair_attempts: 1,
          },
        },
      });
      if (revisionError) {
        repairError = `수리본 저장 실패: ${(revisionError as { message?: string }).message ?? String(revisionError)}`;
      } else {
        repaired = true;
        contentToSave = repair.missionContent;
        mission = repair.mission;
        quality = repair.quality;
        check = repair.check;
        const repairedCounts = candidateCountsFromContent(repair.missionContent);
        candidateRegenerationCount = Object.keys(repairedCounts).length > 0
          ? candidateRegenerationTotal(repairedCounts)
          : candidateRegenerationCount + ("regenerationCount" in repair && typeof repair.regenerationCount === "number"
            ? repair.regenerationCount
            : 0);
        candidateRegenerationMaxCount = Object.keys(repairedCounts).length > 0
          ? candidateRegenerationMax(repairedCounts)
          : Math.max(candidateRegenerationMaxCount, candidateRegenerationCount > 0 ? 1 : 0);
      }
    } else {
      repairError = "error" in repair ? repair.error : "문항 수리를 완료하지 못했습니다.";
    }
  }
  const finalViolations = check.violations.map((violation) => ({
    id: violation.id,
    level: violation.level,
    message: violation.message,
  }));
  const boundaryFallback = isRecord(rawBandTargeting.boundary_fallback)
    ? rawBandTargeting.boundary_fallback
    : null;
  const boundaryFallbackAttempted = Array.isArray(boundaryFallback?.attempted_paths) &&
    boundaryFallback.attempted_paths.length > 0;
  return {
    ok: true,
    mission,
    ruleResult: check.result as "pass" | "warning",
    violations: finalViolations,
    attempts,
    quality,
    firstPassQualityVerdict,
    repaired,
    candidateRegenerationCount,
    candidateRegenerationMaxPerCandidate: candidateRegenerationMaxCount,
    repairError,
    savedId: savedId as string,
    terminal: promotionTerminal({
      terminalStage: quality.verdict === "fail" ? "critic" : "eligible",
      topology: frozenTopologyEvidence,
      initialR27Findings: initialR27Evidence,
      r27RepairAttempted,
      postRepairDeterministicResult,
      postRepairDeterministicFindings,
      itemCandidatePaths: quality.findings
        .map((finding) => canonicalCandidatePath(finding.where))
        .filter((path): path is string => Boolean(path)),
      deterministicFailureCodes: initialViolations
        .filter((violation) => violation.level === "fail")
        .map((violation) => violation.id),
      criticVerdict: quality.verdict,
      criticFindingCodes: qualityFindingSummary(quality),
      criticFindings: qualityFindingEvidence(quality),
      regenerationCount: candidateRegenerationCount,
      operation: boundaryFallbackAttempted
        ? "relative_boundary_candidate_fallback"
        : repaired || repairError ? "mission_item_repair_or_candidate_regeneration" : "none",
      operationResult: repairError
        ? "failed"
        : repaired || boundaryFallbackAttempted
          ? "succeeded"
          : "not_attempted",
      operationError: repairError,
      boundaryFallback,
      finalOutcome: quality.verdict === "fail" ? "quality_fail_draft" : "eligible",
    }),
  };
}

async function fetchGeneratedMissionContent(scenarioId: string): Promise<Record<string, unknown>> {
  // 신규 authoring 메타가 생성 타입보다 먼저 배포될 수 있어 query builder만 국소 cast한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as unknown as { from: (table: string) => any })
    .from("scenarios")
    .select("mission_status,mission_content")
    .eq("scenario_id", scenarioId)
    .single();
  if (error || data?.mission_status !== "generated" || !isRecord(data.mission_content)) {
    throw new Error(error?.message ?? "검수 대기 미션을 찾지 못했습니다.");
  }
  return data.mission_content as Record<string, unknown>;
}

async function hasPriorCandidateRegeneration(core: PromotableCore): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as unknown as { from: (table: string) => any })
    .from("llm_invocation_events")
    .select("id", { count: "exact", head: true })
    .eq("scenario_id", core.scenario_id)
    .eq("prompt_version", CANDIDATE_GENERATION_PROMPT_VERSION)
    .eq("invocation_attempt", 1)
    .eq("success", true);
  if (core.generation_run_id) query = query.eq("generation_run_id", core.generation_run_id);
  const { count, error } = await query;
  if (error) throw new Error(`후보 regeneration 호출 장부 조회 실패: ${error.message}`);
  return candidateRetryAlreadyAttempted(Number(count ?? 0));
}

/** 저장된 critic-fail 초안에서 band/현실성 후보는 재생성하고, 그 밖의 후보 결함만 repair한다. */
export async function retryGeneratedMissionCandidateRepair(core: PromotableCore): Promise<PromoteResult> {
  try {
    const current = await fetchGeneratedMissionContent(core.scenario_id);
    const qualityResult = QualityCheckSchema.safeParse(current.quality_check);
    if (!qualityResult.success) return { ok: false, error: "저장된 AI 품질점검을 읽을 수 없습니다." };
    if (qualityResult.data.verdict !== "fail") {
      return { ok: true, quality: qualityResult.data, firstPassQualityVerdict: qualityResult.data.verdict, attempts: 0, repaired: false };
    }
    const featureCode = DEFAULT_FEATURE_BY_ACT[core.speech_act];
    const feature = featureCode ? getTargetFeature(featureCode) : undefined;
    if (!feature) return { ok: false, error: "문항 판정 초점 카탈로그를 찾지 못했습니다." };
    const direction: LanguageDirection =
      coreDirection(core.core_content) === "zh_ko" || core.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
    const ctx: CheckContext = {
      speech_act: core.speech_act,
      level: core.learner_level,
      domain: (core.domain ?? "daily") as Domain,
      theme_code: (core.theme_code ?? "daily_living") as ThemeCode,
      topic_code: core.topic_code ?? "",
      industry: core.industry_sector ?? null,
      mode: core.mode ?? "translation",
      source_modality: (core.source_modality ?? "written") as "written" | "spoken",
      planned_target_feature: feature.code,
      direction,
    };
    const sharedArgs = {
      missionContent: current,
      quality: qualityResult.data,
      feature,
      direction,
      speechAct: core.speech_act,
      scenarioId: core.scenario_id,
      generationRunId: core.generation_run_id,
      generationItemKey: core.generation_item_key,
      ctx,
      coreContent: core.core_content,
    };
    const candidateFindings = candidateRegenerationFindings(qualityResult.data);
    const needsCandidateRegeneration = candidateFindings.length > 0;
    const currentCounts = candidateCountsFromContent(current);
    const hasStructuredCounts = Object.keys(currentCounts).length > 0;
    const eligibleCandidateFindingExists = candidateFindings.some((finding) => {
      const path = canonicalCandidatePath(finding.where);
      return Boolean(path) && (currentCounts[path!] ?? 0) < 1;
    });
    if (needsCandidateRegeneration && !eligibleCandidateFindingExists) {
      return {
        ok: false,
        quality: qualityResult.data,
        firstPassQualityVerdict: qualityResult.data.verdict,
        error: "BAND_TARGETING_STOP:candidate_regeneration_attempt_exhausted:이 저장 초안은 후보 regeneration을 이미 1회 실행했습니다.",
      };
    }
    if (needsCandidateRegeneration && !hasStructuredCounts && await hasPriorCandidateRegeneration(core)) {
      return {
        ok: false,
        quality: qualityResult.data,
        firstPassQualityVerdict: qualityResult.data.verdict,
        error: "BAND_TARGETING_STOP:candidate_regeneration_attempt_exhausted:이 legacy 저장 초안은 후보 regeneration을 이미 1회 실행했습니다.",
      };
    }
    const repaired = needsCandidateRegeneration
      ? await regenerateMissionCandidatesOnce(sharedArgs)
      : await repairMissionOnce(sharedArgs);
    if (repaired.ok === false) return { ok: false, quality: qualityResult.data, error: repaired.error };
    const violations = repaired.check.violations.map((violation) => ({
      id: violation.id,
      level: violation.level,
      message: violation.message,
    }));
    const { error } = await rpc("save_generated_mission_revision", {
      p_scenario_id: core.scenario_id,
      p_payload: {
        mission_content: repaired.missionContent,
        validation_result: {
          result: repaired.check.result,
          violations,
          candidate_retry: true,
          repair_attempts: 1,
        },
      },
    });
    if (error) return { ok: false, error: (error as { message?: string }).message ?? String(error) };
    const repairedCounts = candidateCountsFromContent(repaired.missionContent);
    const initialRegenerationCount = Object.keys(currentCounts).length > 0
      ? candidateRegenerationTotal(currentCounts)
      : (() => {
          const currentBandTargeting = bandTargetingFromContent(current);
          return typeof currentBandTargeting.within_regeneration_count === "number"
            ? Math.max(0, Math.trunc(currentBandTargeting.within_regeneration_count))
            : 0;
        })();
    const finalRegenerationCount = Object.keys(repairedCounts).length > 0
      ? candidateRegenerationTotal(repairedCounts)
      : initialRegenerationCount +
        ("regenerationCount" in repaired && typeof repaired.regenerationCount === "number" ? repaired.regenerationCount : 0);
    return {
      ok: true,
      mission: repaired.mission,
      ruleResult: repaired.check.result as "pass" | "warning",
      violations,
      attempts: 1,
      quality: repaired.quality,
      firstPassQualityVerdict: qualityResult.data.verdict,
      repaired: true,
      candidateRegenerationCount: finalRegenerationCount,
      candidateRegenerationMaxPerCandidate: Object.keys(repairedCounts).length > 0
        ? candidateRegenerationMax(repairedCounts)
        : finalRegenerationCount > 0 ? 1 : 0,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface ProfessorMissionEdits {
  itemBlocks: Array<{ itemIndex: number; item: Record<string, unknown> }>;
  referenceAlternatives?: unknown[];
  vocabularyHints?: Array<{ source: string; target: string }>;
  diagnosticDimensions?: unknown[];
}

/** 교수자가 선택한 item block만 바꾸고, 구조검사·critic 후 append-only draft를 저장한다. */
export async function reviseMissionDraft(
  core: PromotableCore,
  edits: ProfessorMissionEdits,
  revisionSource: "professor" | "ai" = "professor",
): Promise<PromoteResult> {
  try {
    const current = await fetchGeneratedMissionContent(core.scenario_id);
    const featureCode = DEFAULT_FEATURE_BY_ACT[core.speech_act];
    const feature = featureCode ? getTargetFeature(featureCode) : undefined;
    if (!feature) return { ok: false, error: "문항 판정 초점 카탈로그를 찾지 못했습니다." };
    const direction: LanguageDirection =
      coreDirection(core.core_content) === "zh_ko" || core.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
    const operations: MissionRepairOperation[] = edits.itemBlocks.map((edit) => ({
      operation: "replace_item_block",
      item_index: edit.itemIndex,
      item: edit.item,
    }));
    if (edits.referenceAlternatives) {
      operations.push({
        operation: "replace_reference_alternatives",
        reference_alternatives: edits.referenceAlternatives,
      });
    }
    const patched = applyMissionRepairOperations(current, operations);
    if (edits.vocabularyHints && isRecord(patched.production_task)) patched.production_task.vocabulary_hints = edits.vocabularyHints;
    if (edits.diagnosticDimensions) patched.diagnostic_dimensions = edits.diagnosticDimensions;
    const currentAuthoring = isRecord(current.authoring) ? current.authoring : {};
    patched.authoring = {
      schema_version: "mission_authoring_v1",
      stage: revisionSource === "professor" ? "professor_revised" : "ai_repaired",
      lineage_status: "pending",
      repair_attempts: currentAuthoring.repair_attempts === 1 ? 1 : 0,
    };
    delete patched.quality_check;
    const provenance = isRecord(patched.provenance) ? patched.provenance : {};
    patched.provenance = { ...provenance, mission_content_hash: await contentHashForDraft(patched) };
    const ctx: CheckContext = {
      speech_act: core.speech_act,
      level: core.learner_level,
      domain: (core.domain ?? "daily") as Domain,
      theme_code: (core.theme_code ?? "daily_living") as ThemeCode,
      topic_code: core.topic_code ?? "",
      industry: core.industry_sector ?? null,
      mode: core.mode ?? "translation",
      source_modality: (core.source_modality ?? "written") as "written" | "spoken",
      planned_target_feature: feature.code,
      direction,
    };
    const check = checkMission(patched, ctx, core.core_content ?? undefined);
    const violations = check.violations.map((violation) => ({
      id: violation.id,
      level: violation.level,
      message: violation.message,
    }));
    const parsed = normalizeMission(patched);
    if (!parsed.ok || !parsed.data || check.result === "fail") {
      return { ok: false, ruleResult: "fail", violations, error: "수정본이 구조검사를 통과하지 못했습니다." };
    }
    const checked = await runQualityCheck({
      missionContent: patched,
      feature,
      direction,
      speechAct: core.speech_act,
      scenarioId: core.scenario_id,
      generationRunId: core.generation_run_id,
      generationItemKey: core.generation_item_key,
    });
    if (checked.ok === false) return { ok: false, mission: parsed.data, violations, error: checked.error };
    patched.quality_check = checked.quality;
    const { error } = await rpc("save_generated_mission_revision", {
      p_scenario_id: core.scenario_id,
      p_payload: {
        mission_content: patched,
        validation_result: { result: check.result, violations, professor_revision: revisionSource === "professor", ai_editorial_revision: revisionSource === "ai" },
      },
    });
    if (error) return { ok: false, error: (error as { message?: string }).message ?? String(error) };
    return {
      ok: true,
      mission: normalizeMission(patched).data,
      ruleResult: check.result as "pass" | "warning",
      violations,
      quality: checked.quality,
      attempts: 1,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface ProfessorIssueOverride {
  issue_index: number;
  code: string;
  where: string;
  rationale_ko: string;
}

/** generated → reviewed. 현재 콘텐츠를 동결한 뒤 lineage·HSK·hash를 새로 산출한다. */
export async function reviewMission(
  core: PromotableCore,
  issueOverrides: ProfessorIssueOverride[] = [],
  approval?: { reviewId: string; contentHash: string; professorNote: string; openaiFailOverride?: string },
): Promise<{ ok: boolean; mission?: MissionRuntime; error?: string }> {
  try {
    if (!approval) return { ok: false, error: "현재 버전의 콘텐츠 검수에서 교수자 승인을 진행하세요." };
    const current = await fetchGeneratedMissionContent(core.scenario_id);
    const featureCode = DEFAULT_FEATURE_BY_ACT[core.speech_act];
    const feature = featureCode ? getTargetFeature(featureCode) : undefined;
    if (!feature) return { ok: false, error: "문항 판정 초점 카탈로그를 찾지 못했습니다." };
    const direction: LanguageDirection =
      coreDirection(core.core_content) === "zh_ko" || core.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
    const lineageScope = buildMissionLineageScope({
      direction,
      speechAct: core.speech_act,
      targetFeature: feature.code,
    });
    const { data, error: finalizeError } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "finalize_mission",
        telemetry: {
          scenario_id: core.scenario_id,
          generation_run_id: core.generation_run_id ?? null,
          generation_item_key: core.generation_item_key ?? null,
          invocation_attempt: 1,
        },
        finalize_mission: {
          mission_content: current,
          feature: featureForGen(feature, direction, lineageScope),
          direction,
          learner_level: core.learner_level,
          level_ko: LEVEL[core.learner_level],
        },
      },
    });
    if (finalizeError) {
      return { ok: false, error: `최종 근거·HSK 산출 실패: ${(finalizeError as { message?: string }).message ?? String(finalizeError)}` };
    }
    const finalized = (data as { mission_content?: unknown })?.mission_content;
    const parsed = normalizeMission(finalized);
    if (!parsed.ok || !parsed.data || !isRecord(finalized)) {
      return { ok: false, error: "최종화된 미션이 스키마를 통과하지 못했습니다." };
    }
    const { error } = await rpc("finalize_reviewed_mission", {
      p_scenario_id: core.scenario_id,
      p_payload: { mission_content: finalized, issue_overrides: issueOverrides,
        review_id: approval.reviewId, review_content_hash: approval.contentHash, professor_note: approval.professorNote,
        openai_fail_override: approval.openaiFailOverride ?? null },
    });
    if (error) return { ok: false, error: (error as { message?: string }).message ?? String(error) };
    return { ok: true, mission: parsed.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 교수자 반려: 현재 generated 스냅샷을 보존하고 같은 코어의 새 조립 대기 행을 만든다.
 * 실제 재조립은 반환된 scenarioId로 promoteCore를 다시 호출한다.
 */
export async function supersedeMissionForRework(
  scenarioId: string,
): Promise<{ ok: true; scenarioId: string } | { ok: false; error: string }> {
  const { data, error } = await rpc("supersede_generated_mission_for_rework", {
    p_scenario_id: scenarioId,
  });
  if (error) {
    return { ok: false, error: (error as { message?: string }).message ?? String(error) };
  }
  if (typeof data !== "string") return { ok: false, error: "재작업 코어 ID를 받지 못했습니다." };
  return { ok: true, scenarioId: data };
}
