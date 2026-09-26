import { useEffect, useState } from "react";
import {
  Database,
  ExternalLink,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  auditSnapshotFromContent,
  selectRecentAudit,
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
  { id: "beginner", level: "PRAGMA 입문", ceiling: "HSK 1–4급", entries: 2_000, addition: "1급 300 · 2급 200 · 3급 500 · 4급 1,000" },
  { id: "intermediate", level: "PRAGMA 중급", ceiling: "HSK 1–5급", entries: 3_600, addition: "HSK 5급 1,600개 추가" },
  { id: "advanced", level: "PRAGMA 고급", ceiling: "HSK 1–6급", entries: 5_400, addition: "HSK 6급 1,800개 추가" },
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
      title="HSK 3.0 어휘 참조"
      description="생성된 중국어 어휘를 수준별 HSK 누적 목록과 대조해 참고 기록으로 남깁니다."
    >
      <div className="w-full space-y-4">
        <DatasetOverview
          loading={loading}
          ready={referenceReady}
          status={status}
          checkedAt={referenceCheckedAt}
        />

        {error && (
          <div
            className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900"
            title={error}
          >
            운영 DB 상태를 확인하지 못했습니다. 공식 데이터의 출처와 구성 정보는 계속 볼 수 있습니다.
          </div>
        )}

        <AuditMethodSection />

        <OperationsSection
          loading={loading}
          audit={recentAudit}
          lookupFailed={auditLookupFailed}
          referenceReady={referenceReady}
        />

        <OfficialSource status={status} />
      </div>
    </AdminShell>
  );
};

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
  const checkedAt = formatAuditDate(audit?.createdAt ?? null);
  const pragmaLevel = pragmaLevelForCeiling(audit?.referenceCeiling ?? null);
  const level = audit?.learnerLevel
    ? LEVEL_LABEL[audit.learnerLevel] ?? audit.learnerLevel
    : pragmaLevel
      ? `PRAGMA ${pragmaLevel}`
      : null;
  const mode = audit?.mode ? MODE_LABEL[audit.mode] ?? audit.mode : null;
  const speechAct = audit?.speechAct
    ? SPEECH_ACT_LABEL[audit.speechAct] ?? audit.speechActText ?? audit.speechAct
    : audit?.speechActText ?? null;
  const direction = audit?.direction === "ko_zh" ? "한→중" : audit?.direction === "zh_ko" ? "중→한" : null;
  const contentKind = audit?.contentKind === "mission"
    ? "학습 미션 1건"
    : audit?.contentKind === "core"
      ? "시나리오 1건"
      : "콘텐츠 1건";
  const caseTitle = audit?.title?.replace(/^\s*\[[^\]]*\]\s*/, "") || null;
  const caseAxes = [speechAct, level, mode, direction].filter((item): item is string => Boolean(item));
  const referenceEntries = referenceEntriesForCeiling(audit?.referenceCeiling ?? null);
  const emptyTitle = lookupFailed || audit?.status === "unavailable"
    ? "최근 대조 기록을 확인할 수 없습니다."
    : audit?.status === "not_applicable"
      ? "최신 대조 대상에는 대조할 중국어가 없습니다."
      : "아직 표시할 최근 대조 기록이 없습니다.";
  const emptyDescription = lookupFailed || audit?.status === "unavailable"
    ? "잠시 뒤 다시 확인해 주세요. 대조 결과는 콘텐츠의 참고 기록으로 저장됩니다."
    : "다음 콘텐츠 생성부터 수준·추출 단어·대조 결과가 이곳에 기록됩니다.";

  return (
    <section className="overflow-hidden rounded-xl border border-[#CFC9BC] bg-white shadow-[0_10px_30px_rgba(21,32,43,0.05)]" aria-labelledby="lexical-audit-title">
      <div className="border-b border-[#E4DED1] px-4 py-4 sm:px-5">
        <div>
          <p className="text-[13.5px] font-semibold tracking-[0.11em] text-[#8A7423]">가장 최근 대조 기록</p>
          <h2 id="lexical-audit-title" className="mt-1 text-[21px] font-semibold tracking-[-0.025em] text-[#15202B]">
            {complete && audit
              ? caseTitle ? `“${caseTitle}”` : `${caseAxes.join(" · ")} · ${contentKind}`
              : "AI 생성 중국어를 수준별 HSK 누적 목록과 대조합니다"}
          </h2>
          {complete && audit && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13.5px] text-[#514C44]">
              {caseAxes.map((axis) => (
                <span key={axis} className="rounded-full border border-[#DDD6C8] bg-[#FBFAF6] px-2 py-0.5">
                  {axis}
                </span>
              ))}
              <strong className="rounded-full bg-[#ECE8DE] px-2 py-0.5 font-semibold text-[#3F3A32]">
                {contentKind}
              </strong>
              {checkedAt && <span className="text-[#8A847A]">{checkedAt}</span>}
            </div>
          )}
          <p className="mt-1 text-[13.5px] leading-5 text-[#5B564D]">
            {complete && audit
              ? `중국어 단어를 뽑아 PRAGMA ${pragmaLevel ?? "수준"} 기준(HSK 1–${audit.referenceCeiling}급 누적)과 대조했습니다.`
              : "생성된 중국어를 수준별 HSK 누적 어휘와 대조합니다."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-5">
          <Skeleton className="h-52 lg:col-span-2" />
          <Skeleton className="h-52 lg:col-span-3" />
        </div>
      ) : complete && audit ? (
        <div className="px-4 py-4 sm:px-5">
          <ol className="grid overflow-hidden rounded-lg border border-[#DED8CB] sm:grid-cols-[0.9fr_1fr_1.45fr] sm:divide-x sm:divide-[#DED8CB]">
            <li className="border-b border-[#DED8CB] bg-white px-4 py-3 sm:border-b-0">
              <p className="text-[12.5px] font-semibold tracking-[0.06em] text-[#8A7423]">01 · 대조 대상</p>
              <p className="mt-1.5 text-[26px] font-semibold leading-none text-[#15202B]">1건</p>
              <p className="mt-1.5 text-[13.5px] leading-5 text-[#5B564D]">{contentKind.replace(" 1건", "")}</p>
            </li>
            <li className="border-b border-[#DED8CB] bg-white px-4 py-3 sm:border-b-0">
              <p className="text-[12.5px] font-semibold tracking-[0.06em] text-[#8A7423]">02 · 중국어 단어 추출</p>
              <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-[#15202B]">
                {fmt(audit.distinctTokenCount ?? 0)}<span className="ml-0.5 text-[13.5px] font-normal text-[#655F55]">개</span>
              </p>
              <p className="mt-1.5 text-[13.5px] leading-5 text-[#5B564D]">중복 제외</p>
            </li>
            <li className="bg-[#FBFAF6] px-4 py-3">
              <p className="text-[12.5px] font-semibold tracking-[0.06em] text-[#8A7423]">03 · HSK 목록 대조</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-[#EEF1F2] px-3 py-2.5 text-[#15202B]">
                  <p className="text-[24px] font-semibold leading-none tabular-nums">
                    {fmt(audit.matchedTokenCount ?? 0)}<span className="ml-0.5 text-[12.5px] font-normal">개</span>
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium leading-4">목록 일치</p>
                </div>
                <div className="rounded-md bg-[#FFF4BE] px-3 py-2.5 text-[#5B4B0C]">
                  <p className="text-[24px] font-semibold leading-none tabular-nums">
                    {fmt(audit.candidates.length)}<span className="ml-0.5 text-[12.5px] font-normal">개</span>
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium leading-4">목록 밖</p>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-4 text-[#5B564D]">
                HSK 1–{audit.referenceCeiling}급 누적{referenceEntries != null && ` · ${fmt(referenceEntries)}개`}
              </p>
            </li>
          </ol>

          <div className="mt-3 rounded-lg bg-[#FFF8D8] px-3.5 py-3">
            <p className="text-[13.5px] leading-5 text-[#5F5A50]">
              <strong className="font-semibold text-[#3F3A32]">목록 밖 {fmt(audit.candidates.length)}개는 오류를 뜻하지 않습니다.</strong>{" "}
              고유명사·전문용어·어절 분리 등의 이유로 HSK 목록과 정확히 일치하지 않을 수 있습니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-5 sm:px-5">
          <p className="text-[15px] font-medium text-[#15202B]">{emptyTitle}</p>
          <p className="mt-1 text-[13.5px] leading-5 text-[#5B564D]">{emptyDescription}</p>
          {referenceReady && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> 운영 DB 준비됨
            </p>
          )}
        </div>
      )}

    </section>
  );
}

