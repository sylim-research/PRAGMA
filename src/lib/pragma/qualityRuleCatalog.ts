// 자동 품질 점검 규칙의 *사람용 설명층*. 실행 사실(강도·적용 조건·메시지)은 missionRules.ts가
// 정본이며 여기서 복제하지 않는다. Record<RuleId, …>이므로 규칙을 추가하고 설명을 빠뜨리면
// 컴파일이 실패한다. 범주는 2026-09-09 독립 감사가 제안하고 연구자가 채택한 설명용 7분류다
// (원래부터 있던 설계 분류가 아니다). ID당 주분류 하나이며 논리적 MECE를 주장하지 않는다.

import {
  ACTIVE_RULE_IDS,
  RETIRED_MISSION_RULE_IDS,
  type RetiredRuleId,
  type RuleId,
} from "@/lib/pragma/missionRules";

export const QUALITY_RULE_CATEGORIES = [
  "문항 구성·판정 데이터",
  "요청 조건·카탈로그 정합",
  "언어 방향·문자 형식",
  "수행 방식·역할·채널",
  "장면·원문 구성",
  "일반화·사전 정보 노출 위험",
  "생성 기록·계승·근거 귀속",
] as const;
export type QualityRuleCategory = (typeof QUALITY_RULE_CATEGORIES)[number];

/**
 * structural = 필드·수량·코드값·동일성의 기계적 계약 검사.
 * signal = 정규식·집계로 위험을 *추정*하는 검사(의미 판단 아님, 교수자 확인 대상).
 * governance = 생성 기록·계승·귀속의 존재·형식 검사(진위·승인 아님).
 */
export type QualityRuleNature = "structural" | "signal" | "governance";

export interface QualityRuleDescription {
  category: QualityRuleCategory;
  nature: QualityRuleNature;
  /** 규칙이 실제로 확인하는 것만 쓴다. 능력 과장 금지(예: 「적절성 판정」·「출처 보장」). */
  summary_ko: string;
  /** 항상 실행되지 않는 규칙의 조건. 없으면 저장 계약과 무관하게 실행된다는 뜻은 아니다. */
  applicability_ko?: string;
}

/** 설명 검토 상태 — 연구자가 문안을 확정하기 전까지 UI에는 이 상태를 함께 표시한다. */
export const QUALITY_RULE_CATALOG_REVIEW_STATUS = "draft_pending_researcher_review" as const;

