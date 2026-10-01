import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { buildLearningRecordDetail, type RecordDetailRow } from "@/lib/admin/learningRecordDetail";
import { getSessions, type LearningSession } from "@/lib/learningSessions";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";
import { supabase } from "@/integrations/supabase/client";

// 학습자 본인의 완료 기록을 다시 읽는 화면 — 재검토의 자료(원고 4.3.5·5.2.3).
// 기록을 옮겨 보여 줄 뿐 점수·유형·강약점을 만들지 않는다. 고친 건수처럼 「고치는 것이 목표」로 읽히는 숫자도 두지 않는다.

type ReportRecord = {
  id: string;
  speechAct: SpeechActUI | null;
  taskType: "translation" | "interpreting" | "other";
  courseId: string | null;
  weekNo: number | null;
  sourceText: string;
  firstResponse: string;
  revisedResponse: string;
  completedAt: string;
  /** 저장된 AI 피드백 판정 줄 — 채점이 아니다. */
  feedback: string[];
  decision: "최초 산출 유지" | "수정" | null;
  dissent: { conditions: string[]; reason: string | null } | null;
};

type MissionLogRecord = RecordDetailRow & {
  id: string;
  mission_id: string | null;
  speech_act: string | null;
  course_id: string | null;
  week_no: number | null;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isSpeechAct = (value: string | null): value is SpeechActUI =>
  value !== null && ACTS.includes(value as SpeechActUI);

/**
 * 목록에 올리는 기준(한 곳에서만 정의).
 * 완료(조회 조건) + 9화행 중 하나 + 실제 미션에 연결(미션 id가 시나리오 UUID).
 * 프로토타입 시기의 `sample:` 시험 기록처럼 미션·화행 연결을 확인할 수 없는 행은 원자료로 남기되
 * 화면에서는 뺀다. 과거 v5 미션의 정상 기록은 구버전이어도 포함한다.
 */
function isCountableLog(row: Pick<MissionLogRecord, "mission_id" | "speech_act">) {
  return isSpeechAct(row.speech_act) && typeof row.mission_id === "string" && UUID.test(row.mission_id);
}

const COURSE_LABEL = new Map(COURSE_PRESETS.map((preset) => [preset.outline_id, preset.label]));

function localRecord(session: LearningSession): ReportRecord {
  const key = session.selected_translation as keyof LearningSession["ai_translations"];
  const first = session.ai_translations[key] ?? session.selected_translation ?? "";
  return {
    id: session.session_id,
    speechAct: isSpeechAct(session.speech_act) ? session.speech_act : null,
    taskType: session.mode === "interpretation" ? "interpreting" : "translation",
    courseId: null,
    weekNo: null,
    sourceText: "",
    firstResponse: first,
    revisedResponse: session.final_translation,
    completedAt: session.timestamp,
    feedback: [],
    decision: null,
    dissent: null,
  };
}

function missionLogRecord(row: MissionLogRecord): ReportRecord {
  // 관리자 기록 펼침과 같은 해석기를 쓴다 — 피드백 판정 줄·학습자 결정·이견을 같은 기준으로 읽는다.
  const detail = buildLearningRecordDetail(row, null, "", () => "");
  return {
    id: row.id,
    speechAct: isSpeechAct(row.speech_act) ? row.speech_act : null,
    taskType:
      row.task_type === "interpreting"
        ? "interpreting"
        : row.task_type === "translation"
          ? "translation"
          : "other",
    courseId: row.course_id,
    weekNo: row.week_no,
    sourceText: row.source_text ?? "",
    firstResponse: row.first_response ?? "",
    revisedResponse: row.revised_response ?? row.first_response ?? "",
    completedAt: row.completed_at ?? row.created_at,
    feedback: detail.task.feedback,
    decision: detail.task.decision,
    dissent: detail.dissent,
  };
}

function changed(record: ReportRecord) {
  if (record.decision) return record.decision === "수정";
  return Boolean(
    record.firstResponse.trim() &&
      record.revisedResponse.trim() &&
      record.firstResponse.trim() !== record.revisedResponse.trim(),
  );
}

const TASK_LABEL: Record<ReportRecord["taskType"], string> = { translation: "번역", interpreting: "통역", other: "통번역" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

/** 기록 한 건의 머리 줄 — 수업·주차·화행·과업. */
function recordMeta(record: ReportRecord) {
  return [
    record.courseId ? COURSE_LABEL.get(record.courseId) ?? null : null,
    record.courseId && record.weekNo ? `${record.weekNo}주차` : null,
    record.speechAct ? SPEECH_ACT_UI[record.speechAct] : null,
    TASK_LABEL[record.taskType],
  ].filter(Boolean).join(" · ");
}

// 글자 체계: 한국어 본문 14px · 보조 12~13px · 중국어 표현 16px. 한 화면에서 이 값만 쓴다.
const rowGrid = "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-2";
const rowLabel = "pt-[3px] text-[12.5px] font-semibold text-[#8C8471]";
const zhText = "min-w-0 break-words font-zh text-[16px] leading-[1.7] text-[#15202B] [word-break:keep-all]";
const koText = "min-w-0 break-words text-[14px] leading-6 text-[#26323D]";

/** 원문 — 길면 두 줄까지만 보이고 「펼치기」로 전체를 연다. */
function SourceText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 70;
  return (
    <div className="break-words text-[14px] leading-6 text-[#4F6070]">
      <p className={long && !open ? "line-clamp-2" : ""}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-[#344F63] hover:underline">
          {open ? "접기" : "펼치기"}
        </button>
      )}
    </div>
  );
}

