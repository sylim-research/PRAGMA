import { describe, expect, it } from "vitest";

import { REPRESENTATIVE_MISSION_SNAPSHOT } from "@/lib/demo/representativeMissionSnapshot";
import { buildVirtualClassRows, DEMO_LEARNER_ROW } from "@/lib/demo/virtualClassRows";
import { DEMO_FIRST_DRAFT, DEMO_MJT_ANSWERS, DEMO_REVISED_DRAFT } from "@/lib/demo/representativeDemoFeedback";
import { buildClassDiscussion, type CandidatesItemView, type FreeItemView, type ScaleItemView } from "./classDiscussion";

const MISSION_ID = REPRESENTATIVE_MISSION_SNAPSHOT.scenario_id;
const content = REPRESENTATIVE_MISSION_SNAPSHOT.mission_content;
const rows = buildVirtualClassRows(MISSION_ID, content)!;

describe("buildClassDiscussion — 가상 학급 20명(대표 미션)", () => {
  const data = buildClassDiscussion(MISSION_ID, rows, content);

  it("문항을 학습자 제시 순서(1→2→5→3→4)로 늘어놓고 모든 그래프를 같은 20명에서 센다", () => {
    expect(data.learners).toBe(20);
    expect(data.items.map((item) => item.itemId)).toEqual([1, 2, 5, 3, 4]);
    expect(data.items.map((item) => item.activity)).toEqual(["단일 표현 판단", "판단과 이유", "복수 표현 비교", "수정안 선택", "직접 수정"]);
    expect(data.items.every((item) => item.total === 20)).toBe(true);
    expect(data.focus).toBe("완화와 선택권");
    expect(data.speechAct).toBe("request");
  });

  it("MJT1은 척도 순서를 고정한 채 3·7·8·2로 갈린다", () => {
    const item = data.items[0] as ScaleItemView;
    expect(item.kind).toBe("scale");
    expect(item.slices.map((slice) => [slice.key, slice.count])).toEqual([
      ["very_appropriate", 3], ["somewhat_appropriate", 7], ["somewhat_inappropriate", 8], ["very_inappropriate", 2],
    ]);
    expect(item.reasons).toBeNull();
    expect(item.target).toBe("把最终版PPT发到群里吧。");
  });

  it("MJT2 교차표는 같은 판단 안에서도 이유가 갈리고, 이유를 본 뒤 바꾼 판단을 따로 센다", () => {
    const item = data.items[1] as ScaleItemView;
    const reasons = item.reasons!;
    expect(reasons.options.map((option) => option.id)).toEqual(["request-and-deadline", "assumed-acceptance", "earlier-deadline"]);
    expect(reasons.options.reduce((sum, option) => sum + option.count, 0)).toBe(20);
    const inappropriate = reasons.cross.find((row) => row.key === "somewhat_inappropriate")!;
    expect(inappropriate.total).toBe(9);
    expect(Object.values(inappropriate.byReason).filter((count) => count > 0).length).toBeGreaterThanOrEqual(2);
    expect(reasons.revised).toBe(2);
    // 첫 판단 분포는 revised를 덮어쓰지 않는다.
    expect(item.slices.reduce((sum, slice) => sum + slice.count, 0)).toBe(20);
  });

  it("MJT5는 후보마다 범주 분포를 나란히 두고, 첫 후보에서 판단이 갈린다", () => {
    const item = data.items[2] as CandidatesItemView;
    expect(item.kind).toBe("candidates");
    expect(item.bands.map((band) => band.code)).toEqual(["too_direct", "appropriate", "too_indirect"]);
    expect(item.candidates).toHaveLength(4);
    const first = item.candidates[0];
    expect(first.total).toBe(20);
    expect(first.slices.find((slice) => slice.key === "appropriate")?.count).toBe(13);
    expect(first.slices.find((slice) => slice.key === "too_direct")?.count).toBe(6);
    expect(item.candidates[3].slices.find((slice) => slice.key === "too_direct")?.count).toBe(16);
  });

  it("MJT3 수정안 선택과 MJT4 익명 수정문은 미션 본문의 표현만 쓴다", () => {
    const corrections = data.items[3];
    expect(corrections.kind).toBe("corrections");
    if (corrections.kind !== "corrections") return;
    expect(corrections.corrections.map((correction) => correction.count)).toEqual([5, 12, 3]);
    expect(corrections.corrections[1].text).toContain("想麻烦您帮我核实一下");

    const free = data.items[4] as FreeItemView;
    const item4 = content.mpj_items[3] as { reference_alternatives: string[]; contrast: { target: string } };
    const allowed = new Set([...item4.reference_alternatives, item4.contrast.target, "我下课晚，明天的彩排能从七点推迟到七点半吗？"]);
    expect(free.texts.reduce((sum, entry) => sum + entry.count, 0)).toBe(20);
    expect(free.texts.every((entry) => allowed.has(entry.text))).toBe(true);
  });

  it("DCT형 통번역 과제는 수정 여부와 이견 여부를 따로 세고 익명 번호만 남긴다", () => {
    expect(data.dct).toMatchObject({ mode: "translation", total: 20, revised: 10, retained: 10, dissents: 4 });
    expect(data.dissents).toBe(4);
    expect(data.dct.verdicts.map((slice) => [slice.key, slice.count])).toEqual([["too_direct", 14], ["appropriate", 6], ["too_indirect", 0]]);
    const revisedWithDissent = data.dct.cases.filter((item) => item.decision === "revised" && item.dissent);
    expect(revisedWithDissent).toHaveLength(1);
    expect(data.dct.cases.every((item) => /^응답 \d+$/.test(item.id))).toBe(true);
    const dissent = data.dct.cases.find((item) => item.dissent?.conditions.includes("관계·친밀도에 대한 다른 판단"))!;
    expect(dissent.feedback?.band).toBe("너무 직접적");
    expect(dissent.feedback?.scope).toBe("상대에게 주는 인상");
    expect(dissent.final).toBe(dissent.first);
  });
});

