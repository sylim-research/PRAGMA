// R29 — 미니 담화형 원문 + focal segments (DEC-20260730-01)
// 검사 대상: 유효 글자 수 하드 경계·문장 수 권장 범위, focal segments 구조·부분문자열,
// 그리고 legacy 단문 코어가 면제되는지.
import { describe, expect, it } from "vitest";
import {
  checkCore,
  checkMission,
  countCoreEffectiveChars,
  countSentences,
  coreLengthHintKo,
  type CheckContext,
} from "@/lib/pragma/missionRules";
import { SAMPLE_MISSION_V5 } from "@/lib/mission/missionV4Sample";
import { coreContentForHash, normalizeCore } from "@/lib/pragma/coreSchema";

const SOURCE_3 =
  "지난번에 보내주신 샘플은 잘 받았습니다. 내부 품질 검토 자료로 샘플 하나가 더 꼭 필요해서요. 가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?";

const CTX: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "work_sample_request",
  mode: "translation",
  source_modality: "written",
};

function coreV3(over: Record<string, unknown> = {}) {
  return {
    schema_version: "scenario_core_v3",
    direction: "ko_zh",
    situation_ko:
      "평소 연락하던 거래처 담당자에게 검토용 샘플을 한 부 더 보내 달라고 글로 적어 보낸다. 기록으로 남는 요청이고 담당자가 내부 확인을 거쳐야 한다.",
    relation_ko: "거래처 담당자와 실무로 알고 지내는 관계",
    source_modality: "written",
    source_text: SOURCE_3,
    preceding_turn: null,
    pdr: { p: "equal", d: "acquaintance", r: "mid" },
    focal_segments: [
      { text: "가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?", role: "head" },
    ],
    ...over,
  };
}

const r29 = (core: unknown, ctx: CheckContext = CTX) =>
  checkCore(core, ctx).violations.filter((x) => x.id === "R29");

/**
 * 실제 v5 샘플 미션의 참고 산출안만 바꿔 checkMission을 돌린다.
 * 미션 전체를 손으로 만들지 않고 실 데이터를 재사용해 검사 경로를 그대로 태운다.
 */
const V5_CTX: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "work_delivery_address_change",
  mode: "translation",
  source_modality: "written",
};

function altCoverageViolations(altText: string) {
  const mission = {
    ...SAMPLE_MISSION_V5,
    production_task: {
      ...SAMPLE_MISSION_V5.production_task,
      reference_alternatives: [{ text: altText, note_ko: "테스트용" }],
    },
  };
  return checkMission(mission, V5_CTX).violations.filter((x) => x.id === "R29");
}

describe("countSentences", () => {
  it("종결 부호로 문장을 센다", () => {
    expect(countSentences(SOURCE_3)).toBe(3);
    expect(countSentences("한 문장입니다.")).toBe(1);
    expect(countSentences("부호 없이 끝나는 문장")).toBe(1);
    expect(countSentences("你好。今天可以吗？")).toBe(2);
  });
});

describe("coreLengthHintKo — 생성 안내는 R29 글자 수 정책에서 파생된다", () => {
  it("수준·모드별로 다른 유효 글자 범위를 안내한다", () => {
    expect(coreLengthHintKo("beginner_intermediate", "translation")).toContain("45~65자");
    expect(coreLengthHintKo("intermediate", "translation")).toContain("60~85자");
    expect(coreLengthHintKo("advanced", "stt_interpreting")).toContain("55~85자");
    expect(coreLengthHintKo("advanced", "stt_interpreting")).toContain("2~4문장");
  });
  it("통역 안내에는 기억 부담 경계가 붙는다", () => {
    expect(coreLengthHintKo("intermediate", "stt_interpreting")).toContain("기억 과부하");
  });

  it("공백·문장부호를 제외해 원문 부담을 센다", () => {
    expect(countCoreEffectiveChars(SOURCE_3)).toBe(61);
  });
});

