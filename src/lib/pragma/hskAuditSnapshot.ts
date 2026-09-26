export type AuditStatus = "complete" | "not_applicable" | "unavailable";

export type AuditSnapshot = {
  status: AuditStatus;
  direction: "ko_zh" | "zh_ko" | null;
  createdAt: string | null;
  contentKind: "mission" | "core" | null;
  title: string | null;
  learnerLevel: string | null;
  mode: string | null;
  speechAct: string | null;
  speechActText: string | null;
  referenceCeiling: number | null;
  distinctTokenCount: number | null;
  matchedTokenCount: number | null;
  candidates: string[];
};

export type AuditSnapshotContext = {
  contentKind?: "mission" | "core" | null;
  title?: unknown;
  learnerLevel?: unknown;
  mode?: unknown;
  speechAct?: unknown;
  speechActText?: unknown;
  languageDirection?: unknown;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function auditTimestamp(record: Record<string, unknown>, fallback: string | null) {
  const provenance = recordValue(record.provenance);
  const generation = recordValue(record.generation);
  return stringValue(provenance?.generated_at)
    ?? stringValue(generation?.generated_at)
    ?? fallback;
}

export function auditSnapshotFromContent(
  content: unknown,
  fallbackCreatedAt: string | null,
  context: AuditSnapshotContext = {},
): AuditSnapshot | null {
  const record = recordValue(content);
  const audit = recordValue(record?.hsk_lexical_audit);
  const status = audit?.status;
  if (status !== "complete" && status !== "not_applicable" && status !== "unavailable") {
    return null;
  }
  const direction = audit.direction === "ko_zh" || audit.direction === "zh_ko"
    ? audit.direction
    : context.languageDirection === "ko_zh" || context.languageDirection === "zh_ko"
      ? context.languageDirection
      : null;
  return {
    status,
    direction,
    createdAt: record ? auditTimestamp(record, fallbackCreatedAt) : fallbackCreatedAt,
    contentKind: context.contentKind === "mission" || context.contentKind === "core"
      ? context.contentKind
      : null,
    title: stringValue(context.title),
    learnerLevel: stringValue(context.learnerLevel),
    mode: stringValue(context.mode),
    speechAct: stringValue(context.speechAct),
    speechActText: stringValue(context.speechActText),
    referenceCeiling: typeof audit.reference_ceiling === "number" ? audit.reference_ceiling : null,
    distinctTokenCount: typeof audit.distinct_token_count === "number" ? audit.distinct_token_count : null,
    matchedTokenCount: typeof audit.matched_token_count === "number" ? audit.matched_token_count : null,
    candidates: Array.isArray(audit.out_of_reference_candidates)
      ? audit.out_of_reference_candidates.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function timestampValue(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function selectRecentAudit(snapshots: AuditSnapshot[]) {
  const newestFirst = [...snapshots].sort(
    (left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt),
  );
  return newestFirst.find((item) => item.status === "complete") ?? newestFirst[0] ?? null;
}

/** 완료된 대조 기록을 최신 순으로. 화면의 「대조 기록」 목록용. */
export function completedAuditsNewestFirst(snapshots: AuditSnapshot[]) {
  return [...snapshots]
    .filter((item) => item.status === "complete" && (item.distinctTokenCount ?? 0) > 0)
    .sort((left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt));
}

export type AuditSummaryRow = { count: number; matchRatio: number | null };

/** 학습 미션 대조 기록의 누적 요약: 전체와 참조 상한(4·5·6급)별 미션 수·목록 일치율(일치 단어 합 ÷ 추출 단어 합). */
export function summarizeMissionAudits(snapshots: AuditSnapshot[]) {
  const missions = completedAuditsNewestFirst(snapshots).filter((item) => item.contentKind === "mission");
  const bucket = (rows: AuditSnapshot[]): AuditSummaryRow => {
    const distinct = rows.reduce((sum, item) => sum + (item.distinctTokenCount ?? 0), 0);
    const matched = rows.reduce((sum, item) => sum + (item.matchedTokenCount ?? 0), 0);
    return { count: rows.length, matchRatio: distinct > 0 ? matched / distinct : null };
  };
  return {
    all: bucket(missions),
    byCeiling: ([4, 5, 6] as const).map((ceiling) => ({ ceiling, ...bucket(missions.filter((item) => item.referenceCeiling === ceiling)) })),
  };
}
