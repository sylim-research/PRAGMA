// 학습자 프로필 배경 문항의 선택지 정본 (2026-07-26 개편).
//
// 마법사(ProfileWizardForm)와 관리자 조회(AdminLearners)가 같은 목록을 봐야
// 한다 — 화면마다 라벨을 따로 두면 한쪽이 조용히 낡는다.
// DB에는 code를 저장하고 화면에는 label을 보여준다.

export type CodedOption = { code: string; label: string };

/** 주 사용 언어 — 양방향(한→중·중→한) 지원상 HSK보다 먼저 필요하다.
 *  중국어 주 사용자·이중언어 사용자를 HSK 서열 안에 끼워 넣지 않기 위한 문항이기도 하다. */
export const PRIMARY_LANGUAGE_OPTIONS: CodedOption[] = [
  { code: "ko", label: "한국어" },
  { code: "zh", label: "중국어" },
  { code: "ko_zh", label: "한국어·중국어 모두" },
  { code: "other", label: "그 외" },
];

/** 중국어 학습 수준. '원어민 수준'은 급수와 다른 축이라 주 사용 언어 문항으로 옮겼고,
 *  미응시자가 'HSK 3급 이하'로 답해 데이터가 오염되던 문제는 '응시 경험 없음'으로 푼다. */
export const CHINESE_LEVEL_OPTIONS: CodedOption[] = [
  { code: "hsk3_or_below", label: "HSK 3급 이하" },
  { code: "hsk4", label: "HSK 4급" },
  { code: "hsk5", label: "HSK 5급" },
  { code: "hsk6", label: "HSK 6급" },
  { code: "hsk7_9", label: "HSK 7–9급" },
  { code: "not_taken", label: "응시 경험 없음" },
];

/** 중국어 주 사용자의 한국어 공인시험 급수. HSK와 같은 저장 컬럼을 쓰되
 *  코드 접두어로 시험 종류를 구분한다. */
export const TOPIK_LEVEL_OPTIONS: CodedOption[] = [
  { code: "topik2_or_below", label: "TOPIK 2급 이하" },
  { code: "topik3", label: "TOPIK 3급" },
  { code: "topik4", label: "TOPIK 4급" },
  { code: "topik5", label: "TOPIK 5급" },
  { code: "topik6", label: "TOPIK 6급" },
  { code: "not_taken", label: "응시 경험 없음" },
];

/** 이 앱은 양방향(한→중·중→한)이라 학습 대상 언어가 학습자마다 다르다.
 *  중국어 모어 화자에게 "중국어를 접해 온 상황"을 묻는 것은 무의미하다 —
 *  그들의 학습 대상은 한국어다. 주 사용 언어에서 대상 언어를 도출한다.
 *  '모두'·'그 외'는 중국어 기준 — 이 수업의 주 목표어이고 코어도 ko_zh가 기본이다. */
export type TargetLanguage = "zh" | "ko";
export const targetLanguageOf = (primaryLanguage: string | null | undefined): TargetLanguage =>
  primaryLanguage === "zh" ? "ko" : "zh";

export const TARGET_LANGUAGE_LABEL: Record<TargetLanguage, string> = {
  zh: "중국어",
  ko: "한국어",
};

export const languageTestOptions = (
  primaryLanguage: string | null | undefined,
): CodedOption[] =>
  targetLanguageOf(primaryLanguage) === "ko"
    ? TOPIK_LEVEL_OPTIONS
    : CHINESE_LEVEL_OPTIONS;

export const languageTestLabel = (primaryLanguage: string | null | undefined) =>
  targetLanguageOf(primaryLanguage) === "ko" ? "최근 TOPIK 급수" : "최근 HSK 급수";

/** 접촉·사용 상황(복수). 수용(드라마·읽을거리)도 학습 경로이므로 함께 담는다 —
 *  앱이 수용(MPJ)과 산출(DCT)로 나뉘는데 배경만 산출을 물으면 앞뒤가 안 맞는다.
 *  정본(pragma-level-layer-lock)의 "습관 语域에서 얼마나 먼가"를 잡는 입력.
 *
 *  ⚠️ **code는 대상 언어와 무관하게 동일하다** — 그래야 한국어 학습자군과
 *  중국어 학습자군을 같은 축에서 비교할 수 있다. 바뀌는 것은 라벨뿐. */
export const exposureContextOptions = (target: TargetLanguage): CodedOption[] => [
  { code: "media", label: "드라마·영화·영상·음악" },
  { code: "reading", label: "뉴스·기사·읽을거리" },
  { code: "class", label: "수업·시험" },
  { code: "messaging", label: "메신저·SNS 일상 대화" },
  { code: "work_docs", label: "업무 문서·이메일" },
  {
    code: "native_friends",
    label: target === "zh" ? "중국인 친구·동료와 대화" : "한국인 친구·동료와 대화",
  },
  {
    code: "residence",
    label: target === "zh" ? "중국어권 체류·근무" : "한국 체류·근무",
  },
  { code: "almost_none", label: "거의 없음" },
];

/** 프로필 입력에서는 교수자가 수업 운영에 참고할 실제 사용 맥락만 간결하게 묻는다.
 * 기존 저장값 표시를 위해 exposureContextOptions의 전체 정본은 유지한다. */
const PROFILE_EXPOSURE_CODES = new Set([
  "class",
  "work_docs",
  "native_friends",
  "residence",
]);

export const profileExposureOptions = (target: TargetLanguage): CodedOption[] =>
  exposureContextOptions(target).filter((option) => PROFILE_EXPOSURE_CODES.has(option.code));
/** 다른 항목과 함께 고를 수 없는 배타 선택지. */
export const EXPOSURE_EXCLUSIVE = "almost_none";

// 학부 대상이라 두 학기 이상 수강자가 거의 없어 학기 수 구분은 변별력이 없다.
// 수업 경험은 한 칸으로 합친다(선지 4개 = 2×2 격자로 떨어진다).
// 2026-09-25: 학기 수 대신 「학원·대학교 수업」으로 일반화. code는 그대로 두어 기존 응답과 비교가 유지된다.
export const TI_EXPERIENCE_OPTIONS: CodedOption[] = [
  { code: "none", label: "없음" },
  { code: "coursework", label: "학원·대학교에서 관련 수업 수강" },
  { code: "assisted", label: "실습·현장 보조 경험" },
  { code: "professional", label: "전문 통번역 경력" },
];

/** 저장된 code를 화면 라벨로. 모르는 code(구 데이터)는 그대로 보여준다 — 숨기면
 *  관리자가 "값이 없다"고 오해한다. */
export const labelOf = (options: CodedOption[], code: string | null | undefined) =>
  code ? options.find((o) => o.code === code)?.label ?? code : null;

export const labelsOf = (options: CodedOption[], codes: string[] | null | undefined) =>
  codes && codes.length > 0 ? codes.map((c) => labelOf(options, c)).join(", ") : null;
