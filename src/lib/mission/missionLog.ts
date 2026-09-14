// 학습자 수행 로그 저장 — 루프의 마지막 노드(실행 → 저장).
//
// 저장처 = learner_mission_logs(migration 20260721120000). RLS = 본인 행만 insert
// (auth_user_id = auth.uid()). 따라서 **실제 Supabase 세션**에서만 저장된다 —
// 데모 스텁(auth 없음)은 저장을 건너뛴다(크래시 없이 사유 반환).
//
// 이번 단계 = 루프를 닫는 수행 로그(신원·방향·MPJ 비채점 응답·원문·산출·수정·완료).
// context_judgment = mpj_response_v1 봉투. 이견 채널이 있으면 learner_dissent에 함께
// 넣는다. MPJ 응답이 없는 legacy/2부 직접 진입은 기존 이견 단독 형태도 읽기 호환한다.

import { supabase } from "@/integrations/supabase/client";
import {
  buildMissionAttemptRow,
  type SaveAttemptInput,
} from "@/lib/mission/missionAttemptRow";

export type {
  LearnerDissent,
  MpjResponseTrace,
  ProductionSupportTrace,
  SaveAttemptInput,
} from "@/lib/mission/missionAttemptRow";

export type SaveAttemptResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_auth" | "error"; message?: string };

/**
 * 미션 완료 로그를 저장한다. 실제 세션이 없으면(데모 스텁) 저장하지 않고
 * reason:'no_auth'를 돌려준다(호출측이 화면에 "데모 — 미저장"을 표시).
 */
export async function saveMissionAttempt(input: SaveAttemptInput, logId?: string): Promise<SaveAttemptResult> {
  // 실제 auth 세션 확인 — RLS(auth_user_id = auth.uid()) 충족 여부.
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return { ok: false, reason: "no_auth" };
  if (input.courseContext && !/^[0-9a-f]{64}$/.test(input.mission.provenance?.mission_content_hash ?? "")) {
    return { ok: false, reason: "error", message: "교과목 수행의 콘텐츠 해시가 없습니다." };
  }

  // profile_id(profiles.id, NOT NULL) 조회 — auth user에 매인 프로필.
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (profErr || !prof?.id) {
    return { ok: false, reason: "error", message: profErr?.message ?? "프로필을 찾을 수 없습니다." };
  }

  const row = buildMissionAttemptRow(input, prof.id, authUserId);

  const { data, error } = await supabase
    .from("learner_mission_logs")
    // 같은 완료 화면의 재시도는 같은 PK를 사용한다. 응답이 유실돼도 중복 insert하지 않는다.
    .insert({ ...row, ...(logId ? { id: logId } : {}) })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505" && logId) {
    // 다른 unique 제약 위반을 성공으로 바꾸지 않고, 이번 요청의 본인 행만 확인한다.
    const { data: existing, error: lookupError } = await supabase
      .from("learner_mission_logs")
      .select("id")
      .eq("id", logId)
      .eq("auth_user_id", authUserId)
      .eq("mission_id", row.mission_id)
      .eq("first_response", row.first_response)
      .eq("revised_response", row.revised_response)
      .maybeSingle();
    if (!lookupError && existing?.id) return { ok: true, id: existing.id };
  }
  if (error || !data?.id) {
    return { ok: false, reason: "error", message: error?.message ?? "저장 실패" };
  }
  return { ok: true, id: data.id as string };
}

