// 코어 배치 실행기 — 계약 v1.4 §7-0. scenario_core_v1 대량 생성.
//
// legacy batchRun.ts(candidates+feedback)와 별개. 경로:
//   action:'core'(엣지함수) → checkCore(클라 검사) → save_generated_core RPC
// RPC는 is_admin() 가드 → 관리자 세션에서만 성공(브라우저 AdminBatch).

import { supabase } from "@/integrations/supabase/client";
import {
  DOMAIN,
  LEVEL,
  SPEECH_ACT_UI,
  type GenMode,
  type LanguageDirection,
} from "@/lib/pragma/enums";
import {
  PDR_POWER_ENUM_TO_JSON,
  PDR_DISTANCE_ENUM_TO_JSON,
  coreContentForHash,
} from "@/lib/pragma/coreSchema";
import {
  checkCore,
  coreLengthHintKo,
  type CheckContext,
  type RuleViolation,
} from "@/lib/pragma/missionRules";
import type { BatchCell } from "@/lib/pragma/batchPlan";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import { coreSemanticGate, coreSemanticContent } from '../../../supabase/functions/_shared/sceneGrounding';
import { CURRENT_CORE_QUALITY_PROMPT_VERSION } from '../../../supabase/functions/_shared/contentRelease';

const RESPONSE_ACTS = new Set(["refusal", "opposition"]);

export interface CoreIndustryCriticResult {
  verdict: "pass" | "warning" | "fail" | "UNKNOWN";
  reason: string;
  model?: string;
  promptVersion?: string;
  issues?: string[];
  check?: Record<string, unknown>;
}

export interface CoreCellResult {
  index: number;
  cell: BatchCell;
  ok: boolean;
  scenarioId?: string;
  /** 같은 run ID에서 이미 저장된 항목이라 AI 호출 없이 건너뛴 경우. */
  reused?: boolean;
  /** 같은 세션에서 코어 비평 또는 증거 기록에 사용하는 생성 응답. */
  coreContent?: Record<string, unknown>;
  ruleResult?: "pass" | "warning" | "fail";
  ruleFindings?: RuleViolation[];
  ruleFailFirst?: string;
  error?: string;
  terminalStage?: "core_generation" | "core_deterministic" | "core_semantic_critic" | "core_save" | "core_eligible" | "core_reused";
  deterministicFailureCodes?: string[];
  semanticFailureCodes?: string[];
  industryCritic?: CoreIndustryCriticResult;
  stopCode?: string;
  infrastructureError?: boolean;
  providerStatus?: number | "UNKNOWN";
}

export interface CoreRunOptions {
  languageDirection?: LanguageDirection;
  runId: string;
  /** 있으면 test-only 저장 RPC가 아니라 lock된 최종 코퍼스 전용 RPC를 사용한다. */
  finalCorpusRunId?: string;
  /**
   * cells가 전체 계획의 부분집합일 때 각 항목의 원래 0-based 계획 index.
   * 검수에서 특정 셀만 새 run ID로 재생성해도 generation_item_key와 화면 번호를
   * 원래 계획 기준으로 유지한다. 생략하면 기존처럼 배열 index를 쓴다.
   */
  itemIndexes?: readonly number[];
  /** 같은 run ID로 재개할 때 DB에 이미 존재하는 item key → 저장 행. */
  existingItems?: ReadonlyMap<string, ExistingCoreRunItem | string>;
  concurrency?: number;
  onProgress?: (done: number, total: number, last: CoreCellResult) => void;
  signal?: AbortSignal;
}

export interface ExistingCoreRunItem {
  scenarioId: string;
  /** 재개 실행에서도 전체 run 비평을 할 수 있도록 함께 읽는다. */
  coreContent?: Record<string, unknown>;
}

// task_mode → source_modality (channel 폐기 2026-07-25 — 매체가 아니라 수행 방식이 결정).
const modalityOf = (mode: GenMode) => (mode === "stt_interpreting" ? "spoken" : "written");
// genre 행 태그(legacy)를 task_mode에서 파생하기 위한 legacy channel 토큰.
// channel은 더 이상 축이 아니지만, save_generated_core RPC가 core_content.channel로
// genre를 파생하므로(DB 무변경 유지) 저장 직전 mode에서 이 값을 주입한다.
const legacyChannelOf = (mode: GenMode) => (mode === "stt_interpreting" ? "facetoface" : "messenger");

