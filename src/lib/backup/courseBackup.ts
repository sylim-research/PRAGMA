// 교강사가 편성한 한 교과목(15주 수업 구성)을 파일로 소유·복원하기 위한 순수 로직.
//
// 백업 단위 = curriculum_outline 1건 = 「수준 / 도메인·산업 / 언어 방향 / 15주 편성」.
// 이 모듈은 Supabase에 접근하지 않는다. 조회·쓰기는 courseBackupApi.ts가 맡는다.
//
// 경계(의도적):
//  - 학습자 데이터(수행 로그·판단·산출·이견)는 이 백업에 넣지 않는다.
//    그것은 AdminExport(수행 기록 내려받기)의 연구 자료 export가 담당한다.
//  - 인증정보·API key·개인 식별자는 넣지 않는다(scanForSecrets가 내보내기 직전 막는다).

export const COURSE_BACKUP_FORMAT_VERSION = 1;
export const COURSE_BACKUP_KIND = "pragma.course-backup";

/** 시나리오 행에서 제거하는 열 — 검수자 개인 식별자는 파일에 담지 않는다. */
export const SCENARIO_REDACTED_COLUMNS = ["mission_reviewed_by"] as const;

export type BackupRow = Record<string, unknown>;

export type CourseBackupManifest = {
  kind: typeof COURSE_BACKUP_KIND;
  backup_format_version: number;
  exported_at: string;
  app_version: string | null;
  source_project_ref: string | null;
  /** 표기용 요약 — 복원 로직은 이 값을 신뢰하지 않는다. */
  outline_title: string;
  item_counts: {
    curriculum_outlines: number;
    curriculum_weeks: number;
    curriculum_week_scenarios: number;
    scenarios: number;
  };
};

export type CourseBackupData = {
  curriculum_outlines: BackupRow[];
  curriculum_weeks: BackupRow[];
  curriculum_week_scenarios: BackupRow[];
  scenarios: BackupRow[];
};

export type CourseBackupFile = {
  manifest: CourseBackupManifest;
  data: CourseBackupData;
};

export const COURSE_BACKUP_TABLES = [
  "curriculum_outlines",
  "curriculum_weeks",
  "curriculum_week_scenarios",
  "scenarios",
] as const satisfies readonly (keyof CourseBackupData)[];

/**
 * 첫 화면용 한 줄 요약. 제외 항목은 여기 두지 않는다 —
 * 「백업 범위 자세히 보기」(COURSE_BACKUP_SCOPE.excluded)가 담당한다.
 */
export const COURSE_BACKUP_SUMMARY = {
  included: "현재 교과목의 15주 수업 구성을 백업 파일로 저장합니다.",
} as const;

/** 백업이 담는 것 / 담지 않는 것 — UI 문구와 보고서가 같은 정본을 쓴다. */
export const COURSE_BACKUP_SCOPE = {
  included: [
    "교과목 편성 정보 — 제목·수준·언어 방향·도메인·산업·주차 수",
    "15주 주차 편성 — 주차 유형, 목표 화행, 상황 조건(P·D·R), can-do 목표, 시나리오 배치 정보",
    "주차별 학습 미션 배치 — 순서와 역할",
    "배정된 시나리오 본문과 점검·승인 상태",
  ],
  excluded: [
    "인증정보·API key·접속 토큰",
    "학습 수행 기록(판단·산출·수정·이견) — 「연구용 기록 내보내기」가 담당합니다",
    "감수·승인 담당자 개인 식별자",
    "다른 교과목의 편성",
  ],
} as const;

type ScenarioRedactedColumn = (typeof SCENARIO_REDACTED_COLUMNS)[number];

/** 시나리오 행에서 개인 식별 열을 제거한다(값을 비우는 것이 아니라 열 자체를 뺀다). */
export function redactScenarioRow(row: BackupRow): BackupRow {
  const output: BackupRow = {};
  for (const [key, value] of Object.entries(row)) {
    if ((SCENARIO_REDACTED_COLUMNS as readonly string[]).includes(key as ScenarioRedactedColumn)) continue;
    output[key] = value;
  }
  return output;
}

export type BuildCourseBackupInput = {
  outline: BackupRow;
  weeks: BackupRow[];
  assignments: BackupRow[];
  scenarios: BackupRow[];
  exportedAt?: Date;
  appVersion?: string | null;
  projectRef?: string | null;
};

export function buildCourseBackup(input: BuildCourseBackupInput): CourseBackupFile {
  const scenarios = input.scenarios.map(redactScenarioRow);
  const data: CourseBackupData = {
    curriculum_outlines: [input.outline],
    curriculum_weeks: input.weeks,
    curriculum_week_scenarios: input.assignments,
    scenarios,
  };
  const title = typeof input.outline.title === "string" ? input.outline.title : "(제목 없음)";
  return {
    manifest: {
      kind: COURSE_BACKUP_KIND,
      backup_format_version: COURSE_BACKUP_FORMAT_VERSION,
      exported_at: (input.exportedAt ?? new Date()).toISOString(),
      app_version: input.appVersion ?? null,
      source_project_ref: input.projectRef ?? null,
      outline_title: title,
      item_counts: {
        curriculum_outlines: data.curriculum_outlines.length,
        curriculum_weeks: data.curriculum_weeks.length,
        curriculum_week_scenarios: data.curriculum_week_scenarios.length,
        scenarios: data.scenarios.length,
      },
    },
    data,
  };
}

