// 화용 초점(target_feature) 카탈로그 — 코드 정본. AI 임의 생성 금지.
//
// 생성계약 v1.3 §2. 축·대역은 화행 공통이 아니라 "화용 초점별"이다(A1):
// 요청의 대역(too_direct/within_band/too_indirect)과 감사의 대역
// (insufficient/within_band/excessive)은 서로 다른 자로 잰다. 문항·피드백은
// 모두 이 카탈로그의 band code를 쓴다(R1·R13).
//
// learner_label·closing_principle_ko는 AI가 생성하지 않고 이 파일에서 복사한다(R14).
//
// v1.3 시드 = 참조 미션 3개(요청·거절·감사 × 중급)에 필요한 3종 + 공손성 보조축.
// v1.4 = 나머지 6화행 7종(칭찬하기·칭찬 대응 분리)을 사람 작성 정본으로 추가.

import type { SpeechActUI } from "@/lib/pragma/enums";
import { realizationResourceLabelsForFeature } from "@/lib/pragma/realizationPack";

/** 판정 대역 하나. 배열 순서 = 척도 순서(과소→적정→과잉). */
export interface BandDef {
  code: string;
  label_ko: string;
}

/** MPJ5 뒤 학습자가 실제로 가져갈 판단 기준. AI 생성 없이 카탈로그에서 복사한다. */
export interface HandoffSummaryCopy {
  first_impression: string;
  /** 네이티브 mission_v5의 독립 맥락 대비 판단. 미지정 카탈로그는 공통 문구를 쓴다. */
  context_contrast?: string;
  correction: string;
  reason: string;
  compare_low: string;
  compare_high: string;
}

/** 모든 초점 공용 — 충실성은 대역 판정의 선행 조건이고, 대역은 핵심 내용을 유지한 상태에서 화행의 대인적 힘을 본다(2026-09-17 교차검증 v2). */
const FIDELITY_NOTE =
  "원문의 사실·사유·조건·약속 등 핵심 내용의 보존은 대역 판정의 선행 조건이다. 과소/적정/과잉 대역은 핵심 내용을 유지한 상태에서 화행의 대인적 힘과 기능이 목표 상황에 어떻게 실현되었는지를 본다. 원문 밖 사실·약속의 추가나 핵심 내용 누락은 대역 차이가 아니라 별도의 충실성 문제로 판정한다.";

export interface TargetFeature {
  /** 안정 식별자 — 문항·행에 저장(R13). 예: "request_mitigation_optionality" */
  code: string;
  /** 카탈로그 버전 — 문항에 함께 저장(R13). 정의가 바뀌면 올린다. */
  version: string;
  speech_act: SpeechActUI;
  /** 학습자 화면 "이번 주 핵심" — AI 생성 금지, 여기서 복사(R14) */
  learner_label: string;
  /** 이 초점이 무엇이고 무엇이 아닌지 — 생성 프롬프트에 주입 */
  operational_definition: string;
  /** 판정 축 — 화행·초점별로 다르다(A1). 순서 = 척도 순서 */
  band_schema: BandDef[];
  /** within_band에 해당하는 코드(정답 대역의 중심). 규칙검사 R2가 참조 */
  within_band_code: string;
  /** 이 초점을 실현하는 장치 — 프롬프트가 산출 정합에 사용 */
  relevant_resources: string[];
  /** 이 초점이 아닌 것 — 혼입 방지(예: 격식체 어휘 선택은 직접성 축이 아님) */
  excluded_confounds: string[];
  /** 완료 화면 핵심 한 줄 — AI 생성 금지, 여기서 복사(R14) */
  closing_principle_ko: string;
  /** MPJ→DCT handoff의 네 줄 개념 정리 — 방향·모드 공용 */
  handoff_summary: HandoffSummaryCopy;
  /** judge3 반례가 깨야 할 "소박한 규칙"(A1 일반화) */
  counter_rule_note: string;
  /** 「선택적 자원」의 적용 범위 — 형태 비의무이지 내용·기능 생략 허용이 아님(DEC 2026-09-17, GPT 교차검증). 화행 공용 */
  fidelity_note: string;
  // ── zh_ko(중→한) 방향 변형 (계약 0-l·86, 선택 — 없으면 zh_ko 승격 불가) ──
  // 구인 동일(상황 P·D·R 화용 적절성), 산출 장치만 한국어. version·band·within·
  // learner_label·closing은 방향 공용이라 여기엔 없다(비파괴 확장, version 불변).
  operational_definition_zh_ko?: string;
  relevant_resources_zh_ko?: string[];
  excluded_confounds_zh_ko?: string[];
  counter_rule_note_zh_ko?: string;
}