function AuditMethodSection() {
  return (
    <section
      className="overflow-hidden rounded-xl border border-[#D9D2BF] bg-[#FFFDF7]"
      aria-labelledby="audit-method-title"
    >
      <div className="border-b border-[#E5DEC9] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#8A7621]">
            어휘 참조
          </p>
        </div>
        <h2 id="audit-method-title" className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#15202B]">
          HSK 어휘 목록 대조
        </h2>
        <p className="mt-1 max-w-[50rem] text-[14px] leading-5 text-[#5B564D]">
          같은 입력에는 늘 같은 결과가 나오며, 목록 밖 단어를 막지 않습니다.
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <ol className="grid gap-2 text-[13.5px] sm:grid-cols-3">
          <li className="rounded-lg border border-[#E5DEC9] bg-white p-3">
            <span className="text-[12px] font-semibold text-[#8A7621]">01 · 입력</span>
            <p className="mt-1 font-semibold text-[#26333B]">중국어 콘텐츠 + PRAGMA 수준</p>
          </li>
          <li className="rounded-lg border border-[#E5DEC9] bg-white p-3">
            <span className="text-[12px] font-semibold text-[#8A7621]">02 · 대조</span>
            <p className="mt-1 font-semibold text-[#26333B]">중국어 단어 추출 → HSK 누적 목록 대조</p>
            <p className="mt-1 leading-relaxed text-[#5B564D]">
              목록에 있으면 목록 일치, 없으면 목록 밖으로 나눕니다.
            </p>
          </li>
          <li className="rounded-lg border border-[#E5DEC9] bg-white p-3">
            <span className="text-[12px] font-semibold text-[#8A7621]">03 · 기록</span>
            <p className="mt-1 font-semibold text-[#26333B]">목록 일치 수 + 목록 밖 단어 수</p>
            <p className="mt-1 leading-relaxed text-[#5B564D]">
              결과를 콘텐츠의 참고 기록으로 저장합니다.
            </p>
          </li>
        </ol>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[#E5DEC9] bg-white px-3 py-3 text-[13.5px] text-[#26333B]">
            <p className="font-semibold">이 대조가 확인하는 것</p>
            <p className="mt-1 leading-relaxed">
              뽑은 단어 수, HSK 목록과 일치한 수, 목록 밖 단어 수를 매번 같은 규칙으로 셉니다.
            </p>
          </div>
          <div className="rounded-lg bg-[#F6F3EA] px-3 py-3 text-[13.5px] text-[#26333B]">
            <p className="font-semibold">이 대조가 판정하지 않는 것</p>
            <p className="mt-1 leading-relaxed">
              난이도의 적절성, 목록 밖 단어의 부적절성, 재생성 필요 여부는 판정하지 않습니다.
            </p>
          </div>
        </div>
      </div>
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
          <p className="text-[13.5px] font-semibold">운영 데이터셋 확인 필요</p>
          <p className="mt-0.5 text-[13.5px]">공식 추출본은 계속 표시되며, 운영 DB 연결 상태를 확인해야 합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#D9D3C4] bg-white" aria-labelledby="dataset-title">
      <div className="flex flex-col gap-3 border-b border-[#E8E2D6] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF1F2] text-[#3F4E59]" aria-hidden>
            <Database className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[12.5px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> 최근 조회
              </span>
            </div>
            <h2 id="dataset-title" className="mt-0.5 text-[17px] font-semibold tracking-[-0.015em] text-[#15202B]">
              HSK 3.0 어휘 <span className="tabular-nums">{vocabularyEntries}개</span>
            </h2>
          </div>
        </div>
        <div className="text-left sm:text-right">
          {checkedTime && <p className="text-[13.5px] text-[#5A6670]">연결 확인 {checkedTime}</p>}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div>
          <div>
            <p className="text-[13.5px] font-semibold tracking-[0.08em] text-[#8A7423]">PRAGMA 수준별 HSK 참조 범위</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PRAGMA_RANGES.map((range) => (
            <div
              key={range.id}
              id={`pragma-${range.id}`}
              className="scroll-mt-24 rounded-lg border border-[#DED8CB] border-t-[3px] border-t-[#E2C847] bg-[#FCFBF7] px-4 py-3"
            >
              <p className="text-[18px] font-semibold tracking-[-0.02em] text-[#15202B]">{range.level}</p>
              <div className="mt-2 flex items-end justify-between gap-3 border-t border-[#E8E2D6] pt-2">
                <p className="text-[13px] font-medium text-[#615B52]">{range.ceiling} 누적</p>
                <p className="shrink-0 text-[24px] font-semibold leading-none tabular-nums text-[#15202B]">
                  {fmt(range.entries)}<span className="ml-0.5 text-[13.5px] font-normal text-[#655F55]">개</span>
                </p>
              </div>
              <p className="mt-2 text-[13.5px] text-[#655F55]">{range.addition}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OfficialSource({ status }: { status: ReferenceStatus | null }) {
  const fallback = "확인 필요";
  const release = status?.released_at || status?.effective_at
    ? `${status?.released_at ?? "—"} 발표 · ${status?.effective_at ?? "—"} 시행`
    : fallback;

  return (
    <section className="rounded-xl border border-[#D9D3C4] bg-[#F8F6EF] px-4 py-3.5 sm:px-5" aria-labelledby="official-source-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#806D22]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold tracking-[0.08em] text-[#8A7423]">공식 출처</p>
            <h2 id="official-source-title" className="mt-0.5 truncate text-[13px] font-medium text-[#15202B]">{status?.title ?? fallback}</h2>
            <p className="mt-0.5 text-[13.5px] leading-5 text-[#5B564D]">{status?.publisher ?? fallback} · {release}</p>
          </div>
        </div>
        {status?.official_url && (
          <a
            href={status.official_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-[#15202B] underline decoration-[#D6C65E] decoration-2 underline-offset-3"
          >
            공식 PDF <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </section>
  );
}

export default AdminCorpus;