export function serializeCourseBackup(file: CourseBackupFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

// ── 파일명 ────────────────────────────────────────────────────
// 확정 규칙(2026-08-18):
//   일반   PRAGMA_2026-2_중급통번역_20260818_203241.json
//   복원전 PRAGMA_복원전_2026-2_중급통번역_20260818_203241.json
// 파일명은 **이 한 곳에서만** 만든다 — 화면 표시·미리보기·실제 다운로드가 같은 값을 쓴다.
// 초 단위 시각을 넣는 이유: 날짜만 쓰던 판이 같은 날 두 번째 백업을 덮어썼고,
// 복원 직전 자동 백업까지 지워 되돌릴 근거가 사라졌다.

const FILENAME_PREFIX = "PRAGMA";
const MAX_SUBJECT_LENGTH = 20;

/** 파일 시스템 금지 문자와 군더더기 기호를 걷어낸다. 한글은 그대로 둔다. */
function stripUnsafe(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[(){}[\],]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 제목에서 학기와 핵심 과목명을 뽑는다. 자연어 파서가 아니라 두 가지 규칙만 본다.
 *  - 앞머리의 `2026-2` 또는 `2026-2학기` = 학기
 *  - 괄호 안 부가 설명은 버린다
 * 규칙에 맞지 않으면 학기를 비우고 제목 전체를 짧게 줄여 쓴다(무리한 파싱 금지).
 */
function splitCourseTitle(title: string): { term: string; subject: string } {
  const withoutParens = title.replace(/\([^)]*\)/g, " ");
  const cleaned = stripUnsafe(withoutParens);
  const termMatch = cleaned.match(/^(\d{4})[-–](\d)\s*(?:학기)?/);
  const term = termMatch ? `${termMatch[1]}-${termMatch[2]}` : "";
  const rest = termMatch ? cleaned.slice(termMatch[0].length) : cleaned;
  const subject = rest.replace(/\s+/g, "").slice(0, MAX_SUBJECT_LENGTH);
  return { term, subject: subject.length > 0 ? subject : "교과목" };
}

/** `20260818_203241` — 사용자가 보는 로컬 시각, 초까지(밀리초는 쓰지 않는다). */
function filenameStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}_${time}`;
}

/**
 * 파일명은 **여기서만** 만든다.
 *   일반   PRAGMA_2026-2_중급통번역_20260818_203241.json
 *   복원전 PRAGMA_복원전_2026-2_중급통번역_20260818_203241.json
 */
function buildBackupFilename(title: string, date: Date, kind: "backup" | "pre-restore"): string {
  const { term, subject } = splitCourseTitle(title);
  const parts = [FILENAME_PREFIX];
  if (kind === "pre-restore") parts.push("복원전");
  if (term) parts.push(term);
  parts.push(subject, filenameStamp(date));
  return `${parts.join("_")}.json`;
}

/** 내려받는 백업 파일 이름. 시각은 manifest의 백업 시점을 그대로 쓴다. */
export function courseBackupFilename(file: CourseBackupFile): string {
  return buildBackupFilename(file.manifest.outline_title, new Date(file.manifest.exported_at), "backup");
}

/** 복원 직전 자동 백업 파일 이름 — 일반 백업과 구분되고 서로도 충돌하지 않는다. */
export function preRestoreBackupFilename(file: CourseBackupFile): string {
  return buildBackupFilename(file.manifest.outline_title, new Date(file.manifest.exported_at), "pre-restore");
}

/** 아직 만들지 않은 백업의 파일명 미리보기(화면 표시용). 실제 저장 이름과 같은 규칙이다. */
export function courseBackupFilenamePreview(title: string, date: Date = new Date()): string {
  return buildBackupFilename(title, date, "backup");
}

// ── 시크릿 검사 ────────────────────────────────────────────────
// 내보내기 직전과 검증 테스트가 같은 함수를 쓴다. 하나라도 걸리면 내보내지 않는다.

const SECRET_KEY_PATTERN = /(api[_-]?key|secret|password|passwd|credential|access[_-]?token|refresh[_-]?token|service[_-]?role|bearer)/i;
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9]{16,}/, // OpenAI 계열 키
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, // JWT (anon·service-role 키 형태)
  /\bSUPABASE_SERVICE_ROLE[_A-Z]*\s*=/,
];

/** 시크릿으로 의심되는 위치를 JSON 경로 문자열로 돌려준다. 빈 배열 = 깨끗함. */
export function scanForSecrets(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) hits.push(path);
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...scanForSecrets(item, `${path}[${index}]`)));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = `${path}.${key}`;
      // 키 이름이 시크릿을 가리키면서 값이 비어 있지 않으면 그 자체로 걸린다.
      if (SECRET_KEY_PATTERN.test(key) && child !== null && child !== undefined && child !== "") {
        hits.push(childPath);
      }
      hits.push(...scanForSecrets(child, childPath));
    }
  }
  return hits;
}

export function assertNoSecrets(file: CourseBackupFile): void {
  const hits = scanForSecrets(file);
  if (hits.length > 0) {
    throw new Error(`백업 파일에 인증정보로 의심되는 값이 있어 내보내기를 중단했습니다: ${hits.join(", ")}`);
  }
}

// ── 파싱·검증 ──────────────────────────────────────────────────

export class CourseBackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseBackupFormatError";
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const requireRowArray = (value: unknown, table: string): BackupRow[] => {
  if (!Array.isArray(value)) throw new CourseBackupFormatError(`백업 파일의 ${table} 항목이 배열이 아닙니다.`);
  return value.map((row, index) => {
    if (!isPlainObject(row)) {
      throw new CourseBackupFormatError(`백업 파일의 ${table}[${index}] 항목 형식이 올바르지 않습니다.`);
    }
    return row;
  });
};

const requireString = (row: BackupRow, key: string, table: string): string => {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new CourseBackupFormatError(`${table}의 ${key} 값이 없습니다.`);
  }
  return value;
};

/** JSON 텍스트를 검증한다. 실패하면 사용자에게 보여 줄 한국어 사유와 함께 던진다. */
export function parseCourseBackup(text: string): CourseBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CourseBackupFormatError("JSON 파일로 읽을 수 없습니다. 백업 파일이 맞는지 확인해 주세요.");
  }
  if (!isPlainObject(parsed)) throw new CourseBackupFormatError("백업 파일의 최상위 구조가 올바르지 않습니다.");

  const manifest = parsed.manifest;
  if (!isPlainObject(manifest)) throw new CourseBackupFormatError("백업 파일에 manifest가 없습니다.");
  if (manifest.kind !== COURSE_BACKUP_KIND) {
    throw new CourseBackupFormatError("PRAGMA 수업 백업 파일이 아닙니다.");
  }
  if (manifest.backup_format_version !== COURSE_BACKUP_FORMAT_VERSION) {
    throw new CourseBackupFormatError(
      `지원하지 않는 백업 형식 버전입니다(파일 ${String(manifest.backup_format_version)} · 이 버전 ${COURSE_BACKUP_FORMAT_VERSION}).`,
    );
  }

  const data = parsed.data;
  if (!isPlainObject(data)) throw new CourseBackupFormatError("백업 파일에 data가 없습니다.");

  const curriculum_outlines = requireRowArray(data.curriculum_outlines, "curriculum_outlines");
  if (curriculum_outlines.length !== 1) {
    throw new CourseBackupFormatError("이 형식은 교과목 1건만 복원합니다. 파일에 담긴 교과목 수가 1이 아닙니다.");
  }
  const outlineId = requireString(curriculum_outlines[0], "id", "curriculum_outlines");

  const curriculum_weeks = requireRowArray(data.curriculum_weeks, "curriculum_weeks");
  const curriculum_week_scenarios = requireRowArray(data.curriculum_week_scenarios, "curriculum_week_scenarios");
  const scenarios = requireRowArray(data.scenarios, "scenarios");

  // 관계 검증: 주차·배정이 모두 이 교과목 것인지, 배정된 시나리오가 파일에 들어 있는지.
  const scenarioIds = new Set(scenarios.map((row) => requireString(row, "scenario_id", "scenarios")));
  for (const week of curriculum_weeks) {
    if (week.outline_id !== outlineId) {
      throw new CourseBackupFormatError("백업 파일의 주차 중 다른 교과목에 속한 항목이 있습니다.");
    }
  }
  for (const assignment of curriculum_week_scenarios) {
    if (assignment.outline_id !== outlineId) {
      throw new CourseBackupFormatError("백업 파일의 미션 배정 중 다른 교과목에 속한 항목이 있습니다.");
    }
    const scenarioId = requireString(assignment, "scenario_id", "curriculum_week_scenarios");
    if (!scenarioIds.has(scenarioId)) {
      throw new CourseBackupFormatError(`배정된 학습 미션(${scenarioId})의 본문이 백업 파일에 없습니다.`);
    }
  }

  return {
    manifest: manifest as unknown as CourseBackupManifest,
    data: { curriculum_outlines, curriculum_weeks, curriculum_week_scenarios, scenarios },
  };
}

export function summarizeCourseBackup(file: CourseBackupFile) {
  const outline = file.data.curriculum_outlines[0] ?? {};
  return {
    title: typeof outline.title === "string" ? outline.title : "(제목 없음)",
    level: typeof outline.level === "string" ? outline.level : null,
    languageDirection: typeof outline.language_direction === "string" ? outline.language_direction : null,
    domain: typeof outline.domain === "string" ? outline.domain : null,
    weekCount: file.data.curriculum_weeks.length,
    assignmentCount: file.data.curriculum_week_scenarios.length,
    scenarioCount: file.data.scenarios.length,
    exportedAt: file.manifest.exported_at,
  };
}
