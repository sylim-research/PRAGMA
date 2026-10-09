import { useEffect, useMemo, useState } from "react";
import {
  Database,
  ExternalLink,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  auditSnapshotFromContent,
  completedAuditsNewestFirst,
  selectRecentAudit,
  summarizeMissionAudits,
  topOutOfListWords,
  type AuditSnapshot,
} from "@/lib/pragma/hskAuditSnapshot";
import { HSK3_REFERENCE_SOURCE_ID } from "@/lib/pragma/hskReference";

const EXPECTED_VOCABULARY_ENTRIES = 11_000;
const EXPECTED_TOPIC_ROWS = 427;

type ReferenceStatus = {
  source_id: string | null;
  title: string | null;
  publisher: string | null;
  released_at: string | null;
  effective_at: string | null;
  official_url: string | null;
  sha256: string | null;
  manifest_version: string | null;
  extraction_version: string | null;
  vocabulary_entries: number | null;
  official_topic_rows: number | null;
  derived_topic_rows: number | null;
  researcher_mapping_rows: number | null;
};

const PRAGMA_RANGES = [
  { id: "beginner", level: "PRAGMA 입문", ceiling: "HSK 1–4급", entries: 2_000, addition: "HSK 1–4급 누적" },
  { id: "intermediate", level: "PRAGMA 중급", ceiling: "HSK 1–5급", entries: 3_600, addition: "+ HSK 5급 1,600개" },
  { id: "advanced", level: "PRAGMA 고급", ceiling: "HSK 1–6급", entries: 5_400, addition: "+ HSK 6급 1,800개" },
] as const;

const LEVEL_LABEL: Record<string, string> = {
  beginner_intermediate: "PRAGMA 입문",
  intermediate: "PRAGMA 중급",
  advanced: "PRAGMA 고급",
};

const MODE_LABEL: Record<string, string> = {
  translation: "번역",
  stt_interpreting: "통역",
  interpreting: "통역",
};

