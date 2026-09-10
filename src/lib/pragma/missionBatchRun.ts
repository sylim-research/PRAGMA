import { supabase } from "@/integrations/supabase/client";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import {
  promoteCore,
  retryGeneratedMissionCandidateRepair,
  type PromotableCore,
  type PromoteResult,
  type PromotionTerminalEvidence,
} from "@/lib/pragma/promoteMission";
import type { Domain, GenMode, LanguageDirection, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import type { RuleViolation } from "@/lib/pragma/missionRules";

export interface MissionBatchCore extends PromotableCore {
  mission_status: string | null;
  mission_quality_verdict: "pass" | "warning" | "fail" | null;
}

export interface MissionBatchItemResult {
  scenarioId: string;
  generationItemKey: string | null;
  ok: boolean;
  reused: boolean;
  qualityVerdict?: "pass" | "warning" | "fail";
  firstPassQualityVerdict?: "pass" | "warning" | "fail";
  candidateRegenerationCount?: number;
  candidateRegenerationMaxPerCandidate?: number;
  violations?: RuleViolation[];
  error?: string;
  terminal?: PromotionTerminalEvidence;
}

export interface MissionBatchOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, last: MissionBatchItemResult) => void;
  promote?: (core: PromotableCore) => Promise<PromoteResult>;
  retryFailedGenerated?: boolean;
  retryFailed?: (core: PromotableCore) => Promise<PromoteResult>;
  stopOnBandTargetingRepeat?: boolean;
}

const PROMOTED_STATUSES = new Set(["generated", "reviewed", "released"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function coreReleaseId(coreContent: Record<string, unknown> | null): string | null {
  const generation = record(coreContent?.generation);
  return typeof generation?.content_release_id === "string" ? generation.content_release_id : null;
}

/**
 * 같은 generation_run_id의 저장 코어를 다시 읽는다. mission_status가 이미 채워진 행도
 * 포함해 재실행 시 AI 호출 없이 완료 항목으로 재사용한다.
 */
export async function loadLockMissionBatchCores(runId: string): Promise<MissionBatchCore[]> {
  const { data, error } = await (supabase as unknown as { from: (table: string) => any })
    .from("scenarios")
    .select(
      "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, language_direction, generation_run_id, generation_item_key, mission_status, core_content, mission_content",
    )
    .eq("generation_run_id", runId)
    .eq("content_format", "scenario_core_v1")
    .is("archived_at", null)
    .order("generation_item_key", { ascending: true })
    .limit(4000);
  if (error) throw new Error(`미션 배치 코어 조회 실패: ${error.message}`);

  return (data ?? [])
    .filter((row: Record<string, unknown>) =>
      coreReleaseId(record(row.core_content)) === CURRENT_CONTENT_RELEASE_ID,
    )
    .map((row: Record<string, unknown>) => ({
      scenario_id: row.scenario_id as string,
      speech_act: row.speech_act as SpeechActUI,
      learner_level: row.learner_level as LearnerLevel,
      domain: row.domain as Domain | null,
      industry_sector: row.industry_sector as string | null,
      mode: row.mode as GenMode | null,
      source_modality: row.source_modality as string | null,
      theme_code: row.theme_code as ThemeCode | null,
      topic_code: row.topic_code as string | null,
      language_direction: row.language_direction as LanguageDirection | null,
      generation_run_id: row.generation_run_id as string | null,
      generation_item_key: row.generation_item_key as string | null,
      mission_status: row.mission_status as string | null,
      mission_quality_verdict: (() => {
        const mission = record(row.mission_content);
        const quality = record(mission?.quality_check);
        return quality?.verdict === "pass" || quality?.verdict === "warning" || quality?.verdict === "fail"
          ? quality.verdict
          : null;
      })(),
      core_content: record(row.core_content),
    }));
}

export async function runMissionBatch(
  cores: readonly MissionBatchCore[],
  options: MissionBatchOptions = {},
): Promise<MissionBatchItemResult[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 4));
  const promote = options.promote ?? promoteCore;
  const retryFailed = options.retryFailed ?? retryGeneratedMissionCandidateRepair;
  const results: MissionBatchItemResult[] = new Array(cores.length);
  let cursor = 0;
  let done = 0;
  let stopped = false;

  const worker = async () => {
    while (true) {
      if (options.signal?.aborted || stopped) return;
      const index = cursor;
      cursor += 1;
      if (index >= cores.length) return;
      const core = cores[index];
      let result: MissionBatchItemResult;
      if (
        options.retryFailedGenerated &&
        core.mission_status === "generated" &&
        core.mission_quality_verdict === "fail"
      ) {
        try {
          const retried = await retryFailed(core);
          result = {
            scenarioId: core.scenario_id,
            generationItemKey: core.generation_item_key ?? null,
            ok: retried.ok,
            reused: false,
            qualityVerdict: retried.quality?.verdict,
            firstPassQualityVerdict: retried.firstPassQualityVerdict,
            candidateRegenerationCount: retried.candidateRegenerationCount,
            candidateRegenerationMaxPerCandidate: retried.candidateRegenerationMaxPerCandidate,
            violations: retried.violations,
            error: retried.error,
            terminal: retried.terminal,
          };
        } catch (error) {
          result = {
            scenarioId: core.scenario_id,
            generationItemKey: core.generation_item_key ?? null,
            ok: false,
            reused: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      } else if (PROMOTED_STATUSES.has(core.mission_status ?? "")) {
        result = {
          scenarioId: core.scenario_id,
          generationItemKey: core.generation_item_key ?? null,
          ok: true,
          reused: true,
        };
      } else if (core.mission_status) {
        result = {
          scenarioId: core.scenario_id,
          generationItemKey: core.generation_item_key ?? null,
          ok: false,
          reused: false,
          error: `승격할 수 없는 mission_status: ${core.mission_status}`,
        };
      } else {
        try {
          const promoted = await promote(core);
          result = {
            scenarioId: core.scenario_id,
            generationItemKey: core.generation_item_key ?? null,
            ok: promoted.ok,
            reused: false,
            qualityVerdict: promoted.quality?.verdict,
            firstPassQualityVerdict: promoted.firstPassQualityVerdict,
            candidateRegenerationCount: promoted.candidateRegenerationCount,
            candidateRegenerationMaxPerCandidate: promoted.candidateRegenerationMaxPerCandidate,
            violations: promoted.violations,
            error: promoted.error,
            terminal: promoted.terminal,
          };
        } catch (error) {
          result = {
            scenarioId: core.scenario_id,
            generationItemKey: core.generation_item_key ?? null,
            ok: false,
            reused: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
      results[index] = result;
      done += 1;
      options.onProgress?.(done, cores.length, result);
      if (options.stopOnBandTargetingRepeat && result.error?.includes("BAND_TARGETING_STOP:band_targeting_repeated_semantic_defect")) {
        stopped = true;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(cores.length, 1)) }, worker));
  return results.filter(Boolean);
}