/** 학습 기록 화면 한 줄 — 학습자 본인이 쓴 것만 담는다(판정·점수 없음). */
export interface MyMissionLogEntry {
  id: string;
  createdAtIso: string;
  speechAct: string | null;
  level: string | null;
  taskType: string | null;
  /** 학습자가 산출한 언어. 카탈로그 표현 예시를 방향에 맞게 읽는 데 사용한다. */
  targetLang: string | null;
  sourceText: string | null;
  firstResponse: string | null;
  revisedResponse: string | null;
  /** 최초안과 최종안이 다르면 true. 별도 플래그가 없어 두 값을 비교한다. */
  revised: boolean;
  /** 이번 수행의 목표 화용 초점 코드(카탈로그 조회용). */
  featureId: string | null;
  /** 목표 화용 초점 버전. 서로 다른 판정 계약을 한 집계에 섞지 않는 데 사용한다. */
  featureVersion?: string | null;
  /** 피드백 rubric 버전. 버전이 다른 판정은 같은 프로파일 분모로 묶지 않는다. */
  feedbackRubricVersion?: string | null;
  /** 해당 화용 초점의 수행별 AI 피드백 band. 초점 간 합산하지 않는다. */
  pragmaticBandCode?: string | null;
  /** 시스템이 지정한 수정 지점 = meaning | grammar | feature | clear. */
  revisionScope: string | null;
  /** system_assigned = AI 피드백을 받고 수정했음 / learner_free = 피드백 없이 진행. */
  revisionSource: string | null;
}

/**
 * 학습 기록 조회 — 최신순. 세션이 없으면 빈 배열(데모에서 남의 기록이 보이지 않도록).
 *
 * ⚠️ `auth_user_id`를 **명시적으로** 건다. RLS의 `learner_select_own_log`만 믿으면
 * 관리자 계정에서는 `admin_select_all_logs`가 함께 걸려 전체 학습자의 답안이 나온다
 * (migration 20260721120000). 이 화면은 "내 기록"이므로 역할과 무관하게 본인 것만 본다.
 *
 * 점수·등급은 조회하지 않는다. `target_feature_observed`에서는 현재 초점의 수행별
 * band만 읽어 같은 초점·방식·버전 안에서 분포를 보여 준다. 화행·초점 간 합산이나
 * 숙달도 해석에는 사용하지 않는다(계약상 점수 표현 금지).
 */
export async function listMyMissionLogs(limit = 50): Promise<MyMissionLogEntry[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return [];

  const { data, error } = await supabase
    .from("learner_mission_logs")
    .select(
      "id, created_at, speech_act, level, task_type, target_lang, source_text, first_response, revised_response, feature_id, content_ver, target_feature_observed, revision_target_selected, revision_target_source",
    )
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.floor(limit)));
  if (error) throw new Error(`학습 기록을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => {
    const first = (row.first_response as string | null) ?? null;
    const revisedText = (row.revised_response as string | null) ?? null;
    const observed =
      row.target_feature_observed &&
      typeof row.target_feature_observed === "object" &&
      !Array.isArray(row.target_feature_observed)
        ? row.target_feature_observed
        : null;
    const verdicts =
      observed?.verdicts &&
      typeof observed.verdicts === "object" &&
      !Array.isArray(observed.verdicts)
        ? observed.verdicts
        : null;
    const pragmatic =
      verdicts?.pragmatic_appropriateness &&
      typeof verdicts.pragmatic_appropriateness === "object" &&
      !Array.isArray(verdicts.pragmatic_appropriateness)
        ? verdicts.pragmatic_appropriateness
        : null;
    return {
      id: row.id as string,
      createdAtIso: row.created_at as string,
      speechAct: (row.speech_act as string | null) ?? null,
      level: (row.level as string | null) ?? null,
      taskType: (row.task_type as string | null) ?? null,
      targetLang: (row.target_lang as string | null) ?? null,
      sourceText: (row.source_text as string | null) ?? null,
      firstResponse: first,
      revisedResponse: revisedText,
      revised: Boolean(first && revisedText && first !== revisedText),
      featureId: (row.feature_id as string | null) ?? null,
      featureVersion: (row.content_ver as string | null) ?? null,
      feedbackRubricVersion:
        typeof observed?.rubric_version === "string"
          ? observed.rubric_version
          : null,
      pragmaticBandCode:
        typeof pragmatic?.band_code === "string" ? pragmatic.band_code : null,
      revisionScope: (row.revision_target_selected as string | null) ?? null,
      revisionSource: (row.revision_target_source as string | null) ?? null,
    };
  });
}
