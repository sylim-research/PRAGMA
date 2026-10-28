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
  /** 규칙이 실제로 확인하는 것만 쓴다. 능력 과장 금지(예: 「적절성 판정」·「출처 보장」).
   *  2026-10-29: 개발 용어(judge3·band code 등)를 화면에서 읽히는 말로 바꿨다(연구자 승인). */
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
    summary_ko: "미션 형식이 맞는지 확인한다(문항 종류와 순서, 판정 칸 이름 등). 형식이 틀리면 나머지 규칙은 실행하지 않는다.",
  },
  R1c: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "시나리오 형식이 맞는지, 주제·하위 주제·영역(일상·학업·직장) 조합이 허용된 것인지 확인한다.",
  },
  R2: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "단일 판단 문항에서 정답으로 인정하는 판정 칸 수가 맞는지, 관계 조건이 DCT 과제와 같은지 확인한다.",
    applicability_ko: "현행 MJT5와 이전 형식에 서로 다른 조건을 적용한다.",
  },
  R3: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "수정안 고르기 문항의 수정안이 3개이고 적절한 안이 1개인지(이전 형식은 2개), 관계 조건이 DCT 과제와 같은지 확인한다.",
    applicability_ko: "현행·이전 형식 중 해당 형식의 조건만 적용한다.",
  },
  R4: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "이유 문항의 정답 이유가 실제로 있고 역할별 이유가 하나씩인지, 주된 이유가 맞는지, 이유 문구가 겹치지 않는지 확인한다.",
  },
  R5: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "복수 비교 문항의 후보 수·판정 분포·문장 중복과 관계 조건이 한 축만 다른지 확인한다. 문장 길이만으로 정답이 갈리면(4자 이상이면서 10% 이상 차이) warning으로 남긴다.",
  },
  R6: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "강조 표시한 부분이 실제 문장 안에 그대로 있는지 확인한다.",
  },
  R7: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "4단계 척도 문항의 정답 구간이 이어진 두 칸이고 기준 판정을 포함하는지 확인한다. 정답이 적절 쪽으로 기운 반례는 warning이다.",
  },
  R8: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "이전 형식 미션은 앞선 발화가 있는지, 현행 MJT5는 앞선 발화 없이 장면만으로 성립하는지 확인한다. 시나리오의 앞선 발화 조건은 2026-10-25에 폐기했다.",
    applicability_ko: "이전 형식·현행 MJT5 미션에 따라 조건이 다르다. 현행 시나리오 검사에는 쓰지 않는다.",
  },
  R9: {
    category: "일반화·사전 정보 노출 위험",
    nature: "signal",
    summary_ko: "상황·관계·해설에 「중국인은…」「한국에서는…」처럼 국가 단위로 일반화하는 표현이 있는지 찾는다. 부정문·인용·장소 표현을 가려내지 못하므로 교수자 확인 신호다.",
  },
  R10: {
    category: "언어 방향·문자 형식",
    nature: "structural",
    summary_ko: "요청한 언어 방향과 데이터 방향이 같은지, 원문·참고 표현이 맞는 문자(한글·한자)로 쓰였는지 확인한다. 중국어 산출에 한글이 섞이면 불통과, 그 밖의 문자 추정은 warning이다.",
  },
  R11: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "참고 표현이 1~2개 있고 문항마다 권장 예시가 있는지 확인한다(대부분은 R1 형식 검사가 먼저 걸러 낸다).",
  },
  R12: {
    category: "문항 구성·판정 데이터",
    nature: "signal",
    summary_ko: "세트 전체의 정답 판정이 한쪽으로만 쏠렸는지, 적절이 정답인 문항이 하나도 없는지 집계한다(교수자 확인 신호).",
  },
  R13: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "목표 화용요소가 목록에 있는 것이고 버전이 현행과 같은지 확인한다.",
  },
  R14: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "학습자에게 보이는 목표 이름과 마무리 문구가 목록의 고정 문구와 글자 그대로 같은지 확인한다.",
  },
  R15: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "미션의 화행이 요청한 화행과 같은지 확인한다(목표 화용요소·학습 목표 포함).",
  },
  R16: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "번역·통역 요청과 글·말 매체가 맞는지 확인한다(불통과). 상황문이 반대 수행 장면을 적은 것처럼 보이면 글자 패턴 추정이라 warning이다.",
  },
  R17: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "산업 분야가 직장 영역에서만 지정됐는지 확인한다.",
  },
  R18: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "수정·이유 문항의 문제 문장이 적절 판정으로 표시돼 있지 않은지 확인한다(표시만 보며, 실제로 부적절한지는 판단하지 않는다).",
  },
  R19: {
    category: "문항 구성·판정 데이터",
    nature: "signal",
    summary_ko: "문항의 문장·수정안·후보가 글자 그대로 겹치는지 찾는다(교수자 확인 신호). 일부러 같은 장면을 쓰는 MJT2·3·4의 공유는 제외한다.",
  },
  R20: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "생성 기록(모델·프롬프트 판본·콘텐츠 지문·생성 시각·시도 횟수)이 남아 있는지 확인한다. 지문이 진짜인지는 검증하지 않는다.",
  },
  R21: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "권장 예시가 부적절 문장이나 틀린 수정안과 글자 그대로 같은 모순이 있는지 확인한다.",
  },
  R23: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "DCT 과제의 원문·관계 조건·매체·언어 방향·사용 가능한 사실이 시나리오와 정확히 같은지(그대로 물려받았는지) 확인한다.",
    applicability_ko: "시나리오가 함께 전달된 경우에만 실행한다.",
  },
  R24: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "미션의 목표 화용요소가 계획한 것과 같은지 확인한다.",
    applicability_ko: "계획한 목표 화용요소가 전달된 경우에만 실행한다.",
  },
  R25: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "새 시나리오에 서버가 넣는 상황 설정과 통역 역할(A·B·C, 관계·거리·부담) 값이 있는지 확인한다.",
    applicability_ko: "새로 생성하는 시나리오에만 실행한다.",
  },
  R26: {
    category: "장면·원문 구성",
    nature: "signal",
    summary_ko: "직장 시나리오에 지정 산업을 보여 주는 어휘 단서가 실제로 있는지 찾는다(교수자 확인 신호). 일괄 생성에서는 이 신호가 뜨면 산업 적합성 AI 검토를 1회 붙인다.",
    applicability_ko: "직장 영역이고 산업이 지정된 시나리오에만 실행한다.",
  },
  R27: {
    category: "장면·원문 구성",
    nature: "structural",
    summary_ko: "MJT 상황문의 장면 배치(X-A-A-A-Y-C)와 겹침, 관계 조건이 한 축만 다른지, 상황문 형식(문장 수 근사)을 확인한다. DCT 형식은 warning이다.",
    applicability_ko: "이전 형식(mission_v4·v5)의 장면 계획 여부에 따라 조건이 다르다.",
  },
  R28: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "문항의 전달 경로가 수행 방식에 맞는지 확인한다(번역 = 이메일·메신저, 통역 = 대면·전화).",
  },
  R29: {
    category: "장면·원문 구성",
    nature: "structural",
    summary_ko: "원문 분량이 수준별 상한을 넘지 않는지(넘으면 불통과), 하한·문장 수(2~4문장)를 지키는지, 화용 집중 구간이 원문 안에 정확히 있는지 확인한다(하한·문장 수는 warning).",
    applicability_ko: "화용 집중 구간이 있는 시나리오와 이전 형식(mission_v5)에서 실행한다.",
  },
  R30: {
    category: "일반화·사전 정보 노출 위험",
    nature: "signal",
    summary_ko: "학습자에게 보이는 상황문이 정중성·완화·선택권·강도 같은 답의 평가 기준을 미리 드러내는지 찾는다(교수자 확인 신호). 단어를 금지하거나 자동으로 지우는 규칙이 아니다.",
    applicability_ko: "시나리오와 미션의 MJT·DCT 상황문이 대상이다.",
  },
  R31: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "문항별로 어느 모델이 무엇을 만들었는지 기록이 형식대로 남아 있는지 확인한다. 문헌이 그 표현을 실제로 뒷받침하는지는 판정하지 않는다.",
    applicability_ko: "현행 판본으로 만든 미션 중 기록 작성이 끝난 미션만 검사하고, 오래된 판본은 건너뛴다.",
  },
  R32: {
    category: "생성 기록·계승·근거 귀속",
    nature: "signal",
    summary_ko: "출처를 밝히지 못한 문항 기록이 20%를 넘을 때만 교수자 확인 신호로 남긴다(차단하지 않음, 2026-09-21).",
    applicability_ko: "R31과 같은 조건에서, 기록 범위가 갖춰진 경우에만 실행한다.",
  },
  R33: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "진단 차원이 2~6개이고 허용된 이름이며 근거 위치가 두 곳 이상인지 확인한다. 차원의 실제 타당성은 판정하지 않는다.",
    applicability_ko: "이전 형식(mission_v5) 중 현행 판본으로 만든 미션만 검사한다.",
  },
};

