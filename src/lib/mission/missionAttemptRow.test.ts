import { describe, expect, it } from "vitest";

import { buildMissionAttemptRow } from "@/lib/mission/missionAttemptRow";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { SAMPLE_MISSION_V4, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { POLICY_VERSION } from "@/lib/research/versions";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";

function sampleMissionV2() {
  const normalized = normalizeMission(SAMPLE_MISSION_V1);
  if (!normalized.ok || !normalized.data) throw new Error("sample mission normalization failed");
  return normalized.data;
}

const feedback: RuntimeFeedback = {
  schema_version: "feedback_v1",
  rubric_version: "request_mitigation_optionality@1",
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "clean",
    pragmatic_appropriateness: {
      feature_code: "request_mitigation_optionality",
      band_code: "within_band",
    },
  },
  revision_scope: "clear",
  blocks: {
    meaning_ko: "핵심 뜻이 유지되었습니다.",
    grammar: [],
    feature_ko: "이 상황에서 선택권을 충분히 남겼습니다.",
    alternatives: [],
  },
  uncertainty_flags: [{ dimension: "pragmatic", reason: "맥락에 따라 변이가 가능함" }],
  provenance: {
    model: "test-model",
    prompt_version: "feedback_v1",
    content_release_id: CURRENT_CONTENT_RELEASE_ID,
    generated_at: "2026-07-27T01:03:00.000Z",
  },
};