function ctxOf(cell: BatchCell): CheckContext {
  const mode = cell.mode;
  return {
    speech_act: cell.speech_act_ui,
    level: cell.level,
    domain: cell.domain,
    theme_code: cell.theme_code as ThemeCode,
    topic_code: cell.topic_code,
    industry: cell.industry,
    mode,
    source_modality: modalityOf(mode),
    direction: cell.direction, // 0-l·89 — 데이터 방향과 요청 방향 일치 검사
    require_context_spec: true,
  };
}

function statusOf(error: unknown): number | "UNKNOWN" {
  const status = (error as { context?: { status?: unknown }; status?: unknown })?.context?.status ??
    (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : "UNKNOWN";
}

/** 배치·개별 생성·승격이 같은 완전 코어 의미 검사를 사용한다. */
export type IndustryCriticCell = Pick<
  BatchCell,
  | "direction" | "speech_act_ui" | "level" | "domain" | "industry" | "mode"
  | "pdr_power" | "pdr_distance" | "pdr_burden" | "topic_code" | "situation_seed_ko"
>;

export async function checkCoreSemanticFit(
  cell: IndustryCriticCell,
  core: Record<string, unknown>,
  runId: string,
  itemKey: string,
): Promise<
  | { ok: true; result: CoreIndustryCriticResult }
  | { ok: false; error: string; providerStatus: number | "UNKNOWN" }
> {
  const generation = core.generation as { semantic_check?: Record<string, unknown> } | undefined;
  const previous = generation?.semantic_check;
  const scope = { direction: cell.direction, speech_act: cell.speech_act_ui, level: cell.level, domain: cell.domain,
    industry: cell.industry, mode: cell.mode, topic_code: cell.topic_code,
    pdr: { p: PDR_POWER_ENUM_TO_JSON[cell.pdr_power], d: PDR_DISTANCE_ENUM_TO_JSON[cell.pdr_distance], r: cell.pdr_burden } };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coreSemanticContent(core, scope)));
  const contentHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (previous?.prompt_version === CURRENT_CORE_QUALITY_PROMPT_VERSION && previous.core_content_hash === contentHash) {
    const gate = coreSemanticGate(previous);
    return { ok: true, result: { verdict: gate.ok ? 'pass' : 'warning', reason: gate.reason,
      issues: gate.issues, check: previous, model: String(previous.model ?? ''), promptVersion: String(previous.prompt_version) } };
  }
  const { data, error } = await supabase.functions.invoke("generate-scenario", {
    body: {
      action: "core_quality_check",
      telemetry: {
        generation_run_id: runId,
        generation_item_key: itemKey,
        invocation_attempt: 1,
      },
      core_quality: {
        core_content: core,
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
          (core as { context_spec?: unknown }).context_spec ?? null,
      },
    },
  });
  if (error) {
    return { ok: false, error: error.message ?? "코어 의미 검토 호출 실패", providerStatus: statusOf(error) };
  }
  const check = data?.core_quality_check as Record<string, unknown> | undefined;
  if (!check || check.prompt_version !== CURRENT_CORE_QUALITY_PROMPT_VERSION) {
    return { ok: false, error: data?.error ?? "현행 코어 의미 검토 결과 없음", providerStatus: "UNKNOWN" };
  }
  const gate = coreSemanticGate(check);
  return {
    ok: true,
    result: {
      verdict: gate.ok ? 'pass' : check.verdict === 'fail' ? 'fail' : 'warning',
      reason: gate.reason,
      issues: gate.issues,
      check: { ...check, core_content_hash: contentHash },
      model: typeof check?.model === "string" ? check.model : undefined,
      promptVersion: typeof check?.prompt_version === "string" ? check.prompt_version : undefined,
    },
  };
}

/** 결정론 content hash — 멱등키 보조(§6). crypto.subtle 없이 간단 해시. */
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * 한 논리 배치 안에서 셀을 식별하는 결정론 키.
 *
 * 방향·모드·P/D/R까지 포함해 쿼터나 방향을 바꾼 뒤 같은 run ID를 실수로
 * 재사용해도 다른 셀을 완료 항목으로 오인하지 않는다. index는 같은 축의 반복분을
 * 구분한다.
 */
export function coreGenerationItemKey(cell: BatchCell, index: number): string {
  return [
    cell.direction,
    cell.speech_act_ui,
    cell.level,
    cell.domain,
    cell.mode,
    cell.pdr_power,
    cell.pdr_distance,
    cell.pdr_burden,
    cell.theme_code,
    cell.topic_code,
    cell.industry ?? "-",
    cell.business_function ?? "-",
    index,
  ].join("|");
}

