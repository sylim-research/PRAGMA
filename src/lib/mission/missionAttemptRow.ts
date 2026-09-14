import type { Json } from "@/integrations/supabase/types";
import { DIRECTION_LANGS, type LanguageDirection } from "@/lib/pragma/enums";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import type { LearnerMissionRuntime } from "@/lib/pragma/missionV6";
import { POLICY_VERSION } from "@/lib/research/versions";
import { parseMissionV6Responses } from "./missionV6Responses";

export interface SaveAttemptInput {
  mission: LearnerMissionRuntime;
  /** DB 미션이면 scenarios.scenario_id(uuid), 샘플이면 null */
  scenarioId: string | null;
  speechAct: string | null;
  level: string | null;
  /** 공개 교과목에서 진입한 수행은 네 값이 모두 필수다. */
  courseContext?: CourseAttemptContext;
  /** 학습 전(피드백 전) 산출 = 최초 번역/통역 */
  firstResponse: string;
  /** 다듬은 최종 산출(없으면 최초와 동일) */
  revisedResponse: string;
  /** 학습자에게 실제로 제시된 feedback_v1 스냅샷. 호출 실패 시 생략한다. */
  feedback?: RuntimeFeedback;
  /** 컴포넌트 마운트 시각(ISO) */
  startedAtIso: string;
  /**
   * MPJ에서 학습자가 실제로 고른 응답. 정답 점수로 환산하지 않고
   * 화면에 제시된 선택의 비채점 trace로만 저장한다.
   */
  mpjResponses?: MpjResponseTrace[];
  /** 번역 산출에서 내용 어휘 힌트를 열람했는지 남기는 비채점 수행 trace. */
  productionSupport?: ProductionSupportTrace;
  /**
   * 학습자 이견 기록(0-r·104). AI 참고 판정을 덮어쓰지 않고 학습자의 최종 산출 결정과
   * 결함 문항 발견·채점키 캘리브레이션 근거를 함께 남긴다. 남기지 않으면 undefined.
   */
  contextJudgment?: LearnerDissent;
}

export interface CourseAttemptContext {
  courseId: string;
  weekNo: number;
  assignmentId: string;
  attemptId: string;
}

/** context_judgment의 versioned MPJ envelope에 저장되는 문항별 비채점 응답. */
export interface MpjResponseTrace extends Record<string, Json | undefined> {
  item_id: number;
  item_type: string;
  completed_at: string;
  /** MJT 자유교정에서 학습자가 제출한 수정문. 비채점 원응답. */
  revised_text?: string;
  /** legacy scale4 */
  scale_code?: string;
  /** judge3 또는 fix_choice의 최초 조절 정도 판단 */
  band_code?: string;
  /** fix_choice에서 고른 수정안의 0-based 위치 */
  correction_indexes?: number[];
  /** legacy reason_conf */
  reason_ids?: string[];
  /** 학습자가 선택한 이유 후보 ID. v4/v5 reason 또는 v6 MJT2의 단일 선택. */
  reason_id?: string;
  /** reason 문항에서 해설을 보기 전에 제출한 최초 적절성 판단. */
  initial_judgment?: "appropriate" | "inappropriate";
  /** 선택한 reason 후보의 진단 역할. 정오 점수가 아니라 오개념 유형 분석용 trace. */
  reason_kind?: "primary" | "pragmatic_misconception" | "meaning_grammar_context";
  /** legacy reason_conf에만 존재한다. mission_v4에는 기록하지 않는다. */
  confidence?: string;
  /** multi_judge 후보 순서와 같은 band code 배열 */
  candidate_band_codes?: string[];
  /** v4 multi_judge에서 고른 BEST 1개와 WORST 1개의 0-based 위치. */
  best_candidate_index?: number;
  worst_candidate_index?: number;
}

export interface ProductionSupportTrace extends Record<string, Json | undefined> {
  kind: "translation_vocabulary_hints";
  available: boolean;
  opened: boolean;
  opened_at: string | null;
}

/** 이견 채널 저장 형태 — context_judgment jsonb에 그대로 들어간다. */
export interface LearnerDissent extends Record<string, Json | undefined> {
  kind: "learner_dissent";
  /** 어느 화면에서 남겼는가 */
  at: "feedback";
  /** 다르게 본 조건(복수 선택, 코드) */
  conditions: string[];
  /** 한 줄 이유(선택) */
  reason_ko: string;
  /** AI 참고 판정을 보존한 채 학습자가 선택한 최종 산출 결정. 과거 행은 값이 없을 수 있다. */
  final_decision?: "retained_first_response" | "revised_response";
  created_at: string;
}