// ── 요청 · 완화와 선택권 ──────────────────────────────────────────────
const REQUEST_MITIGATION_OPTIONALITY: TargetFeature = {
  code: "request_mitigation_optionality",
  version: "1.1",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "request",
  learner_label: "완화와 선택권",
  operational_definition:
    "주어진 상황의 관계·권리·의무·부담에 비춰 요청의 직접성과 상대의 선택권이 알맞은지 보는 초점. 능원동사·의문형·조건절(能不能·可以…吗·如果方便的话)과 직접형(把…发过来)은 맥락에 따라 기능이 달라지는 선택적 자원이다. 표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다. " +
    "친밀·저부담도 직접형의 자동 정답 조건이 아니다. 실제 표현이 요청을 얼마나 분명히 전달하고 상대에게 어떤 조정 여지를 남기는지 상황 근거와 함께 본다. 원문의 명제·의도·화행 목적을 보존하고, 원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다. " +
    "격식체 어휘 선택(尊敬的·恳请)이나 호칭 문제는 이 초점이 아니다 — 그것은 공손성 축이다.",
  band_schema: [
    { code: "too_direct", label_ko: "너무 직접적 (상황에 비해 단정적)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "too_indirect", label_ko: "지나치게 우회적 (요청이 흐려짐)" },
  ],
  within_band_code: "within_band",
  relevant_resources: realizationResourceLabelsForFeature("request_mitigation_optionality"),
  excluded_confounds: [
    "격식체 어휘 선택 (尊敬的·恳请) — 공손성 축",
    "호칭 (您 vs 你) — 공손성 축",
    "문장 길이 자체",
  ],
  closing_principle_ko:
    "요청은 표현형이나 친밀도만으로 판단하지 않습니다. 원문의 뜻을 지키며 상황에 필요한 명료성과 상대의 선택권을 함께 살핍니다.",
  handoff_summary: {
    first_impression: "관계·권리·의무와 실제 부담에 비춰 요청 표현을 살폈습니다.",
    correction: "원문의 뜻을 지키며 요청의 명료성과 상대의 선택권을 조절했습니다.",
    reason: "표현형만으로 판단하지 않고 상황에서 요청을 어떻게 받아들일지 살폈습니다.",
    compare_low: "상황에 잘 맞는 안과 선택권을 거의 남기지 않은 안을 구분했습니다.",
    compare_high: "상황에 잘 맞는 안과 요청이 흐려질 만큼 우회적인 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"직접적이면 나쁘다\"의 반례를 설계한다. 이미 합의한 보고서 전달을 짧게 재확인하는 장면에서는 직접형(把报告发我)도 적절할 수 있다. 친밀·저부담 라벨이 아니라 실제 상황과 표현에서 근거를 제시한다.",
  operational_definition_zh_ko:
    "주어진 상황의 관계·권리·의무·부담에 비춰 한국어 요청의 직접성과 선택권이 알맞은지 보는 초점. 의문형(-아/어 주실 수 있을까요), 조건절(혹시 괜찮으시면), 직접형(-해 주세요·-하세요)은 맥락에 따라 기능이 달라지는 선택적 자원이다. 표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다. " +
    "친밀·저부담도 직접형의 자동 정답 조건이 아니다. 실제 표현의 요청 명료성과 조정 여지를 상황 근거와 함께 본다. 원문의 명제·의도·화행 목적을 보존하고, 원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다. " +
    "높임 등급 선택(합쇼체/해요체·-님 호칭)은 이 초점이 아니다 — 공손성 축이다.",
  relevant_resources_zh_ko: [
    "의문형 완화 (-아/어 주실 수 있을까요·-아/어도 될까요·-면 안 될까요)",
    "조건절 포석 (혹시 괜찮으시면·시간 되시면·바쁘지 않으시면)",
    "가능성 완충 (혹시·어쩌면·-ㄹ 수 있을지)",
    "부담 예고 (번거로우시겠지만·부탁 하나 드려도 될까요·죄송한데)",
  ],
  excluded_confounds_zh_ko: [
    "높임 등급·경어 선택 (합쇼체/해요체·-님/-씨 호칭) — 공손성 축",
    "문장 길이 자체",
  ],
  counter_rule_note_zh_ko:
    "\"직접적이면 나쁘다\"의 반례를 설계한다. 이미 합의한 파일 전달을 짧게 재확인하는 장면에서는 직접형(\"그 파일 좀 보내 줘\")도 적절할 수 있다. 친밀·저부담 라벨이 아니라 실제 상황과 표현에서 근거를 제시한다.",
};

// ── 거절 · 완충과 대안 ────────────────────────────────────────────────
const REFUSAL_SOFTENING: TargetFeature = {
  code: "refusal_softening",
  version: "1.1",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "refusal",
  learner_label: "완충과 대안",
  operational_definition:
    "상황에 제시된 요청·제안·초대와 관계에 비춰 거절의 명료성과 대인 배려를 함께 보는 초점. 직접적 부정(不行·不可以), 이유·사과·대안(恐怕·可以…但是·下次)은 선택적 자원이며 표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다. " +
    "완충의 유무나 양 대신 실제 표현이 상황에 필요한 배려를 놓치는지(too_blunt), 알맞은지(within_band), 과한 설명이나 유보로 거절의 전달을 어렵게 하는지(over_elaborate)를 본다. 원문의 명제·의도·화행 목적을 보존하고, 원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다. 거절을 수락으로 바꾸는 것은 대역 차이가 아니라 목적 이탈이다.",
  band_schema: [
    { code: "too_blunt", label_ko: "너무 단칼 (상황에 필요한 배려 부족)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "over_elaborate", label_ko: "지나치게 장황 (거절이 흐려짐)" },
  ],
  within_band_code: "within_band",
  relevant_resources: realizationResourceLabelsForFeature("refusal_softening"),
  excluded_confounds: [
    "격식체 어휘 선택 — 공손성 축",
    "거절의 명제 자체(무엇을 거절하는가)는 불변항",
    "문장 길이 자체",
  ],
  closing_principle_ko:
    "거절은 완충 장치의 수보다 상황에서 하는 역할을 봅니다. 거절의 뜻을 지키며 필요한 배려를 조절하고, 없는 사유나 약속을 덧붙이지 않습니다.",
  handoff_summary: {
    first_impression: "무엇을 거절하는지와 관계를 확인하고 표현의 역할을 살폈습니다.",
    correction: "거절의 뜻을 지키며 필요한 배려를 조절하고 없는 약속은 더하지 않았습니다.",
    reason: "완충 장치의 수가 아닌 실제 표현과 상황에서 판단 근거를 찾았습니다.",
    compare_low: "알맞게 완충한 안과 너무 단칼인 안을 구분했습니다.",
    compare_high: "알맞게 완충한 안과 거절이 흐려질 만큼 장황한 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"거절은 길수록 공손하다\"의 반례를 설계한다. 일정 제약을 이미 공유하고 즉답을 요청받은 장면에서는 간결한 거절(今天不行)도 적절할 수 있다. 길이나 완충량 대신 실제 상황에서 거절과 배려가 전달되는 근거를 제시한다.",
  operational_definition_zh_ko:
    "상황에 제시된 요청·제안·초대와 관계에 비춰 한국어 거절의 명료성과 대인 배려를 함께 보는 초점. 직접적 부정(안 돼요·못 해요), 유보(좀 어려울 것 같아요), 사과·유감·이유·대안은 선택적 자원이며 표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다. " +
    "완충의 유무나 양 대신 실제 표현이 상황에 필요한 배려를 놓치는지(too_blunt), 알맞은지(within_band), 과한 설명이나 유보로 거절의 전달을 어렵게 하는지(over_elaborate)를 본다. 원문의 명제·의도·화행 목적을 보존하고, 원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다. 거절을 수락으로 바꾸는 것은 대역 차이가 아니라 목적 이탈이다.",
  relevant_resources_zh_ko: [
    "유보·완화 표현 (좀 어려울 것 같아요·-기는 힘들 것 같아요·아무래도 -겠는데요)",
    "사과·유감 (죄송하지만·아쉽지만·미안한데)",
    "이유 제시 (-아/어서·그날은 선약이 있어서)",
    "대안·미래 약속 (다음에는 꼭·대신 -면 어떨까요·요일을 바꾸면 어때요)",
    "부분 수용 후 전환 (그건 좋은데·-는 되는데 -는 어려워요)",
  ],
  excluded_confounds_zh_ko: [
    "높임 등급·경어 선택 — 공손성 축",
    "거절의 명제 자체(무엇을 거절하는가)는 불변항",
    "문장 길이 자체",
  ],
  counter_rule_note_zh_ko:
    "\"거절은 길수록 공손하다\"의 반례를 설계한다. 일정 제약을 이미 공유하고 즉답을 요청받은 장면에서는 간결한 거절(\"오늘은 안 되겠어요\")도 적절할 수 있다. 길이나 완충량 대신 실제 상황에서 거절과 배려가 전달되는 근거를 제시한다.",
};

// ── 감사 · 강도 조절 ──────────────────────────────────────────────────
const GRATITUDE_CALIBRATION: TargetFeature = {
  code: "gratitude_calibration",
  version: "1.1",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "thanks",
  learner_label: "강도 조절",
  operational_definition:
    "주어진 관계·도움의 내용·상황에서 감사의 뜻과 강도가 알맞게 전달되는지 보는 초점. 谢谢·강조·반복·구체화는 선택적 자원이며 표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다. " +
    "호의 크기에 강도를 기계적으로 비례시키거나 谢谢만으로 부족하다고 판정하지 않는다. 실제 표현이 감사의 뜻을 충분히 전달하는지, 상황에 비해 과장되거나 의도치 않은 보답 부담을 만드는지 근거를 들어 판단한다. 원문의 명제·의도·화행 목적을 보존하고, 원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다.",
  band_schema: [
    { code: "insufficient", label_ko: "부족함 (상황에서 감사 전달이 미흡)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "excessive", label_ko: "과함 (상황에 비해 과장됨)" },
  ],
  within_band_code: "within_band",
  relevant_resources: realizationResourceLabelsForFeature("gratitude_calibration"),
  excluded_confounds: [
    "호칭·격식 — 공손성 축",
    "감사의 대상(무엇에 감사하는가)은 불변항",
  ],
  closing_principle_ko:
    "감사는 관계와 도움을 받은 상황에서 뜻이 충분히 전달되는지 살핍니다. 도움의 크기나 표현의 길이·반복만으로 강도를 정하지 않습니다.",
  handoff_summary: {
    first_impression: "관계와 도움을 받은 상황에서 감사의 뜻이 충분히 전달되는지 살폈습니다.",
    correction: "원문의 뜻을 지키며 감사 표현을 조절하고 없는 보답 약속은 더하지 않았습니다.",
    reason: "도움의 크기나 표현의 반복만으로 감사의 적절성이 정해지지 않음을 살폈습니다.",
    compare_low: "상황에 맞는 감사와 감사의 뜻을 충분히 전달하지 못하는 안을 구분했습니다.",
    compare_high: "상황에 맞는 감사와 불필요하게 과장된 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"감사는 강할수록 좋다\"의 반례를 설계한다. 도움의 내용을 서로 알고 감사의 뜻이 분명히 전달되는 장면에서는 간단한 감사(谢谢)도 충분할 수 있다. 호의 크기나 반복 수가 아니라 실제 상황과 표현에서 근거를 제시한다.",
  operational_definition_zh_ko:
    "주어진 관계·도움의 내용·상황에서 한국어 감사의 뜻과 강도가 알맞게 전달되는지 보는 초점. 고마워요·감사합니다·강조·반복·구체화는 선택적 자원이며 표현형·표지 수·PDR 라벨만으로 적절성을 결정하지 않는다. " +
    "호의 크기에 강도를 기계적으로 비례시키거나 간단한 감사만으로 부족하다고 판정하지 않는다. 실제 표현이 감사의 뜻을 충분히 전달하는지, 상황에 비해 과장되거나 의도치 않은 보답 부담을 만드는지 근거를 들어 판단한다. 원문의 명제·의도·화행 목적을 보존하고, 원문·상황·허용된 사실에 없는 사유·조건·약속을 만들지 않는다.",
  relevant_resources_zh_ko: [
    "강도 부사·서법 (정말·너무·진심으로 감사드립니다)",
    "부연·구체화 (덕분에 일이 잘 풀렸어요·큰 도움이 됐어요)",
    "보답 의향 (다음에 꼭 밥 살게·신세 갚을게요)",
    "간단한 감사 (고마워요·감사합니다)",
  ],
  excluded_confounds_zh_ko: [
    "호칭·높임 등급 — 공손성 축",
    "감사의 대상(무엇에 감사하는가)은 불변항",
  ],
  counter_rule_note_zh_ko:
    "\"감사는 강할수록 좋다\"의 반례를 설계한다. 도움의 내용을 서로 알고 감사의 뜻이 분명히 전달되는 장면에서는 간단한 감사(\"고마워요\")도 충분할 수 있다. 호의 크기나 반복 수가 아니라 실제 상황과 표현에서 근거를 제시한다.",
};

// ── 사과 · 책임 인정과 수리 ────────────────────────────────────────────
const APOLOGY_ACCOUNTABILITY_REPAIR: TargetFeature = {
  code: "apology_accountability_repair",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "apology",
  learner_label: "책임 인정과 수리",
  operational_definition:
    "위반·피해에 대한 유감, 화자의 책임 범위, 필요한 수리의 무게를 상황에 맞추는 초점. 사과 공식만 반복하고 책임·영향을 비껴가는가, 사실과 R에 맞게 인정하는가, 또는 실제 책임과 피해를 넘어 과도한 책임·보상·약속을 떠안는가를 본다. " +
    "설명·수리·재발 방지 약속은 원문 또는 서버가 허용한 usable_facts에 있을 때만 사용할 수 있다.",
  band_schema: [
    { code: "under_acknowledged", label_ko: "부족함 (책임·영향을 충분히 인정하지 않음)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "overextended", label_ko: "과함 (책임·수리를 실제보다 확대함)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "사과 공식 (对不起·不好意思·抱歉)",
    "책임 인정 (是我没确认好·这件事是我的疏忽)",
    "상대 영향 인정 (给您添麻烦了·让你久等了)",
    "허용된 수리 제안 (我马上处理·费用由我承担)",
    "허용된 재발 방지 약속 (以后我会提前确认)",
  ],
  excluded_confounds: [
    "사과 공식의 개수나 문장 길이 자체",
    "호칭·격식체 선택 — 공손성 축",
    "원문·usable_facts에 없는 이유·보상·새 약속",
    "설명의 유무를 책임 인정과 자동 등치하는 것",
  ],
  closing_principle_ko:
    "사과는 세게 말하는 것이 아니라, 실제 책임과 상대가 받은 영향에 맞게 인정하고 필요한 수리를 제시할 때 적절합니다.",
  handoff_summary: {
    first_impression: "실제 책임과 영향에 이 사과의 무게가 맞는지 살폈습니다.",
    correction: "사과 표현만 늘리지 않고 책임·영향·허용된 수리를 조절했습니다.",
    reason: "책임을 비껴가거나 사실보다 확대하면 적절한 사과가 되지 않음을 찾았습니다.",
    compare_low: "책임을 알맞게 인정한 안과 책임·영향 인정이 부족한 안을 구분했습니다.",
    compare_high: "책임을 알맞게 인정한 안과 책임·수리를 실제보다 확대한 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"사과는 길고 강할수록 좋다\" — 반례: 사소하고 즉시 회복된 실수에는 간결한 책임 인정과 사과가 과도한 보상 약속보다 자연스럽다.",
  operational_definition_zh_ko:
    "위반·피해에 대한 유감, 화자의 책임 범위, 필요한 수리의 무게를 한국어 산출에서 상황에 맞추는 초점. 사과 표현만 반복하고 책임·영향을 비껴가는가, 사실과 R에 맞게 인정하는가, 또는 실제 책임과 피해를 넘어 과도한 책임·보상·약속을 떠안는가를 본다. " +
    "설명·수리·재발 방지 약속은 원문 또는 서버가 허용한 usable_facts에 있을 때만 사용할 수 있다.",
  relevant_resources_zh_ko: [
    "사과 공식 (미안해요·죄송합니다·사과드립니다)",
    "책임 인정 (제가 확인을 놓쳤습니다·제 실수였습니다)",
    "상대 영향 인정 (불편을 드렸습니다·오래 기다리게 했습니다)",
    "허용된 수리 제안 (바로 처리하겠습니다·제가 비용을 부담하겠습니다)",
    "허용된 재발 방지 약속 (앞으로는 미리 확인하겠습니다)",
  ],
  excluded_confounds_zh_ko: [
    "사과 공식의 개수나 문장 길이 자체",
    "높임 등급·호칭 — 공손성 축",
    "원문·usable_facts에 없는 이유·보상·새 약속",
    "설명의 유무를 책임 인정과 자동 등치하는 것",
  ],
  counter_rule_note_zh_ko:
    "\"사과는 길고 강할수록 좋다\" — 반례: 사소하고 즉시 회복된 실수에는 \"제가 놓쳤네요. 미안해요\"처럼 간결한 책임 인정이 과도한 보상 약속보다 자연스럽다.",
};

// ── 제안 · 선택지와 방안 명료성 ────────────────────────────────────────
const PROPOSAL_OPTIONALITY_CLARITY: TargetFeature = {
  code: "proposal_optionality_clarity",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "proposal",
  learner_label: "선택지와 방안 명료성",
  operational_definition:
    "상대 또는 공동의 미래 행동 방안을 선택 가능한 안으로 분명히 제시하는 초점. 화자가 이미 정한 지시처럼 밀어붙이는가, 결정권을 존중하면서 실행할 안을 식별 가능하게 제시하는가, 또는 유보가 지나쳐 무엇을 제안하는지 흐려지는가를 본다. " +
    "직접성 자체가 아니라 제안의 선택 가능성과 명료성을 함께 판단한다.",
  band_schema: [
    { code: "too_directive", label_ko: "지시적임 (제안을 확정된 결정처럼 제시함)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "too_tentative", label_ko: "지나치게 유보적 (제안 내용이 흐려짐)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "제안 공식 (不如…·要不要…·我建议…)",
    "검토 가능성 (可以考虑…·我们是不是可以…)",
    "조건·범위 한정 (如果…的话·先…再…)",
    "허용된 근거와 예상 효과",
  ],
  excluded_confounds: [
    "상대 행동을 요구하는 요청·지시",
    "화자의 단독 결정 또는 통보",
    "근거 문장 수나 표현 길이 자체",
    "격식체 선택 — 공손성 축",
  ],
  closing_principle_ko:
    "제안은 결정권을 빼앗지 않으면서도 무엇을 해 보자는지 분명해야 합니다. 직접 말해도 선택 가능한 안이면 적절할 수 있습니다.",
  handoff_summary: {
    first_impression: "상대의 결정권을 남기면서 제안할 방안이 분명한지 살폈습니다.",
    correction: "선택 가능한 제안임을 드러내면서 실행할 방안을 분명히 했습니다.",
    reason: "결정처럼 밀어붙이거나 유보가 지나치면 제안이 어긋남을 찾았습니다.",
    compare_low: "선택 가능한 제안과 지시처럼 밀어붙인 안을 구분했습니다.",
    compare_high: "방안이 분명한 제안과 유보가 지나쳐 내용이 흐린 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"간접적일수록 좋은 제안이다\" — 반례: 공동 결정이 필요한 급한 상황에서는 분명한 방안을 짧게 제시하는 편이 여러 겹 유보해 안을 흐리는 것보다 적절하다.",
  operational_definition_zh_ko:
    "상대 또는 공동의 미래 행동 방안을 한국어로 선택 가능한 안으로 분명히 제시하는 초점. 화자가 이미 정한 지시처럼 밀어붙이는가, 결정권을 존중하면서 실행할 안을 식별 가능하게 제시하는가, 또는 유보가 지나쳐 무엇을 제안하는지 흐려지는가를 본다. " +
    "직접성 자체가 아니라 제안의 선택 가능성과 명료성을 함께 판단한다.",
  relevant_resources_zh_ko: [
    "제안 공식 (-면 어떨까요·-는 게 어때요·-을 제안합니다)",
    "검토 가능성 (-을 고려해 볼 수 있습니다·혹시 -하는 건 어떨까요)",
    "조건·범위 한정 (-라면·우선 -하고 나서)",
    "허용된 근거와 예상 효과",
  ],
  excluded_confounds_zh_ko: [
    "상대 행동을 요구하는 요청·지시",
    "화자의 단독 결정 또는 통보",
    "근거 문장 수나 표현 길이 자체",
    "높임 등급 선택 — 공손성 축",
  ],
  counter_rule_note_zh_ko:
    "\"간접적일수록 좋은 제안이다\" — 반례: 공동 결정이 필요한 급한 상황에서는 \"우선 A부터 확인하는 게 어떨까요?\"처럼 방안을 분명히 제시하는 편이 지나친 유보보다 적절하다.",
};

// ── 초대 · 참여 선택권과 약속 명료성 ───────────────────────────────────
const INVITATION_CHOICE_COMMITMENT: TargetFeature = {
  code: "invitation_choice_commitment",
  // v1.2 — too_ambiguous의 모호 대상을 '정보'에서 '약속 성립'으로 옮겼다.
  // v1.1은 "무엇에 참여하는지 또는 초대 의도를 알아볼 수 없을 때만"으로 좁혀 오탐은
  // 없앴지만, 그 조건을 만족하는 문장은 명제·의도가 소실되어 gate1(명제·의도 불변)
  // 위반이 된다. 명제를 지키면 within_band가 되고 지우면 gate1에 걸려, 실현 가능한
  // 과잉 후보가 정의에서 배제됐다(2026-08-03 5자 판정, MultiJudge는 과잉 1개 강제).
  // v1.2는 행사·의도가 식별되더라도 '언제·어떤 방식으로 답해야 하는지'가 결정 불가능한
  // 상태를 과잉으로 삼는다. v1.1이 세운 오탐 가드는 그대로 유지한다.
  version: "1.2",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "agreement",
  learner_label: "참여 선택권과 약속 명료성",
  operational_definition:
    "화자가 관여하는 행사·활동에 상대를 초대하면서 참여 내용과 선택권을 조절하는 초점. 업무 의무나 압박처럼 수락을 강제하는가, 활동·조건을 알리고 자유로운 선택을 남기는가, 또는 참여 약속의 성립 요건이 지나치게 흐린가를 본다. " +
    "여러 번 권하거나 설득하는 것을 진정성의 자동 기준으로 삼지 않는다. " +
    "대역 경계: 참여가 의무이거나 이미 결정된 것처럼 전제하고 거절의 비용·불이익·반복 압박을 두면 too_pressuring이다. 행사와 참여 행위가 문맥에서 식별되고 상대에게 수락 여부가 남으며 답을 어떻게 주면 되는지 알 수 있으면 within_band이며, 希望您能参加·欢迎您来 같은 통상적 희망·환영형은 그 자체로 압박이 아니다. " +
    "too_ambiguous는 행사와 초대 의도가 식별되더라도 참여 약속의 성립 요건이 결정 불가능하게 열려 있을 때 쓴다 — 상대가 참석 여부를 언제·어떤 방식으로 알리면 되는지, 무엇을 약속하게 되는지 판단할 수 없는 상태다(예: 초대는 분명하나 '您到时候根据情况安排就可以'처럼 응답 기대를 통째로 열어 둠). " +
    "행사·의도 정보 자체가 사라진 문장은 이 대역이 아니라 명제 위반이므로 재생성 대상이다. 이미 상황·원문에 제시된 행사 정보를 매 후보가 반복하지 않거나, 다른 일정·불참 가능성을 제시해 선택권을 넓힌다는 이유만으로 모호하다고 판정하지 않는다.",
  band_schema: [
    { code: "too_pressuring", label_ko: "압박함 (참여 선택권을 충분히 남기지 않음)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "too_ambiguous", label_ko: "지나치게 모호함 (초대·약속 내용이 흐려짐)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "공동 활동 제시 (一起…吧·要不要一起…)",
    "참여 의향 확인 (你想来吗·有空的话一起来)",
    "공식 초대 (想邀请您参加…·欢迎您来…)",
    "선택권·거절 여지 (不方便也没关系)",
    "원문이 허용한 시간·장소·편의 정보",
  ],
  excluded_confounds: [
    "업무상 의무 참석 요청·지시",
    "화자 관여가 없는 일반 조언·제안",
    "반복 권유 횟수나 문장 길이 자체",
    "매체를 격식의 자동 기준으로 삼는 것",
  ],
  closing_principle_ko:
    "초대는 함께할 활동과 약속을 알아볼 수 있게 제시하되, 상대가 실제로 수락하거나 거절할 여지를 남겨야 합니다.",
  handoff_summary: {
    first_impression: "함께할 활동과 참여 선택권이 모두 드러나는지 살폈습니다.",
    correction: "무엇에 초대하는지 밝히면서 수락하거나 거절할 여지를 남겼습니다.",
    reason: "참여를 압박하거나 조건이 너무 모호하면 초대가 어긋남을 찾았습니다.",
    compare_low: "자유로운 선택을 남긴 초대와 참여를 압박한 안을 구분했습니다.",
    compare_high: "내용이 분명한 초대와 초대 의도·조건이 모호한 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"여러 번 강하게 권해야 진짜 초대다\" — 반례: 일정·비용 부담이 큰 활동에서는 한 번의 분명한 초대와 자유로운 거절 여지가 반복 설득보다 적절하다.",
  operational_definition_zh_ko:
    "화자가 관여하는 행사·활동에 상대를 한국어로 초대하면서 참여 내용과 선택권을 조절하는 초점. 업무 의무나 압박처럼 수락을 강제하는가, 활동·조건을 알리고 자유로운 선택을 남기는가, 또는 참여 약속의 성립 요건이 지나치게 흐린가를 본다. " +
    "여러 번 권하거나 설득하는 것을 진정성의 자동 기준으로 삼지 않는다. " +
    "대역 경계: 참여가 의무이거나 이미 결정된 것처럼 전제하고 거절의 비용·불이익·반복 압박을 두면 too_pressuring이다. 행사와 참여 행위가 문맥에서 식별되고 상대에게 수락 여부가 남으며 답을 어떻게 주면 되는지 알 수 있으면 within_band이며, '참석해 주시면 좋겠습니다'·'함께해 주시면 좋겠습니다' 같은 통상적 희망형은 그 자체로 압박이 아니다. " +
    "too_ambiguous는 행사와 초대 의도가 식별되더라도 참여 약속의 성립 요건이 결정 불가능하게 열려 있을 때 쓴다 — 상대가 참석 여부를 언제·어떤 방식으로 알리면 되는지, 무엇을 약속하게 되는지 판단할 수 없는 상태다(예: 초대는 분명하나 '그때 상황 봐서 편하신 대로 하시면 됩니다'처럼 응답 기대를 통째로 열어 둠). " +
    "행사·의도 정보 자체가 사라진 문장은 이 대역이 아니라 명제 위반이므로 재생성 대상이다. 이미 상황·원문에 제시된 행사 정보를 매 후보가 반복하지 않거나, '일정이 맞지 않으면 조정하겠습니다'처럼 선택권을 넓힌다는 이유만으로 모호하다고 판정하지 않는다.",
  relevant_resources_zh_ko: [
    "공동 활동 제시 (같이 -할래요·함께 -하시겠어요)",
    "참여 의향 확인 (시간 되시면 같이 가실래요·참석 가능하실까요)",
    "공식 초대 (-에 초대합니다·함께해 주시면 좋겠습니다)",
    "선택권·거절 여지 (어려우시면 괜찮습니다·부담 없이 말씀해 주세요)",
    "원문이 허용한 시간·장소·편의 정보",
  ],
  excluded_confounds_zh_ko: [
    "업무상 의무 참석 요청·지시",
    "화자 관여가 없는 일반 조언·제안",
    "반복 권유 횟수나 문장 길이 자체",
    "매체를 격식의 자동 기준으로 삼는 것",
  ],
  counter_rule_note_zh_ko:
    "\"여러 번 강하게 권해야 진짜 초대다\" — 반례: 일정·비용 부담이 큰 활동에서는 한 번의 분명한 초대와 \"어려우시면 괜찮습니다\"라는 선택권이 반복 설득보다 적절하다.",
};

// ── 반대 · 이견 명료성과 관계 조정 ────────────────────────────────────
const OPPOSITION_STANCE_MITIGATION: TargetFeature = {
  code: "opposition_stance_mitigation",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "opposition",
  learner_label: "이견 명료성과 관계 조정",
  operational_definition:
    "상대가 제시한 같은 명제에 대한 이견을 식별 가능하게 밝히면서 관계와 이해관계에 필요한 조정을 하는 초점. 인격 비난이나 단정으로 대립을 키우는가, 입장과 범위를 분명히 하면서 필요한 인정·한정·근거를 사용하는가, 또는 완화가 지나쳐 실제 이견이 무엇인지 감추는가를 본다. " +
    "부분 동의나 인정은 선택적 자원이며 고정된 첫 문장 공식이 아니다.",
  band_schema: [
    { code: "too_confrontational", label_ko: "대립적임 (이견보다 공격·단정이 앞섬)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "too_obscured", label_ko: "지나치게 흐림 (이견의 대상·범위가 불분명함)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "이견 명시 (我不太同意…·我的看法不太一样)",
    "상대 견해 인정 (我理解你的意思，不过…)",
    "부분 동의·범위 한정 (这一点我同意，但是…)",
    "입장 완화 (我觉得·可能·恐怕)",
    "원문이 허용한 근거·대안",
  ],
  excluded_confounds: [
    "상대 인격에 대한 평가·비난",
    "preceding_turn에 없는 새 논점",
    "부분 동의·완화 표현의 개수",
    "격식체 선택 — 공손성 축",
  ],
  closing_principle_ko:
    "반대는 관계를 공격하지 않으면서도 무엇에 어느 범위까지 동의하지 않는지 알아볼 수 있어야 합니다. 완화는 이견을 숨기는 장치가 아닙니다.",
  handoff_summary: {
    first_impression: "이견의 대상·범위가 드러나고 관계를 공격하지 않는지 살폈습니다.",
    correction: "입장은 분명히 하면서 필요한 인정·한정으로 관계를 조절했습니다.",
    reason: "공격적 단정이나 지나친 완화는 이견의 초점을 흐린다는 점을 찾았습니다.",
    compare_low: "관계를 조절한 분명한 이견과 대립적인 안을 구분했습니다.",
    compare_high: "관계를 조절한 분명한 이견과 실제 입장이 가려진 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"반대는 반드시 먼저 동의해야 한다\" — 반례: 안전·권리처럼 즉시 명확한 이견이 필요한 상황에서는 근거 있는 직접 반대가 형식적인 선동의보다 적절하다.",
  operational_definition_zh_ko:
    "상대가 제시한 같은 명제에 대한 이견을 한국어로 식별 가능하게 밝히면서 관계와 이해관계에 필요한 조정을 하는 초점. 인격 비난이나 단정으로 대립을 키우는가, 입장과 범위를 분명히 하면서 필요한 인정·한정·근거를 사용하는가, 또는 완화가 지나쳐 실제 이견이 무엇인지 감추는가를 본다. " +
    "부분 동의나 인정은 선택적 자원이며 고정된 첫 문장 공식이 아니다.",
  relevant_resources_zh_ko: [
    "이견 명시 (저는 조금 다르게 생각합니다·그 부분에는 동의하기 어렵습니다)",
    "상대 견해 인정 (말씀하신 취지는 이해하지만·그 점은 맞지만)",
    "부분 동의·범위 한정 (-부분에는 동의하지만·적어도 -에는)",
    "입장 완화 (제가 보기에는·아마·조금)",
    "원문이 허용한 근거·대안",
  ],
  excluded_confounds_zh_ko: [
    "상대 인격에 대한 평가·비난",
    "preceding_turn에 없는 새 논점",
    "부분 동의·완화 표현의 개수",
    "높임 등급 선택 — 공손성 축",
  ],
  counter_rule_note_zh_ko:
    "\"반대는 반드시 먼저 동의해야 한다\" — 반례: 안전·권리처럼 즉시 명확한 이견이 필요한 상황에서는 \"그 방안에는 반대합니다. 안전 기준을 충족하지 못합니다\"라는 근거 있는 직접 반대가 형식적인 선동의보다 적절하다.",
};

// ── 칭찬하기 · 평가 강도와 민감도 ─────────────────────────────────────
const COMPLIMENT_GROUNDING_SENSITIVITY: TargetFeature = {
  code: "compliment_grounding_sensitivity",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "compliment",
  learner_label: "평가 강도와 민감도",
  operational_definition:
    "상대 또는 상대 관련 대상에 대한 긍정 평가의 강도·범위·개인성을 관찰 근거, 관계, 주제 민감도에 맞추는 초점. 성과에 비해 지나치게 약하거나 의례적으로 들리는가, 근거와 관계에 맞는가, 또는 확인하지 않은 속성·사적 영역까지 과장해 침해·아첨으로 들릴 수 있는가를 본다. " +
    "명시적 칭찬과 암시적 칭찬은 모두 가능하며 명시성 자체를 정답으로 삼지 않는다.",
  band_schema: [
    { code: "under_calibrated", label_ko: "부족함 (성과·관계에 비해 평가가 약하거나 의례적임)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "overreaching", label_ko: "과함 (평가 범위·개인성이 근거를 넘어섬)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "명시적 긍정 평가 (做得真好·这个设计很清楚)",
    "구체적 근거 (尤其是…·你把…处理得很细致)",
    "범위 한정 (这次·这一部分·在…方面)",
    "화자에게 미친 긍정적 효과 (让我很容易理解·很有启发)",
    "암시적 긍정 평가",
  ],
  excluded_confounds: [
    "감사·축하가 칭찬을 대체하는 것",
    "원문에 없는 능력·외모·관계의 발명",
    "외모·신체·사적 관계를 자동으로 적절한 칭찬 주제로 보는 것",
    "명시성·문장 길이 자체",
  ],
  closing_principle_ko:
    "칭찬은 세게 말하는 것보다, 실제로 확인한 강점을 관계와 주제의 민감도에 맞는 범위로 평가할 때 자연스럽습니다.",
  handoff_summary: {
    first_impression: "실제 근거와 관계에 이 칭찬의 강도·범위가 맞는지 살폈습니다.",
    correction: "확인한 강점을 관계와 주제의 민감도 안에서 구체화했습니다.",
    reason: "근거 없이 약하거나 과장된 평가는 자연스러운 칭찬이 되기 어렵다는 점을 찾았습니다.",
    compare_low: "근거 있는 칭찬과 지나치게 약하거나 의례적인 안을 구분했습니다.",
    compare_high: "근거 있는 칭찬과 확인한 범위를 넘어 과장한 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"구체적이고 강한 칭찬일수록 좋다\" — 반례: 관계가 멀거나 주제가 사적인 경우에는 범위를 한정한 평가가 과장된 개인 평가보다 적절하다.",
  operational_definition_zh_ko:
    "상대 또는 상대 관련 대상에 대한 한국어 긍정 평가의 강도·범위·개인성을 관찰 근거, 관계, 주제 민감도에 맞추는 초점. 성과에 비해 지나치게 약하거나 의례적으로 들리는가, 근거와 관계에 맞는가, 또는 확인하지 않은 속성·사적 영역까지 과장해 침해·아첨으로 들릴 수 있는가를 본다. " +
    "명시적 칭찬과 암시적 칭찬은 모두 가능하며 명시성 자체를 정답으로 삼지 않는다.",
  relevant_resources_zh_ko: [
    "명시적 긍정 평가 (정말 잘했어요·이 구성이 아주 명확하네요)",
    "구체적 근거 (특히 -부분이·-을 세심하게 처리했네요)",
    "범위 한정 (이번 발표에서·이 부분은·-측면에서)",
    "화자에게 미친 긍정적 효과 (이해하기 쉬웠어요·많이 배웠어요)",
    "암시적 긍정 평가",
  ],
  excluded_confounds_zh_ko: [
    "감사·축하가 칭찬을 대체하는 것",
    "원문에 없는 능력·외모·관계의 발명",
    "외모·신체·사적 관계를 자동으로 적절한 칭찬 주제로 보는 것",
    "명시성·문장 길이 자체",
  ],
  counter_rule_note_zh_ko:
    "\"구체적이고 강한 칭찬일수록 좋다\" — 반례: 관계가 멀거나 주제가 사적인 경우에는 \"이번 발표의 사례 구성이 명확했습니다\"처럼 범위를 한정한 평가가 과장된 개인 평가보다 적절하다.",
};

// ── 칭찬 대응 · 칭찬 처리와 관계 조정 ─────────────────────────────────
const COMPLIMENT_RESPONSE_UPTAKE: TargetFeature = {
  code: "compliment_response_uptake",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "compliment",
  learner_label: "칭찬 처리와 관계 조정",
  operational_definition:
    "상대가 제시한 긍정 평가를 실제로 처리하면서 수용·감사·공로 분배·자기 낮추기·비껴가기의 조합을 관계와 주제에 맞추는 초점. 칭찬을 형식적으로만 밀어내 관계적 응답이 부족한가, 맥락에 맞게 처리하는가, 또는 자기 자랑·과도한 부정·상호 칭찬이 원래 칭찬 처리를 대체하는가를 본다. " +
    "수용·거절·비껴가기 중 어느 전략도 언어·문화의 고정 정답으로 두지 않는다.",
  band_schema: [
    { code: "under_engaged", label_ko: "부족함 (칭찬을 관계적으로 충분히 처리하지 않음)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "overextended", label_ko: "과함 (자기 평가·부정·되돌리기가 칭찬 처리를 덮음)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "수용과 감사 (谢谢·谢谢你这么说)",
    "긍정 감정 표현 (你这么说我很开心)",
    "공로 분배 (是大家一起完成的·多亏了团队)",
    "자기 낮추기·비껴가기 (过奖了·哪里哪里)",
    "관계에 맞는 칭찬 되돌리기",
  ],
  excluded_confounds: [
    "수용·거절 전략의 국가·문화별 고정 정답화",
    "칭찬에 실제로 응답하지 않는 주제 전환",
    "독립적인 자기 자랑이나 과도한 자기 비하",
    "원래 칭찬 처리를 대체하는 상호 칭찬",
  ],
  closing_principle_ko:
    "칭찬 대응에는 하나의 문화 공식이 없습니다. 상대의 평가를 알아듣고, 수용·감사·공로 분배·비껴가기를 현재 관계에 맞게 조합하는 것이 핵심입니다.",
  handoff_summary: {
    first_impression: "상대의 칭찬을 실제로 처리하면서 관계에 맞게 반응했는지 살폈습니다.",
    correction: "수용·감사·공로 분배를 현재 관계에 맞게 조절했습니다.",
    reason: "무조건 부정하거나 자기 평가를 늘리면 원래 칭찬 처리가 가려짐을 찾았습니다.",
    compare_low: "칭찬을 관계적으로 처리한 안과 반응이 부족한 안을 구분했습니다.",
    compare_high: "칭찬을 관계적으로 처리한 안과 자기 평가·부정이 지나친 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"중국어 칭찬에는 반드시 부정으로 답해야 한다\" — 반례: 관계와 주제에 따라 간단한 수용과 감사가 과도한 부정보다 자연스럽고 적절할 수 있다.",
  operational_definition_zh_ko:
    "상대가 제시한 긍정 평가를 한국어로 실제 처리하면서 수용·감사·공로 분배·자기 낮추기·비껴가기의 조합을 관계와 주제에 맞추는 초점. 칭찬을 형식적으로만 밀어내 관계적 응답이 부족한가, 맥락에 맞게 처리하는가, 또는 자기 자랑·과도한 부정·상호 칭찬이 원래 칭찬 처리를 대체하는가를 본다. " +
    "수용·거절·비껴가기 중 어느 전략도 언어·문화의 고정 정답으로 두지 않는다.",
  relevant_resources_zh_ko: [
    "수용과 감사 (고마워요·좋게 봐 주셔서 감사합니다)",
    "긍정 감정 표현 (그렇게 말해 주셔서 기뻐요)",
    "공로 분배 (다 같이 한 일이에요·팀 덕분이에요)",
    "자기 낮추기·비껴가기 (아직 부족한데 좋게 봐 주셨네요)",
    "관계에 맞는 칭찬 되돌리기",
  ],
  excluded_confounds_zh_ko: [
    "수용·거절 전략의 국가·문화별 고정 정답화",
    "칭찬에 실제로 응답하지 않는 주제 전환",
    "독립적인 자기 자랑이나 과도한 자기 비하",
    "원래 칭찬 처리를 대체하는 상호 칭찬",
  ],
  counter_rule_note_zh_ko:
    "\"한국어 칭찬에는 반드시 겸손하게 부정해야 한다\" — 반례: 관계와 주제에 따라 \"좋게 봐 주셔서 감사합니다\"처럼 간단히 수용하는 반응이 과도한 자기 비하보다 자연스럽고 적절할 수 있다.",
};

// ── 직접 불만 · 문제 명료화와 책임 범위 ───────────────────────────────
const COMPLAINT_PROBLEM_ACCOUNTABILITY: TargetFeature = {
  code: "complaint_problem_accountability",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "complaint",
  learner_label: "문제 명료화와 책임 범위",
  operational_definition:
    "책임 당사자 또는 해결 권한자에게 문제·영향·책임 범위를 사실과 R에 맞게 밝히는 초점. 문제와 영향이 지나치게 흐려 수리할 대상을 알기 어려운가, 근거 있는 범위로 문제를 제기하는가, 또는 확인되지 않은 책임·의도·심각도를 확대해 인신 비난이나 위협으로 넘어가는가를 본다. " +
    "개선·수리 요구는 원문 또는 서버가 허용한 usable_facts에 있을 때만 종속적으로 사용할 수 있고 자동 필수 요소가 아니다.",
  band_schema: [
    { code: "under_specified", label_ko: "부족함 (문제·영향·책임 범위가 불분명함)" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "over_attributed", label_ko: "과함 (책임·의도·심각도를 근거보다 확대함)" },
  ],
  within_band_code: "within_band",
  relevant_resources: [
    "문제 사실 (…出了问题·已经连续…)",
    "구체적 영향 (耽误了…·给我造成了…)",
    "근거 있는 책임 범위 (这部分由贵方负责·上次约定的是…)",
    "부정 평가·감정 (这让我很困扰·我对此很不满意)",
    "허용된 개선·수리 요구 (希望尽快处理·请确认…)",
  ],
  excluded_confounds: [
    "책임자가 아닌 제3자에게 하는 불평",
    "근거 없는 의도 추정·인신 비난",
    "보상·수리 요구의 자동 필수화",
    "직접성·감정 표현의 존재 자체",
  ],
  closing_principle_ko:
    "불만은 세게 말하는 것이 아니라, 무엇이 어떤 영향을 주었고 상대가 어디까지 책임지는지를 사실에 맞게 밝혀야 해결 가능한 문제 제기가 됩니다.",
  handoff_summary: {
    first_impression: "문제·영향·책임 범위를 사실에 맞게 드러냈는지 살폈습니다.",
    correction: "문제와 영향을 분명히 하되 확인된 책임 범위만 제시했습니다.",
    reason: "문제가 모호하거나 책임을 확대하면 해결 가능한 불만이 되기 어렵다는 점을 찾았습니다.",
    compare_low: "해결할 문제를 분명히 한 안과 문제·영향이 모호한 안을 구분했습니다.",
    compare_high: "근거 있는 불만과 책임·의도를 사실보다 확대한 안을 구분했습니다.",
  },
  counter_rule_note:
    "\"불만은 간접적일수록 공손하다\" — 반례: 반복 피해와 책임이 분명한 상황에서는 문제와 필요한 조치를 직접 특정하는 편이 모호한 암시보다 적절하다.",
  operational_definition_zh_ko:
    "책임 당사자 또는 해결 권한자에게 문제·영향·책임 범위를 한국어로 사실과 R에 맞게 밝히는 초점. 문제와 영향이 지나치게 흐려 수리할 대상을 알기 어려운가, 근거 있는 범위로 문제를 제기하는가, 또는 확인되지 않은 책임·의도·심각도를 확대해 인신 비난이나 위협으로 넘어가는가를 본다. " +
    "개선·수리 요구는 원문 또는 서버가 허용한 usable_facts에 있을 때만 종속적으로 사용할 수 있고 자동 필수 요소가 아니다.",
  relevant_resources_zh_ko: [
    "문제 사실 (-에 문제가 생겼습니다·계속 -되고 있습니다)",
    "구체적 영향 (-이 지연됐습니다·-에 차질이 생겼습니다)",
    "근거 있는 책임 범위 (이 부분은 귀사 담당입니다·지난번 합의는 -였습니다)",
    "부정 평가·감정 (이 문제로 곤란합니다·이 점은 유감입니다)",
    "허용된 개선·수리 요구 (빠른 처리를 요청드립니다·확인해 주시기 바랍니다)",
  ],
  excluded_confounds_zh_ko: [
    "책임자가 아닌 제3자에게 하는 불평",
    "근거 없는 의도 추정·인신 비난",
    "보상·수리 요구의 자동 필수화",
    "직접성·감정 표현의 존재 자체",
  ],
  counter_rule_note_zh_ko:
    "\"불만은 간접적일수록 공손하다\" — 반례: 반복 피해와 책임이 분명한 상황에서는 \"배송 지연이 세 번 반복되어 일정에 차질이 생겼습니다. 처리 일정을 확인해 주십시오\"처럼 문제와 조치를 특정하는 편이 모호한 암시보다 적절하다.",
};

// ── 공손성 (보조축) — v1.3 미사용 ─────────────────────────────────────
// 계약 0-b·19: axis_feature = unit.target_feature 고정. 공손성 혼용 금지.
// 공손성이 '중심 초점'인 단원에서만 이 코드를 unit.target_feature로 쓴다.
const POLITENESS: TargetFeature = {
  code: "politeness",
  version: "1.0",
  fidelity_note: FIDELITY_NOTE,
  speech_act: "request", // placeholder — 공손성 중심 단원 정의 시 확정
  learner_label: "공손성",
  operational_definition:
    "호칭·대인 배려의 격식이 상황에 맞는가를 보는 축. 무례한가·알맞은가·지나치게 공손한가. " +
    "v1.3에서는 문항 축으로 쓰지 않는다(단일 초점 원칙). 공손성 중심 단원에서만 중심 초점으로 사용.",
  band_schema: [
    { code: "impolite", label_ko: "무례함" },
    { code: "within_band", label_ko: "알맞음" },
    { code: "overpolite", label_ko: "지나치게 공손함" },
  ],
  within_band_code: "within_band",
  relevant_resources: ["호칭 (您/你)", "인사·안부", "격식 표지"],
  excluded_confounds: ["요청의 직접성 — 별도 축", "거절의 완충 — 별도 축"],
  closing_principle_ko: "공손함은 상황에 맞을 때 자연스럽습니다.",
  handoff_summary: {
    first_impression: "상대와 상황에 이 정도 공손성이 자연스러운지 살폈습니다.",
    correction: "관계와 상황에 맞게 공손 표현의 정도를 조절했습니다.",
    reason: "무례하거나 지나치게 공손하면 상황에 어긋날 수 있음을 찾았습니다.",
    compare_low: "상황에 맞는 공손 표현과 무례하게 들리는 안을 구분했습니다.",
    compare_high: "상황에 맞는 공손 표현과 지나치게 격식을 높인 안을 구분했습니다.",
  },
  counter_rule_note: "\"공손할수록 좋다\" — 반례: 친한 사이의 과잉 격식은 거리감을 만든다.",
};

/** 코드 → 화용 초점. AI가 아니라 이 맵이 정본이다. */
export const TARGET_FEATURES: Record<string, TargetFeature> = {
  [REQUEST_MITIGATION_OPTIONALITY.code]: REQUEST_MITIGATION_OPTIONALITY,
  [REFUSAL_SOFTENING.code]: REFUSAL_SOFTENING,
  [GRATITUDE_CALIBRATION.code]: GRATITUDE_CALIBRATION,
  [APOLOGY_ACCOUNTABILITY_REPAIR.code]: APOLOGY_ACCOUNTABILITY_REPAIR,
  [PROPOSAL_OPTIONALITY_CLARITY.code]: PROPOSAL_OPTIONALITY_CLARITY,
  [INVITATION_CHOICE_COMMITMENT.code]: INVITATION_CHOICE_COMMITMENT,
  [OPPOSITION_STANCE_MITIGATION.code]: OPPOSITION_STANCE_MITIGATION,
  [COMPLIMENT_GROUNDING_SENSITIVITY.code]: COMPLIMENT_GROUNDING_SENSITIVITY,
  [COMPLIMENT_RESPONSE_UPTAKE.code]: COMPLIMENT_RESPONSE_UPTAKE,
  [COMPLAINT_PROBLEM_ACCOUNTABILITY.code]: COMPLAINT_PROBLEM_ACCOUNTABILITY,
  [POLITENESS.code]: POLITENESS,
};

/**
 * 화행 → 자동 승격 기본 초점.
 * compliment_response는 정본에 포함하지만 response subtype 코어 경로 전까지 자동 기본값으로
 * 쓰지 않는다. 7월 compliment 코어는 compliment_giving만 생성한다.
 */
export const DEFAULT_FEATURE_BY_ACT: Record<SpeechActUI, string> = {
  request: REQUEST_MITIGATION_OPTIONALITY.code,
  refusal: REFUSAL_SOFTENING.code,
  apology: APOLOGY_ACCOUNTABILITY_REPAIR.code,
  thanks: GRATITUDE_CALIBRATION.code,
  proposal: PROPOSAL_OPTIONALITY_CLARITY.code,
  agreement: INVITATION_CHOICE_COMMITMENT.code,
  opposition: OPPOSITION_STANCE_MITIGATION.code,
  compliment: COMPLIMENT_GROUNDING_SENSITIVITY.code,
  complaint: COMPLAINT_PROBLEM_ACCOUNTABILITY.code,
};

/** 한 화행에 속한 승인 feature 목록. 칭찬은 주차 안에서 두 미션으로 분리한다. */
export const FEATURE_CODES_BY_ACT: Record<SpeechActUI, readonly string[]> = {
  request: [REQUEST_MITIGATION_OPTIONALITY.code],
  refusal: [REFUSAL_SOFTENING.code],
  apology: [APOLOGY_ACCOUNTABILITY_REPAIR.code],
  thanks: [GRATITUDE_CALIBRATION.code],
  proposal: [PROPOSAL_OPTIONALITY_CLARITY.code],
  agreement: [INVITATION_CHOICE_COMMITMENT.code],
  opposition: [OPPOSITION_STANCE_MITIGATION.code],
  compliment: [COMPLIMENT_GROUNDING_SENSITIVITY.code, COMPLIMENT_RESPONSE_UPTAKE.code],
  complaint: [COMPLAINT_PROBLEM_ACCOUNTABILITY.code],
};

export function getTargetFeature(code: string): TargetFeature | undefined {
  return TARGET_FEATURES[code];
}

/** 카탈로그에 존재하고 band code가 그 초점의 band_schema에 있는지(R1·R13). */
export function isBandCodeValid(featureCode: string, bandCode: string): boolean {
  const f = TARGET_FEATURES[featureCode];
  if (!f) return false;
  return f.band_schema.some((b) => b.code === bandCode);
}

/** scale4 — 전 화행 공통 전반 적절성 척도(초점 band와 별개, 계약 §2). */
export const SCALE4_CODES = [
  "very_appropriate",
  "somewhat_appropriate",
  "somewhat_inappropriate",
  "very_inappropriate",
] as const;
export type Scale4Code = (typeof SCALE4_CODES)[number];
export const SCALE4_LABELS: Record<Scale4Code, string> = {
  very_appropriate: "매우 적절",
  somewhat_appropriate: "다소 적절",
  somewhat_inappropriate: "다소 부적절",
  very_inappropriate: "매우 부적절",
};
