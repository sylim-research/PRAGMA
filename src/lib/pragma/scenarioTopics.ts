// 편성층 메타데이터 — theme_code(강좌 기획 단위) + topic 카탈로그(장면 시드).
// 생성계약 v1.3 §2b · 0-c·24~26. 코드 정본, AI 임의 생성 금지.
//
// 왜 domain과 별개인가:
// - domain(일상/학업/직장) = 교육 편성·소재 층. P·D·R과 같은 화용 구인축이 아니다.
// - theme_code(7종) = 콘텐츠 검색·편성용 소재 영역(대학생활·학업 등). domain을
//   대체하지 않는 교차 축이다. theme↔domain 허용 매핑을 코드로 못박아 모순 생성을 막는다.
// - topic_code = Dai 2023 기반 장면 시드의 형식화. 배치 생성이 시드에서 상황을 뽑으므로
//   "생성 입력이 곧 태그"(태깅 비용 0).
//
// ⚠️ 논문 서술 경계(0-c·24): theme·topic은 화용 판정 변인이 아니라 콘텐츠 검색·편성 및
//    상황 다양성 확보용 운영 메타데이터다. 새 화용 변인으로 설명하지 않는다.

import type {
  Domain,
  GenMode,
  LanguageDirection,
  LearnerLevel,
  PdrDistance,
  PdrPower,
  SpeechActUI,
} from "@/lib/pragma/enums";
import type { CourseMode } from "@/lib/curriculum/courseModePolicy";
import { LEGACY_SCENARIO_TOPICS } from "@/lib/pragma/scenarioTopicsLegacy";

// ── theme_code (현행 제작·선택용 7종 통제값) ──────────────────────────
export const THEME_CODES = [
  "campus_study",
  "daily_living",
  "relationship_social",
  "career_workplace",
  "commerce_customer",
  "digital_content",
  "international_exchange",
] as const;
export type ThemeCode = (typeof THEME_CODES)[number];

export const THEME_LABEL: Record<ThemeCode, string> = {
  campus_study: "대학생활·학업",
  daily_living: "일상생활",
  relationship_social: "친구·대인관계",
  career_workplace: "취업·직장",
  commerce_customer: "상거래·고객응대",
  digital_content: "콘텐츠·SNS·플랫폼",
  international_exchange: "유학·국제교류",
};

/** theme → 허용 domain. 코어 검사(R1c)가 참조 — 모순 생성 차단. */
export const THEME_ALLOWED_DOMAINS: Record<ThemeCode, Domain[]> = {
  campus_study: ["school"],
  daily_living: ["daily"],
  relationship_social: ["daily"],
  career_workplace: ["work"],
  commerce_customer: ["daily", "work"], // 고객 입장=일상 / 응대 직원=직장
  digital_content: ["daily", "work"], // SNS 이용자=일상 / 크리에이터·마케터=직장
  international_exchange: ["school", "daily"],
};

// ── topic 카탈로그 (장면 시드) ────────────────────────────────────────
export interface ScenarioTopic {
  code: string;
  labelKo: string;
  themeCode: ThemeCode;
  /** 이 topic이 놓일 수 있는 domain (theme 허용 domain의 부분집합) */
  allowedDomains: Domain[];
  /** 이 topic에 어울리는 화행. 비우면 전 화행 허용 */
  allowedSpeechActs?: SpeechActUI[];
  /**
   * 사건 자체가 특정 역할 관계를 요구할 때만 제한한다.
   * 일반 topic은 역할을 고정하지 않고 서버의 context_spec이 P·D에 맞는 역할을 정한다.
   */
  allowedPowers?: PdrPower[];
  allowedDistances?: PdrDistance[];
  /** 특정 수행 방식에서만 성립하는 사건일 때만 제한한다. 기본값은 번역·통역 모두 허용. */
  allowedModes?: GenMode[];
  /** 생성 프롬프트 주입용 사건 시드. P·D 관계와 전달 매체를 가능한 한 고정하지 않는다. */
  situationSeedKo: string;
  sourceNote?: string;
}