/**
 * DB I/O와 분리한 학습 로그 행 조립.
 * 버전 스탬프와 방향 매핑이 빠지지 않는지 결정론적으로 회귀 검사한다.
 */
export function buildMissionAttemptRow(
  input: SaveAttemptInput,
  profileId: string,
  authUserId: string,
  completedAtIso = new Date().toISOString(),
) {
  const dir = input.mission.direction as LanguageDirection;
  const langs = DIRECTION_LANGS[dir];
  const pt = input.mission.production_task;
  const taskType = pt.mode === "interpreting" ? "interpreting" : "translation";
  const feedback = input.feedback;
  const semanticStatus = feedback
    ? {
        preserved: "pass",
        minor_loss: "warning",
        distorted: "fail",
      }[feedback.verdicts.semantic_fidelity]
    : null;
  const submittedResponses = input.mission.schema_version === "mission_v6"
    ? parseMissionV6Responses(input.mission, input.mpjResponses) : input.mpjResponses;
  const mpjResponses = submittedResponses?.map((response) => {
    // v4·v5는 같은 reason 계약(확신도 없음, DEC-20260730-01) — legacy confidence를 남기지 않는다.
    const noConfidenceContract =
      input.mission.schema_version === "mission_v4" || input.mission.schema_version === "mission_v5" || input.mission.schema_version === "mission_v6";
    if (!noConfidenceContract || response.confidence === undefined) {
      return response;
    }
    const { confidence: _legacyConfidence, ...withoutConfidence } = response;
    return withoutConfidence;
  });
  const contextJudgment =
    (mpjResponses && mpjResponses.length > 0) || input.productionSupport
      ? ({
          schema_version:
            (input.mission.schema_version === "mission_v5" && input.mission.mpj_items.length === 5) || input.mission.schema_version === "mission_v6"
              ? "mpj_response_v2"
              : "mpj_response_v1",
          mission_schema_version: input.mission.schema_version,
          // 수행 시점의 정확한 미션 본문을 append-only lineage와 연결한다.
          // 승인 전 legacy/sample 콘텐츠는 provenance가 없을 수 있으므로 null을 허용한다.
          mission_content_hash: input.mission.provenance?.mission_content_hash ?? null,
          responses: mpjResponses ?? [],
          production_support: input.productionSupport ?? null,
          learner_dissent: input.contextJudgment ?? null,
        } as unknown as Json)
      : input.contextJudgment ?? null;

  return {
    profile_id: profileId,
    auth_user_id: authUserId,
    mission_id: input.scenarioId ?? `sample:${input.mission.unit.target_feature}`,
    cell_id: input.scenarioId,
    course_id: input.courseContext?.courseId ?? null,
    week_no: input.courseContext?.weekNo ?? null,
    assignment_id: input.courseContext?.assignmentId ?? null,
    attempt_id: input.courseContext?.attemptId ?? null,
    content_hash: input.mission.provenance?.mission_content_hash ?? null,
    feature_id: input.mission.unit.target_feature,
    speech_act: input.speechAct,
    level: input.level,
    mode: "학습",
    task_type: taskType,
    source_lang: langs.source,
    target_lang: langs.target,
    source_text: pt.source_text,
    first_response: input.firstResponse,
    revised_response: input.revisedResponse,
    revision_target_selected: feedback?.revision_scope ?? null,
    revision_target_source: feedback ? "system_assigned" : "learner_free",
    target_feature_observed: feedback
      ? ({
          schema_version: feedback.schema_version,
          rubric_version: feedback.rubric_version,
          verdicts: feedback.verdicts,
          revision_scope: feedback.revision_scope,
          blocks: feedback.blocks,
          uncertainty_flags: feedback.uncertainty_flags,
          provenance: feedback.provenance,
        } as unknown as Json)
      : null,
    semantic_fidelity_status: semanticStatus,
    example_shown: true,
    mission_completed: true,
    content_ver: input.mission.unit.target_feature_version ?? null,
    policy_ver: POLICY_VERSION,
    context_judgment: contextJudgment,
    started_at: input.startedAtIso,
    completed_at: completedAtIso,
  };
}
