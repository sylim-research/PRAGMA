import { describe, expect, it } from "vitest";
import { MissionV6Schema } from "@/lib/pragma/missionV6";
import { SAMPLE_MISSION_V5_NATIVE } from "./missionV4Sample";
import { convertMissionV5ToV6 } from "./missionV5ToV6";

const v5 = SAMPLE_MISSION_V5_NATIVE as any;
const item = (type: string) => v5.mpj_items.find((i: any) => i.type === type);

describe("v5 native → v6 변환이 옮기는 것과 남기는 것", () => {
  const { draft, gaps } = convertMissionV5ToV6(SAMPLE_MISSION_V5_NATIVE, { speechAct: "request" });
  const items = draft.mpj_items as any[];

  it("판정·교정안·대역·해설을 저장본 그대로 옮긴다", () => {
    expect(items[0].accepted_scale_codes).toEqual(item("scale4").accepted_scale_codes);
    expect(items[0].reference_scale_code).toBe(item("scale4").reference_scale_code);
    // 판정에 쓰는 세 필드만 옮기고 v5의 여분 필드는 떨군다.
    expect(items[2].corrections).toEqual(item("fix_choice").corrections.map((c: any) =>
      ({ text: c.text, is_valid: c.is_valid, note_ko: c.note_ko })));
    expect(items[4].candidates).toEqual(item("multi_judge").candidates.map((c: any) =>
      ({ text: c.text, accepted_band_codes: c.accepted_band_codes, note_ko: c.note_ko })));
    expect(items[4].candidates[0]).not.toHaveProperty("comparison_role");
    expect(items[1].situation_ko).toBe(item("judge3").situation_ko);
    expect(items[1].reason_choice.options).toEqual(
      item("reason").reasons.map((r: any) => ({ id: r.id, text: r.text_ko })),
    );
    expect(draft.unit).toEqual(v5.unit);
  });

  it("v6가 쓰지 않는 v5 필드를 끌고 오지 않는다", () => {
    for (const entry of items) {
      for (const dropped of ["axis_feature", "highlights", "item_focus", "recommended_example", "preceding_turn"]) {
        expect(entry).not.toHaveProperty(dropped);
      }
    }
    expect(draft).not.toHaveProperty("contrast_plan");
    expect(draft).not.toHaveProperty("diagnostic_dimensions");
    expect((draft.production_task as any).preceding_turn).toBeNull();
  });

  it("승인본에서 상수로 굳은 자리는 규칙으로 채운다", () => {
    expect(items.map((entry: any) => entry.short_label)).toEqual(["첫인상 판단", "맥락 판단", "선택교정", "직접 고쳐 보기", "네 표현 비교"]);
    expect(items[0].prompt).toBe(items[1].prompt);
    expect(items[1].reason_choice.prompt).toBe("가장 큰 이유는 무엇인가요?");
    // v5 topology X→A→A→A→Y: judge3는 within 밖이므로 승인본 여섯 건과 같은 척도.
    expect(item("judge3").accepted_band_codes).not.toContain("within_band");
    expect(items[1].accepted_scale_codes).toEqual(["somewhat_inappropriate", "very_inappropriate"]);
    expect(items[1].reference_scale_code).toBe("somewhat_inappropriate");
    // judge3의 권장 예시는 수정 예시로, reason의 해설은 2번 해설 뒤에 붙는다.
    expect(items[1].revision_examples).toEqual([item("judge3").recommended_example]);
    expect(items[1].explanation_ko).toContain(item("reason").explanation_ko);
  });

  it("사람이 써야 하는 자리를 빠짐없이 보고한다", () => {
    const paths = gaps.map(gap => gap.path);
    // 문항 다섯 개의 제목 + 4번 문항 전체(장면·관계·PDR·원문·대상·참고안·해설) + 핵심 다섯 줄.
    expect(paths).toHaveLength(5 + 7 + 5);
    expect(paths).toContain("mpj_items[1].title");
    expect(paths).toContain("mpj_items[3].target");
    expect(paths).toContain("lesson_points[0]");
    // 옮겨오거나 규칙으로 채운 자리는 gap이 아니다.
    expect(paths).not.toContain("mpj_items[2].corrections");
    expect(paths).not.toContain("mpj_items[4].candidates");
    expect(paths).not.toContain("mpj_items[1].accepted_scale_codes");
    expect(paths).not.toContain("mpj_items[0].prompt");
  });

  it("빈 채로는 스키마를 통과하지 못하고, 자리를 채우면 통과한다", () => {
    expect(MissionV6Schema.safeParse(draft).success).toBe(false);

    const filled = structuredClone(draft) as any;
    filled.mpj_items.forEach((entry: any, index: number) => {
      entry.short_label = `문항 ${index + 1}`;
      entry.title = `제목 ${index + 1}`;
      entry.prompt = "지금 할 일";
    });
    filled.mpj_items[1].accepted_scale_codes = ["somewhat_inappropriate"];
    filled.mpj_items[1].reference_scale_code = "somewhat_inappropriate";
    filled.mpj_items[1].reason_choice.prompt = "가장 큰 이유는 무엇인가요?";
    const fourth = filled.mpj_items[3];
    fourth.situation_ko = "새로 쓴 장면";
    fourth.relation_ko = "새로 쓴 관계";
    fourth.source = "새로 쓴 원문";
    fourth.target = "새로 쓴 번역안";
    fourth.reference_alternatives = ["새로 쓴 참고 답안"];
    fourth.explanation_ko = "새로 쓴 해설";
    filled.lesson_points = filled.lesson_points.map((point: any) => ({ ...point, label: "핵심", text: "한 줄" }));
    filled.provenance = { ...filled.provenance, prompt_version: "v5_to_v6_conversion_test" };

    const parsed = MissionV6Schema.safeParse(filled);
    expect(parsed.success ? [] : parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });

  it("다섯 문항이 갖춰지지 않은 저장본은 변환하지 않는다", () => {
    const missing = structuredClone(v5);
    missing.mpj_items = missing.mpj_items.filter((i: any) => i.type !== "judge3");
    expect(() => convertMissionV5ToV6(missing)).toThrow();
  });
});
