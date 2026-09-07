import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

export type MissionReleaseGateMode = "legacy_reviewed" | "expert_v1";

export interface MissionReleaseState {
  mission_status: string | null;
  release_gate_mode?: string | null;
  content_release_id?: string | null;
}

/** Professor final review is the current learner-release endpoint. */
export function isMissionReleasedForLearner(
  state: MissionReleaseState | null | undefined,
): boolean {
  if (!state) return false;
  return state.mission_status === "reviewed" || state.mission_status === "released";
}

/**
 * Keep the already published course generation usable when prompts change.
 * This is runtime compatibility, not approval under the latest review criteria.
 * Unversioned/pre-lock content and generated drafts remain excluded.
 */
export function isCurrentMissionReleasedForLearner(
  state: MissionReleaseState | null | undefined,
): boolean {
  return isMissionReleasedForLearner(state) && (
    state?.content_release_id === CURRENT_CONTENT_RELEASE_ID
    || state?.content_release_id === "pragma_zhko_bidirectional_candidate_20260904_02"
  );
}

export function missionReleaseLabel(state: MissionReleaseState): string {
  if (state.mission_status === "released") return "최종 공개 완료";
  if (state.mission_status === "reviewed") return "교수자 최종 검수 완료";
  if (state.mission_status === "generated") return "학습 콘텐츠 생성 완료";
  return "검수 대기";
}
