// Shared PRAGMA enums/labels used by AdminGenerator, 배치 러너, and curriculum UI.
// Extracted verbatim from AdminGenerator.tsx — values/keys/labels unchanged.
//
// Generator-only helpers intentionally REMAIN in AdminGenerator.tsx and are NOT
// moved here: SPEECH_ACT_UI_TO_INTERNAL and the scenario prompt/save mappings.
//
// 2026-07-22: CHANNEL_TO_GENRE·COMPLEX_TASK_TO_CONTEXT는 여기로 올렸다.
// "생성기 전용"이라는 원래 판단은 소비자가 하나였을 때의 것이고, 배치 러너가
// 같은 매핑으로 저장 payload를 만들어야 하므로 복제하면 조용히 갈라진다.

// ── Speech act — UI-only taxonomy (9) ──
// NOTE: internal_key `agreement` is FROZEN (persisted in scenarios.speech_act /
// decision_traces.speech_act, docs/ENUMS.md registry). Its DISPLAY LABEL was changed
// 동의→"초대" (concept = 초대·공동행동 권유 / invitation; short 2-char label for UI
// uniformity across the 9 acts). 동의 is no longer a top-level act (absorbed into
// `opposition` response strategies). Key kept for DB stability; act_position of
// `agreement` is now INITIATING (invitation is an initiating act), see docs/ENUMS.md §12.
export type SpeechActUI =
  | "request" | "refusal" | "apology" | "thanks"
  | "proposal" | "agreement" | "opposition" | "compliment" | "complaint";
export const SPEECH_ACT_UI: Record<SpeechActUI, string> = {
  request: "요청",
  refusal: "거절",
  apology: "사과",
  thanks: "감사",
  proposal: "제안",
  agreement: "초대",
  opposition: "반대",
  compliment: "칭찬",
  complaint: "불만",
};
// 콜드 오픈 질문("{목표어}로는 어떻게 __ 좋을까?")에 끼우는 동사형.
// SPEECH_ACT_UI의 명사를 그대로 쓰면 "감사하면"·"불만하면"처럼 깨지므로 별도로 둔다.
// 정답 하나를 암시하지 않도록 당위형("해야 할까") 대신 "하면 좋을까" 어미를 전제한다.
export const SPEECH_ACT_VERB_KO: Record<SpeechActUI, string> = {
  request: "요청하면",
  refusal: "거절하면",
  apology: "사과하면",
  thanks: "고마움을 전하면",
  proposal: "제안하면",
  agreement: "초대하면",
  opposition: "반대 의견을 말하면",
  compliment: "칭찬하면",
  complaint: "불만을 전하면",
};
export const SPEECH_ACT_UI_EN: Record<SpeechActUI, string> = {
  request: "Request",
  refusal: "Refusal",
  apology: "Apology",
  thanks: "Thanks",
  proposal: "Suggestion",
  agreement: "Invitation",
  opposition: "Disagreement",
  compliment: "Compliment",
  complaint: "Complaint",
};

// ── Learner level (3-tier) ──
export type LearnerLevel = "beginner_intermediate" | "intermediate" | "advanced";
export const LEVEL: Record<LearnerLevel, string> = {
  beginner_intermediate: "입문",
  intermediate: "중급",
  advanced: "고급",
};
/** 중국어 누적 어휘 참고 상한. PRAGMA 수준과 HSK 숙달도의 등가 표가 아니다. */
export const HSK_REFERENCE_CEILING: Record<LearnerLevel, 4 | 5 | 6> = {
  beginner_intermediate: 4,
  intermediate: 5,
  advanced: 6,
};

// ── Language direction ──
// 양방향 일반화(계약 0-l·82). 코딩 정본 = ko_zh/zh_ko(승격 파이프라인 계열).
// entryGate의 ko_to_zh·legacy ko-zh(하이픈)는 각자 영역에 동결 — 신규 저장 금지.
export type LanguageDirection = "ko_zh" | "zh_ko";
export const DIRECTION_LABEL: Record<LanguageDirection, string> = {
  ko_zh: "한→중",
  zh_ko: "중→한",
};
/** 방향별 언어 배정(계약 0-l·82·90). source/target = 문자 검사(R10)·라벨용, tts/stt = 통역용. */
export const DIRECTION_LANGS: Record<
  LanguageDirection,
  { source: "ko" | "zh"; target: "ko" | "zh"; tts: string; stt: string }
> = {
  ko_zh: { source: "ko", target: "zh", tts: "ko-KR", stt: "zh-CN" },
  zh_ko: { source: "zh", target: "ko", tts: "zh-CN", stt: "ko-KR" },
};
/** 부재 시 기본 방향(기존 데이터 호환 — 계약 0-l·82). */
export const DEFAULT_DIRECTION: LanguageDirection = "ko_zh";

// ── Channel (4) + derived mode ──
export type ChannelUI = "email" | "messenger" | "facetoface" | "phone";
export const CHANNEL_UI: Record<ChannelUI, string> = {
  email: "이메일",
  messenger: "메신저",
  facetoface: "대면",
  phone: "전화",
};
export type GenMode = "translation" | "stt_interpreting";
export const MODE_LABEL: Record<GenMode, string> = {
  translation: "번역",
  stt_interpreting: "통역",
};
export const CHANNEL_TO_MODE: Record<ChannelUI, GenMode> = {
  email: "translation",
  messenger: "translation",
  facetoface: "stt_interpreting",
  phone: "stt_interpreting",
};