export const RETIRED_QUALITY_RULES: Record<RetiredRuleId, { retired_on: string; replacement_ko: string }> = {
  R22: {
    retired_on: "2026-08-09",
    replacement_ko: "어휘 참고 부분만 비차단 HSK lexical audit가 대신하고, 길이·담화 형태 일부는 R29가 담당한다. 옛 R22의 모든 목적을 일대일로 대체한 것은 아니다.",
  },
};

/**
 * 현행 생성 경로에서 실제로 실행되는 단계. missionRules.ts의 checkCore(시나리오)와
 * checkV6Mission(현행 mission_v6)이 add()하는 ID를 손으로 옮긴 표다 — 그 함수가 바뀌면
 * qualityRuleCatalog.test.ts의 실행 대조 테스트가 이 표의 갱신을 요구한다.
 * 여기에 없는 ID는 mission_v5(native·legacy) 전용이다(계약 정본 서두 — v5 규칙을 v6에 자동 적용하지 않는다).
 */
export const CURRENT_SCENARIO_RULE_IDS = ["R1c", "R9", "R10", "R16", "R17", "R25", "R26", "R29", "R30"] as const satisfies readonly RuleId[];
export const CURRENT_MISSION_V6_RULE_IDS = ["R1", "R9", "R10", "R13", "R15", "R16", "R20", "R23", "R24", "R30", "R31", "R32"] as const satisfies readonly RuleId[];
export const CURRENT_PIPELINE_RULE_IDS = new Set<RuleId>([...CURRENT_SCENARIO_RULE_IDS, ...CURRENT_MISSION_V6_RULE_IDS]);

export const QUALITY_RULE_IDS_IN_CATALOG = Object.keys(QUALITY_RULE_CATALOG) as RuleId[];
export { ACTIVE_RULE_IDS, RETIRED_MISSION_RULE_IDS };