/** 중단된 코어 배치를 같은 run ID로 재개하기 위한 저장 완료 목록. */
export async function loadExistingCoreRunItems(
  runId: string,
): Promise<Map<string, ExistingCoreRunItem>> {
  const { data, error } = await supabase
    .from("scenarios")
    .select("scenario_id, generation_item_key, core_content")
    .eq("generation_run_id", runId)
    .not("generation_item_key", "is", null);

  if (error) throw error;

  const items = new Map<string, ExistingCoreRunItem>();
  for (const row of data ?? []) {
    if (row.generation_item_key) {
      items.set(row.generation_item_key, {
        scenarioId: row.scenario_id,
        coreContent:
          row.core_content && typeof row.core_content === "object"
            ? (row.core_content as Record<string, unknown>)
            : undefined,
      });
    }
  }
  return items;
}

export async function runCoreCell(
  cell: BatchCell,
  index: number,
  opts: CoreRunOptions,
): Promise<CoreCellResult> {
  let terminalStage: NonNullable<CoreCellResult["terminalStage"]> = "core_generation";
  try {
    const mode = cell.mode;
    const sourceModality = modalityOf(mode);
    const isResponse = RESPONSE_ACTS.has(cell.speech_act_ui);
    const itemKey = coreGenerationItemKey(cell, index);

    // 1. 코어 생성 (엣지함수 action:'core')
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "core",
        telemetry: {
          generation_run_id: opts.runId,
          generation_item_key: itemKey,
          invocation_attempt: 1,
        },
        core: {
          direction: cell.direction, // 0-l·89 — 엣지가 방향별 원문·산출 언어 결정(라운드2 배포 후 활성)
          speech_act: cell.speech_act_ui,
          speech_act_ko: SPEECH_ACT_UI[cell.speech_act_ui],
          level: cell.level,
          level_ko: LEVEL[cell.level],
          domain: cell.domain,
          domain_ko: DOMAIN[cell.domain],
          industry: cell.industry,
          func: cell.business_function,
          topic_code: cell.topic_code,
          mode, // channel 폐기(2026-07-25) — 수행 방식이 1차 축(매체 관습 강제 제거)
          // 재배포 전 live 엣지 호환용 legacy channel(mode 파생). 재배포 후 엣지는 mode를 본다.
          channel: legacyChannelOf(mode),
          channel_ko: mode === "stt_interpreting" ? "구두(통역)" : "서면(번역)",
          pdr: {
            p: PDR_POWER_ENUM_TO_JSON[cell.pdr_power],
            d: PDR_DISTANCE_ENUM_TO_JSON[cell.pdr_distance],
            r: cell.pdr_burden,
          },
          source_modality: sourceModality,
          situation_seed_ko: cell.situation_seed_ko,
          is_response_act: isResponse,
          length_hint_ko: coreLengthHintKo(cell.level, mode),
        },
      },
    });
    if (error) throw error;
    if (!data?.core_content) {
      const check = data?.core_quality_check as Record<string, unknown> | undefined;
      const gate = check ? coreSemanticGate(check) : undefined;
      return {
        index, cell, ok: false, coreContent: data?.core_draft,
        terminalStage: check ? 'core_semantic_critic' : 'core_generation',
        stopCode: data?.stop_code, semanticFailureCodes: gate?.issues,
        error: data?.error ?? '빈 응답',
        ...(check ? { industryCritic: { verdict: 'warning' as const, reason: gate?.reason ?? '', check } } : {}),
      };
    }

    const core = data.core_content as Record<string, unknown> & {
      channel?: string;
      brief_note_ko?: string;
      situation_ko?: string;
    };
    const meta = data.meta;

    // 2. 클라 검사 (checkCore) — fail이면 저장하지 않는다
    terminalStage = "core_deterministic";
    const ruleResult = checkCore(core, ctxOf(cell));
    if (ruleResult.result === "fail") {
      return {
        index,
        cell,
        ok: false,
        coreContent: core,
        ruleResult: "fail",
        ruleFindings: ruleResult.violations,
        ruleFailFirst: ruleResult.violations.find((v) => v.level === "fail")?.message,
        deterministicFailureCodes: ruleResult.violations.filter((v) => v.level === "fail").map((v) => v.id),
        terminalStage,
        error: "규칙검사 실패(저장 안 함)",
      };
    }

    let industryCritic: CoreIndustryCriticResult | undefined;
    {
      terminalStage = "core_semantic_critic";
      const checked = await checkCoreSemanticFit(cell, core, opts.runId, itemKey);
      if ("error" in checked) {
        return {
          index,
          cell,
          ok: false,
          coreContent: core,
          ruleResult: "warning",
          ruleFindings: ruleResult.violations,
          terminalStage,
          industryCritic: { verdict: "UNKNOWN", reason: checked.error },
          infrastructureError: true,
          providerStatus: checked.providerStatus,
          stopCode: "CORE_SEMANTIC_UNAVAILABLE",
          error: checked.error,
        };
      }
      industryCritic = checked.result;
      if (industryCritic.verdict !== "pass") {
        return {
          index,
          cell,
          ok: false,
          coreContent: core,
          ruleResult: "warning",
          ruleFindings: ruleResult.violations,
          terminalStage,
          semanticFailureCodes: industryCritic.issues,
          industryCritic,
          stopCode: "CORE_SEMANTIC_HOLD",
          error: "코어 의미 검토 보류: " + industryCritic.reason,
        };
      }
    }

    // 3. save_generated_core RPC (검증 통과분만)
    // genre 행 태그(legacy)를 task_mode에서 파생 — RPC가 core_content.channel로 genre를
    // 만들므로(DB 무변경) 저장 직전 mode에서 legacy channel을 주입한다. channel은 축이 아님.
    core.channel = legacyChannelOf(mode);
    const payload = {
      title: core.brief_note_ko || core.situation_ko?.slice(0, 40),
      speech_act: cell.speech_act_ui,
      learner_level: cell.level,
      domain: cell.domain,
      industry_sector: cell.industry,
      business_function: cell.business_function,
      mode,
      source_modality: sourceModality,
      theme_code: cell.theme_code,
      topic_code: cell.topic_code,
      language_direction: cell.direction, // 0-l·89 — 행 태그(RPC가 라운드2에서 INSERT)
      core_content: core,
      auto_check_result: ruleResult.result === "warning" ? "warning" : "pass",
      meta,
      generation_run_id: opts.runId,
      generation_item_key: itemKey,
      content_hash: hashString(JSON.stringify(coreContentForHash(core))),
      // 프롬프트 지문 — 엣지가 '보내기 직전 문자열'로 계산한 값을 그대로 넘긴다.
      // 여기서 재계산하면 로컬 코드 기준이 되어 배포본과 어긋날 수 있다(=거짓 기록).
      prompt_snapshot_hash: meta?.prompt_snapshot_hash ?? null,
    };
    const saveFunction = opts.finalCorpusRunId ? "save_final_corpus_core" : "save_generated_core";
    const saveArgs = opts.finalCorpusRunId
      ? { p_run_id: opts.finalCorpusRunId, p_payload: payload }
      : { p_payload: payload };
    terminalStage = "core_save";
    const { data: savedId, error: saveErr } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )(saveFunction, saveArgs);
    if (saveErr) throw saveErr;

    return {
      index,
      cell,
      ok: true,
      scenarioId: savedId as string,
      coreContent: core,
      ruleResult: ruleResult.result === "warning" ? "warning" : "pass",
      ruleFindings: ruleResult.violations,
      industryCritic,
      terminalStage: "core_eligible",
    };
  } catch (e) {
    const status = statusOf(e);
    return {
      index,
      cell,
      ok: false,
      terminalStage,
      infrastructureError: status !== "UNKNOWN",
      providerStatus: status,
      error: (e as Error).message ?? "실패",
    };
  }
}