const SPEECH_ACT_LABEL: Record<string, string> = {
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

// 글자 위계(2026-10-09): 구역 제목 17 · 소제목 16 · 본문 14 · 보조 13 · 큰 숫자 24. 중국어는 font-zh.
const H2 = "text-[17px] font-bold tracking-[-0.01em] text-[#15202B]";
const H3 = "text-[16px] font-semibold text-[#15202B]";
const META = "text-[14px] text-[#514C44]";
const NOTE = "text-[13px] text-[#655F55]";

function fmt(value: number) {
  return value.toLocaleString();
}

function formatAuditDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatConnectionTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pragmaLevelForCeiling(ceiling: number | null) {
  if (ceiling === 4) return "입문";
  if (ceiling === 5) return "중급";
  if (ceiling === 6) return "고급";
  return null;
}

function referenceEntriesForCeiling(ceiling: number | null) {
  if (ceiling === 4) return 2_000;
  if (ceiling === 5) return 3_600;
  if (ceiling === 6) return 5_400;
  return null;
}

const AdminCorpus = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReferenceStatus | null>(null);
  const [recentAudit, setRecentAudit] = useState<AuditSnapshot | null>(null);
  // 불러온 모든 대조 기록(미션·시나리오). 목록에서 한 건을 고르면 아래 상세 카드가 그 건으로 바뀐다.
  const [allAudits, setAllAudits] = useState<AuditSnapshot[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditSnapshot | null>(null);
  const [auditLookupFailed, setAuditLookupFailed] = useState(false);
  const [referenceCheckedAt, setReferenceCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      const [statusResult, missionResult, coreResult] = await Promise.all([
        supabase
          .from("hsk3_reference_status")
          .select("*")
          .eq("source_id", HSK3_REFERENCE_SOURCE_ID)
          .maybeSingle(),
        supabase
          .from("scenarios")
          .select("created_at, title, learner_level, mode, language_direction, speech_act, speech_act_text, mission_content")
          .not("mission_content", "is", null)
          .is("archived_at", null),
        supabase
          .from("scenarios")
          .select("created_at, title, learner_level, mode, language_direction, speech_act, speech_act_text, core_content")
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (cancelled) return;

      if (statusResult.error) {
        setStatus(null);
        setError(statusResult.error.message);
      } else {
        setStatus((statusResult.data as ReferenceStatus | null) ?? null);
      }
      setReferenceCheckedAt(new Date().toISOString());

      if (missionResult.error || coreResult.error) {
        setRecentAudit(null);
        setAuditLookupFailed(true);
      } else {
        const snapshots = [
          ...(missionResult.data ?? []).map((row) =>
            auditSnapshotFromContent(row.mission_content, row.created_at, {
              contentKind: "mission",
              title: row.title,
              learnerLevel: row.learner_level,
              mode: row.mode,
              languageDirection: row.language_direction,
              speechAct: row.speech_act,
              speechActText: row.speech_act_text,
            })),
          ...(coreResult.data ?? []).map((row) =>
            auditSnapshotFromContent(row.core_content, row.created_at, {
              contentKind: "core",
              title: row.title,
              learnerLevel: row.learner_level,
              mode: row.mode,
              languageDirection: row.language_direction,
              speechAct: row.speech_act,
              speechActText: row.speech_act_text,
            })),
        ].filter((item): item is AuditSnapshot => Boolean(item));
        setRecentAudit(selectRecentAudit(snapshots));
        setAllAudits(snapshots);
        setAuditLookupFailed(false);
      }

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const referenceReady = Boolean(
    status
      && Number(status.vocabulary_entries) === EXPECTED_VOCABULARY_ENTRIES
      && Number(status.official_topic_rows) === EXPECTED_TOPIC_ROWS,
  );

  return (
    <AdminShell
      title="HSK 3.0 어휘 대조"
      description="생성된 중국어 어휘를 수준별 HSK 누적 목록과 대조해 참고 기록으로 남깁니다."
    >
      {/* 네 부분을 「묻는 것 → 답」 순서로 번호를 붙여 둔다 — 생성계약 화면의 번호 제목과 같은 양식(2026-10-09). */}
      <div className="w-full space-y-8">
        <section aria-labelledby="part-reference">
          <PartHeading no={1} id="part-reference" title="HSK 3.0 대조 기준" />
          <div className="space-y-3">
            <DatasetOverview
              loading={loading}
              ready={referenceReady}
              status={status}
              checkedAt={referenceCheckedAt}
            />
            {error && (
              <div
                className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-[14px] text-amber-900"
                title={error}
              >
                운영 DB 상태를 확인하지 못했습니다. 공식 데이터의 출처와 구성 정보는 계속 볼 수 있습니다.
              </div>
            )}
            {/* 데이터셋이 준비되면 공식 출처는 기준 카드 안에 함께 보인다. */}
            {!referenceReady && <OfficialSource status={status} />}
          </div>
        </section>

        <section aria-labelledby="part-method">
          <PartHeading no={2} id="part-method" title="어휘 대조 방식" />
          <AuditMethodSection />
        </section>

        <section aria-labelledby="part-result">
          <PartHeading no={3} id="part-result" title="미션별 대조 결과" />
          <div className="space-y-3">
            {!loading && !auditLookupFailed && (
              <AuditHistory audits={allAudits} selected={selectedAudit ?? recentAudit} onSelect={setSelectedAudit} />
            )}
            <OperationsSection
              loading={loading}
              audit={selectedAudit ?? recentAudit}
              lookupFailed={auditLookupFailed}
              referenceReady={referenceReady}
            />
          </div>
        </section>

        {!loading && !auditLookupFailed && (
          <section aria-labelledby="part-trend">
            <PartHeading no={4} id="part-trend" title="목록 밖 후보 누적 경향" />
            <TopOutOfListWords audits={allAudits} />
          </section>
        )}
      </div>
    </AdminShell>
  );
};

// 번호 제목은 한 줄 — 제목이 그 부분을 요약하고 보조 설명은 두지 않는다(2026-10-09).
function PartHeading({ no, id, title }: { no: number; id: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 id={id} className="flex shrink-0 items-center gap-2.5 text-[18px] font-bold leading-8 text-[#15202B]">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#233542] text-[12px] font-bold text-white">{no}</span>
        {title}
      </h2>
      {/* 제목 오른쪽 가는 선 — 빈 자리를 채우고 구역의 시작을 표시한다(2026-10-09). */}
      <span aria-hidden className="h-px flex-1 bg-[#E2DED2]" />
    </div>
  );
}

const cleanTitle = (title: string | null) => title?.replace(/^\s*\[[^\]]*\]\s*/, "") || null;
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
function formatShortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}.${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** 일치(남색)·목록 밖(금색) 비율 막대. */
function RatioBar({ matched, outside, className = "" }: { matched: number; outside: number; className?: string }) {
  const total = matched + outside;
  const share = total > 0 ? (matched / total) * 100 : 0;
  return (
    <span aria-hidden className={`flex h-1.5 overflow-hidden rounded-full bg-[#F1E4A8] ${className}`}>
      <span className="h-full bg-[#33495A]" style={{ width: `${share}%` }} />
    </span>
  );
}

/** 고른 대조 기록 한 건 — 제목·조건, 단어 수와 일치 막대, 목록 밖 단어를 그대로 보여 준다. */
function OperationsSection({
  loading,
  audit,
  lookupFailed,
  referenceReady,
}: {
  loading: boolean;
  audit: AuditSnapshot | null;
  lookupFailed: boolean;
  referenceReady: boolean;
}) {
  const complete = Boolean(
    audit?.status === "complete"
    && audit.referenceCeiling != null
    && audit.distinctTokenCount != null
    && audit.matchedTokenCount != null,
  );
  const pragmaLevel = pragmaLevelForCeiling(audit?.referenceCeiling ?? null);
  const level = audit?.learnerLevel
    ? LEVEL_LABEL[audit.learnerLevel] ?? audit.learnerLevel
    : pragmaLevel ? `PRAGMA ${pragmaLevel}` : null;
  const mode = audit?.mode ? MODE_LABEL[audit.mode] ?? audit.mode : null;
  const speechAct = audit?.speechAct
    ? SPEECH_ACT_LABEL[audit.speechAct] ?? audit.speechActText ?? audit.speechAct
    : audit?.speechActText ?? null;
  const direction = audit?.direction === "ko_zh" ? "한→중" : audit?.direction === "zh_ko" ? "중→한" : null;
  const kind = audit?.contentKind === "core" ? "시나리오" : "학습 미션";
  const axes = [speechAct, level, mode, direction].filter((item): item is string => Boolean(item));
  const referenceEntries = referenceEntriesForCeiling(audit?.referenceCeiling ?? null);
  // 목록 밖 수 = 분석 유형 − 일치 유형. 저장된 후보 목록은 미션당 40개까지라 개수로 쓰지 않는다.
  const outsideCount = Math.max(0, (audit?.distinctTokenCount ?? 0) - (audit?.matchedTokenCount ?? 0));
  const emptyTitle = lookupFailed || audit?.status === "unavailable"
    ? "대조 기록을 불러오지 못했습니다."
    : audit?.status === "not_applicable"
      ? "대조할 중국어가 없는 콘텐츠입니다."
      : "아직 대조 기록이 없습니다.";

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2DED2] bg-white" aria-label="선택한 기록의 대조 상세">
      {loading ? (
        <div className="p-5"><Skeleton className="h-32" /></div>
      ) : complete && audit ? (
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[13px] font-semibold text-[#8A7423]">선택한 기록 · {kind}</p>
            <h3 className={`mt-0.5 ${H3}`}>{cleanTitle(audit.title) ?? axes.join(" · ")}</h3>
            <p className={`mt-1 ${NOTE}`}>{[speechAct, mode, direction].filter(Boolean).join(" · ")}</p>
          </div>
          {/* 흐름 = 뽑은 단어 → 이 미션의 기준 → 대조 결과(비율 막대). 목록 밖 단어는 아래에 예시로. */}
          <ol className="grid overflow-hidden rounded-lg border border-[#DED8CB] sm:grid-cols-[1fr_1fr_1.85fr] sm:divide-x sm:divide-[#DED8CB]">
            {/* 핵심 대응: 미션 수준(PRAGMA) → 그 수준의 HSK 대조 범위 → 결과. */}
            <li className="bg-white px-4 py-3">
              <p className="text-[13px] font-medium text-[#8A7423]">1 · 미션 수준</p>
              <p className="mt-1.5 text-[24px] font-semibold leading-tight text-[#15202B]">{level ?? "—"}</p>
            </li>
            <li className="relative bg-white px-4 py-3">
              <span aria-hidden className="absolute -left-2.5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white px-0.5 text-[16px] text-[#B5AC98] sm:block">→</span>
              <p className="text-[13px] font-medium text-[#8A7423]">2 · 대조 범위</p>
              <p className="mt-1.5 text-[24px] font-semibold leading-tight text-[#15202B]">HSK 1–{audit.referenceCeiling}급</p>
              <p className="mt-1 text-[14px] text-[#655F55]">누적 어휘{referenceEntries != null && ` ${fmt(referenceEntries)}개`}</p>
            </li>
            <li className="relative bg-[#FBFAF6] px-4 py-3">
              <span aria-hidden className="absolute -left-2.5 top-1/2 hidden -translate-y-1/2 rounded-full bg-[#FBFAF6] px-0.5 text-[16px] text-[#B5AC98] sm:block">→</span>
              {/* 큰 숫자는 비율 하나만 두고, 「N개 중 M개」를 한 구절로 아래에 둔다(2026-10-09). */}
              <p className="text-[13px] font-medium text-[#8A7423]">3 · 대조 결과</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-[#EEF1F2] px-3 py-2">
                  <p className="text-[24px] font-semibold leading-none tabular-nums text-[#15202B]">{pct(audit.distinctTokenCount ? (audit.matchedTokenCount ?? 0) / audit.distinctTokenCount : null)}</p>
                  <p className="mt-1.5 text-[13px] font-medium text-[#33495A]">HSK 1–{audit.referenceCeiling}급 목록에 있음</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-[#5A6670]">{fmt(audit.distinctTokenCount ?? 0)}개 중 {fmt(audit.matchedTokenCount ?? 0)}개</p>
                </div>
                <div className="rounded-md bg-[#FFF4BE] px-3 py-2">
                  <p className="text-[24px] font-semibold leading-none tabular-nums text-[#15202B]">{pct(audit.distinctTokenCount ? outsideCount / audit.distinctTokenCount : null)}</p>
                  <p className="mt-1.5 text-[13px] font-medium text-[#8A6A0E]">목록 밖 후보</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-[#7A6420]">{fmt(audit.distinctTokenCount ?? 0)}개 중 {fmt(outsideCount)}개</p>
                </div>
              </div>
              <RatioBar matched={audit.matchedTokenCount ?? 0} outside={outsideCount} className="mt-2.5" />
            </li>
          </ol>
          {audit.candidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[14px] font-medium text-[#514C44]">목록 밖 후보 예</span>
              {audit.candidates.slice(0, 12).map((word) => (
                <span key={word} className="rounded-md border border-[#EBDDA2] bg-[#FFF9E3] px-2 py-0.5 font-zh text-[15px] text-[#3F3A32]" lang="zh">{word}</span>
              ))}
              {outsideCount > Math.min(12, audit.candidates.length) && <span className="text-[14px] text-[#655F55]">외 {fmt(outsideCount - Math.min(12, audit.candidates.length))}개</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-4">
          <p className="text-[15px] font-medium text-[#15202B]">{emptyTitle}</p>
          {referenceReady && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> HSK 목록 준비됨
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 대조 기록 — [미션 자동 생성] 때마다 서버가 남긴 HSK 대조 기록을 모아 보여 준다.
 * 새로 대조하지 않고 저장된 기록만 읽는다. 목록 포함률은 난이도·적절성 판정이 아니다.
 */
function AuditHistory({ audits, selected, onSelect }: { audits: AuditSnapshot[]; selected: AuditSnapshot | null; onSelect: (audit: AuditSnapshot) => void }) {
  const summary = useMemo(() => summarizeMissionAudits(audits), [audits]);
  const recent = useMemo(() => completedAuditsNewestFirst(audits).slice(0, 10), [audits]);
  if (recent.length === 0) return null;
  const grid = "grid grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_5.5rem_6.5rem] items-center gap-x-4";
  return (
    <section aria-label="대조 기록" className="overflow-hidden rounded-xl border border-[#E2DED2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 pb-3 pt-4">
        <div className="flex items-baseline gap-3">
          <span className={META}>
            학습 미션 <b className="font-semibold text-[#15202B]">{fmt(summary.all.count)}</b> · HSK 목록 포함률(유형 기준·합산) <b className="font-semibold text-[#15202B]">{pct(summary.all.matchRatio)}</b>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.byCeiling.filter((row) => row.count > 0).map((row) => (
            <span key={row.ceiling} className="rounded-full bg-[#F4F1E8] px-3 py-1 text-[13px] text-[#514C44]">
              {pragmaLevelForCeiling(row.ceiling)} <b className="font-semibold text-[#15202B]">{fmt(row.count)}</b> · {pct(row.matchRatio)}
            </span>
          ))}
        </div>
        {/* 76% 같은 평균 바로 곁에서 해석의 경계를 한 번 보인다(목록 밖 = 수준 부적합이 아님). */}
        <p className="basis-full text-[13px] text-[#7A746A]">목록 밖 후보는 곧바로 수준 부적합을 뜻하지 않습니다.</p>
      </div>
      <div className={`${grid} border-y border-[#EFEAE0] bg-[#FBFAF6] px-5 py-1.5 text-[13px] text-[#7A746A]`}>
        <span>일시</span><span>콘텐츠</span><span>조건</span><span className="text-right">일치 / 밖</span><span className="text-right">포함률(유형)</span>
      </div>
      <ol className="divide-y divide-[#F2EEE6]">
        {recent.map((audit, index) => {
          const active = selected === audit || (!selected && index === 0);
          const matched = audit.matchedTokenCount ?? 0;
          const outside = Math.max(0, (audit.distinctTokenCount ?? 0) - matched);
          const ratio = audit.distinctTokenCount ? matched / audit.distinctTokenCount : null;
          return (
            <li key={`${audit.createdAt}-${index}`}>
              <button type="button" onClick={() => onSelect(audit)} aria-pressed={active}
                className={`${grid} w-full px-5 py-2 text-left text-[14px] transition-colors ${active ? "bg-[#FFF8DA]" : "hover:bg-[#FAF8F2]"}`}>
                <span className="tabular-nums text-[#7A746A]">{formatShortDate(audit.createdAt)}</span>
                <span className="truncate text-[#15202B]">{cleanTitle(audit.title) ?? "제목 없음"}</span>
                <span className="truncate text-[#655F55]">
                  {[audit.speechAct ? SPEECH_ACT_LABEL[audit.speechAct] ?? audit.speechAct : null, pragmaLevelForCeiling(audit.referenceCeiling), audit.direction === "zh_ko" ? "중→한" : "한→중"].filter(Boolean).join(" · ")}
                </span>
                <span className="text-right tabular-nums text-[#514C44]">{fmt(matched)} / {fmt(outside)}</span>
                <span className="flex items-center justify-end gap-2">
                  <RatioBar matched={matched} outside={outside} className="w-10" />
                  <span className="w-9 text-right font-semibold tabular-nums text-[#15202B]">{pct(ratio)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** 자주 나온 HSK 목록 밖 어휘 Top 20 — 탐색용 목록. 해석·판정 라벨은 두지 않는다(범주 판정은 따로 한다). */
function TopOutOfListWords({ audits }: { audits: AuditSnapshot[] }) {
  const top = useMemo(() => topOutOfListWords(audits, 20), [audits]);
  if (top.words.length === 0) return null;
  const max = top.words[0].missionCount;
  return (
    <section aria-label="자주 나온 HSK 목록 밖 후보" className="overflow-hidden rounded-xl border border-[#E2DED2] bg-white">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pb-3 pt-4">
        <span className={META}>상위 {top.words.length}개 · 학습 미션 {fmt(top.missionCount)}개 기준</span>
      </div>
      <ol className="grid gap-x-6 gap-y-1 border-t border-[#EFEAE0] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        {top.words.map(({ word, missionCount }, index) => (
          <li key={word} className="flex items-center gap-2.5 py-1 text-[14px]">
            <span className="w-5 text-right text-[13px] tabular-nums text-[#9A9387]">{index + 1}</span>
            <span className="w-16 shrink-0 font-zh text-[15px] text-[#15202B]" lang="zh">{word}</span>
            <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F4F1E8]">
              <span className="block h-full rounded-full bg-[#E3C44E]" style={{ width: `${(missionCount / max) * 100}%` }} />
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums text-[#514C44]">미션 {fmt(missionCount)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 대조 방식 — 세 단계와, 어휘교육 연구자가 먼저 묻는 방법 세부를 한 줄씩 보인다(2026-10-09). */
const AUDIT_METHOD_DETAILS: { label: string; body: string }[] = [
  { label: "분절", body: "ICU 단어 분절기(Intl.Segmenter, 중국어 단어 단위) · 한자가 들어간 단어만" },
  { label: "단위", body: "서로 다른 단어(유형) · 미션당 최대 160개, 넘으면 등장 순서로 자름" },
  { label: "대상", body: "한→중은 중국어 산출문(번역안·후보·추천 표현), 중→한은 중국어 원문" },
  { label: "산식", body: "목록 안 유형 수 ÷ 분석한 유형 수 — 텍스트 커버리지(토큰 기준)가 아님" },
];

function AuditMethodSection() {
  const steps = ["중국어 단어 추출", "HSK 누적 목록과 대조", "일치·목록 밖 후보 기록"];
  return (
    <section aria-label="대조 방식" className="flex flex-wrap items-center gap-x-6 gap-y-2.5 rounded-xl border border-[#E2DED2] bg-[#FFFDF7] px-5 py-4">
      <ol className="flex flex-wrap items-center gap-2 text-[14px] text-[#26333B]">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className="text-[#B5AC98]">→</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 ring-1 ring-[#E5DEC9]">
              <span className="text-[13px] font-semibold text-[#8A7423]">{index + 1}</span>{step}
            </span>
          </li>
        ))}
      </ol>
      <dl className="grid basis-full gap-x-6 gap-y-1 border-t border-[#EFE8D2] pt-2.5 text-[14px] md:grid-cols-2">
        {AUDIT_METHOD_DETAILS.map((item) => (
          <div key={item.label} className="flex gap-2">
            <dt className="w-8 shrink-0 font-semibold text-[#8A7423]">{item.label}</dt>
            <dd className="text-[#3B4A54]">{item.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DatasetOverview({
  loading,
  ready,
  status,
  checkedAt,
}: {
  loading: boolean;
  ready: boolean;
  status: ReferenceStatus | null;
  checkedAt: string | null;
}) {
  const vocabularyEntries = status?.vocabulary_entries == null
    ? "—"
    : fmt(Number(status.vocabulary_entries));
  const checkedTime = formatConnectionTime(checkedAt);

  if (loading) {
    return <Skeleton className="h-[300px] w-full rounded-xl" />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[58px] items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
        <div>
          <p className="text-[14px] font-semibold">운영 데이터셋 확인 필요</p>
          <p className="mt-0.5 text-[14px]">공식 추출본은 계속 표시되며, 운영 DB 연결 상태를 확인해야 합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#E2DED2] bg-white" aria-labelledby="dataset-title">
      <div className="flex flex-col gap-3 border-b border-[#E8E2D6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF1F2] text-[#3F4E59]" aria-hidden>
            <Database className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[13px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> 최근 조회
              </span>
            </div>
            <h3 id="dataset-title" className={`mt-0.5 ${H2}`}>
              HSK 3.0 어휘 <span className="tabular-nums">{vocabularyEntries}개</span>
            </h3>
          </div>
        </div>
        <div className="text-left sm:text-right">
          {checkedTime && <p className="text-[14px] text-[#5A6670]">연결 확인 {checkedTime}</p>}
        </div>
      </div>

      {/* 무엇과 대조했나 — 공식 기준과 실제 대조 목록을 나눠 보인다(2026-10-09). */}
      <dl className="space-y-1 border-b border-[#E8E2D6] bg-[#FBFAF6] px-5 py-3 text-[14px]">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <dt className="w-[5.5rem] shrink-0 font-semibold text-[#8A7423]">공식 기준</dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
            <span><b className="font-zh text-[#15202B]" lang="zh">{status?.title ?? "확인 필요"}</b> <span className="text-[#5B564D]">· <span className="font-zh" lang="zh">{status?.publisher ?? "확인 필요"}</span> · {releaseLine(status)}</span></span>
            {status?.official_url && (
              <a href={status.official_url} target="_blank" rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#15202B] underline decoration-[#D6C65E] decoration-2 underline-offset-3">
                공식 PDF <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <dt className="w-[5.5rem] shrink-0 font-semibold text-[#8A7423]">실제 대조 목록</dt>
          <dd className="text-[#5B564D]">
            공식 PDF 추출본 · 표제어 <b className="font-semibold tabular-nums text-[#15202B]">{vocabularyEntries}개</b>
            {status?.extraction_version && <> · 추출 {status.extraction_version}</>}
            {status?.manifest_version && <> · 목록 {status.manifest_version}</>}
          </dd>
        </div>
      </dl>

      <div className="px-5 py-4">
        <div>
          <div>
            <h3 className={H3}>PRAGMA 수준별 HSK 참조 범위</h3>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PRAGMA_RANGES.map((range) => (
            <div
              key={range.id}
              id={`pragma-${range.id}`}
              className="scroll-mt-24 rounded-lg border border-[#DED8CB] border-t-[3px] border-t-[#E2C847] bg-[#FCFBF7] px-4 py-3"
            >
              {/* 카드 = 수준 이름 · 누적 어휘 수 · 핵심 한 줄(입문은 누적 범위, 중·고급은 추가분). */}
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[16px] font-semibold text-[#15202B]">{range.level}</p>
                <p className="shrink-0 text-[24px] font-semibold leading-none tabular-nums text-[#15202B]">
                  {fmt(range.entries)}<span className="ml-0.5 text-[14px] font-normal text-[#655F55]">개</span>
                </p>
              </div>
              <p className="mt-1.5 text-[14px] font-medium text-[#615B52]">{range.addition}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function releaseLine(status: ReferenceStatus | null) {
  return status?.released_at || status?.effective_at
    ? `${status?.released_at ?? "—"} 발표 · ${status?.effective_at ?? "—"} 시행`
    : "확인 필요";
}

function OfficialSource({ status }: { status: ReferenceStatus | null }) {
  const fallback = "확인 필요";
  const release = releaseLine(status);

  return (
    <section className="rounded-xl border border-[#E2DED2] bg-[#F8F6EF] px-4 py-2.5 sm:px-5" aria-labelledby="official-source-title">
      {/* 공식 출처는 한 줄: 「공식 출처 · 제목 · 발행처 · 발표·시행」 + 오른쪽 PDF 링크. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 text-[14px]">
          <span className="font-semibold text-[#8A7423]">공식 출처</span>
          <h2 id="official-source-title" className="font-semibold text-[#15202B]">{status?.title ?? fallback}</h2>
          <span className="text-[#5B564D]">{status?.publisher ?? fallback} · {release}</span>
        </div>
        {status?.official_url && (
          <a
            href={status.official_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold text-[#15202B] underline decoration-[#D6C65E] decoration-2 underline-offset-3"
          >
            공식 PDF <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </section>
  );
}

export default AdminCorpus;
