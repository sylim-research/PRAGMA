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
  ],
};

describe("buildLearningRecordDetail", () => {
  it("orders sections by the learning flow and spells out saved choices", () => {
    const sections = buildLearningRecordDetail(row, mission, "편성 외 수행", (iso) => iso ?? "");
    expect(sections.map((section) => section.title)).toEqual(["상황과 출발텍스트", "MJT 판단", "DCT형 통번역 과제", "이견", "기록 정보"]);
    const mjt = sections[1].lines;
    expect(mjt[0].label).toBe("MJT2 · 이유 보기");
    expect(mjt[0].value).toContain("판단: 매우 적절 → 이유 확인 후 다소 부적절");
    expect(mjt[0].value).toContain("고른 이유: 관계가 멀다");
    expect(mjt[1].value).toContain("고른 수정안: 고친 문장");
    const task = Object.fromEntries(sections[2].lines.map((line) => [line.label, line.value]));
    expect(task["최초 산출"]).toBe("A");
    expect(task["최종 산출"]).toBe("C");
    expect(task["학습자의 결정"]).toBe("수정");
    expect(sections[3].lines[0].value).toContain("관계·친밀도에 대한 다른 판단");
  });

  it("drops empty sections instead of showing placeholders", () => {
    const sections = buildLearningRecordDetail({ ...row, context_judgment: null }, null, "편성 외 수행", () => "");
    expect(sections.map((section) => section.key)).toEqual(["context", "task", "meta"]);
  });
});
