/**
 * 생성 콘텐츠 작업 후보의 단일 버전 표식.
 *
 * 콘텐츠는 아직 최종 동결이 아니므로 `candidate`로 부른다. 시나리오·미션·런타임
 * 피드백 중 하나라도 이 ID가 다르면 같은 검수·배포 묶음으로 취급하지 않는다.
 * 새 학습설계 또는 생성 기준을 시험할 때는 기존 ID를 덮어쓰지 말고 새 ID를 만든다.
 */
export const CURRENT_CONTENT_RELEASE = {
  id: "pragma_scene_grounding_candidate_20260910_03",
  lifecycle: "candidate",
  corePromptVersions: [
    "core_v18_observed_pdr_scene_gate",
    "core_v18_observed_pdr_scene_repair",
  ],
  missionPromptVersions: [
    "mission_v5_mpj5_minidiscourse_v20_observed_pdr_scene",
    "mission_v4_mpj4_dct1_context_v13_observed_pdr_scene",
  ],
  itemLineagePromptVersion: "item_lineage_attribution_v4_mission_v5_mpj5",
  feedbackPromptVersions: [
    "feedback_v1_minidiscourse_v6_concise",
    "feedback_v1_feature_general_v3_concise",
  ],
  qualityPromptVersions: {
    core: "core_quality_v11_observed_pdr_scene_gate",
    mission: "quality_v23_reason_branch_severity",
  },
} as const;

export const CURRENT_CONTENT_RELEASE_ID = CURRENT_CONTENT_RELEASE.id;
export const CURRENT_CORE_PROMPT_VERSIONS = CURRENT_CONTENT_RELEASE.corePromptVersions;
export const CURRENT_MISSION_PROMPT_VERSIONS = CURRENT_CONTENT_RELEASE.missionPromptVersions;
export const CURRENT_ITEM_LINEAGE_PROMPT_VERSION = CURRENT_CONTENT_RELEASE.itemLineagePromptVersion;
export const CURRENT_FEEDBACK_PROMPT_VERSIONS = CURRENT_CONTENT_RELEASE.feedbackPromptVersions;
export const CURRENT_CORE_QUALITY_PROMPT_VERSION = CURRENT_CONTENT_RELEASE.qualityPromptVersions.core;
export const CURRENT_MISSION_QUALITY_PROMPT_VERSION = CURRENT_CONTENT_RELEASE.qualityPromptVersions.mission;
