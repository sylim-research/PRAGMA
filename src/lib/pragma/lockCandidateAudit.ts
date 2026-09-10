import { supabase } from "@/integrations/supabase/client";
import { CURRENT_CONTENT_RELEASE_ID, CURRENT_MISSION_PROMPT_VERSIONS } from "../../../supabase/functions/_shared/contentRelease";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import type { Domain, GenMode, LanguageDirection, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import { DIRECTION_MINIMUMS, VALID_LOCK_CANDIDATE_TARGET } from "@/lib/pragma/contentFunnelPlan";

export type LockCandidateBlocker =
  | "status"
  | "core_release"
  | "mission_release"
  | "schema"
  | "structure"
  | "quality_critical_fail"
  | "prompt_version"
  | "prompt_snapshot_hash"
  | "content_hash"
  | "exact_duplicate";

export interface LockCandidateRow {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  mode: GenMode | null;
  source_modality: string | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  industry_sector: string | null;
  language_direction: LanguageDirection | null;
  mission_status: string | null;
  core_content: Record<string, unknown> | null;
  mission_content: Record<string, unknown> | null;
}

export interface AuditedLockCandidate {
  scenarioId: string;
  direction: LanguageDirection | null;
  eligible: boolean;
  blockers: LockCandidateBlocker[];
  contentHash: string | null;
}

export interface LockCandidateAuditSummary {
  target: number;
  eligible: number;
  directionCounts: Record<LanguageDirection, number>;
  directionMinimums: Record<LanguageDirection, number>;
  directionMinimumsMet: boolean;
  targetMet: boolean;
  reviewedUniqueMissions: number;
  blockerCounts: Partial<Record<LockCandidateBlocker, number>>;
  qualityCriticalFailCodes: Record<string, number>;
  qualityCriticalFailSamples: Record<string, { scenarioId: string; where: string; noteKo: string }[]>;
  rows: AuditedLockCandidate[];
}

const HASH_RE = /^[0-9a-f]{64}$/;
const ELIGIBLE_STATUSES = new Set(["generated", "reviewed", "released"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textAt(value: Record<string, unknown> | null, key: string): string | null {
  const found = value?.[key];
  return typeof found === "string" ? found : null;
}

export function auditLockCandidates(
  candidates: readonly LockCandidateRow[],
  expectedPromptSnapshotHash: string,
): LockCandidateAuditSummary {
  if (!HASH_RE.test(expectedPromptSnapshotHash)) {
    throw new Error("LOCK prompt snapshot hash must be a 64-character lowercase SHA-256 value.");
  }
  const seenHashes = new Set<string>();
  const rows: AuditedLockCandidate[] = [...candidates]
    .sort((left, right) => left.scenario_id.localeCompare(right.scenario_id))
    .map((candidate) => {
      const blockers: LockCandidateBlocker[] = [];
      const coreGeneration = record(candidate.core_content?.generation);
      const mission = candidate.mission_content;
      const provenance = record(mission?.provenance);
      const quality = record(mission?.quality_check);
      const contentHash = textAt(provenance, "mission_content_hash");
      const direction = mission?.direction === "zh_ko" ? "zh_ko"
        : mission?.direction === "ko_zh" ? "ko_zh"
          : candidate.language_direction;

      if (!ELIGIBLE_STATUSES.has(candidate.mission_status ?? "")) blockers.push("status");
      if (textAt(coreGeneration, "content_release_id") !== CURRENT_CONTENT_RELEASE_ID) blockers.push("core_release");
      if (textAt(provenance, "content_release_id") !== CURRENT_CONTENT_RELEASE_ID) blockers.push("mission_release");
      if (mission?.schema_version !== "mission_v5" || !Array.isArray(mission.mpj_items) || mission.mpj_items.length !== 5) {
        blockers.push("schema");
      }

      const normalized = normalizeMission(mission);
      if (!normalized.ok || !normalized.data) {
        blockers.push("structure");
      } else {
        const context: CheckContext = {
          speech_act: candidate.speech_act,
          level: candidate.learner_level,
          domain: candidate.domain ?? "daily",
          theme_code: candidate.theme_code ?? "daily_living",
          topic_code: candidate.topic_code ?? "",
          industry: candidate.industry_sector,
          mode: candidate.mode ?? "translation",
          source_modality: candidate.source_modality === "spoken" ? "spoken" : "written",
          planned_target_feature: normalized.data.unit.target_feature,
          direction: normalized.data.direction,
        };
        if (checkMission(mission, context, candidate.core_content ?? undefined).result === "fail") {
          blockers.push("structure");
        }
      }

      if (!quality || quality.verdict === "fail" || !["pass", "warning"].includes(String(quality.verdict))) {
        blockers.push("quality_critical_fail");
      }
      const promptVersion = textAt(provenance, "prompt_version");
      if (
        !promptVersion ||
        !(CURRENT_MISSION_PROMPT_VERSIONS as readonly string[]).includes(promptVersion)
      ) {
        blockers.push("prompt_version");
      }
      // The snapshot hash fingerprints the core prompt surface. Mission provenance
      // is gated independently by CURRENT_MISSION_PROMPT_VERSIONS above.
      if (textAt(coreGeneration, "prompt_snapshot_hash") !== expectedPromptSnapshotHash) {
        blockers.push("prompt_snapshot_hash");
      }
      if (!contentHash || !HASH_RE.test(contentHash)) {
        blockers.push("content_hash");
      } else if (seenHashes.has(contentHash)) {
        blockers.push("exact_duplicate");
      } else {
        seenHashes.add(contentHash);
      }

      return {
        scenarioId: candidate.scenario_id,
        direction,
        eligible: blockers.length === 0,
        blockers: [...new Set(blockers)],
        contentHash,
      };
    });

  const eligibleRows = rows.filter((row) => row.eligible);
  const directionCounts = {
    ko_zh: eligibleRows.filter((row) => row.direction === "ko_zh").length,
    zh_ko: eligibleRows.filter((row) => row.direction === "zh_ko").length,
  };
  const reviewedIds = new Set(
    candidates
      .filter((candidate) => ["reviewed", "released"].includes(candidate.mission_status ?? ""))
      .map((candidate) => candidate.scenario_id),
  );
  const blockerCounts: Partial<Record<LockCandidateBlocker, number>> = {};
  for (const row of rows) {
    for (const blocker of row.blockers) blockerCounts[blocker] = (blockerCounts[blocker] ?? 0) + 1;
  }
  const qualityCriticalFailCodes: Record<string, number> = {};
  const qualityCriticalFailSamples: Record<string, { scenarioId: string; where: string; noteKo: string }[]> = {};
  for (const candidate of candidates) {
    const quality = record(candidate.mission_content?.quality_check);
    if (quality?.verdict !== "fail" || !Array.isArray(quality.findings)) continue;
    const codes = new Set(
      quality.findings
        .map((finding) => record(finding))
        .filter((finding) => finding?.severity === "fail")
        .map((finding) => textAt(finding, "code") ?? "unknown"),
    );
    for (const code of codes) qualityCriticalFailCodes[code] = (qualityCriticalFailCodes[code] ?? 0) + 1;
    for (const rawFinding of quality.findings) {
      const finding = record(rawFinding);
      if (finding?.severity !== "fail") continue;
      const code = textAt(finding, "code") ?? "unknown";
      const samples = qualityCriticalFailSamples[code] ?? [];
      if (samples.length >= 2) continue;
      samples.push({
        scenarioId: candidate.scenario_id,
        where: textAt(finding, "where") ?? "",
        noteKo: textAt(finding, "note_ko") ?? "",
      });
      qualityCriticalFailSamples[code] = samples;
    }
  }
  return {
    target: VALID_LOCK_CANDIDATE_TARGET,
    eligible: eligibleRows.length,
    directionCounts,
    directionMinimums: { ...DIRECTION_MINIMUMS },
    directionMinimumsMet:
      directionCounts.ko_zh >= DIRECTION_MINIMUMS.ko_zh && directionCounts.zh_ko >= DIRECTION_MINIMUMS.zh_ko,
    targetMet: eligibleRows.length >= VALID_LOCK_CANDIDATE_TARGET,
    reviewedUniqueMissions: reviewedIds.size,
    blockerCounts,
    qualityCriticalFailCodes,
    qualityCriticalFailSamples,
    rows,
  };
}

export async function loadLockCandidateRows(runId?: string): Promise<LockCandidateRow[]> {
  let query = (supabase as unknown as { from: (table: string) => any })
    .from("scenarios")
    .select("scenario_id, speech_act, learner_level, domain, mode, source_modality, theme_code, topic_code, industry_sector, language_direction, mission_status, core_content, mission_content")
    .in("mission_status", ["generated", "reviewed", "released"])
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(4000);
  if (runId) query = query.eq("generation_run_id", runId);
  const { data, error } = await query;
  if (error) throw new Error(`LOCK 후보 조회 실패: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    core_content: record(row.core_content),
    mission_content: record(row.mission_content),
  })) as unknown as LockCandidateRow[];
}