export interface TopicContext {
  speechAct: SpeechActUI;
  domain: Domain;
  power: PdrPower;
  distance: PdrDistance;
  mode: GenMode;
}

/**
 * topic은 연구축이 아니라 사건 후보이므로, 이미 정해진 화행·P·D·mode·domain에
 * 맞는 것만 선택한다. R은 화행별 사건 무게를 context_spec에서 구체화하므로
 * topic 카탈로그의 전역 허용값으로 고정하지 않는다.
 */
export function topicSupportsContext(
  topic: Pick<ScenarioTopic, "allowedDomains" | "allowedSpeechActs" | "allowedPowers" | "allowedDistances" | "allowedModes">,
  context: TopicContext,
): boolean {
  return (
    topic.allowedDomains.includes(context.domain) &&
    (!topic.allowedSpeechActs || topic.allowedSpeechActs.includes(context.speechAct)) &&
    (!topic.allowedPowers || topic.allowedPowers.includes(context.power)) &&
    (!topic.allowedDistances || topic.allowedDistances.includes(context.distance)) &&
    (!topic.allowedModes || topic.allowedModes.includes(context.mode))
  );
}

// 정치·시사·정부 기관 소재는 배제(§7-1). 학부 수업 콘텐츠 적합성 우선.
export const SCENARIO_TOPICS: ScenarioTopic[] = [
  // ── campus_study (school) ──
  {
    code: "deadline_extension",
    labelKo: "과제 마감 연장 요청",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "apology"],
    allowedPowers: ["higher"],
    allowedDistances: ["acquaintance"],
    situationSeedKo: "교수/조교에게 과제 제출 기한을 미뤄 달라고 부탁하는 상황",
    sourceNote: "Dai 2023 학업 상호작용",
  },
  {
    code: "office_hour_request",
    labelKo: "면담·질문 시간 요청",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request"],
    allowedPowers: ["higher"],
    allowedDistances: ["acquaintance"],
    situationSeedKo: "교수에게 면담 시간을 잡아 달라고 요청하거나 수업 내용을 다시 묻는 상황",
  },
  {
    code: "group_work_coordination",
    labelKo: "조별 과제 상호작용",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "thanks", "proposal", "complaint"],
    situationSeedKo: "조별 과제를 함께 수행하는 학생들 사이에서 생기는 상호작용 상황",
  },
  {
    code: "school_request_refusal",
    labelKo: "학교 과제 역할 거절",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["refusal"],
    situationSeedKo: "학교 관계의 상대가 부탁한 과제 관련 역할을 맡지 않겠다고 알리는 상황",
  },
  {
    code: "school_activity_invitation",
    labelKo: "학교 활동 초대",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["agreement"],
    situationSeedKo: "학교 관계의 상대에게 스터디·학과 행사·교내 활동에 함께 참여하자고 초대하는 상황",
  },
  {
    code: "school_viewpoint_opposition",
    labelKo: "학교 의견 반대",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["opposition"],
    situationSeedKo: "학교 관계의 상대가 수업이나 조별과제에서 제시한 의견과 다른 견해를 밝히는 상황",
  },
  {
    code: "school_academic_compliment",
    labelKo: "학교 학업 칭찬",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["compliment"],
    situationSeedKo: "학교 관계의 상대가 발표나 과제에서 보인 구체적인 강점을 칭찬하는 상황",
  },
  {
    code: "recommendation_letter_request",
    labelKo: "추천서 부탁",
    themeCode: "campus_study",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "thanks"],
    allowedPowers: ["higher"],
    allowedDistances: ["acquaintance"],
    situationSeedKo: "교수에게 유학·장학 추천서를 부탁하고 이후 감사를 전하는 상황",
  },

  // ── daily_living (daily) ──
  // 경계 규칙(계약 0-k·81⑤): 친구 "관계 유지"가 초점이면 relationship_social,
  // 이웃·상인 등 비인격적 관계의 생활 문제면 daily_living. (예: borrow_favor=이웃 계열 /
  // favor_thanks=친구 관계 계열)
  {
    code: "neighbor_noise",
    labelKo: "이웃 소음 문제",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "complaint"],
    situationSeedKo: "상대 이웃이 낸 생활 소음으로 불편을 겪은 화자가 그 이웃에게 소음을 줄여 달라고 말하는 상황",
  },
  {
    code: "neighbor_noise_apology",
    labelKo: "이웃 소음 사과",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "화자 본인의 집에서 난 생활 소음으로 상대 이웃에게 불편을 준 책임을 인정하고 사과하는 상황",
  },
  {
    code: "borrow_favor",
    labelKo: "물건·도움 빌리기",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "thanks"],
    situationSeedKo: "친구·이웃에게 물건을 빌리거나 작은 도움을 청하고 감사를 전하는 상황",
  },
  {
    code: "club_meetup_invite",
    labelKo: "동호회·모임 초대",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["agreement", "refusal"],
    situationSeedKo: "동호회 모임에 초대하거나 초대를 정중히 거절하는 상황",
  },

  // ── relationship_social (daily) ──
  {
    code: "invitation_refusal",
    labelKo: "초대 거절",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["refusal"],
    situationSeedKo: "일상 관계의 상대가 한 식사·행사 초대를 거절하는 상황",
  },
  {
    code: "congratulation_gift",
    labelKo: "축하·선물 감사",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["thanks", "compliment"],
    situationSeedKo: "일상 관계의 상대가 건넨 선물·축하에 감사를 전하거나 상대를 칭찬하는 상황",
  },
  {
    code: "apology_lateness",
    labelKo: "약속 늦음 사과",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "일상 관계의 상대와 한 약속에 늦거나 약속을 지키지 못해 사과하는 상황",
  },
  {
    code: "favor_thanks",
    labelKo: "도움에 대한 감사",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["thanks"],
    situationSeedKo: "일상 관계의 상대가 베푼 도움의 크기에 맞게 감사를 전하는 상황",
  },

  // ── career_workplace (work) ──
  {
    code: "schedule_change",
    labelKo: "회의·일정 변경",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["request", "apology", "proposal"],
    situationSeedKo: "상사·동료·거래처에 회의나 마감 일정 변경을 요청·통보하는 상황",
  },
  {
    code: "task_delegation_refusal",
    labelKo: "업무 요청 거절",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["refusal"],
    situationSeedKo: "직장 관계의 상대가 요청한 추가 업무를 맡지 않겠다고 알리는 상황",
  },
  {
    code: "delay_apology",
    labelKo: "납기·업무 지연 사과",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "직장 관계의 상대에게 납기·업무 지연을 사과하고 후속을 알리는 상황",
  },
  {
    code: "collaboration_proposal",
    labelKo: "협업·개선 제안",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["proposal", "opposition"],
    situationSeedKo: "직장 관계의 상대에게 협업 방식이나 업무 개선을 제안하는 상황",
  },
  // 시드 작성 규칙: P·D 관계와 수행 매체를 고정하지 않는다. 셀 축이 시드보다 우선하며,
  // 번역·통역 어느 모드에서도 같은 소재를 관계·장면에 맞게 재구성할 수 있어야 한다.
  {
    code: "work_support_thanks",
    labelKo: "업무 도움 감사",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["thanks"],
    situationSeedKo: "직장 관계의 상대가 업무 검토·협조·문제 해결에 도움을 준 뒤, 그 구체적인 기여에 감사를 전하는 상황",
  },
  {
    code: "work_activity_invitation",
    labelKo: "직장 공동 활동 초대",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["agreement"],
    situationSeedKo: "직장 관계의 상대에게 점심·직무 스터디·사내 행사 등 공동 활동에 함께 참여하자고 초대하는 상황",
  },
  {
    code: "work_process_complaint",
    labelKo: "업무 과정 불만",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["complaint"],
    situationSeedKo: "직장 관계의 상대에게 반복된 일정 변경·업무 전달 누락·품질 문제로 겪은 어려움을 알리는 상황",
  },

  // ── commerce_customer (daily | work) ──
  {
    code: "refund_request",
    labelKo: "환불·교환 요청",
    themeCode: "commerce_customer",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "complaint"],
    situationSeedKo: "구매한 상품의 환불·교환을 판매자에게 요청하는 상황(고객 입장)",
  },
  {
    code: "complaint_response",
    labelKo: "고객 불만 응대",
    themeCode: "commerce_customer",
    allowedDomains: ["work"],
    allowedSpeechActs: ["apology", "proposal"],
    situationSeedKo: "고객의 불만에 사과하고 해결책을 제시하는 상황(응대 직원 입장)",
  },
  {
    code: "price_negotiation",
    labelKo: "가격·조건 문의",
    themeCode: "commerce_customer",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["request", "proposal"],
    situationSeedKo: "판매자·거래처에 가격이나 조건을 문의·조정하는 상황",
  },

  // ── digital_content (daily | work) ──
  // ⚠️ 정의 축소(계약 0-k·81③): 콘텐츠 제작·게시·커뮤니티 운영·크리에이터 협업만.
  //    "메신저·단체방을 썼다"는 매체 사실만으로 digital에 분류하지 않는다(매체 = channel 축).
  {
    code: "collab_dm_request",
    labelKo: "콘텐츠 협업 제안",
    themeCode: "digital_content",
    allowedDomains: ["work"],
    allowedSpeechActs: ["proposal", "request"],
    situationSeedKo: "크리에이터·브랜드 담당자 사이에서 콘텐츠 협업의 범위나 조건을 제안·요청하는 상황",
  },
  {
    code: "comment_feedback_disagreement",
    labelKo: "콘텐츠 피드백·이견",
    themeCode: "digital_content",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["opposition"],
    situationSeedKo: "상대가 만든 콘텐츠에 관해 상대가 명시한 하나의 평가·제안과 같은 명제를 두고 이견을 밝히는 상황",
  },
  {
    code: "content_strength_compliment",
    labelKo: "콘텐츠 강점 칭찬",
    themeCode: "digital_content",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["compliment"],
    situationSeedKo: "상대가 만든 콘텐츠에서 직접 확인한 구체적인 강점을 상대에게 칭찬하는 상황",
  },
  {
    code: "content_reuse_permission",
    labelKo: "콘텐츠 사용 허락",
    themeCode: "digital_content",
    allowedDomains: ["daily", "work"],
    allowedSpeechActs: ["request", "refusal"],
    situationSeedKo: "다른 크리에이터에게 콘텐츠 2차 사용 허락을 요청하거나, 온 요청을 정중히 거절하는 상황",
  },
  // 구 group_chat_coordination(단체방 일정 조율)은 매체 기준 분류라 삭제 —
  // 목적 기준으로 2분할(계약 0-k·81③). campus 팀플 조율은 기존 group_work_coordination이 담당.
  {
    code: "work_team_chat_coordination",
    labelKo: "업무 협업 조율",
    themeCode: "career_workplace",
    allowedDomains: ["work"],
    allowedSpeechActs: ["request", "proposal"],
    situationSeedKo: "직장 관계의 상대들과 일정·업무 분담·보고 순서를 조율하는 상황",
  },
  {
    code: "friend_group_plan_coordination",
    labelKo: "모임 약속 조율",
    themeCode: "relationship_social",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["proposal", "refusal", "agreement"],
    situationSeedKo: "일상 모임의 날짜·장소를 조율하거나 변경을 제안·거절하는 상황",
  },

  // ── international_exchange (school | daily) ──
  {
    code: "exchange_program_inquiry",
    labelKo: "교환·유학 문의",
    themeCode: "international_exchange",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request"],
    allowedPowers: ["higher"],
    allowedDistances: ["acquaintance", "formal"],
    situationSeedKo: "교환학생·유학 담당자에게 절차·서류를 문의하는 상황",
  },
  {
    code: "host_family_thanks",
    labelKo: "호스트·도움 감사",
    themeCode: "international_exchange",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["thanks"],
    situationSeedKo: "유학·교류 생활에서 함께 지낸 호스트 가족이나 생활 적응을 도운 현지 버디가 제공한 숙소·생활 도움에 감사를 전하는 상황",
  },
  {
    code: "cultural_misunderstanding_apology",
    labelKo: "문화 차이 오해 사과",
    themeCode: "international_exchange",
    allowedDomains: ["daily", "school"],
    allowedSpeechActs: ["apology"],
    situationSeedKo: "문화 차이로 생긴 오해나 실수를 현지 상대에게 사과하는 상황",
  },
  // 보강 3종(계약 0-k·81④) — 국제교류 "프로그램 고유" 장면만. 비자·정부기관은 §7-1
  // 소재 배제와 충돌로 기각, 은행·통신은 daily 소속 원칙.
  {
    code: "buddy_program_arrangement",
    labelKo: "버디 프로그램 조율",
    themeCode: "international_exchange",
    allowedDomains: ["school", "daily"],
    allowedSpeechActs: ["request", "proposal", "thanks"],
    allowedPowers: ["equal"],
    allowedDistances: ["formal", "acquaintance"],
    situationSeedKo: "배정된 버디(도우미 학생)와 만남 약속·활동 일정을 조율하는 상황. 처음 연락하는지 이미 교류했는지 지정 D에 맞는 실제 접촉 이력을 구체화한다.",
  },
  {
    code: "exchange_housing_assignment",
    labelKo: "교환 기숙사 조정",
    themeCode: "international_exchange",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "complaint"],
    allowedPowers: ["higher"],
    allowedDistances: ["acquaintance", "formal"],
    situationSeedKo: "국제교류처가 배정한 기숙사 방·입실 일정의 문제를 알리고 조정을 요청하는 상황",
  },
  {
    code: "exchange_orientation_schedule",
    labelKo: "오리엔테이션 일정",
    themeCode: "international_exchange",
    allowedDomains: ["school"],
    allowedSpeechActs: ["request", "apology"],
    allowedPowers: ["higher"],
    allowedDistances: ["acquaintance", "formal"],
    situationSeedKo: "교환학생 오리엔테이션 일정을 문의하거나 불참·지각에 대해 양해를 구하는 상황",
  },
  // 의료·생활서비스(계약 0-k·81⑤) — 여행·유학 실전 최빈 장면. primary theme = daily.
  {
    code: "hospital_pharmacy_visit",
    labelKo: "병원·약국 이용",
    themeCode: "daily_living",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "thanks"],
    situationSeedKo: "병원·약국에서 증상을 설명하고 예약 변경이나 복용 안내를 요청하는 상황",
  },
];

