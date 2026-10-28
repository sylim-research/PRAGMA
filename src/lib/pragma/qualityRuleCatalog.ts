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
   *  2026-10-29: 개발 용어를 풀어 쓰되, 원래 정보는 줄이지 않고 코드 이름을 괄호로 남긴다(연구자 지시 — 문장 다듬기는 뒤에 따로 한다). */
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
    summary_ko: "학습 미션이 정해진 형식(스키마)을 지키는지 확인한다. 문항 유형의 순서, 대비 계획(contrast_plan)의 슬롯, 판정 칸 코드(band code)가 모두 있는지 본다. 형식 검사에서 실패하면 나머지 규칙은 실행하지 않는다.",
  },
  R1c: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "시나리오가 정해진 형식(스키마)을 지키는지, 그리고 주제(theme)·하위 주제(topic)·영역(domain: 일상·학업·직장)의 조합이 목록에서 허용된 것인지 확인한다.",
  },
  R2: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "단일 판단 문항(judge3)에서 정답으로 인정하는 판정 칸(accepted 대역 라벨)의 수가 맞는지, 그리고 그 문항의 관계 조건(P·D·R)이 DCT 과제의 기준 장면(앵커)과 같은지 확인한다. 현행 형식(native MJT5)은 비적정 판정 칸이 1개여야 하고, 이전 형식(legacy)은 적절(within) 칸을 포함한다.",
    applicability_ko: "현행 형식(native MJT5)과 이전 형식(legacy) 미션에 서로 다른 조건을 적용한다.",
  },
  R3: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "수정안 고르기 문항(fix_choice)의 수정안 개수와 적절한 안(is_valid)의 개수를 확인한다. 현행 형식은 수정안 3개 중 적절한 안 1개, 이전 형식은 적절한 안 2개다. 관계 조건(P·D·R)이 DCT 기준 장면과 같은지도 본다.",
    applicability_ko: "현행 형식과 이전 형식 중 해당 미션의 형식에 맞는 조건 하나만 적용한다.",
  },
  R4: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "이유 문항에서 정답으로 지정한 이유가 실제로 존재하는지, 세 가지 역할(주된 이유·화용적 오해·의미·문법·맥락)의 이유가 각각 1개씩인지, 주된 이유가 일치하는지, 이유 문구가 서로 겹치지 않는지, 관계 조건이 기준 장면과 같은지 확인한다. 이전 형식의 이유 문항(reason_conf)에서 관계 조건이 다른 경우는 warning이다.",
  },
  R5: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "복수 비교 문항(multi_judge)의 후보 수, 판정 칸의 분포, 후보 문장의 중복, 후보끼리 관계 조건(P·D·R)이 한 축만 다른지를 확인한다. 문장 길이만으로 정답이 갈리는 경우는 warning으로 남기는데, 길이 차이가 4자 이상이면서 10% 이상일 때만 신호로 본다.",
  },
  R6: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "강조 표시(highlights)한 부분이 실제 문장(target) 안에 글자 그대로 들어 있는지 확인한다.",
  },
  R7: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "4단계 척도 문항(scale4)에서 정답 구간이 이어진 두 칸이고 같은 방향(적절 쪽 또는 부적절 쪽)인지, 기준 판정(reference)을 포함하는지 확인한다. 정답이 적절 방향인 반례 문항은 warning이다.",
  },
  R8: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "이전 형식 미션에는 앞선 발화(preceding_turn)가 있는지, 현행 형식(native MJT5)에는 앞선 발화가 없는지(장면만으로 성립하는지) 확인한다. 시나리오에 앞선 발화를 요구하던 조건은 2026-10-25에 폐기했다(앞선 발화를 더 이상 생성하지 않음).",
    applicability_ko: "이전 형식과 현행 형식 미션에 따라 조건이 다르다. 현행 시나리오 검사에는 쓰지 않는다.",
  },
  R9: {
    category: "일반화·사전 정보 노출 위험",
    nature: "signal",
    summary_ko: "상황·관계 설명, 해설, 비고 필드에서 「중국인은」「한국에서는」「한국 문화에서는」처럼 국가 단위로 일반화하는 것으로 읽힐 수 있는 한국어 정형 표현을 찾는다. 부정문(「~라고 일반화하면 안 된다」), 인용, 장소를 나타내는 표현(「한국에서는 설에 쉰다」)을 구별하지 못하므로 warning(교수자 확인 신호)으로만 남긴다.",
  },
  R10: {
    category: "언어 방향·문자 형식",
    nature: "structural",
    summary_ko: "요청한 언어 방향(한→중·중→한)과 데이터에 기록된 방향이 같은지, 그리고 원문·앞선 발화·문항 문장·후보·참고 표현이 방향에 맞는 문자(한글 또는 한자)로 쓰였는지 확인한다. 중국어로 써야 할 산출에 한글이 섞이면 불통과(fail)이고, 그 밖의 문자 범위 추정은 warning이다.",
  },
  R11: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "참고 표현(reference_alternatives)이 1~2개 있고, 문항마다 권장 예시(recommended_example)가 있는지 확인한다. 일부 결함은 R1 형식 검사가 먼저 걸러 낸다.",
  },
  R12: {
    category: "문항 구성·판정 데이터",
    nature: "signal",
    summary_ko: "미션 세트 전체에서 정답 판정 칸이 한 방향(적절 쪽이나 부적절 쪽)으로만 쏠렸는지, 적절(within)이 정답인 문항이 하나도 없는지 집계한다. 학습자가 판정 방향을 예측할 수 있게 되는 위험을 알리는 warning(교수자 확인 신호)이다.",
  },
  R13: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "미션의 목표 화용요소(target_feature)와 문항 초점(item_focus)이 목록(카탈로그)에 있는 것인지, 그 버전이 현행 버전과 같은지 확인한다.",
  },
  R14: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "학습자에게 보이는 목표 이름(learner_label)과 마무리 문구(closing_ko)가 목록(카탈로그)에 고정된 문구와 글자 그대로 같은지 확인한다. AI가 임의로 바꿔 쓰지 못하게 하는 검사다.",
  },
  R15: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "요청한 화행이 목록(카탈로그)의 화행, 문항 초점(item_focus)의 화행, 학습 목표(learning_goal)의 화행과 모두 같은지 확인한다.",
  },
  R16: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "요청한 수행 방식(번역·통역)과 원문 매체(글·말)가 서로 맞는지, 시나리오에 기록된 매체(source_modality)와 미션의 수행 방식(production_task.mode)이 요청과 같은지 확인한다(어긋나면 불통과). 상황 설명(situation_ko)이 반대 수행 장면을 명시한 것처럼 보이는 경우는 글자 패턴으로 추정한 것이라 warning이다.",
  },
  R17: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "산업 분야(industry)가 직장 영역(domain='work')에서만 지정됐는지 확인한다.",
  },
  R18: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "수정 문항·이유 문항의 「문제 문장」이 적절(within) 판정 칸으로 표시돼 있지 않은지 확인한다. 표시(라벨)만 확인할 뿐, 그 문장이 실제로 부적절한지는 판정하지 않는다.",
  },
  R19: {
    category: "문항 구성·판정 데이터",
    nature: "signal",
    summary_ko: "한 미션 안에서 문항 원문·문장·수정안·후보가 글자 그대로 겹치는지 찾는다(warning, 교수자 확인 신호). 현행 형식에서 R27이 같은 장면을 쓰도록 강제하는 MJT2·3·4(Anchor A 슬롯)의 원문·문장 공유는 제외하고, 그 밖의 재사용만 남긴다.",
  },
  R20: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "미션의 생성 기록(provenance)이 있고, 그 안에 모델명·프롬프트 판본·콘텐츠 지문(content_hash)·생성 시각·생성 시도 횟수가 모두 있는지 확인한다. 지문이 실제 내용과 맞는지(진위)는 검증하지 않는다.",
  },
  R21: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "수정안 고르기 문항(fix_choice)의 권장 예시가 부적절한 문장(target)이나 틀린 수정안(invalid)과 글자 그대로 같은 모순이 있는지 확인한다.",
  },
  R23: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "DCT 과제(production_task)의 원문(source_text), 관계 조건(P·D·R), 원문 매체(source_modality), 언어 방향(direction), 사용 가능한 사실(usable_facts)이 시나리오에 기록된 값과 정확히 같은지 확인한다. 시나리오의 설정을 미션이 그대로 물려받았는지 보는 검사다.",
    applicability_ko: "유효한 시나리오가 함께 전달된 경우에만 실행한다.",
  },
  R24: {
    category: "요청 조건·카탈로그 정합",
    nature: "structural",
    summary_ko: "생성을 요청한 쪽이 계획한 목표 화용요소(planned_target_feature)와, 생성된 미션에 기록된 목표 화용요소(unit.target_feature)가 같은지 확인한다.",
    applicability_ko: "계획한 목표 화용요소(planned_target_feature)가 전달된 생성 경로에서만 실행한다.",
  },
  R25: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "새로 생성한 시나리오에 서버가 넣는 상황 설정(context_spec)이 있는지, 그리고 통역 시나리오라면 화자 A·B와 통역자 C의 역할, 관계 조건(P·D·R)이 어느 두 사람 사이의 값인지에 대한 역할 계약 값이 있는지 확인한다.",
    applicability_ko: "서버가 상황 설정을 넣는 신규 생성 경로(require_context_spec=true)에서만 실행한다.",
  },
  R26: {
    category: "장면·원문 구성",
    nature: "signal",
    summary_ko: "직장 영역에서 산업이 지정된 시나리오에, 그 산업을 보여 주는 정해진 어휘 단서가 실제로 있는지 찾는다(warning, 교수자 확인 신호). 일괄 생성 경로에서는 이 신호가 뜬 경우에 한해 산업 적합성 AI 검토를 1회 덧붙인다.",
    applicability_ko: "직장 영역(domain='work')이고 산업이 지정된 시나리오에서만 실행한다.",
  },
  R27: {
    category: "장면·원문 구성",
    nature: "structural",
    summary_ko: "MJT 상황문 사이의 복사·중복 관계가 정해진 배치(X-A-A-A-Y-C: 다섯 문항과 DCT가 어떤 장면을 공유하는지)를 따르는지, 장면끼리 관계 조건(P·D·R)이 한 축만 다른지, 상황문 형식(종결 부호 개수로 근사한 문장 수)을 지키는지 확인한다. DCT 상황문 형식은 warning이다.",
    applicability_ko: "이전 형식(mission_v4·v5)이고 대비 계획(contrast_plan_v1)이 있는지에 따라 조건이 다르다.",
  },
  R28: {
    category: "수행 방식·역할·채널",
    nature: "structural",
    summary_ko: "문항의 전달 경로(channel)가 미션의 수행 방식과 허용된 짝인지 확인한다. 번역은 이메일·메신저, 통역은 대면·전화만 허용한다.",
  },
  R29: {
    category: "장면·원문 구성",
    nature: "structural",
    summary_ko: "원문의 유효 글자 수(공백·문장부호 제외)가 수준·수행 방식별 상한을 넘지 않는지(넘으면 불통과), 하한과 문장 수(2~4문장)를 지키는지(warning) 확인한다. 화용 집중 구간(focal_segments)은 핵심(head) 1개, 보조(support) 2개 이하이고 원문 안에 글자 그대로 있어야 한다. 참고 산출의 길이 비율이 크게 벗어나면 warning이다.",
    applicability_ko: "화용 집중 구간(focal_segments)이 있는 시나리오(v3 형식)와 이전 형식 미션(mission_v5)에서 실행한다.",
  },
  R30: {
    category: "일반화·사전 정보 노출 위험",
    nature: "signal",
    summary_ko: "학습자에게 보이는 상황 설명(시나리오, MJT·DCT의 situation_ko)에서 정중성·완화·선택권·강도처럼 답의 평가 기준을 미리 알려 주는 정형 표현 조합을 찾는다(warning, 교수자 확인 신호). 특정 단어를 금지하거나 자동으로 지우는 규칙이 아니며, 맥락은 교수자가 확인한다.",
    applicability_ko: "시나리오, 그리고 저장된 미션의 MJT·DCT 상황 설명이 대상이다.",
  },
  R31: {
    category: "생성 기록·계승·근거 귀속",
    nature: "governance",
    summary_ko: "문항별로 어느 모델이 무엇을 만들었고 그 근거가 무엇인지 기록한 귀속 기록(item_lineage)이 정해진 구조·범위·근거 번호·귀속 호출 정보를 갖췄는지 확인한다. 문헌이 그 표현을 실제로 뒷받침하는지는 판정하지 않는다.",
    applicability_ko: "이전 형식(mission_v5)은 현행 콘텐츠 판본으로 만들고 기록 작성이 끝난 미션만, 현행 형식(mission_v6)은 귀속 기록 작성이 끝난 미션만 검사한다. 오래된 판본은 건너뛴다.",
  },
  R32: {
    category: "생성 기록·계승·근거 귀속",
    nature: "signal",
    summary_ko: "귀속 기록에서 출처를 밝히지 못한 항목(model_unattributed)의 비율이 참조 상한 20%를 넘을 때만, 교수자가 먼저 확인할 항목이라는 warning(교수자 확인 신호)을 남긴다. 승인을 막지 않으며, 상한 이하이면 신호를 남기지 않는다(2026-09-21 연구자 결정).",
    applicability_ko: "R31과 같은 조건에서, 귀속 기록 범위가 갖춰진(covered) 경우에만 실행한다.",
  },
  R33: {
    category: "문항 구성·판정 데이터",
    nature: "structural",
    summary_ko: "미션이 선언한 진단 차원이 2~6개이고, 허용된 차원 이름이며, 서로 겹치지 않고, 각 차원의 근거 위치가 서로 다른 두 곳 이상인지 확인한다. 그 차원이 문항에 실제로 구현됐는지, 문헌 근거가 타당한지는 판정하지 않는다.",
    applicability_ko: "이전 형식(mission_v5) 중 현행 콘텐츠 판본으로 만든 미션만 검사한다.",
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
