export const SYLLABUS_EVALUATION_KEYS = [
  "mpj",
  "dct",
  "completion",
  "participation",
] as const;

export type SyllabusEvaluationKey = (typeof SYLLABUS_EVALUATION_KEYS)[number];

export const SYLLABUS_EVALUATION_ROWS: ReadonlyArray<{
  key: SyllabusEvaluationKey;
  label: string;
  evidence: string;
}> = [
  { key: "mpj", label: "MJT5 상황·표현 판단", evidence: "맥락 판단 5문항의 선택과 판단 근거" },
  { key: "dct", label: "DCT형 통번역 과제 산출·수정", evidence: "초안, AI 피드백 반영, 수정안·확정안" },
  { key: "completion", label: "주차 미션 이수", evidence: "배정된 두 학습 미션의 완료 기록" },
  { key: "participation", label: "학습노트·수업 참여", evidence: "주차 학습노트와 수업 활동 산출물" },
] as const;

export type CurriculumSyllabusSettings = {
  instructorName: string;
  scheduleLocation: string;
  attendanceAssignmentPolicy: string;
  materials: string;
  evaluationWeights: Record<SyllabusEvaluationKey, number | null>;
};

export const EMPTY_SYLLABUS_SETTINGS: CurriculumSyllabusSettings = {
  instructorName: "",
  scheduleLocation: "",
  attendanceAssignmentPolicy: "",
  materials: "",
  evaluationWeights: {
    mpj: null,
    dct: null,
    completion: null,
    participation: null,
  },
};

const STORAGE_PREFIX = "pragma:curriculum-syllabus:v1:";

function storageKey(outlineId: string) {
  return `${STORAGE_PREFIX}${outlineId}`;
}

function normalizedWeight(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeSyllabusSettings(value: unknown): CurriculumSyllabusSettings {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawWeights = record.evaluationWeights && typeof record.evaluationWeights === "object"
    ? record.evaluationWeights as Record<string, unknown>
    : {};

  return {
    instructorName: typeof record.instructorName === "string" ? record.instructorName : "",
    scheduleLocation: typeof record.scheduleLocation === "string" ? record.scheduleLocation : "",
    attendanceAssignmentPolicy: typeof record.attendanceAssignmentPolicy === "string"
      ? record.attendanceAssignmentPolicy
      : "",
    materials: typeof record.materials === "string" ? record.materials : "",
    evaluationWeights: {
      mpj: normalizedWeight(rawWeights.mpj),
      dct: normalizedWeight(rawWeights.dct),
      completion: normalizedWeight(rawWeights.completion),
      participation: normalizedWeight(rawWeights.participation),
    },
  };
}

export function syllabusEvaluationTotal(settings: CurriculumSyllabusSettings) {
  return SYLLABUS_EVALUATION_KEYS.reduce(
    (total, key) => total + (settings.evaluationWeights[key] ?? 0),
    0,
  );
}

export function hasSyllabusEvaluationWeights(settings: CurriculumSyllabusSettings) {
  return SYLLABUS_EVALUATION_KEYS.some((key) => settings.evaluationWeights[key] !== null);
}

export function syllabusEvaluationIsValid(settings: CurriculumSyllabusSettings) {
  return !hasSyllabusEvaluationWeights(settings) || syllabusEvaluationTotal(settings) === 100;
}

export function loadCurriculumSyllabusSettings(outlineId: string) {
  if (typeof window === "undefined") return { ...EMPTY_SYLLABUS_SETTINGS };
  try {
    const raw = window.localStorage.getItem(storageKey(outlineId));
    return raw ? normalizeSyllabusSettings(JSON.parse(raw)) : normalizeSyllabusSettings(null);
  } catch {
    return normalizeSyllabusSettings(null);
  }
}

export function saveCurriculumSyllabusSettings(
  outlineId: string,
  settings: CurriculumSyllabusSettings,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(outlineId), JSON.stringify(normalizeSyllabusSettings(settings)));
}
