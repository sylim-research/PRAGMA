// 15주 편성기 데이터 레이어 (태스크 D).
//
// 시나리오 코어를 curriculum_week_scenarios 조인 테이블로 주차에 배정한다.
// RLS 전제: admin은 전체를 읽고 쓴다. 프로필 작성을 마친 learner의 SELECT는
// published 강좌 편성 + reviewed 미션으로 제한된다
// (20260727190000_learner_published_curriculum_read). 쓰기는 admin-only다.
//
// ⚠️ 원자성 한계(updateCurriculumOutline과 동일): 여러 PostgREST 요청은 하나의
//    트랜잭션이 아니다. 다만 새 편성을 먼저 upsert한 뒤 사라진 행만 삭제해, 삽입
//    실패 때문에 기존 편성 전체가 먼저 사라지는 경로는 두지 않는다.

import { supabase } from "@/integrations/supabase/client";
import type { Domain, GenMode, LanguageDirection, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";
import { coreDirection } from "@/lib/pragma/coreSchema";
import { weeklyOpeningContext } from "./weeklyOpeningContext";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import {
  assertCurrentWeeklyMissionPairShapes,
  type WeeklyContextAxis,
  type WeeklyDiagnosticDimension,
  type WeeklyMissionRole,
} from "@/lib/curriculum/weeklyMissionPair";

const db = supabase;
// release_gate_mode는 신규 migration 컬럼이라 생성 타입 갱신 전까지 이 조회만 좁게 우회한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const releaseDb = supabase as unknown as { from: (table: string) => any };

/** 편성 대상 = 시나리오 코어(scenario_core_v1) 한 행의 편성용 요약. */
export interface ComposerCore {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  mode: GenMode | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  /** NULL(코어만) | generated | reviewed(내부 확인) | released(학습자 사용 승인) */
  mission_status: string | null;
  /** 기존 자료는 reviewed, 새 품질 게이트 자료는 released가 학습자 사용 가능 상태다. */
  release_gate_mode?: "legacy_reviewed" | "expert_v1" | null;
  /** core_content.generation.content_release_id — pre-lock/current 운영 경계. */
  content_release_id?: string | null;
  /** 미션 승격 시에만 채워짐. 코어만 있으면 null → 편성표 "미지정" */
  target_feature: string | null;
  /** 현행 완전 미션 후보: mission_v5이며 독립 MPJ가 정확히 5개다. */
  is_native_mpj5: boolean;
  situation_ko: string;
  source_text_ko: string;
  /** 언어 방향(0-l·82) — core_content.direction 우선, 없으면 ko_zh(v1 호환). 편성 필터용 */
  direction: LanguageDirection;
  /** A/B가 실제로 바꾼 축을 저장값과 대조하기 위한 관찰 가능 맥락. */
  context: Record<WeeklyContextAxis, string | null>;
  /** 공통 검수 원본의 core_content에서 읽는 수업 도입용 맥락. */
  opening_context?: ReturnType<typeof weeklyOpeningContext>;
}

export interface WeekAssignment {
  /** curriculum_week_scenarios.id — 학습 수행 귀속에 쓰는 assignment ID. */
  id?: string;
  week_no: number;
  scenario_id: string;
  position: number;
  slot_role: string;
  /** NULL이면 역사적 편성. 새 A/B 정본은 speech_act_ab_v1. */
  pair_contract_version?: "speech_act_ab_v1" | null;
  mission_role?: WeeklyMissionRole | null;
  changed_context_axes?: WeeklyContextAxis[] | null;
  diagnostic_dimensions?: WeeklyDiagnosticDimension[] | null;
}

/**
 * 모든 코어를 한 번에 조회(클라이언트 필터). AdminBrowser·AdminAssembly와 동일 전략.
 *
 * ⚠️ 상한을 명시하지 않으면 PostgREST 기본 상한(1000)이 조용히 적용된다. 2026-07-31
 * 시점 코어가 1299건이고 정렬이 `created_at DESC`라 정본 배치 일부가 편성기에서
 * 사라졌다 — 같은 결함을 라이브러리·조립 큐에서 먼저 고쳤는데 이 데이터 레이어만
 * 누락됐다. 형제 화면과 같은 4000으로 맞춘다.
 */
export const CORE_ROW_CAP = 4000;

export async function listCoreScenarios(): Promise<ComposerCore[]> {
  const { data, error } = await releaseDb
    .from("scenarios")
    .select(
      "scenario_id, speech_act, learner_level, domain, mode, theme_code, topic_code, mission_status, release_gate_mode, target_feature, scenario_p, scenario_d, scenario_r, source_modality, core_content, mission_schema_version:mission_content->>schema_version, mission_mpj_items:mission_content->mpj_items",
    )
    .eq("content_format", "scenario_core_v1")
    .order("created_at", { ascending: false })
    .limit(CORE_ROW_CAP);
  if (error) throw new Error(`시나리오 코어 조회 실패: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: Record<string, any>) => {
    const content =
      r.core_content && typeof r.core_content === "object" && !Array.isArray(r.core_content)
        ? (r.core_content as Record<string, unknown>)
        : {};
    const contextSpec =
      content.context_spec &&
      typeof content.context_spec === "object" &&
      !Array.isArray(content.context_spec)
        ? (content.context_spec as Record<string, unknown>)
        : {};
    const generation =
      content.generation &&
      typeof content.generation === "object" &&
      !Array.isArray(content.generation)
        ? (content.generation as Record<string, unknown>)
        : {};
    const rolePair =
      contextSpec.role_pair &&
      typeof contextSpec.role_pair === "object" &&
      !Array.isArray(contextSpec.role_pair)
        ? (contextSpec.role_pair as Record<string, unknown>)
        : {};
    const counterpart =
      typeof rolePair.addressee_ko === "string"
        ? rolePair.addressee_ko
        : typeof rolePair.addressee === "string"
          ? rolePair.addressee
          : null;
    return {
      scenario_id: r.scenario_id,
      speech_act: r.speech_act as SpeechActUI,
      learner_level: r.learner_level as LearnerLevel,
      domain: (r.domain as Domain | null) ?? null,
      mode: (r.mode as GenMode | null) ?? null,
      theme_code: (r.theme_code as ThemeCode | null) ?? null,
      topic_code: r.topic_code ?? null,
      mission_status: r.mission_status ?? null,
      release_gate_mode: r.release_gate_mode ?? "legacy_reviewed",
      content_release_id:
        typeof generation.content_release_id === "string" ? generation.content_release_id : null,
      target_feature: r.target_feature ?? null,
      is_native_mpj5:
        r.mission_schema_version === "mission_v5" &&
        Array.isArray(r.mission_mpj_items) &&
        r.mission_mpj_items.length === 5,
      situation_ko: typeof content.situation_ko === "string" ? content.situation_ko : "",
      source_text_ko:
        typeof content.source_text_ko === "string"
          ? content.source_text_ko
          : typeof content.source_text === "string"
            ? content.source_text
            : "",
      direction: coreDirection(r.core_content),
      opening_context: weeklyOpeningContext(content),
      context: {
        counterpart,
        power: typeof r.scenario_p === "string" ? r.scenario_p : null,
        distance: typeof r.scenario_d === "string" ? r.scenario_d : null,
        burden: typeof r.scenario_r === "string" ? r.scenario_r : null,
        channel:
          typeof content.channel === "string"
            ? content.channel
            : typeof r.source_modality === "string"
              ? r.source_modality
              : null,
      },
    };
  });
}

/** 한 outline의 주차별 배정을 조회(week_no·position 오름차순). */
export async function listWeekAssignments(outlineId: string): Promise<WeekAssignment[]> {
  const { data, error } = await db
    .from("curriculum_week_scenarios")
    .select(
      "id, week_no, scenario_id, position, slot_role, pair_contract_version, mission_role, changed_context_axes, diagnostic_dimensions",
    )
    .eq("outline_id", outlineId)
    .order("week_no", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new Error(`편성 조회 실패: ${error.message}`);
  return (data ?? []) as WeekAssignment[];
}

/**
 * outline 단위 동기화: 현재 행 조회 → 새 편성 upsert → 빠진 기존 행만 삭제.
 * 빈 편성은 명시적으로 전체 삭제한다. 원자성 한계는 파일 상단 주석 참조.
 */
export async function saveWeekAssignments(
  outlineId: string,
  assignments: WeekAssignment[],
): Promise<void> {
  assertCurrentWeeklyMissionPairShapes(assignments);

  const { data: existing, error: readError } = await db
    .from("curriculum_week_scenarios")
    .select("id, week_no, scenario_id")
    .eq("outline_id", outlineId);
  if (readError) throw new Error(`기존 편성 조회 실패: ${readError.message}`);

  if (assignments.length === 0) {
    const { error: deleteAllError } = await db
      .from("curriculum_week_scenarios")
      .delete()
      .eq("outline_id", outlineId);
    if (deleteAllError) throw new Error(`기존 편성 삭제 실패: ${deleteAllError.message}`);
    return;
  }

  const rows = assignments.map((a) => ({
    outline_id: outlineId,
    week_no: a.week_no,
    scenario_id: a.scenario_id,
    position: a.position,
    slot_role: a.slot_role,
    pair_contract_version: a.pair_contract_version ?? null,
    mission_role: a.mission_role ?? null,
    changed_context_axes: a.changed_context_axes ?? [],
    diagnostic_dimensions: a.diagnostic_dimensions ?? [],
  }));
  const { error: upsertError } = await db
    .from("curriculum_week_scenarios")
    .upsert(rows, { onConflict: "outline_id,week_no,scenario_id" });
  if (upsertError) throw new Error(`편성 저장 실패: ${upsertError.message}`);

  const desiredKeys = new Set(assignments.map((item) => `${item.week_no}:${item.scenario_id}`));
  const staleIds = ((existing ?? []) as Array<{ id: string; week_no: number; scenario_id: string }>)
    .filter((item) => !desiredKeys.has(`${item.week_no}:${item.scenario_id}`))
    .map((item) => item.id);
  if (staleIds.length === 0) return;

  const { error: staleDeleteError } = await db
    .from("curriculum_week_scenarios")
    .delete()
    .in("id", staleIds);
  if (staleDeleteError) {
    throw new Error(`이전 편성 정리 실패: ${staleDeleteError.message}`);
  }
}