describe("buildClassDiscussion — 실제 행", () => {
  it("같은 학습자의 재시도는 최신 행만 세고, 산출이 없는 행은 사례에서 뺀다", () => {
    const envelope = (scale: string) => ({
      schema_version: "mpj_response_v2",
      responses: [{ item_id: 1, item_type: "scale4", scale_code: scale }],
      learner_dissent: null,
    });
    const data = buildClassDiscussion("m", [
      { mission_id: "m", profile_id: "a", completed_at: "2026-09-01T00:00:00Z", context_judgment: envelope("very_appropriate") },
      { mission_id: "m", profile_id: "a", completed_at: "2026-09-02T00:00:00Z", context_judgment: envelope("very_inappropriate") },
      { mission_id: "m", profile_id: "b", completed_at: "2026-09-02T00:00:00Z", context_judgment: envelope("very_inappropriate") },
      { mission_id: "other", profile_id: "c", completed_at: "2026-09-02T00:00:00Z", context_judgment: envelope("very_appropriate") },
    ], content);
    expect(data.learners).toBe(2);
    const item = data.items[0] as ScaleItemView;
    expect(item.slices.find((slice) => slice.key === "very_inappropriate")?.count).toBe(2);
    expect(item.slices.find((slice) => slice.key === "very_appropriate")?.count).toBe(0);
    expect(data.dct.total).toBe(0);
  });

  it("v6 이전 문항 형식은 축별 분포로 그대로 보여 준다", () => {
    const data = buildClassDiscussion("m", [
      { mission_id: "m", profile_id: "a", completed_at: "2026-09-01T00:00:00Z", context_judgment: { responses: [{ item_id: 2, item_type: "judge3", band_code: "too_direct" }] } },
    ], { unit: { target_feature: "request_mitigation_optionality" }, mpj_items: [] });
    expect(data.items[0]).toMatchObject({ kind: "generic", activity: "맥락 대비 판단" });
    if (data.items[0].kind === "generic") expect(data.items[0].groups[0].choices[0].label).toBe("너무 직접적");
  });
});

describe("buildVirtualClassRows", () => {
  it("호출마다 같은 20행을 만들고 v6가 아니면 만들지 않는다", () => {
    expect(rows).toHaveLength(20);
    expect(buildVirtualClassRows(MISSION_ID, content)).toEqual(rows);
    expect(buildVirtualClassRows("x", { schema_version: "mission_v5", mpj_items: [] })).toBeNull();
    expect(rows.every((row) => row.profile_id.startsWith("virtual-"))).toBe(true);
  });
  it("응답 1은 공개 시연 미션의 시연 답안과 글자까지 같다(분포는 그대로)", () => {
    const me = rows[DEMO_LEARNER_ROW];
    const responses = (me.context_judgment as { responses: Array<Record<string, unknown>> }).responses;
    const trace = (id: number) => responses.find((item) => item.item_id === id)!;
    expect(trace(1).scale_code).toBe("very_appropriate");
    expect(trace(2)).toMatchObject({ scale_code: DEMO_MJT_ANSWERS.A2.pick, reason_id: DEMO_MJT_ANSWERS.A2.reasonId });
    expect(trace(2).revised_scale_code).toBeUndefined();
    expect(trace(3).correction_indexes).toEqual([1]);
    expect(trace(4).revised_text).toBe(DEMO_MJT_ANSWERS.A4.text);
    expect(trace(5).candidate_band_codes).toEqual(["too_direct", "appropriate", "appropriate", "too_direct"]);
    expect(me.first_response).toBe(DEMO_FIRST_DRAFT);
    expect(me.revised_response).toBe(DEMO_REVISED_DRAFT);
    expect((me.context_judgment as { learner_dissent: unknown }).learner_dissent).toBeNull();
  });
});