// ── 조회 헬퍼 ─────────────────────────────────────────────────────────
type StoredScenarioTopic = ScenarioTopic | (typeof LEGACY_SCENARIO_TOPICS)[number];
const TOPIC_BY_CODE: Record<string, StoredScenarioTopic> = Object.fromEntries(
  [...SCENARIO_TOPICS, ...LEGACY_SCENARIO_TOPICS].map((t) => [t.code, t]),
);

/** 저장된 자료의 원래 메타데이터 검사에 사용한다. 신규 선택 목록에는 과거 시드를 넣지 않는다. */
export function getScenarioTopic(code: string): StoredScenarioTopic | undefined {
  return TOPIC_BY_CODE[code];
}

export function topicsForTheme(theme: ThemeCode): ScenarioTopic[] {
  return SCENARIO_TOPICS.filter((t) => t.themeCode === theme);
}

/** theme↔domain 허용 매핑 검사(R1c). */
export function isThemeDomainValid(theme: string, domain: Domain): boolean {
  if (theme === "travel_mobility") return domain === "daily";
  return THEME_ALLOWED_DOMAINS[theme as ThemeCode]?.includes(domain) ?? false;
}

/** 배치 전 최소 요건(0-c·25): theme당 topic ≥3. */
export function assertTopicCoverage(): { ok: boolean; short: ThemeCode[] } {
  const short = THEME_CODES.filter((th) => topicsForTheme(th).length < 3);
  return { ok: short.length === 0, short };
}

