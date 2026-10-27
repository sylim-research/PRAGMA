import { describe, expect, it } from "vitest";
import { buildLearningRecordDetail, type RecordDetailRow } from "./learningRecordDetail";

const row: RecordDetailRow = {
  feature_id: null,
  task_type: "translation",
  source_lang: "ko",
  target_lang: "zh",
  source_text: "원문",
  first_response: "A",
  revised_response: "C",
  target_feature_observed: { verdicts: { semantic_fidelity: "preserved", grammatical_accuracy: "clean" }, revision_scope: "feature" },
  context_judgment: {
    responses: [
      { item_id: 2, item_type: "scale4", scale_code: "very_appropriate", revised_scale_code: "somewhat_inappropriate", reason_id: "r1" },
      { item_id: 3, item_type: "fix_choice", correction_indexes: [1] },
      { item_id: 5, item_type: "multi_judge", candidate_band_codes: ["x", "y"] },
    ],
    learner_dissent: { kind: "learner_dissent", conditions: ["relationship"], reason_ko: "이유", final_decision: "revised_response" },
  },
  content_ver: "v1",
  content_hash: "abcdef1234",
  started_at: null,
  completed_at: null,
};
const mission = {
  production_task: { relation_ko: "처음 거래", situation_ko: "가격 조정" },
  mpj_items: [
    { id: 2, short_label: "이유 보기", target: "T2", reason_choice: { options: [{ id: "r1", text: "관계가 멀다" }] } },
    { id: 3, target: "T3", corrections: [{ text: "x" }, { text: "고친 문장" }, { text: "z" }] },
    { id: 5, candidates: [{ text: "후보1" }, { text: "후보2" }] },
  ],
};

describe("buildLearningRecordDetail", () => {
  it("spells out saved choices in learning-flow order", () => {
    const detail = buildLearningRecordDetail(row, mission, "편성 외 수행", (iso) => iso ?? "");
    expect(detail.context.relation).toBe("처음 거래");
    expect(detail.mjt[0].activity).toBe("이유 보기");
    expect(detail.mjt[0].choices.map((choice) => choice.value)).toEqual(["매우 적절", "관계가 멀다", "다소 부적절"]);
    expect(detail.mjt[1].choices[0].value).toBe("고친 문장");
    expect(detail.mjt[2].rows.map((r) => r.label)).toEqual(["후보1", "후보2"]);
    expect(detail.task).toMatchObject({ first: "A", final: "C", decision: "수정" });
    expect(detail.dissent?.conditions).toEqual(["관계에 대한 다른 판단"]);
  });

  it("labels the frozen request middle band like the learner screen", () => {
    const detail = buildLearningRecordDetail(
      { ...row, feature_id: "request_mitigation_optionality", context_judgment: { responses: [{ item_id: 5, item_type: "multi_judge", candidate_band_codes: ["appropriate"] }] } },
      null, "", () => "",
    );
    expect(detail.mjt[0].rows[0].value).not.toBe("appropriate");
  });

  it("shows process memos once and keeps pre-feature records distinct from blank memos", () => {
    const withMemos = buildLearningRecordDetail({
      ...row,
      task_type: "interpreting",
      context_judgment: {
        responses: [],
        learner_dissent: { kind: "learner_dissent", conditions: [], reason_ko: "이대로 둔다", final_decision: "retained_first_response" },
        process_memos: {
          schema_version: "process_memo_v1",
          first: { stage: "interpreting_after_recording", text: "빨리 말하느라 높임을 놓쳤다", submitted_at: "t1" },
          final: { text: "이대로 둔다", decision: "retained_first_response", used_as_dissent_reason: true, submitted_at: "t2" },
        },
      },
    }, null, "", () => "");
    expect(withMemos.memos).toEqual({ firstTitle: "통역 과정 메모", first: "빨리 말하느라 높임을 놓쳤다", final: "이대로 둔다", finalIsDissentReason: true });
    // 같은 이유를 이견 칸에 다시 싣지 않는다.
    expect(withMemos.dissent?.reason).toBeNull();

    const legacy = buildLearningRecordDetail(row, null, "", () => "");
    expect(legacy.memos).toBeNull();
    expect(legacy.dissent?.reason).toBe("이유");
  });
});