describe("R29 focal segments", () => {
  it("정상 미니 담화 코어는 R29 위반이 없다", () => {
    expect(r29(coreV3())).toHaveLength(0);
  });

  it("글자 수 하한보다 짧은 한 문장 원문은 minimum warning", () => {
    const v = r29(coreV3({ source_text: "샘플 하나 더 보내주실 수 있을까요?", focal_segments: [{ text: "샘플 하나 더 보내주실 수 있을까요?", role: "head" }] }));
    expect(v).toContainEqual(expect.objectContaining({
      level: "warning",
      evidence: expect.objectContaining({ subrule: "minimum_length", actual: 14, threshold: 60 }),
    }));
    expect(v.some((x) => x.level === "fail")).toBe(false);
  });

  it("글자 수 상한을 넘으면 maximum hard fail", () => {
    const source = `${SOURCE_3} 내부 검토가 끝난 뒤에도 추가 자료의 필요성과 제출 시점을 다시 확인해 주시면 감사하겠습니다.`;
    const v = r29(coreV3({ source_text: source }));
    expect(v).toContainEqual(expect.objectContaining({
      level: "fail",
      evidence: expect.objectContaining({ subrule: "maximum_length", threshold: 85 }),
    }));
  });

  it("원문에 없는 구간은 fail", () => {
    const v = r29(coreV3({ focal_segments: [{ text: "원문에 없는 문장", role: "head" }] }));
    expect(v.some((x) => x.level === "fail" && x.message.includes("부분문자열"))).toBe(true);
  });

  it("head가 2개면 fail", () => {
    const v = r29(
      coreV3({
        focal_segments: [
          { text: "지난번에 보내주신 샘플은 잘 받았습니다.", role: "head" },
          { text: "가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?", role: "head" },
        ],
      }),
    );
    expect(v.some((x) => x.level === "fail" && x.message.includes("head"))).toBe(true);
  });

  it("support가 3개여도 개수만으로 fail하지 않는다(상한 없음)", () => {
    const v = r29(
      coreV3({
        focal_segments: [
          { text: "오늘 중으로 하나 더 보내주실 수 있을까요?", role: "head" },
          { text: "가능하시다면", role: "support" },
          { text: "내부 품질 검토 자료로 샘플 하나가 더 꼭 필요해서요.", role: "support" },
          { text: "지난번에 보내주신 샘플은 잘 받았습니다.", role: "support" },
        ],
      }),
    );
    expect(v.filter((x) => x.level === "fail")).toEqual([]);
  });

  it("head가 없으면 fail", () => {
    const v = r29(coreV3({ focal_segments: [{ text: "내부 검토에 하나가 더 필요해서요.", role: "support" }] }));
    expect(v.some((x) => x.level === "fail")).toBe(true);
  });

  it("글자 수 범위 안에서 문장 수만 벗어나면 warning", () => {
    const five = SOURCE_3 + " 감사합니다. 부탁드립니다.";
    const v = r29(coreV3({ source_text: five }));
    expect(v.some((x) => x.level === "fail")).toBe(false);
    expect(v.some((x) => x.level === "warning" && x.message.includes("2~4문장"))).toBe(true);
  });

  it("legacy 단문 코어(v2)는 R29 면제 — focal_segments 부재", () => {
    const v2 = { ...coreV3(), schema_version: "scenario_core_v2", source_text: "샘플 하나 더 보내주실 수 있을까요?" };
    delete (v2 as Record<string, unknown>).focal_segments;
    expect(r29(v2)).toHaveLength(0);
  });
});

describe("normalizeCore — v3 상위집합 정규화", () => {
  it("v2는 focal_segments 없이 v3로 승격된다", () => {
    const v2 = { ...coreV3(), schema_version: "scenario_core_v2" };
    delete (v2 as Record<string, unknown>).focal_segments;
    const n = normalizeCore(v2);
    expect(n.ok).toBe(true);
    expect(n.data?.schema_version).toBe("scenario_core_v3");
    expect(n.data?.focal_segments).toBeUndefined();
  });

  it("v3는 focal_segments를 보존한다", () => {
    const n = normalizeCore(coreV3());
    expect(n.ok).toBe(true);
    expect(n.data?.focal_segments).toHaveLength(1);
    expect(n.data?.focal_segments?.[0].role).toBe("head");
  });

  it("길이 정책 스냅샷은 정규화하되 콘텐츠 동일성 hash 입력에서는 제외한다", () => {
    const lengthPolicy = {
      version: "effective_chars_v2_min_warning",
      unit: "effective_chars" as const,
      min: 60,
      max: 85,
      actual: 61,
    };
    const n = normalizeCore(coreV3({ length_policy: lengthPolicy }));

    expect(n.ok).toBe(true);
    expect(n.data?.length_policy).toEqual(lengthPolicy);
    expect(coreContentForHash(n.data ?? {})).not.toHaveProperty("length_policy");
    expect(
      coreContentForHash({
        ...(n.data ?? {}),
        generation: {
          content_release_id: "candidate",
          prompt_version: "core_v8",
          prompt_snapshot_hash: "hash",
          generated_at: "now",
        },
      }),
    ).not.toHaveProperty("generation");
  });
});

// mission_v5는 MPJ 구성·순서·판정이 v4와 동일하다(DEC-20260730-01). 버전 분기가
// v4만 보면 v5는 조용히 legacy(V2) 기준으로 검사돼 전 화행이 R1 fail이 된다 —
// 2026-07-30 9화행 표본 생성에서 실제로 그렇게 나왔다. R29만 보던 기존 검사로는
// 잡히지 않았으므로 fail 전량을 본다.
describe("mission_v5는 v4 계약 검사를 그대로 통과한다", () => {
  it("정상 v5 미션에는 fail 위반이 없다", () => {
    const checked = checkMission(SAMPLE_MISSION_V5, V5_CTX);
    expect(checked.violations.filter((x) => x.level === "fail")).toEqual([]);
  });

  it("유형 순서를 흐트러뜨리면 v5도 R1 fail이다 — 검사 면제가 아니다", () => {
    const items = SAMPLE_MISSION_V5.mpj_items;
    const swapped = {
      ...SAMPLE_MISSION_V5,
      mpj_items: [items[1], items[0], items[2], items[3]],
    };
    expect(
      checkMission(swapped, V5_CTX).violations.some((x) => x.id === "R1" && x.level === "fail"),
    ).toBe(true);
  });
});

describe("R29 reference_alternatives 담화 커버리지 (2026-07-30 실화면 회귀)", () => {
  it("중심 화행만 옮긴 참고안은 warning으로 잡힌다", () => {
    const short = altCoverageViolations("请问这次订单的收货地址方便改成我们的新办公室吗？");
    expect(short.some((x) => x.level === "warning" && x.message.includes("담화 전체"))).toBe(true);
  });

  it("담화 전체를 옮긴 참고안은 warning이 없다", () => {
    const full = altCoverageViolations(
      "上次的订单已经收到了，谢谢。不过我们这周开始要搬办公室，如果方便的话，这次订单的收货地址能改成我们的新办公室吗？麻烦您了，实在不好意思。",
    );
    expect(full.some((x) => x.message.includes("담화 전체"))).toBe(false);
  });
});