// ── 15주 프리셋 (편성기 config — 스키마 아님, 0-c·26) ──────────────────
export interface CoursePreset {
  outline_id: string;
  preset_code: string;
  label: string;
  target_level: LearnerLevel;
  language_direction: LanguageDirection;
  primary_domain: Domain;
  included_themes: ThemeCode[];
  /** 화행 배분 가중치(합 임의 — 비율로 정규화). 비우면 균등 */
  speech_act_distribution?: Partial<Record<SpeechActUI, number>>;
  course_mode: CourseMode;
  /** 과거 DB의 주수 필드와 호환용. 현행 통번역형의 주차별 모드를 결정하지 않는다. */
  target_interpreting_week_count: number;
  /**
   * 반복 원칙 1문장 — 편성표에 노출(0-g·47, RQ2 증명 장치).
   * 이 강좌가 어떤 화용 초점을 어떤 순서·비중으로 반복 노출하는지 한 문장으로 밝힌다.
   */
  repetition_principle: string;
}

export const COURSE_PRESETS: CoursePreset[] = [
  {
    outline_id: "915fec24-cc38-4b00-a2a0-c3628abcd3f7",
    preset_code: "ko_zh_pragmatic_translation_interpreting",
    label: "AI 한중 화용 통번역",
    target_level: "intermediate",
    language_direction: "ko_zh",
    primary_domain: "school",
    included_themes: [
      "campus_study",
      "international_exchange",
      "relationship_social",
      "daily_living",
    ],
    course_mode: "mixed",
    target_interpreting_week_count: 6,
    repetition_principle:
      "각 화행 학습 주차에 일상·학업 맥락의 서로 다른 상황으로 번역 미션과 통역 미션을 하나씩 수행한다.",
  },
  {
    outline_id: "a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21",
    preset_code: "ko_zh_business_communication",
    label: "AI 한중 비즈니스 통번역",
    target_level: "advanced",
    language_direction: "ko_zh",
    primary_domain: "work",
    included_themes: ["career_workplace", "commerce_customer", "digital_content"],
    course_mode: "mixed",
    target_interpreting_week_count: 6,
    repetition_principle:
      "각 화행 학습 주차에 직장·고객·플랫폼 맥락의 서로 다른 상황으로 번역 미션과 통역 미션을 하나씩 수행한다.",
  },
  {
    outline_id: "c3f9a2d7-6e84-4f61-a953-2b7d9c0e4a12",
    preset_code: "zh_ko_practical_translation",
    label: "AI 중한 실전 통번역",
    target_level: "intermediate",
    language_direction: "zh_ko",
    primary_domain: "daily",
    included_themes: [
      "digital_content",
      "career_workplace",
      "commerce_customer",
      "campus_study",
      "daily_living",
    ],
    course_mode: "mixed",
    target_interpreting_week_count: 3,
    repetition_principle:
      "각 화행 학습 주차에 서로 다른 중국어 상황·원문으로 한국어 번역 미션과 통역 미션을 하나씩 수행한다.",
  },
];

export const DEFENSE_COURSE_IDS = COURSE_PRESETS.map((preset) => preset.outline_id);

const PREVIOUS_STANDARD_COURSE_TITLES: Record<string, string> = {
  "915fec24-cc38-4b00-a2a0-c3628abcd3f7": "AI 한중 화용 통번역 실습",
  "a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21": "AI 한중 비즈니스 통번역 실습",
};

/** 기존 DB의 표준 3과목 이름만 새 표시명으로 읽는다. 교수자가 지정한 다른 이름은 보존한다. */
export function courseDisplayTitle(course: { id: string; title: string }): string {
  const preset = COURSE_PRESETS.find((item) => item.outline_id === course.id);
  const normalizedTitle = course.title.replace(/^AI 기반 /, "AI ");
  if (preset && (
    normalizedTitle === preset.label ||
    normalizedTitle === PREVIOUS_STANDARD_COURSE_TITLES[course.id]
  )) {
    return preset.label;
  }
  return course.title;
}
