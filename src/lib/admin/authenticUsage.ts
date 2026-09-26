// 실제 자료 분석의 활용 유형 — 화면 표시와 시나리오 생성 경로를 한곳에서 정한다.
//
// 내부 분류값(usage_type)은 운영 프롬프트·보관함과 같은 값을 그대로 쓴다. 화면 이름만 현행 설계에 맞춘다.
// 현행 학습 미션은 선행 발화 없이 상황 안에서 완결되고, 통번역 과제는 출발 텍스트를 옮기는 과제다.
// 그래서 선행 발화·후속 반응 과제로 분류된 자료는 관계·상황을 이해하는 참고 자료로만 두고,
// 출발 텍스트 없이 응답하게 하는 과제로 이어지는 「시나리오 만들기」 경로를 열지 않는다.

export type AuthenticUsageType =
  | "scenario_seed"
  | "preceding_turn"
  | "translation_source"
  | "response_task"
  | "expression_resource"
  | "unsuitable";

export const AUTHENTIC_USAGE_TYPES: readonly AuthenticUsageType[] = [
  "scenario_seed",
  "preceding_turn",
  "translation_source",
  "response_task",
  "expression_resource",
  "unsuitable",
];

export const AUTHENTIC_USAGE_LABEL: Record<AuthenticUsageType, string> = {
  scenario_seed: "시나리오",
  preceding_turn: "상황 맥락 참고",
  translation_source: "출발 텍스트",
  response_task: "응답 맥락 참고",
  expression_resource: "참고 표현 후보",
  unsuitable: "미션 부적합",
};

/** 관계·상황 이해용 참고 자료 — 시나리오 생성으로 보내지 않는다. */
export const AUTHENTIC_CONTEXT_REFERENCE_TYPES: readonly AuthenticUsageType[] = ["preceding_turn", "response_task"];

/** 「시나리오 만들기」로 생성기에 넘길 수 있는 유형. */
export const AUTHENTIC_GENERATABLE_TYPES: readonly AuthenticUsageType[] = ["scenario_seed", "translation_source"];

export const isAuthenticUsageType = (value: unknown): value is AuthenticUsageType =>
  typeof value === "string" && (AUTHENTIC_USAGE_TYPES as readonly string[]).includes(value);

export const authenticUsageLabel = (value: string) =>
  isAuthenticUsageType(value) ? AUTHENTIC_USAGE_LABEL[value] : value;

/** 생성 경로 gate — 유형이 허용되고 넘길 출발 텍스트가 있어야 한다. */
export const canMakeScenarioFromAuthentic = (usageType: string, sourceText: string | null | undefined) =>
  isAuthenticUsageType(usageType)
  && AUTHENTIC_GENERATABLE_TYPES.includes(usageType)
  && !!(sourceText ?? "").trim();