/** 기록 한 건 — 원문과 최초·최종 표현이 본체, AI 피드백·내 결정·내 의견은 「자세히 보기」. */
function RecordCard({ record }: { record: ReportRecord }) {
  const [open, setOpen] = useState(false);
  const task = TASK_LABEL[record.taskType];
  const revised = changed(record);
  const hasDetail = record.feedback.length > 0 || record.decision !== null || record.dissent !== null;
  const detailId = `record-detail-${record.id}`;
  return (
    <article className="rounded-2xl border border-[#E4DFD0] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(21,32,43,0.025)] sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] font-semibold text-[#5C6A7A]">{recordMeta(record)}</p>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-[#8C8471]">{shortDate(record.completedAt)}</span>
          <span
            className={[
              "rounded-md border bg-white px-2 py-0.5 text-[12px] font-bold",
              revised ? "border-[#1F3A5F] text-[#1F3A5F]" : "border-[#C99A2E] text-[#8A5A14]",
            ].join(" ")}
          >
            {revised ? "수정" : "유지"}
          </span>
        </div>
      </div>
      <dl className={`mt-3 ${rowGrid}`}>
        {record.sourceText && <><dt className={rowLabel}>원문</dt><dd className="min-w-0"><SourceText text={record.sourceText} /></dd></>}
        <dt className={rowLabel}>최초 {task}</dt>
        <dd className={zhText}>{record.firstResponse || "기록 없음"}</dd>
        <dt className={rowLabel}>최종 {task}</dt>
        <dd className={zhText}>{record.revisedResponse || "기록 없음"}</dd>
      </dl>
      {hasDetail && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((v) => !v)}
            className="mt-3 text-[13px] font-semibold text-[#344F63] hover:underline"
          >
            {open ? "접기" : "자세히 보기"}
          </button>
          {open && (
            <dl id={detailId} className={`mt-3 border-t border-[#EEE9DC] pt-3 ${rowGrid}`}>
              {record.feedback.length > 0 && (
                <><dt className={rowLabel}>AI 피드백</dt><dd className={koText}>{record.feedback.join(" · ")}</dd></>
              )}
              {record.decision && (
                <>
                  <dt className={rowLabel}>내 결정</dt>
                  <dd className={koText}>
                    {record.decision === "수정" ? `AI 피드백을 본 뒤 ${task}을 수정함` : `AI 피드백을 본 뒤 최초 ${task}을 유지함`}
                  </dd>
                </>
              )}
              {record.dissent && (
                <>
                  <dt className={rowLabel}>내 의견</dt>
                  <dd className={koText}>
                    {record.dissent.conditions.join(" · ")}
                    {record.dissent.reason && (
                      <span className="block text-[#4F6070]">“{record.dissent.reason}”</span>
                    )}
                  </dd>
                </>
              )}
            </dl>
          )}
        </>
      )}
    </article>
  );
}

const selectClass =
  "h-9 rounded-lg border border-[#DDD6C4] bg-white px-3 text-[13.5px] font-medium text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]";

