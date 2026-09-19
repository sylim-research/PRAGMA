import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FilePenLine } from "lucide-react";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSessions, type LearningSession } from "@/lib/learningSessions";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { supabase } from "@/integrations/supabase/client";

// 학습자 본인의 완료 기록을 전체 교과목에 걸쳐 다시 보는 화면.
// 기록을 요약할 뿐 유형·성향·능력을 판정하지 않는다(2026-09-19 설계 판정).

type ReportRecord = {
  id: string;
  speechAct: SpeechActUI | null;
  taskType: "translation" | "interpreting" | "other";
  /** 미션 원문 — 어떤 상황의 기록인지 학습자가 떠올릴 수 있게 함께 보여 준다. */
  sourceText: string;
  firstResponse: string;
  revisedResponse: string;
  completedAt: string;
};

type MissionLogRecord = {
  id: string;
  mission_id: string | null;
  speech_act: string | null;
  task_type: string | null;
  source_text: string | null;
  first_response: string | null;
  revised_response: string | null;
  completed_at: string | null;
  created_at: string;
};

const ACTS: SpeechActUI[] = [
  "request",
  "apology",
  "thanks",
  "compliment",
  "agreement",
  "refusal",
  "complaint",
  "proposal",
  "opposition",
];

/** 모든 학습자에게 같은 회고 질문의 화행별 초점. 개인 진단이 아니다. */
const ACT_FOCUS: Record<SpeechActUI, string> = {
  request: "직접성·완화·선택 여지",
  apology: "책임 인정·수리 제안",
  thanks: "감사 이유·관계 표현",
  compliment: "칭찬의 초점·대응 방식",
  agreement: "초대 범위·상대 선택권",
  refusal: "거절 명확성·관계 유지",
  complaint: "문제 제기·해결 요청",
  proposal: "제안 강도·협의 여지",
  opposition: "이견 명확성·관계 조정",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isSpeechAct = (value: string | null): value is SpeechActUI =>
  value !== null && ACTS.includes(value as SpeechActUI);

/**
 * 모든 숫자·지도·돌아보기·수정 노트가 함께 쓰는 집계 기준(한 곳에서만 정의).
 * 완료(조회 조건) + 9화행 중 하나 + 실제 미션에 연결(미션 id가 시나리오 UUID).
 * 프로토타입 시기의 `sample:` 시험 기록처럼 미션·화행 연결을 확인할 수 없는 행은 원자료로 남기되
 * 현행 요약에서는 뺀다. 과거 v5 미션의 정상 기록은 구버전이어도 포함한다.
 */
function isCountableLog(row: Pick<MissionLogRecord, "mission_id" | "speech_act">) {
  return isSpeechAct(row.speech_act) && typeof row.mission_id === "string" && UUID.test(row.mission_id);
}

function localRecord(session: LearningSession): ReportRecord {
  const key = session.selected_translation as keyof LearningSession["ai_translations"];
  const first = session.ai_translations[key] ?? session.selected_translation ?? "";
  return {
    id: session.session_id,
    speechAct: isSpeechAct(session.speech_act) ? session.speech_act : null,
    taskType: session.mode === "interpretation" ? "interpreting" : "translation",
    sourceText: "",
    firstResponse: first,
    revisedResponse: session.final_translation,
    completedAt: session.timestamp,
  };
}

function missionLogRecord(row: MissionLogRecord): ReportRecord {
  return {
    id: row.id,
    speechAct: isSpeechAct(row.speech_act) ? row.speech_act : null,
    taskType:
      row.task_type === "interpreting"
        ? "interpreting"
        : row.task_type === "translation"
          ? "translation"
          : "other",
    sourceText: row.source_text ?? "",
    firstResponse: row.first_response ?? "",
    revisedResponse: row.revised_response ?? row.first_response ?? "",
    completedAt: row.completed_at ?? row.created_at,
  };
}

function changed(record: ReportRecord) {
  return Boolean(
    record.firstResponse.trim() &&
      record.revisedResponse.trim() &&
      record.firstResponse.trim() !== record.revisedResponse.trim(),
  );
}

const TASK_LABEL: Record<ReportRecord["taskType"], string> = { translation: "번역", interpreting: "통역", other: "통번역" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

/** 기록 한 건의 머리 줄 — 화행·날짜·과업. */
function recordMeta(record: ReportRecord) {
  return [record.speechAct ? SPEECH_ACT_UI[record.speechAct] : null, shortDate(record.completedAt), TASK_LABEL[record.taskType]]
    .filter(Boolean).join(" · ");
}

// 글자 체계: 한국어 본문 14px · 보조 12~13px · 중국어 표현 16px(줄간격 1.75). 한 화면에서 이 값만 쓴다.
const eyebrow = "text-[12.5px] font-semibold text-[#857653]";
const sectionTitle = "text-[17px] font-bold text-[#15202B]";
const rowGrid = "grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5";
const rowLabel = "pt-[3px] text-[12px] font-semibold text-[#8C8471]";
const zhText = "min-w-0 break-words font-zh text-[16px] leading-7 text-[#15202B]";

/** 원문 — 길면 두 줄까지만 보이고 「펼치기」로 전체를 연다. */
function SourceText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 70;
  return (
    <div className="break-words text-[14px] leading-7 text-[#4F6070]">
      <p className={long && !open ? "line-clamp-2" : ""}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-[#344F63] hover:underline">
          {open ? "접기" : "펼치기"}
        </button>
      )}
    </div>
  );
}