export const QUALITY_RULE_CATALOG: Record<RuleId, QualityRuleDescription> = {
  R1: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "미션 스키마·문항 유형 순서·contrast_plan 슬롯·band code 존재를 확인한다. 스키마 실패 시 나머지 규칙은 실행되지 않는다.",
  },
  R1c: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "코어 스키마와 theme·topic·domain 카탈로그 조합의 허용 여부를 확인한다.",
  },
  R2: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "judge3 문항의 accepted 대역 라벨 수·앵커 PDR 일치를 확인한다(현행 native는 비적정 1개, legacy는 within 포함).",
    applicability_ko: "native MJT5와 legacy 저장 계약에 서로 다른 조건을 적용한다.",
  },
  R3: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "fix_choice 수정안 개수와 is_valid 라벨 수(현행 3안·1개 / legacy 2개), 앵커 PDR 일치를 확인한다.",
    applicability_ko: "현행·legacy 계약 중 하나만 적용한다.",
  },
  R4: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "이유 문항의 accepted id 존재·역할 3종 각 1개·주원인 일치·문구 중복·앵커 PDR을 확인한다(legacy reason_conf의 PDR 차이는 warning).",
  },
  R5: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "multi_judge 후보 수·대역 라벨 분포·문장 중복·PDR 한 축 차이를 확인하고, 길이만으로 정답이 갈리는 경우는 warning으로 남긴다.",
  },
  R6: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "highlights가 target 문자열의 실제 부분문자열인지 확인한다.",
  },
  R7: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "scale4 accepted가 연속 구간·같은 방향 2개이고 reference를 포함하는지 확인한다. 반례(적절 방향) 여부는 warning.",
  },
  R8: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "응답형 화행 코어의 preceding_turn 존재, legacy 미션의 preceding_turn 존재, native MJT5의 preceding_turn 부재를 확인한다.",
    applicability_ko: "코어·legacy·native 계약별로 조건이 다르다.",
  },
  R9: {
    category: "일반화·사전 정보 노출 위험",
    nature: "signal",
    summary_ko: "국가 단위 일반화로 읽힐 수 있는 한국어 정형 표현을 상황·관계·해설·비고 필드에서 찾는다. 부정문·인용·장소 부사구를 가르지 못하므로 warning(교수자 확인)이다.",
  },
  R10: {
    category: "언어 방향·문자 형식",
    nature: "structural",
    summary_ko: "요청 방향과 데이터 방향의 일치, 원문·선행발화·target·후보·참고 산출의 문자 범위(한글/한자)를 확인한다. 중국어 산출의 한글 혼입은 fail, 그 밖의 문자 추정은 warning.",
  },
  R11: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "reference_alternatives 1~2개와 문항별 recommended_example 존재를 확인한다(일부는 R1 스키마가 먼저 거부한다).",
  },
  R12: {
    category: "문항 구성·판정 데이터",
    nature: "signal",
    summary_ko: "세트 전체의 accepted 대역 라벨이 한 방향으로만 쏠렸는지, within 정답 문항이 없는지 집계한다(warning).",
  },
  R13: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "target_feature·item_focus가 카탈로그에 있고 버전이 현행과 같은지 확인한다.",
  },
  R14: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "learner_label·closing_ko가 카탈로그 고정 문구와 문자 그대로 같은지 확인한다.",
  },
  R15: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "요청 화행과 카탈로그 화행·item_focus 화행·learning_goal의 일치를 확인한다.",
  },
  R16: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "요청 mode↔source_modality, 코어 payload의 source_modality, 미션 production_task.mode의 정합을 확인한다(fail). situation_ko가 반대 수행 장면을 명시한 것으로 보이는 경우는 정규식 신호라 warning.",
  },
  R17: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "industry가 domain='work'에서만 지정됐는지 확인한다.",
  },
  R18: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "교정·이유 문항의 문제 문장이 within 대역 라벨을 갖지 않는지 확인한다(라벨 검사이며 실제 부적절성 판정이 아니다).",
  },
  R19: {
    category: "문항 구성·판정 데이터",
    nature: "signal",
    summary_ko: "문항 source·target·교정·후보 문자열의 완전 중복을 찾는다(warning). 의도된 Anchor 공유도 함께 잡힌다.",
  },
  R20: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "미션 provenance 객체와 model·prompt_version·content_hash·generated_at·generation_attempt 값의 존재를 확인한다. 해시 진위는 검증하지 않는다.",
  },
  R21: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "fix_choice의 recommended_example가 부적절 target이나 invalid 교정안과 문자 그대로 같은 모순을 확인한다.",
  },
  R23: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "production_task의 source_text·pdr·source_modality·direction·usable_facts가 코어와 정확히 같은지 확인한다.",
    applicability_ko: "유효한 코어가 함께 전달된 경우에만 실행된다.",
  },
  R24: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "호출자가 준 계획 초점(planned_target_feature)과 생성된 unit.target_feature의 일치를 확인한다.",
    applicability_ko: "계획 초점이 전달된 경로에서만 실행된다.",
  },
  R25: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "신규 코어의 서버 주입 context_spec과 통역 A/B/C·PDR 역할 계약 값의 존재를 확인한다.",
    applicability_ko: "require_context_spec=true인 신규 생성 경로에서만 실행된다.",
  },
  R26: {
    category: "장면·원문 구성",
    nature: "signal",
    summary_ko: "지정 산업을 보여 주는 제한된 어휘 증거가 있는지 찾는다(warning). 배치 경로는 이 warning에 한해 industry AI 검토를 1회 붙인다.",
    applicability_ko: "domain='work'이고 industry가 지정된 코어에서만 실행된다.",
  },
  R27: {
    category: "장면·원문 구성",
    nature: "structural",
    summary_ko: "MJT 상황문의 X-A-A-A-Y-C 복사·중복 관계, PDR 한 축 차이, 상황문 형식(종결부호 개수 근사)을 확인한다. DCT 형식은 warning.",
    applicability_ko: "v4/v5와 contrast_plan_v1 여부에 따라 조건이 다르다.",
  },
  R28: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "문항 channel이 production_task.mode와 허용 매핑(번역=email/messenger, 통역=facetoface/phone)에 맞는지 확인한다.",
  },
  R29: {
    category: "장면·원문 구성",
    nature: "structural",
    summary_ko: "원문의 유효 글자 상한(fail)·하한과 문장 수(warning), focal_segments의 head 1·support ≤2·부분문자열, 참고 산출의 길이 비율(warning)을 확인한다.",
    applicability_ko: "focal_segments가 있는 코어(v3)와 mission_v5에서 실행된다.",
  },
  R30: {
    category: "일반화·사전 정보 노출 위험",
    nature: "signal",
    summary_ko: "코어 situation_ko에서 정중·완화·선택권·강도류 평가 단서의 정형 조합을 찾는다(warning). 미션 상황문은 검사하지 않으며, 학습자 화면의 공개 시점 통제와는 별개다.",
    applicability_ko: "코어 situation_ko만 대상이다.",
  },
  R31: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "문항별 모델 귀속(item_lineage)의 구조·scope·근거 id·귀속 호출 metadata를 확인한다. 문헌이 실제로 표현을 지지하는지는 판정하지 않는다.",
    applicability_ko: "mission_v5이고 provenance.prompt_version이 현행 콘텐츠 릴리스와 같으며 authoring pending이 아닌 미션만 검사한다. 구버전 미션은 건너뛴다.",
  },
  R32: {
    category: "생성 기록·계승·근거 귀속",
    nature: "signal",
    summary_ko: "model_unattributed claim 개수를 교수자 확인 우선순위 신호로 남긴다(warning). 참조 상한 20% 초과도 차단하지 않는다.",
    applicability_ko: "R31과 같은 조건에서 coverage가 covered일 때만 실행된다.",
  },
  R33: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "진단차원 선언이 2~6개·허용 코드·중복 없음이고 근거 위치가 서로 다른 2곳 이상인지 확인한다. 차원의 실제 구현·문헌 근거는 판정하지 않는다.",
    applicability_ko: "mission_v5이고 provenance.prompt_version이 현행 콘텐츠 릴리스와 같은 미션만 검사한다.",
  },
};

export const RETIRED_QUALITY_RULES: Record<RetiredRuleId, { retired_on: string; replacement_ko: string }> = {
  R22: {
    retired_on: "2026-08-09",
    replacement_ko: "어휘 참고 부분만 비차단 HSK lexical audit가 대신하고, 길이·담화 형태 일부는 R29가 담당한다. 옛 R22의 모든 목적을 일대일로 대체한 것은 아니다.",
  },
};

export const QUALITY_RULE_IDS_IN_CATALOG = Object.keys(QUALITY_RULE_CATALOG) as RuleId[];
export { ACTIVE_RULE_IDS, RETIRED_MISSION_RULE_IDS };