/** 계획 전체를 코어 경로로 실행. 소규모 동시 실행 풀 — 실패해도 계속. */
export async function runCoreBatch(
  cells: BatchCell[],
  opts: CoreRunOptions,
): Promise<CoreCellResult[]> {
  if (opts.finalCorpusRunId && opts.finalCorpusRunId !== opts.runId) {
    throw new Error("최종 코퍼스 run ID와 생성 run ID가 일치해야 합니다.");
  }
  if (opts.itemIndexes && opts.itemIndexes.length !== cells.length) {
    throw new Error("선택 셀 index 수가 실행 셀 수와 일치하지 않습니다.");
  }
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));
  const results: CoreCellResult[] = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      if (opts.signal?.aborted) return;
      const i = cursor;
      cursor += 1;
      if (i >= cells.length) return;
      const cell = cells[i];
      const itemIndex = opts.itemIndexes?.[i] ?? i;
      const existing = opts.existingItems?.get(coreGenerationItemKey(cell, itemIndex));
      const existingScenarioId =
        typeof existing === "string" ? existing : existing?.scenarioId;
      const res: CoreCellResult = existingScenarioId
        ? {
            index: itemIndex,
            cell,
            ok: true,
            scenarioId: existingScenarioId,
            reused: true,
            coreContent:
              typeof existing === "string" ? undefined : existing?.coreContent,
            terminalStage: "core_reused",
          }
        : await runCoreCell(cell, itemIndex, opts);
      results.push(res);
      done += 1;
      opts.onProgress?.(done, cells.length, res);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.sort((a, b) => a.index - b.index);
}
