// 배치 생성 계획기 — "무엇을 몇 개 만들지"를 먼저 계산한다.
//
// 왜 계획을 분리하는가:
// 화행 9 × 수준 3만 순회하면 135개가 쌓여도 도메인·산업·통역 분포는 생성기가
// 주는 대로가 된다. 그러면 교강사가 "직장 · 무역" 필터를 눌렀을 때 0건이 나온다.
// **필터가 존재하는 것과 눌렀을 때 콘텐츠가 나오는 것은 별개다.**
// 따라서 분포를 결과에 맡기지 않고 계획 단계에서 할당량으로 못박는다.
//
// 일반 제작은 수준별 절대 수량·통역 비중을 사용하며 교과목의 주차 편성과는 별개다.
// 아래 과거 화행당 quota 상수는 기존 스크립트의 호출 호환용이다.

import {
  type Domain,
  type BusinessFunction,
  type GenMode,
  type IndustrySector,
  type LanguageDirection,
  type LearnerLevel,
  type PdrBurden,
  type PdrDistance,
  type PdrPower,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import {
  SCENARIO_TOPICS,
  topicSupportsContext,
  type ScenarioTopic,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";

/**
 * 생성 1건의 조건.
 *
 * 구인축: speech_act_ui + P·D·R
 * 과업 조건: mode
 * 편성층: level + domain
 * 사건 메타: theme/topic/industry/business function
 *
 * 이 필드들은 모두 필요하지만 동등한 연구축은 아니다.
 */
export interface BatchCell {
  speech_act_ui: SpeechActUI;
  level: LearnerLevel;
  domain: Domain;
  /** 수행 방식 = 별도 과업 트랙. translation(텍스트 번역) | stt_interpreting(음성 통역). */
  mode: GenMode;
  /** domain === "work" 일 때만 채운다 (스키마 제약과 동일) */
  industry: IndustrySector | null;
  /** domain === "work" 일 때만 채우는 실제 업무 기능 메타 */
  business_function: BusinessFunction | null;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
  /** 편성층 메타 (계약 v1.3 §2b) — 코어 생성 시 행 태그로 저장 */
  theme_code: ThemeCode;
  topic_code: string;
  /** 생성 프롬프트에 넣을 장면 시드 (topic 카탈로그에서) */
  situation_seed_ko: string;
  /** 언어 방향 (계약 0-l·82·89) — 코어 생성·행 태그·JSON direction */
  direction: LanguageDirection;
  /** 한 셀에서 뽑을 개수 — 개요 N개 → 전부 상세화 */
  count: number;
}

/**
 * (화행·도메인)에 맞는 topic을 고른다. 계약 §2b: 생성 입력이 곧 태그(태깅 비용 0).
 * 명시 화행·도메인 일치 topic을 최우선으로 고르고, 그것이 없을 때만 화행 중립
 * wildcard topic을 허용한다. 둘 다 없으면 다른 화행의 시드를 조용히 재사용하지 않고
 * 명시적으로 실패한다(연구 셀 오염 방지).
 *
 * ★ 테마 균형(계약 §7-0 "theme 배분 — 프리셋 선반이 비지 않게 보장"의 코드 이행):
 * 후보 풀에서 **지금까지 가장 적게 뽑힌 테마**의 topic을 우선 고른다. 이게 없으면 school
 * 도메인 topic 다수가 campus_study라 학교 셀이 campus로 쏠리고(관측: campus 23 vs 유학 1),
 * daily의 다른 테마가 소외된다. 동률·같은 테마 내 topic 변주는 seq로 회전(결정론).
 */
function selectTopic(
  act: SpeechActUI,
  domain: Domain,
  pdr: { p: PdrPower; d: PdrDistance; r: PdrBurden },
  mode: GenMode,
  seq: number,
  themeCount: Record<string, number>,
  topicCount: Record<string, number>,
): ScenarioTopic {
  const inDomain = SCENARIO_TOPICS.filter((topic) => topic.allowedDomains.includes(domain));
  const explicitMatch = inDomain.filter((topic) => topic.allowedSpeechActs?.includes(act));
  const wildcardMatch = inDomain.filter((topic) => !topic.allowedSpeechActs);
  const context = {
    speechAct: act,
    domain,
    power: pdr.p,
    distance: pdr.d,
    mode,
  };
  const explicitCompatible = explicitMatch.filter((topic) => topicSupportsContext(topic, context));
  const wildcardCompatible = wildcardMatch.filter((topic) => topicSupportsContext(topic, context));
  const finalPool = explicitCompatible.length > 0 ? explicitCompatible : wildcardCompatible;
  if (!finalPool.length) {
    throw new Error(
      `화행·P·D·mode·domain 호환 topic 없음: ${act}×${pdr.p}×${pdr.d}×${mode}×${domain}`,
    );
  }

  // 1차 = 과소 테마 우선, 2차(0-k·81⑥) = 그 테마 안에서 최소 사용 topic(동일 topic 반복 방지).
  // seq 오프셋으로 순회 시작점을 돌려 완전 동률의 tie-break도 결정론으로 유지한다.
  let best = finalPool[seq % finalPool.length];
  let bestTheme = Infinity;
  let bestTopic = Infinity;
  for (let k = 0; k < finalPool.length; k += 1) {
    const t = finalPool[(seq + k) % finalPool.length];
    const ct = themeCount[t.themeCode] ?? 0;
    const cp = topicCount[t.code] ?? 0;
    if (ct < bestTheme || (ct === bestTheme && cp < bestTopic)) {
      bestTheme = ct;
      bestTopic = cp;
      best = t;
    }
  }
  return best;
}

export interface BatchQuota {
  /** 수준별 · 화행당 **번역** 생성 개수 */
  perLevel: Record<LearnerLevel, number>;
  /**
   * 통역 비율 0~1. 통역 개수 = `max(1, round(번역개수 × 비율))`.
   * ⚠️ 계약 v1.5 0-h·57: 모드는 주변 분포가 아니라 **명시적 쿼터 축**이다.
   * max(1,…) 바닥이 모든 (화행×수준) 셀에 통역 1개 이상을 보장 → 화행9×수준3×모드2=54셀
   * 커버리지(perLevel≥1인 수준). 500 본 배치는 셀당 ≥3을 목표로 값을 올린다(summarizePlan이 검산).
   */
  interpretingRatio: number;
  /** 일반 제작용 수준별 절대 수량. 지정하면 과거 화행당 번역·배율 설정보다 우선한다. */
  perLevelModeCounts?: Record<LearnerLevel, { translation: number; stt_interpreting: number }>;
}

/** 총량 중 통역 비중(0~100%). 반올림 뒤 나머지를 번역에 배정해 총량을 보존한다. */
export function productionModeCounts(total: number, interpretingPercent: number) {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const percent = Number.isFinite(interpretingPercent) ? Math.min(100, Math.max(0, interpretingPercent)) : 0;
  const interpreting = Math.round(count * percent / 100);
  return { translation: count - interpreting, stt_interpreting: interpreting };
}

/**
 * 과거 데모 할당량 — 현재 관리자 제작 화면의 초기값으로 사용하지 않는다.
 * 당시 중급을 9월 실증 코호트·시연 주력으로 두텁게 설정했다.
 * 중국어 어휘 참고 상한은 별도 policy에서 HSK 1–5급 누적으로 관리한다.
 * 입문·고급은 "필터가 작동한다"를 보이는 최소치.
 * 500 본 배치는 이 값을 올려 54셀 셀당 ≥3을 채운다.
 */
export const DEFAULT_QUOTA: BatchQuota = {
  perLevel: {
    intermediate: 3, // 화행9 × (번역3 + 통역1) = 36
    beginner_intermediate: 1, // 화행9 × (번역1 + 통역1) = 18
    advanced: 1, // 18
  },
  interpretingRatio: 0.3, // 교수님 지시에 "통역"이 명시됨 — 바닥(≥1)을 보장한다
};

/**
 * 최종 500+ 본배치 승인안 = 정확히 504건.
 *
 * 화행당 번역 43건(14+15+14) + 통역 13건(4+5+4) = 56건,
 * 9화행 × 56 = 504건. 각 화행의 P3×D3×R3 27셀을 두 차례 이상
 * 순회하므로 243 구인셀을 전부 채우고, 54 전달셀도 셀당 ≥3을 충족한다.
 */
export const FINAL_CORPUS_QUOTA_504: BatchQuota = {
  perLevel: {
    beginner_intermediate: 14,
    intermediate: 15,
    advanced: 14,
  },
  interpretingRatio: 0.3,
};

/** 기존 495건 배치 화면의 재현·재개 호환용. 정식 신규 corpus는 504 상수를 사용한다. */
export const FULL_BATCH_QUOTA_495: BatchQuota = {
  perLevel: {
    beginner_intermediate: 13,
    intermediate: 15,
    advanced: 14,
  },
  interpretingRatio: 0.3,
};

/** 통역 개수 = 번역개수 기준 비율, 단 셀 공백 방지를 위해 최소 1(0-h·57). */
export function interpretingCount(translationCount: number, ratio: number): number {
  if (translationCount <= 0) return 0;
  return Math.max(1, Math.round(translationCount * ratio));
}

const SPEECH_ACTS: SpeechActUI[] = [
  "request", "refusal", "apology", "thanks", "proposal",
  "agreement", "opposition", "compliment", "complaint",
];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const MODES: GenMode[] = ["translation", "stt_interpreting"];
const DOMAINS: Domain[] = ["daily", "school", "work"];

export interface TopicCoverageCell {
  speechAct: SpeechActUI;
  domain: Domain;
}

export interface TopicCoverageAudit {
  /** 명시 topic도 wildcard topic도 없는 조합 — 배치 실행 차단 대상. */
  missing: TopicCoverageCell[];
  /** allowedSpeechActs 미지정 topic에만 의존하는 조합 — 의미 적합성 검토 대상. */
  wildcardOnly: TopicCoverageCell[];
}

export interface TopicCompatibilityGap extends TopicCoverageCell {
  power: PdrPower;
  distance: PdrDistance;
  mode: GenMode;
}

/** 전체 화행·P·D·mode·domain에서 선택 가능한 사건 시드가 있는지 확인한다. */
export function auditTopicCompatibility(
  acts: SpeechActUI[] = SPEECH_ACTS,
  domains: Domain[] = DOMAINS,
  topics: ScenarioTopic[] = SCENARIO_TOPICS,
): TopicCompatibilityGap[] {
  const gaps: TopicCompatibilityGap[] = [];
  const powers: PdrPower[] = ["equal", "higher", "lower"];
  const distances: PdrDistance[] = ["close", "acquaintance", "formal"];
  const modes: GenMode[] = ["translation", "stt_interpreting"];

  for (const speechAct of acts) {
    for (const domain of domains) {
      for (const power of powers) {
        for (const distance of distances) {
          for (const mode of modes) {
            const context = { speechAct, domain, power, distance, mode };
            const explicit = topics.some(
              (topic) =>
                topic.allowedSpeechActs?.includes(speechAct) &&
                topicSupportsContext(topic, context),
            );
            const wildcard = topics.some(
              (topic) => !topic.allowedSpeechActs && topicSupportsContext(topic, context),
            );
            if (!explicit && !wildcard) {
              gaps.push({ speechAct, domain, power, distance, mode });
            }
          }
        }
      }
    }
  }

  return gaps;
}

/**
 * 화행 × domain 전수 정적 감사.
 * `allowedSpeechActs` 부재는 현재 카탈로그상 전 화행 허용이지만 명시 topic과 구분해
 * 보고한다. 문법상 허용과 의미상 적합성을 같은 것으로 취급하지 않기 위해서다.
 */
export function auditTopicCoverage(
  acts: SpeechActUI[] = SPEECH_ACTS,
  domains: Domain[] = DOMAINS,
  topics: ScenarioTopic[] = SCENARIO_TOPICS,
): TopicCoverageAudit {
  const missing: TopicCoverageCell[] = [];
  const wildcardOnly: TopicCoverageCell[] = [];

  for (const speechAct of acts) {
    for (const domain of domains) {
      const inDomain = topics.filter((topic) => topic.allowedDomains.includes(domain));
      const explicit = inDomain.some((topic) => topic.allowedSpeechActs?.includes(speechAct));
      const wildcard = inDomain.some((topic) => !topic.allowedSpeechActs);
      if (!explicit && !wildcard) missing.push({ speechAct, domain });
      else if (!explicit && wildcard) wildcardOnly.push({ speechAct, domain });
    }
  }

  return { missing, wildcardOnly };
}

const INDUSTRIES: IndustrySector[] = [
  "trade_distribution", "IT_platform", "manufacturing", "tourism_hospitality",
  "education_research", "public_international_affairs", "culture_content_media",
];
const BUSINESS_FUNCTIONS: BusinessFunction[] = [
  "overseas_sales",
  "marketing_pr",
  "customer_partner_support",
  "SCM_logistics",
  "project_coordination",
  "localization_translation",
  "international_collaboration",
];

// 연구 구인 행렬 = 화행9 × P3 × D3 × R3 = 243.
// 앞 9개부터 P·D가 모두 나타나고 R도 균형을 이루도록 순서를 섞되,
// 27개 전체에서는 각 P·D·R 조합이 정확히 한 번씩 나타난다.
const P_VALUES: PdrPower[] = ["equal", "higher", "lower"];
const D_VALUES: PdrDistance[] = ["acquaintance", "formal", "close"];
const R_VALUES: PdrBurden[] = ["mid", "high", "low"];
export const PDR_CONSTRUCT_CELLS: {
  p: PdrPower;
  d: PdrDistance;
  r: PdrBurden;
}[] = Array.from({ length: 27 }, (_, index) => {
  const pIndex = index % 3;
  const dIndex = Math.floor(index / 3) % 3;
  const cycle = Math.floor(index / 9);
  const rIndex = (cycle + dIndex + index) % 3;
  return {
    p: P_VALUES[pIndex],
    d: D_VALUES[dIndex],
    r: R_VALUES[rIndex],
  };
});

// zh_ko 30셀 혼합 파일럿(계약 0-l·89, 2026-08-05 개정).
// 핵심 3화행은 수준3 × 모드2를 유지하고, 나머지 6화행은 중급 × 모드2로 먼저 검증한다.
// 인간 눈검사 전에는 54셀 완전 대칭이나 본배치로 자동 확대하지 않는다.
export const ZH_KO_ANCHOR_ACTS: SpeechActUI[] = ["request", "refusal", "thanks"];
export const ZH_KO_EXPANSION_ACTS: SpeechActUI[] = [
  "apology", "proposal", "agreement", "opposition", "compliment", "complaint",
];
export const ZH_KO_VALIDATION_ACTS: SpeechActUI[] = [
  ...ZH_KO_ANCHOR_ACTS,
  ...ZH_KO_EXPANSION_ACTS,
];
const ZH_KO_ANCHOR_QUOTA: BatchQuota = {
  perLevel: { beginner_intermediate: 1, intermediate: 1, advanced: 1 },
  interpretingRatio: 0.5, // max(1,round(1×0.5))=1 → 셀당 번역1·통역1
};
const ZH_KO_EXPANSION_QUOTA: BatchQuota = {
  perLevel: { beginner_intermediate: 0, intermediate: 1, advanced: 0 },
  interpretingRatio: 0.5,
};

export interface DeliveryCoverageCell {
  speechAct: SpeechActUI;
  level: LearnerLevel;
  mode: GenMode;
}

const deliveryCells = (
  acts: SpeechActUI[],
  levels: LearnerLevel[],
): DeliveryCoverageCell[] =>
  acts.flatMap((speechAct) =>
    levels.flatMap((level) =>
      MODES.map((mode) => ({ speechAct, level, mode })),
    ),
  );

/** 혼합 파일럿에서 의도한 전달 커버리지 30셀의 명시 목록. */
export const ZH_KO_VALIDATION_DELIVERY_CELLS: DeliveryCoverageCell[] = [
  ...deliveryCells(ZH_KO_ANCHOR_ACTS, LEVELS),
  ...deliveryCells(ZH_KO_EXPANSION_ACTS, ["intermediate"]),
];

/**
 * 할당량으로부터 셀 목록을 만든다. 순수 함수 — 같은 입력이면 같은 계획.
 *
 * 도메인은 계획에 못박지만 산업·직무 기능은 work 도메인 안에서만 회전시킨다
 * (스키마 CHECK: industry/business_function은 domain='work'가 아니면 null).
 *
 * direction(0-l·89) = 셀에 찍는 방향 태그(기본 ko_zh). acts = 화행 부분집합.
 * zh_ko 혼합 파일럿은 화행별 수준 범위가 다르므로 buildZhKoValidationPlan을 사용한다.
 */
export function buildBatchPlan(
  quota: BatchQuota = DEFAULT_QUOTA,
  direction: LanguageDirection = "ko_zh",
  acts: SpeechActUI[] = SPEECH_ACTS,
): BatchCell[] {
  const cells: BatchCell[] = [];
  let seq = 0; // 전역 순번 — topic·산업 tie-break용
  let workOrdinal = 0; // 산업과 직무의 고정 1:1 짝을 피하는 독립 work 순번
  const actOrdinal: Record<string, number> = {};
  const themeCount: Record<string, number> = {}; // 테마 균형 커서(계약 §7-0)
  const topicCount: Record<string, number> = {}; // topic 반복 방지 커서(0-k·81⑥)

  for (const level of LEVELS) {
    const requested = quota.perLevelModeCounts?.[level];
    const nTrans = quota.perLevel[level];
    if (requested ? requested.translation + requested.stt_interpreting <= 0 : nTrans <= 0) continue;
    const nInterp = interpretingCount(nTrans, quota.interpretingRatio);

    for (const [actPosition, speech_act_ui] of acts.entries()) {
      // 일반 제작은 모드별 절대 수량을 화행에 가능한 균등하게 분배한다.
      // 과거 quota 호출은 화행당 수량을 유지한다. 도메인·theme·산업·P/D/R은 2차 회전이다.
      // 나머지는 화행 순서를 따라 이어서 배정한다. 번역·통역 나머지를 둘 다 앞 화행부터 주면
      // 앞 화행에 몰린다(18건 = 3·3·3·3·2·1·1·1·1). 통역 나머지는 번역 나머지가 끝난 자리부터 준다.
      const perAct = (count: number, offset = 0) =>
        Math.floor(count / acts.length) +
        ((actPosition - offset + acts.length) % acts.length < count % acts.length ? 1 : 0);
      const transOffset = requested ? requested.translation % acts.length : 0;
      const modeSlots: { mode: GenMode; count: number }[] = [
        { mode: "translation", count: requested ? perAct(requested.translation) : nTrans },
        { mode: "stt_interpreting", count: requested ? perAct(requested.stt_interpreting, transOffset) : nInterp },
      ];
      for (const slot of modeSlots) {
        for (let i = 0; i < slot.count; i += 1) {
          const ordinal = actOrdinal[speech_act_ui] ?? 0;
          const actIndex = SPEECH_ACTS.indexOf(speech_act_ui);
          const pdr = PDR_CONSTRUCT_CELLS[ordinal % PDR_CONSTRUCT_CELLS.length];
          // P·D·R과 domain이 같은 modulo 커서를 공유하던 기존 결합을 끊는다.
          // 같은 PDR 조합이 두 번째로 나타나면 domain도 한 칸 이동한다.
          const domainIndex =
            (Math.floor(ordinal / 3) + Math.floor(ordinal / 27) + Math.max(actIndex, 0)) %
            DOMAINS.length;
          const domain = DOMAINS[domainIndex];
          const topic = selectTopic(
            speech_act_ui,
            domain,
            pdr,
            slot.mode,
            seq,
            themeCount,
            topicCount,
          );
          themeCount[topic.themeCode] = (themeCount[topic.themeCode] ?? 0) + 1;
          topicCount[topic.code] = (topicCount[topic.code] ?? 0) + 1;

          const industry = domain === "work" ? INDUSTRIES[workOrdinal % INDUSTRIES.length] : null;
          const businessFunction = domain === "work"
            ? BUSINESS_FUNCTIONS[(workOrdinal * 3 + Math.floor(workOrdinal / 7)) % BUSINESS_FUNCTIONS.length]
            : null;
          cells.push({
            speech_act_ui,
            level,
            domain,
            mode: slot.mode,
            industry,
            business_function: businessFunction,
            pdr_power: pdr.p,
            pdr_distance: pdr.d,
            pdr_burden: pdr.r,
            theme_code: topic.themeCode,
            topic_code: topic.code,
            situation_seed_ko: topic.situationSeedKo,
            direction,
            count: 1,
          });
          actOrdinal[speech_act_ui] = ordinal + 1;
          if (domain === "work") workOrdinal += 1;
          seq += 1;
        }
      }
    }
  }

  return cells;
}

/**
 * 중→한 9화행·30셀 혼합 파일럿 계획.
 * 핵심 3화행 18셀 + 확장 6화행 중급 12셀을 합치되 실제 생성·저장은 호출자가 결정한다.
 */
export function buildZhKoValidationPlan(): BatchCell[] {
  return [
    ...buildBatchPlan(ZH_KO_ANCHOR_QUOTA, "zh_ko", ZH_KO_ANCHOR_ACTS),
    ...buildBatchPlan(ZH_KO_EXPANSION_QUOTA, "zh_ko", ZH_KO_EXPANSION_ACTS),
  ];
}

/** 계획을 실행 전에 눈으로 검산하기 위한 분포 요약. */
export interface PlanSummary {
  total: number;
  byLevel: Record<string, number>;
  byDomain: Record<string, number>;
  byIndustry: Record<string, number>;
  bySpeechAct: Record<string, number>;
  byTheme: Record<string, number>;
  /** 방향별 건수(계약 0-l·89 — 감사표 방향 칸 분리) */
  byDirection: Record<string, number>;
  translation: number;
  interpreting: number;
  /** 화행 × 수준 27칸 중 비어 있는 칸 — 0이어야 코퍼스 브라우저가 채워진다 */
  emptyActLevelCells: string[];
  /**
   * 화행9 × 수준3 × 모드2 = 54셀 감사(계약 0-h·57). perLevel>0인 수준만 대상으로 센다
   * (perLevel=0 수준은 의도된 제외 — 빈 셀로 세지 않는다).
   */
  emptyActLevelModeCells: string[];
  /** 대상 54셀 중 개수가 가장 적은 셀의 값 — 500 배치 목표는 이 값 ≥3 */
  minActLevelModeCount: number;
  /** 셀당 3개 미만인 셀 목록(대상 수준 한정) — 500 배치 전 검산용 */
  underMinCells: string[];
  /** 연구 구인 행렬(화행×P×D×R)에서 비어 있는 셀. 500 본 배치는 0이어야 한다. */
  emptyActPdrCells: string[];
  /** 연구 구인 행렬 셀당 최소 개수. delivery 54셀 최소값과 별개다. */
  minActPdrCount: number;
}

/**
 * 계획을 실행 전에 눈으로 검산하기 위한 분포 요약.
 *
 * @param targetActs 감사 대상 화행(기본 = 9화행 전부).
 * @param expectedDeliveryCells 혼합 파일럿처럼 화행별 수준 범위가 다를 때 의도한
 *   전달 셀을 명시한다. 생략하면 기존 54셀(또는 화행 부분집합×등장 수준×2) 감사를 유지한다.
 */
export function summarizePlan(
  cells: BatchCell[],
  targetActs: SpeechActUI[] = SPEECH_ACTS,
  expectedDeliveryCells?: DeliveryCoverageCell[],
): PlanSummary {
  const bump = (rec: Record<string, number>, key: string, by = 1) => {
    rec[key] = (rec[key] ?? 0) + by;
  };
  const byLevel: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  const bySpeechAct: Record<string, number> = {};
  const byTheme: Record<string, number> = {};
  const byDirection: Record<string, number> = {};
  const actLevel = new Set<string>();
  const actLevelModeCount: Record<string, number> = {};
  const actPdrCount: Record<string, number> = {};
  const levelsPresent = new Set<string>();
  let translation = 0;
  let interpreting = 0;

  const modeOf = (c: BatchCell) => c.mode;

  for (const c of cells) {
    bump(byLevel, c.level, c.count);
    bump(byDomain, c.domain, c.count);
    bump(bySpeechAct, c.speech_act_ui, c.count);
    bump(byTheme, c.theme_code, c.count);
    bump(byDirection, c.direction, c.count);
    if (c.industry) bump(byIndustry, c.industry, c.count);
    if (modeOf(c) === "stt_interpreting") interpreting += c.count;
    else translation += c.count;
    actLevel.add(`${c.speech_act_ui}|${c.level}`);
    levelsPresent.add(c.level);
    bump(actLevelModeCount, `${c.speech_act_ui}|${c.level}|${modeOf(c)}`, c.count);
    bump(
      actPdrCount,
      `${c.speech_act_ui}|${c.pdr_power}|${c.pdr_distance}|${c.pdr_burden}`,
      c.count,
    );
  }

  const expectedActLevelPairs = expectedDeliveryCells
    ? Array.from(new Set(expectedDeliveryCells.map(({ speechAct, level }) => `${speechAct}|${level}`)))
    : targetActs.flatMap((act) => LEVELS.map((level) => `${act}|${level}`));
  const emptyActLevelCells: string[] = [];
  for (const key of expectedActLevelPairs) {
    if (!actLevel.has(key)) emptyActLevelCells.push(key.replace("|", "·"));
  }

  // 기본은 54셀(또는 targetActs 축소분), 혼합 파일럿은 명시된 expectedDeliveryCells만 감사한다.
  const emptyActLevelModeCells: string[] = [];
  const underMinCells: string[] = [];
  let minActLevelModeCount = Infinity;
  const deliveryAuditCells = expectedDeliveryCells ?? LEVELS
    .filter((level) => levelsPresent.has(level))
    .flatMap((level) => targetActs.flatMap((speechAct) =>
      MODES.map((mode) => ({ speechAct, level, mode })),
    ));
  for (const { speechAct, level, mode } of deliveryAuditCells) {
    const n = actLevelModeCount[`${speechAct}|${level}|${mode}`] ?? 0;
    const label = `${speechAct}·${level}·${mode === "translation" ? "번역" : "통역"}`;
    if (n === 0) emptyActLevelModeCells.push(label);
    if (n < 3) underMinCells.push(label);
    if (n < minActLevelModeCount) minActLevelModeCount = n;
  }
  if (!Number.isFinite(minActLevelModeCount)) minActLevelModeCount = 0;

  const emptyActPdrCells: string[] = [];
  let minActPdrCount = Infinity;
  for (const act of targetActs) {
    for (const pdr of PDR_CONSTRUCT_CELLS) {
      const key = `${act}|${pdr.p}|${pdr.d}|${pdr.r}`;
      const n = actPdrCount[key] ?? 0;
      if (n === 0) emptyActPdrCells.push(`${act}·${pdr.p}·${pdr.d}·${pdr.r}`);
      if (n < minActPdrCount) minActPdrCount = n;
    }
  }
  if (!Number.isFinite(minActPdrCount)) minActPdrCount = 0;

  return {
    total: cells.reduce((n, c) => n + c.count, 0),
    byLevel, byDomain, byIndustry, bySpeechAct, byTheme, byDirection,
    translation, interpreting, emptyActLevelCells,
    emptyActLevelModeCells, minActLevelModeCount, underMinCells,
    emptyActPdrCells, minActPdrCount,
  };
}