// ── P·D·R ──
// D/R expanded 2→3 values (2026-07-19) per scenario-matrix LOCK (D: 친밀·지인·초면 / R: 저·중·고).
// Existing keys kept frozen for stored data; new keys: acquaintance(지인), mid(중간).
// D operational definitions: close=사적 관계 / acquaintance=인지하나 개인적 관계 없음 / formal=상호작용 이력 0(초면).
export type PdrPower = "higher" | "equal" | "lower";
export type PdrDistance = "close" | "acquaintance" | "formal";
export type PdrBurden = "low" | "mid" | "high";
export const PDR_POWER: Record<PdrPower, string> = {
  higher: "내가 낮음",
  equal: "동등",
  lower: "내가 높음",
};
export const PDR_DISTANCE: Record<PdrDistance, string> = {
  close: "친밀 (가까운 사이)",
  acquaintance: "지인 (알지만 어색)",
  formal: "초면 (멂)",
};
export const PDR_BURDEN: Record<PdrBurden, string> = {
  low: "낮음",
  mid: "중간",
  high: "높음",
};
export const PDR_POWER_SHORT: Record<PdrPower, string> = {
  higher: "P: 내가 낮음",
  equal: "P: 동등",
  lower: "P: 내가 높음",
};
export const PDR_DISTANCE_SHORT: Record<PdrDistance, string> = {
  close: "D: 친밀",
  acquaintance: "D: 지인",
  formal: "D: 초면",
};
export const PDR_BURDEN_SHORT: Record<PdrBurden, string> = {
  low: "R: 낮음",
  mid: "R: 중간",
  high: "R: 높음",
};

// ── DB enum 매핑 (UI 분류 → 저장 값) ──
// 시나리오 생성·저장 payload가 쓰는 내부 enum. UI 축(채널 4·복합과업 4)을
// DB가 가진 좁은 값 집합으로 접는다.
export type Genre = "business_email" | "business_messenger" | "meeting_speech";
export const CHANNEL_TO_GENRE: Record<ChannelUI, Genre> = {
  email: "business_email",
  messenger: "business_messenger",
  facetoface: "meeting_speech",
  phone: "business_messenger",
};

export type InteractionContext = "coordination" | "negotiation" | "follow_up";
export type ComplexTaskUI = "none" | "persuade" | "coordinate" | "negotiate";
export const COMPLEX_TASK_TO_CONTEXT: Record<ComplexTaskUI, InteractionContext> = {
  none: "follow_up",
  persuade: "negotiation",
  coordinate: "coordination",
  negotiate: "negotiation",
};

// ── Domain (3) ──
export type Domain = "daily" | "school" | "work";
export const DOMAIN: Record<Domain, string> = {
  daily: "일상",
  school: "학업",
  work: "직장",
};

// ── Industry sector (7, UI-only remap onto existing enum keys) ──
export type IndustrySector =
  | "trade_distribution"
  | "IT_platform"
  | "manufacturing"
  | "tourism_hospitality"
  | "education_research"
  | "public_international_affairs"
  | "culture_content_media";
export const INDUSTRY: Record<IndustrySector, string> = {
  culture_content_media: "엔터테인먼트·미디어",
  manufacturing: "뷰티·패션·커머스",
  trade_distribution: "제조·글로벌 무역",
  IT_platform: "IT·테크·플랫폼",
  public_international_affairs: "바이오·의료·헬스케어",
  tourism_hospitality: "관광·MICE",
  education_research: "공공·교육·연구",
};

// ── Business function (work-domain task context) ──
// DB에는 legacy 10개 값이 남아 있으나, 생성 UI는 취업·실무 활용성이 높은 대표 7개만
// 노출한다. 합쳐진 legacy 값은 같은 표시 라벨로 읽을 수 있게 유지한다.
export type BusinessFunction =
  | "overseas_sales"
  | "marketing_pr"
  | "customer_partner_support"
  | "SCM_logistics"
  | "contract_terms"
  | "project_coordination"
  | "research_admin"
  | "localization_translation"
  | "event_operations"
  | "international_collaboration";

export const BUSINESS_FUNCTION: Record<BusinessFunction, string> = {
  overseas_sales: "해외영업·거래",
  marketing_pr: "마케팅·홍보",
  customer_partner_support: "고객·파트너 응대",
  SCM_logistics: "구매·물류",
  contract_terms: "해외영업·거래",
  project_coordination: "프로젝트 운영",
  research_admin: "대외협력·제휴",
  localization_translation: "번역·로컬라이제이션",
  event_operations: "프로젝트 운영",
  international_collaboration: "대외협력·제휴",
};

export const BUSINESS_FUNCTION_PRIMARY: BusinessFunction[] = [
  "overseas_sales",
  "marketing_pr",
  "customer_partner_support",
  "SCM_logistics",
  "project_coordination",
  "localization_translation",
  "international_collaboration",
];