/** 수정 노트 한 건 — 머리 줄, 원문, 내 번역 → 고친 번역. */
function RevisionNote({ record, plain = false }: { record: ReportRecord; plain?: boolean }) {
  return (
    <article className={plain ? "" : "rounded-xl border border-[#E4DFD0] bg-white p-4"}>
      <p className="text-[12px] font-semibold text-[#8C8471]">{recordMeta(record)}</p>
      <dl className={`mt-2 ${rowGrid}`}>
        {record.sourceText && <><dt className={rowLabel}>원문</dt><dd className="min-w-0"><SourceText text={record.sourceText} /></dd></>}
        <dt className={rowLabel}>내 {TASK_LABEL[record.taskType]}</dt>
        <dd className={zhText}>{record.firstResponse || "기록 없음"}</dd>
        <dt className={rowLabel}>고친 {TASK_LABEL[record.taskType]}</dt>
        <dd className={zhText}>{record.revisedResponse || "기록 없음"}</dd>
      </dl>
    </article>
  );
}

const panel = "rounded-2xl border border-[#E4DFD0] bg-white shadow-[0_8px_24px_rgba(21,32,43,0.04)]";

const LearnerRecords = () => {
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const localRecords = useMemo(
    () => (isLocalHost ? getSessions().map(localRecord) : []),
    [isLocalHost],
  );
  const [remoteRecords, setRemoteRecords] = useState<ReportRecord[] | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [recordsError, setRecordsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedAct, setSelectedAct] = useState<SpeechActUI>("request");
  const reviewRef = useRef<HTMLElement>(null);
  const selectAct = (act: SpeechActUI) => {
    setSelectedAct(act);
    // 카드를 누른 결과가 화면 밖에서만 바뀌지 않도록 돌아보기 칸을 보이게 한다.
    const panelEl = reviewRef.current;
    if (panelEl && panelEl.getBoundingClientRect().top > window.innerHeight * 0.6) {
      panelEl.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    setRemoteRecords(null);
    setRecordsError(false);
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        const userId = auth.session?.user?.id;
        if (!userId) {
          if (!cancelled) setRemoteRecords([]);
          return;
        }
        const { data, error } = await supabase
          .from("learner_mission_logs")
          .select(
            "id,mission_id,speech_act,task_type,source_text,first_response,revised_response,completed_at,created_at",
          )
          .eq("auth_user_id", userId)
          .eq("mission_completed", true)
          .order("completed_at", { ascending: false, nullsFirst: false });
        if (error) throw error;
        if (!cancelled) {
          const rows = (data ?? []) as MissionLogRecord[];
          const countable = rows.filter(isCountableLog);
          setExcludedCount(rows.length - countable.length);
          setRemoteRecords(countable.map(missionLogRecord));
        }
      } catch {
        if (!cancelled) setRecordsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const usingLocalPreview = isLocalHost && !recordsError && remoteRecords !== null && remoteRecords.length === 0 && localRecords.length > 0;
  const records = usingLocalPreview ? localRecords : remoteRecords ?? [];
  const completedCount = records.length;
  const revisions = records.filter(changed);
  const actsCovered = new Set(records.flatMap((record) => (record.speechAct ? [record.speechAct] : [])));
  const translationCount = records.filter((record) => record.taskType === "translation").length;
  const interpretingCount = records.filter((record) => record.taskType === "interpreting").length;
  const selectedRecords = records.filter((record) => record.speechAct === selectedAct);
  const selectedRevisions = selectedRecords.filter(changed).length;
  const latestRevision = revisions[0] ?? null;
  const actLabel = SPEECH_ACT_UI[selectedAct];

  if (recordsError || remoteRecords === null) {
    return (
      <LearnerJourneyShell nav>
        <div className="pb-24">
          <h1 className="text-[27px] font-bold tracking-[-0.025em] sm:text-[30px]">나의 학습 기록</h1>
          <div className={`${panel} mt-5 p-5`} role={recordsError ? "alert" : "status"}>
            <p className="text-[13px] text-muted-foreground">
              {recordsError ? "학습 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : "학습 기록을 불러오는 중…"}
            </p>
            {recordsError && (
              <button type="button" className="mt-3 text-[13px] font-semibold underline underline-offset-4" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                다시 불러오기
              </button>
            )}
          </div>
        </div>
      </LearnerJourneyShell>
    );
  }

  return (
    <LearnerJourneyShell nav>
      <div className="pb-24">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className={eyebrow}>전체 교과목</p>
            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.02em] text-[#15202B]">나의 학습 기록</h1>
          </div>
          {usingLocalPreview && (
            <span className="rounded-full bg-[#EFEBDD] px-3 py-1 text-[11px] font-semibold text-[#756D5E]">
              localhost 시연 데이터
            </span>
          )}
        </header>

        <section className={`${panel} mt-5 grid grid-cols-2 divide-x divide-y divide-[#EEE9DC] overflow-hidden sm:grid-cols-4 sm:divide-y-0`} aria-label="수업 이수 범위">
          {[
            [String(completedCount), "완료 학습 기록"],
            [String(revisions.length), "고쳐 쓴 기록"],
            [`${actsCovered.size}/9`, "수행 화행"],
            [`${translationCount} · ${interpretingCount}`, "번역 · 통역"],
          ].map(([value, label]) => (
            <div key={label} className="px-5 py-4">
              <div className="text-[22px] font-bold leading-none tabular-nums text-[#15202B]">{value}</div>
              <div className="mt-2 text-[12.5px] text-[#5C6A7A]">{label}</div>
            </div>
          ))}
        </section>
        {!usingLocalPreview && excludedCount > 0 && (
          <p className="mt-2 text-[12px] text-[#7A8590]">
            미션·화행 연결을 확인할 수 없는 이전 시험 기록 {excludedCount}건은 집계에서 제외했습니다.
          </p>
        )}
        {completedCount === 0 && (
          <section className={`${panel} mt-5 flex flex-wrap items-center justify-between gap-4 p-6`}>
            <div>
              <h2 className="text-[16px] font-bold">아직 완료한 미션이 없습니다.</h2>
              <p className="mt-1 text-[13.5px] text-[#5C6A7A]">미션을 마치면 내가 쓴 표현과 고쳐 쓴 과정이 여기에 쌓입니다.</p>
            </div>
            <Link to="/learner/course" className="rounded-lg bg-[#15202B] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#22303C]">
              이번 주 미션 하러 가기 →
            </Link>
          </section>
        )}

        <section className={`${panel} mt-6 p-6`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className={sectionTitle}>9개 화행 학습 지도</h2>
              <p className="mt-1 text-[13px] text-[#5C6A7A]">화행을 누르면 아래에서 내 기록을 볼 수 있습니다.</p>
            </div>
            <span className="text-[12.5px] text-[#5C6A7A]">{actsCovered.size}/9 화행 수행</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="화행별 학습 이력">
            {ACTS.map((act) => {
              const count = records.filter((record) => record.speechAct === act).length;
              const active = selectedAct === act;
              return (
                <button
                  key={act}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectAct(act)}
                  className={[
                    "flex min-h-[64px] min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-[#15202B] bg-[#15202B] text-white"
                      : count > 0
                        ? "border-[#D3DAE6] bg-[#F3F5F9] text-[#15202B] hover:border-[#6A7C96]"
                        : "border-[#E4DFD0] bg-[#FBF9F3] text-[#15202B] hover:border-[#C9BFA6]",
                  ].join(" ")}
                >
                  <span className="text-[15.5px] font-bold">{SPEECH_ACT_UI[act]}</span>
                  <span className={`shrink-0 text-[12.5px] ${active ? "text-[#D8DEE4]" : count > 0 ? "text-[#344F63]" : "text-[#8C8471]"}`}>
                    {count ? `${count}건 완료` : "기록 없음"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section ref={reviewRef} className={`${panel} mt-6 scroll-mt-24 p-6`} aria-live="polite" aria-label="선택한 화행 돌아보기">
          <p className={eyebrow}>선택한 화행 돌아보기</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[20px] font-bold text-[#15202B]">{actLabel}</h2>
            {selectedRecords.length > 0 && (
              <p className="text-[13px] text-[#5C6A7A]">
                완료 {selectedRecords.length}건 · 고쳐 쓴 기록 {selectedRevisions}건 · 번역 {selectedRecords.filter((r) => r.taskType === "translation").length} · 통역 {selectedRecords.filter((r) => r.taskType === "interpreting").length}
              </p>
            )}
          </div>
          {selectedRecords.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#5C6A7A]">{actLabel} 완료 기록이 아직 없습니다.</p>
          ) : (
            <ol className="mt-4 divide-y divide-[#EEE9DC] border-y border-[#EEE9DC]" aria-label={`${actLabel} 완료 기록`}>
              {selectedRecords.map((record) => (
                <li key={record.id} className="py-4">
                  <p className="text-[12px] font-semibold text-[#8C8471]">{recordMeta(record)}</p>
                  <dl className={`mt-2 ${rowGrid}`}>
                    {record.sourceText && <><dt className={rowLabel}>원문</dt><dd className="min-w-0"><SourceText text={record.sourceText} /></dd></>}
                    <dt className={rowLabel}>내 {TASK_LABEL[record.taskType]}</dt>
                    <dd className={zhText}>{record.firstResponse || "기록 없음"}</dd>
                    <dt className={rowLabel}>고친 {TASK_LABEL[record.taskType]}</dt>
                    <dd className={changed(record) ? zhText : "text-[13.5px] leading-7 text-[#7A8590]"}>
                      {changed(record) ? record.revisedResponse : "고치지 않음"}
                    </dd>
                  </dl>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 rounded-r-lg border-l-[3px] border-[#D6A636] bg-[#FFF9EA] px-4 py-3">
            <p className="text-[12.5px] font-semibold text-[#8A5A14]">회고 질문 · 모든 학습자에게 같은 질문입니다 — 위 기록을 보며 답해 보세요</p>
            <ul className="mt-1.5 space-y-1 text-[14px] leading-relaxed text-[#26323D]">
              <li>최종 표현에서도 원문의 의미와 {actLabel}의 목적이 유지되었나요?</li>
              <li>표현을 그대로 유지하거나 바꾼 이유는 무엇인가요? <span className="text-[#7A8590]">(살펴볼 점: {ACT_FOCUS[selectedAct]})</span></li>
            </ul>
          </div>
        </section>

        <section className={`${panel} mt-6 p-6`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={`flex items-center gap-2 ${sectionTitle}`}><FilePenLine className="h-[18px] w-[18px]" />전체 화행의 최근 수정 노트</h2>
            {revisions.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="text-[13px] font-semibold text-[#344F63] hover:underline">전체 수정 노트 →</button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto bg-[#FAF8F2]">
                  <DialogHeader>
                    <DialogTitle>전체 수정 노트</DialogTitle>
                    <DialogDescription>완료한 미션에서 최초 표현과 최종 선택이 달라진 기록입니다.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {revisions.map((record) => <RevisionNote key={record.id} record={record} />)}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {latestRevision ? (
            <div className="mt-4"><RevisionNote record={latestRevision} plain /></div>
          ) : (
            <p className="mt-3 text-[13.5px] text-[#5C6A7A]">최초 표현과 최종 선택이 달라진 기록이 아직 없습니다.</p>
          )}
        </section>
      </div>
    </LearnerJourneyShell>
  );
};

export default LearnerRecords;