const LearnerRecords = () => {
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const localRecords = useMemo(
    () => (isLocalHost ? getSessions().map(localRecord) : []),
    [isLocalHost],
  );
  const [remoteRecords, setRemoteRecords] = useState<ReportRecord[] | null>(null);
  const [recordsError, setRecordsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [courseFilter, setCourseFilter] = useState("all");
  const [actFilter, setActFilter] = useState("all");

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
            "id,mission_id,speech_act,task_type,course_id,week_no,feature_id,source_lang,target_lang,source_text,first_response,revised_response,target_feature_observed,context_judgment,content_ver,started_at,completed_at,created_at",
          )
          .eq("auth_user_id", userId)
          .eq("mission_completed", true)
          .order("completed_at", { ascending: false, nullsFirst: false });
        if (error) throw error;
        if (!cancelled) {
          const rows = (data ?? []) as MissionLogRecord[];
          setRemoteRecords(rows.filter(isCountableLog).map(missionLogRecord));
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
  const courseIds = [...new Set(records.flatMap((record) => (record.courseId && COURSE_LABEL.has(record.courseId) ? [record.courseId] : [])))];
  const acts = ACTS.filter((act) => records.some((record) => record.speechAct === act));
  const visible = records.filter(
    (record) =>
      (courseFilter === "all" || record.courseId === courseFilter) &&
      (actFilter === "all" || record.speechAct === actFilter),
  );

  if (recordsError || remoteRecords === null) {
    return (
      <LearnerJourneyShell nav>
        <div className="pb-24">
          <h1 className="border-l-4 border-[#FAD338] pl-3 text-[26px] font-bold leading-9 tracking-[-0.04em] text-[#15202B]">내 기록</h1>
          <div className="mt-6 rounded-2xl border border-[#E4DFD0] bg-white p-5" role={recordsError ? "alert" : "status"}>
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
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="border-l-4 border-[#FAD338] pl-3 text-[26px] font-bold leading-9 tracking-[-0.04em] text-[#15202B]">내 기록</h1>
            {records.length > 0 && (
              <p className="mt-2 pl-4 text-[13.5px] text-[#5C6A7A]">
                완료한 미션 {records.length}건{courseIds.length > 0 ? ` · 수업 ${courseIds.length}개` : ""}
              </p>
            )}
          </div>
          {usingLocalPreview && (
            <span className="rounded-full bg-[#EFEBDD] px-3 py-1 text-[11px] font-semibold text-[#756D5E]">
              localhost 시연 데이터
            </span>
          )}
        </header>

        {records.length === 0 ? (
          <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E4DFD0] bg-white p-5">
            <div>
              <h2 className="text-[16px] font-bold">아직 완료한 미션이 없습니다.</h2>
              <p className="mt-1 text-[13.5px] text-[#5C6A7A]">미션을 마치면 내가 쓴 표현과 최종 결정이 여기에 쌓입니다.</p>
            </div>
            <Link to="/learner/course" className="rounded-lg bg-[#15202B] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#22303C]">
              이번 주 미션 하러 가기 →
            </Link>
          </section>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="기록 거르기">
              {courseIds.length > 1 && (
                <select aria-label="수업" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className={selectClass}>
                  <option value="all">전체 수업</option>
                  {courseIds.map((id) => <option key={id} value={id}>{COURSE_LABEL.get(id)}</option>)}
                </select>
              )}
              {acts.length > 1 && (
                <select aria-label="화행" value={actFilter} onChange={(event) => setActFilter(event.target.value)} className={selectClass}>
                  <option value="all">전체 화행</option>
                  {acts.map((act) => <option key={act} value={act}>{SPEECH_ACT_UI[act]}</option>)}
                </select>
              )}
            </div>

            {visible.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-[#E4DFD0] bg-white p-5 text-[14px] text-[#5C6A7A]">조건에 맞는 기록이 없습니다.</p>
            ) : (
              <ol className="mt-4 space-y-3" aria-label="완료 기록">
                {visible.map((record) => (
                  <li key={record.id}><RecordCard record={record} /></li>
                ))}
              </ol>
            )}

            <aside className="mt-6 rounded-r-lg border-l-[3px] border-[#D6A636] bg-[#FFF9EA] px-4 py-3" aria-label="다시 볼 때">
              <p className="text-[12.5px] font-semibold text-[#8A5A14]">다시 볼 때 · 모든 학습자에게 같은 질문입니다</p>
              <ul className="mt-1 space-y-0.5 text-[14px] leading-relaxed text-[#26323D]">
                <li>최종 표현에서도 원문의 의미와 화행의 목적이 유지되었나요?</li>
                <li>표현을 유지하거나 바꾼 이유는 무엇인가요?</li>
              </ul>
            </aside>
          </>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

export default LearnerRecords;
