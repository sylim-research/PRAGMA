// 관리자 화면 머리에 「누가 맡는가」를 적는 표시 이름(2026-10-29).
// 실제 호출 모델은 supabase/functions/_shared/openaiRequestContract.ts가 정본이다 — 거기를 바꾸면 여기도 바꾼다.
// 역할 배정 = 2026-10-26 연구자 확정(만드는 일 Gemini, 검사하는 일 Astra, 중→한 원문만 Astra).
import type { LanguageDirection } from "@/lib/pragma/enums";

export const GENERATION_MODEL_LABEL = "Gemini 3.1 Pro";
export const REVIEW_MODEL_LABEL = "GPT-6 Astra";
export const RULE_CHECK_LABEL = "규칙 점검 코드";

/** 시나리오 뼈대를 쓰는 모델 — 중→한은 중국어 원문이 출발 텍스트라 Astra가 쓴다(generate-scenario coreModel). */
export const scenarioAuthorModel = (direction: LanguageDirection) =>
  direction === "zh_ko" ? REVIEW_MODEL_LABEL : GENERATION_MODEL_LABEL;

/** 방향을 고르기 전에도 읽히도록 두 방향을 함께 적는다(2026-10-29 연구자 요청). */
export const SCENARIO_AUTHOR_LABEL = `한→중 ${scenarioAuthorModel("ko_zh")} · 중→한 ${scenarioAuthorModel("zh_ko")}`;