describe("mission attempt row", () => {
  it("links a course run to course, week, assignment, attempt, mission, and content hash", () => {
    const row = buildMissionAttemptRow({
      mission: SAMPLE_MISSION_V5_NATIVE,
      scenarioId: "11111111-1111-4111-8111-111111111111",
      speechAct: "request",
      level: "intermediate",
      courseContext: {
        courseId: "915fec24-cc38-4b00-a2a0-c3628abcd3f7",
        weekNo: 2,
        assignmentId: "22222222-2222-4222-8222-222222222222",
        attemptId: "33333333-3333-4333-8333-333333333333",
      },
      firstResponse: "第一次翻译",
      revisedResponse: "修改后的翻译",
      startedAtIso: "2026-08-29T01:00:00.000Z",
    }, "profile-1", "user-1");

    expect(row).toMatchObject({
      course_id: "915fec24-cc38-4b00-a2a0-c3628abcd3f7",
      week_no: 2,
      assignment_id: "22222222-2222-4222-8222-222222222222",
      attempt_id: "33333333-3333-4333-8333-333333333333",
      cell_id: "11111111-1111-4111-8111-111111111111",
      mission_id: "11111111-1111-4111-8111-111111111111",
      content_hash: SAMPLE_MISSION_V5_NATIVE.provenance?.mission_content_hash,
    });
  });

  it("stamps the canonical research policy version", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1", "2026-07-27T01:05:00.000Z");

    expect(row.policy_ver).toBe(POLICY_VERSION);
    expect(row).toMatchObject({
      profile_id: "profile-1",
      auth_user_id: "user-1",
      source_lang: "ko",
      target_lang: "zh",
      first_response: "처음 답",
      revised_response: "고친 답",
      completed_at: "2026-07-27T01:05:00.000Z",
    });
  });

  it("persists Take 1 and Take 2 verbatim without redefining revision", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "처음 답 ",
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1");

    expect(row.first_response).toBe("처음 답");
    expect(row.revised_response).toBe("처음 답 ");
    expect(row.first_response !== row.revised_response).toBe(true);
  });

  it("uses a stable synthetic mission id for an unsaved sample", () => {
    const mission = sampleMissionV2();
    const row = buildMissionAttemptRow({
      mission,
      scenarioId: null,
      speechAct: null,
      level: null,
      firstResponse: "답",
      revisedResponse: "답",
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1");

    expect(row.mission_id).toBe(`sample:${mission.unit.target_feature}`);
    expect(row.cell_id).toBeNull();
  });

  it("persists the feedback shown to the learner without a schema migration", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      feedback,
      startedAtIso: "2026-07-27T01:00:00.000Z",
    }, "profile-1", "user-1");

    expect(row.semantic_fidelity_status).toBe("pass");
    expect(row.revision_target_selected).toBe("clear");
    expect(row.revision_target_source).toBe("system_assigned");
    expect(row.target_feature_observed).toMatchObject({
      schema_version: "feedback_v1",
      revision_scope: "clear",
      uncertainty_flags: [{ dimension: "pragmatic" }],
      provenance: { model: "test-model" },
    });
  });

  it("stores unscored MPJ responses in a versioned context envelope", () => {
    const missionV4Shape = {
      ...sampleMissionV2(),
      schema_version: "mission_v4",
    } as unknown as ReturnType<typeof sampleMissionV2>;
    const row = buildMissionAttemptRow({
      mission: missionV4Shape,
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      startedAtIso: "2026-07-29T01:00:00.000Z",
      mpjResponses: [
        {
          item_id: 1,
          item_type: "fix_choice",
          band_code: "overdone",
          correction_indexes: [0, 2],
          completed_at: "2026-07-29T01:01:00.000Z",
        },
        {
          item_id: 2,
          item_type: "reason",
          reason_id: "primary",
          confidence: "이 값은 v4에서 폐기돼야 함",
          completed_at: "2026-07-29T01:02:00.000Z",
        },
        {
          item_id: 4,
          item_type: "multi_judge",
          best_candidate_index: 1,
          worst_candidate_index: 4,
          completed_at: "2026-07-29T01:03:00.000Z",
        },
      ],
      productionSupport: {
        kind: "translation_vocabulary_hints",
        available: true,
        opened: true,
        opened_at: "2026-07-29T01:04:00.000Z",
      },
    }, "profile-1", "user-1");

    expect(row.context_judgment).toMatchObject({
      schema_version: "mpj_response_v1",
      mission_schema_version: "mission_v4",
      learner_dissent: null,
      responses: [
        {
          item_type: "fix_choice",
          band_code: "overdone",
          correction_indexes: [0, 2],
        },
        {
          item_type: "reason",
          reason_id: "primary",
        },
        {
          item_type: "multi_judge",
          best_candidate_index: 1,
          worst_candidate_index: 4,
        },
      ],
      production_support: {
        kind: "translation_vocabulary_hints",
        available: true,
        opened: true,
      },
    });
    expect(JSON.stringify(row.context_judgment)).not.toContain("confidence");
  });

  it("strips legacy confidence for mission_v5 as well — same reason contract as v4", () => {
    const missionV5Shape = {
      ...sampleMissionV2(),
      schema_version: "mission_v5",
    } as unknown as ReturnType<typeof sampleMissionV2>;
    const row = buildMissionAttemptRow({
      mission: missionV5Shape,
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "고친 답",
      startedAtIso: "2026-07-30T01:00:00.000Z",
      mpjResponses: [
        {
          item_id: 3,
          item_type: "reason",
          reason_id: "primary",
          confidence: "v5에서도 폐기돼야 함",
          completed_at: "2026-07-30T01:02:00.000Z",
        },
      ],
    }, "profile-1", "user-1");

    expect(row.context_judgment).toMatchObject({
      mission_schema_version: "mission_v5",
      responses: [{ item_type: "reason", reason_id: "primary" }],
    });
    expect(JSON.stringify(row.context_judgment)).not.toContain("confidence");
  });

  it("versions native mission_v5 five-item traces as mpj_response_v2", () => {
    const row = buildMissionAttemptRow({
      mission: SAMPLE_MISSION_V5_NATIVE,
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "第一次翻译",
      revisedResponse: "修改后的翻译",
      startedAtIso: "2026-08-24T01:00:00.000Z",
      mpjResponses: SAMPLE_MISSION_V5_NATIVE.mpj_items.map((item) => ({
        item_id: item.id,
        item_type: item.type,
        completed_at: "2026-08-24T01:02:00.000Z",
      })),
    }, "profile-1", "user-1");

    expect(row.context_judgment).toMatchObject({
      schema_version: "mpj_response_v2",
      mission_schema_version: "mission_v5",
      mission_content_hash: SAMPLE_MISSION_V5_NATIVE.provenance?.mission_content_hash,
      responses: [
        { item_id: 1, item_type: "scale4" },
        { item_id: 2, item_type: "judge3" },
        { item_id: 3, item_type: "fix_choice" },
        { item_id: 4, item_type: "reason" },
        { item_id: 5, item_type: "multi_judge" },
      ],
    });
  });

  it("keeps judgment, reason diagnosis, feedback, revision, and dissent in one attempt without overwriting", () => {
    const row = buildMissionAttemptRow({
      mission: SAMPLE_MISSION_V4,
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "你必须改地址。",
      revisedResponse: "请问可以把地址改到新办公室吗？",
      feedback,
      startedAtIso: "2026-08-23T01:00:00.000Z",
      mpjResponses: [
        {
          item_id: 3,
          item_type: "reason",
          band_code: "too_direct",
          reason_id: "r2",
          reason_kind: "primary",
          completed_at: "2026-08-23T01:02:00.000Z",
        },
      ],
      contextJudgment: {
        kind: "learner_dissent",
        at: "feedback",
        conditions: ["relationship", "experience"],
        reason_ko: "실제 거래처에서는 이 정도 표현도 사용했습니다.",
        final_decision: "retained_first_response",
        created_at: "2026-08-23T01:04:00.000Z",
      },
    }, "profile-1", "user-1", "2026-08-23T01:05:00.000Z");

    expect(row).toMatchObject({
      first_response: "你必须改地址。",
      revised_response: "请问可以把地址改到新办公室吗？",
      revision_target_selected: "clear",
      target_feature_observed: {
        schema_version: "feedback_v1",
        verdicts: feedback.verdicts,
      },
      context_judgment: {
        schema_version: "mpj_response_v1",
        mission_schema_version: "mission_v4",
        responses: [{
          item_type: "reason",
          band_code: "too_direct",
          reason_id: "r2",
          reason_kind: "primary",
        }],
        learner_dissent: {
          kind: "learner_dissent",
          conditions: ["relationship", "experience"],
          final_decision: "retained_first_response",
        },
      },
    });
    expect(JSON.stringify(row.context_judgment)).not.toContain("confidence");
  });

  it("keeps the pre-feedback process memo apart from the final-choice memo", () => {
    const row = buildMissionAttemptRow({
      mission: sampleMissionV2(),
      scenarioId: "11111111-1111-1111-1111-111111111111",
      speechAct: "request",
      level: "intermediate",
      firstResponse: "처음 답",
      revisedResponse: "처음 답",
      startedAtIso: "2026-07-27T01:00:00.000Z",
      contextJudgment: { kind: "learner_dissent", at: "feedback", conditions: [], reason_ko: "관계상 이대로가 자연스럽다", final_decision: "retained_first_response", created_at: "2026-07-27T01:05:00.000Z" },
      processMemos: {
        schema_version: "process_memo_v1",
        first: { stage: "translation_draft", text: "공손함을 살리려 했다", submitted_at: "2026-07-27T01:02:00.000Z" },
        final: { text: "관계상 이대로가 자연스럽다", decision: "retained_first_response", used_as_dissent_reason: true, submitted_at: "2026-07-27T01:05:00.000Z" },
      },
    }, "profile-1", "user-1");
    const envelope = row.context_judgment as Record<string, any>;
    expect(envelope.process_memos.first.text).toBe("공손함을 살리려 했다");
    expect(envelope.process_memos.final.text).toBe("관계상 이대로가 자연스럽다");
    expect(envelope.learner_dissent.reason_ko).toBe("관계상 이대로가 자연스럽다");
  });
});
