import { supabase } from "@/integrations/supabase/client";
import {
  DOMAIN,
  LEVEL,
  SPEECH_ACT_UI,
} from "@/lib/pragma/enums";
import {
  PDR_DISTANCE_ENUM_TO_JSON,
  PDR_POWER_ENUM_TO_JSON,
} from "@/lib/pragma/coreSchema";
import type { CoreCellResult } from "@/lib/pragma/coreBatchRun";
import { CURRENT_CORE_QUALITY_PROMPT_VERSION } from "../../../supabase/functions/_shared/contentRelease";

export const CORE_QUALITY_AXES = [
  "speech_act",
  "power",
  "distance",
  "burden",
  "domain",
  "industry",
  "mode",
  "context_spec",
  "referents",
  "decision_authority",
  "topic_seed",
  "adjacency",
  "participant_roles",
  "scene_source_alignment",
  "learner_scene",
  "scene_plausibility",
] as const;

export type CoreQualityAxis = (typeof CORE_QUALITY_AXES)[number];

/** 축 한국어 라벨 — 코어 비평과 AI 모델 간 독립 검토가 같은 축을 쓰므로 여기 한 곳에 둔다. */
export const CORE_AXIS_LABEL: Record<CoreQualityAxis, string> = {
  speech_act: "화행",
  power: "P",
  distance: "D",
  burden: "R",
  domain: "도메인",
  industry: "산업",
  mode: "모드",
  context_spec: "역할·의무",
  referents: "행위자·대상",
  decision_authority: "결정 권한",
  topic_seed: "시드",
  adjacency: "인접쌍",
  participant_roles: "통역 참여자",
  scene_source_alignment: "상황·원문 대응",
  learner_scene: "학생용 장면",
  scene_plausibility: "장면 개연성",
};
export type CoreQualityVerdict = "pass" | "warning" | "fail";

export interface CoreQualityAxisResult {
  verdict: CoreQualityVerdict;
  reason_ko: string;
}

export interface CoreQualityCheck {
  verdict: CoreQualityVerdict;
  summary_ko: string;
  axes: Record<CoreQualityAxis, CoreQualityAxisResult>;
  model: string;
  prompt_version: typeof CURRENT_CORE_QUALITY_PROMPT_VERSION;
  checked_at: string;
}

export interface CoreQualityPilotResult {
  index: number;
  source: CoreCellResult;
  ok: boolean;
  check?: CoreQualityCheck;
  error?: string;
}

export interface CoreQualityPilotOptions {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, last: CoreQualityPilotResult) => void;
}

const RESPONSE_ACTS = new Set(["refusal", "opposition"]);

async function auditOne(source: CoreCellResult): Promise<CoreQualityPilotResult> {
  if (!source.coreContent) {
    return { index: source.index, source, ok: false, error: "생성 응답 core_content 없음" };
  }

  try {
    const cell = source.cell;
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "core_quality_check",
        telemetry: {
          scenario_id: source.scenarioId ?? null,
          invocation_attempt: 1,
        },
        core_quality: {
          core_content: source.coreContent,
          direction: cell.direction,
          speech_act: cell.speech_act_ui,
          speech_act_ko: SPEECH_ACT_UI[cell.speech_act_ui],
          level: LEVEL[cell.level],
          domain: cell.domain,
          domain_ko: DOMAIN[cell.domain],
          industry: cell.industry,
          mode: cell.mode,
          pdr: {
            p: PDR_POWER_ENUM_TO_JSON[cell.pdr_power],
            d: PDR_DISTANCE_ENUM_TO_JSON[cell.pdr_distance],
            r: cell.pdr_burden,
          },
          topic_code: cell.topic_code,
          situation_seed_ko: cell.situation_seed_ko,
          is_response_act: RESPONSE_ACTS.has(cell.speech_act_ui),
          expected_context_spec:
            (source.coreContent as { context_spec?: unknown }).context_spec ?? null,
        },
      },
    });
    if (error) throw error;
    if (!data?.core_quality_check) throw new Error(data?.error ?? "빈 비평 응답");
    return {
      index: source.index,
      source,
      ok: true,
      check: data.core_quality_check as CoreQualityCheck,
    };
  } catch (error) {
    return {
      index: source.index,
      source,
      ok: false,
      error: (error as Error).message ?? "비평 실패",
    };
  }
}

/**
 * 코어 비평 파일럿. 저장·생성 진행과 완전히 분리된 감사 표시이며, 실패해도 원 코어를
 * 삭제·재생성하거나 배치를 중단하지 않는다.
 */
export async function runCoreQualityPilot(
  sources: CoreCellResult[],
  options: CoreQualityPilotOptions = {},
): Promise<CoreQualityPilotResult[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 4));
  const results: CoreQualityPilotResult[] = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      if (options.signal?.aborted) return;
      const cursorIndex = cursor;
      cursor += 1;
      if (cursorIndex >= sources.length) return;
      const result = await auditOne(sources[cursorIndex]);
      results.push(result);
      done += 1;
      options.onProgress?.(done, sources.length, result);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.sort((a, b) => a.index - b.index);
}
