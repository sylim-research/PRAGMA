import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  FilePenLine,
  Fingerprint,
  Languages,
  MessageCircleMore,
  RefreshCw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getPublishedCourse, type LearnerCourse } from "@/lib/curriculum/learnerCourse";
import { getSessions, type LearningSession } from "@/lib/learningSessions";
import { COURSE_WEEKS } from "@/lib/mission/mockLearnerCourse";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { supabase } from "@/integrations/supabase/client";

type ReportRecord = {
  id: string;
  speechAct: SpeechActUI | null;
  taskType: "translation" | "interpreting" | "other";
  firstResponse: string;
  revisedResponse: string;
  revisionFocus: string | null;
  completedAt: string;
};

type MissionLogRecord = {
  id: string;
  speech_act: string | null;
  task_type: string | null;
  first_response: string | null;
  revised_response: string | null;
  revision_target_selected: string | null;
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

const SIGNATURE: Record<SpeechActUI, { name: string; qualifier: string; next: string }> = {
  request: { name: "배려 우선형", qualifier: "신중한 조정", next: "같은 요청을 다른 완곡 표현으로 구성" },
  apology: { name: "수리 중심형", qualifier: "책임과 해결 조정", next: "책임 인정과 수리 제안의 비중 비교" },
  thanks: { name: "관계 구체화형", qualifier: "이유를 남기는 감사", next: "관계에 따른 감사 이유의 구체성 비교" },
  compliment: { name: "초점 포착형", qualifier: "대상과 이유 구체화", next: "칭찬 초점과 대응 방식 비교" },
  agreement: { name: "선택권 보존형", qualifier: "참여 부담 조정", next: "상대와 일정에 따른 초대 강도 비교" },
  refusal: { name: "관계 유지형", qualifier: "명확성과 완화 조정", next: "거절 이유와 대안의 비중 비교" },
  complaint: { name: "해결 지향형", qualifier: "문제와 요구 분리", next: "문제 제기와 해결 요청의 강도 비교" },
  proposal: { name: "협의 지향형", qualifier: "제안과 선택 여지 조정", next: "관계에 따른 제안 강도 비교" },
  opposition: { name: "근거 제시형", qualifier: "이견과 관계 조정", next: "동의 표지와 반대 근거의 순서 비교" },
};

const REPEATED_MARKERS = ["酌情", "如果方便", "是否", "能否", "烦请", "恳请", "还请", "理解"];

const isSpeechAct = (value: string | null): value is SpeechActUI =>
  value !== null && ACTS.includes(value as SpeechActUI);

function localRecord(session: LearningSession): ReportRecord {
  const key = session.selected_translation as keyof LearningSession["ai_translations"];
  const first = session.ai_translations[key] ?? session.selected_translation ?? "";
  return {
    id: session.session_id,
    speechAct: isSpeechAct(session.speech_act) ? session.speech_act : null,
    taskType: session.mode === "interpretation" ? "interpreting" : "translation",
    firstResponse: first,
    revisedResponse: session.final_translation,
    revisionFocus: session.speech_act === "refusal" ? "거절 명확성·관계 유지" : "직접성·완화·선택 여지",
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
    firstResponse: row.first_response ?? "",
    revisedResponse: row.revised_response ?? row.first_response ?? "",
    revisionFocus: row.revision_target_selected,
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

function findRepeatedMarker(records: ReportRecord[]) {
  return REPEATED_MARKERS.map((marker) => ({
    marker,
    count: records.filter((record) => record.revisedResponse.includes(marker)).length,
  })).sort((a, b) => b.count - a.count)[0];
}

function actWeek(act: SpeechActUI, course: LearnerCourse | null) {
  const liveWeek = course?.weeks.find((week) => week.speech_act === act)?.week_no;
  if (liveWeek) return liveWeek;
  const label = SPEECH_ACT_UI[act];
  return COURSE_WEEKS.find((week) => week.title.startsWith(label))?.weekNo ?? null;
}

function focusLabel(record: ReportRecord) {
  const focus = record.revisionFocus?.trim();
  // 저장값이 내부 코드(예: "feature")면 학습자에게 보이지 않게 기본 문구로 대신한다.
  if (focus && !/^[a-z0-9_-]+$/i.test(focus)) return focus;
  return record.speechAct ? ACT_FOCUS[record.speechAct] : "표현 선택과 맥락 적합성";
}

const panel = "rounded-2xl border border-[#E4DFD0] bg-white shadow-[0_8px_24px_rgba(21,32,43,0.04)]";

const LearnerRecords = () => {
  const navigate = useNavigate();
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const localRecords = useMemo(
    () => (isLocalHost ? getSessions().map(localRecord) : []),
    [isLocalHost],
  );
  const [remoteRecords, setRemoteRecords] = useState<ReportRecord[] | null>(null);
  const [recordsError, setRecordsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [selectedAct, setSelectedAct] = useState<SpeechActUI>("request");
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRemoteRecords(null);
    setRecordsError(false);
    void (async () => {
      try {
        const [{ data: auth, error: authError }, courseResult] = await Promise.all([
          supabase.auth.getSession(),
          getPublishedCourse().catch(() => null),
        ]);
        if (authError) throw authError;
        if (!cancelled) setCourse(courseResult);
        const userId = auth.session?.user?.id;
        if (!userId) {
          if (!cancelled) setRemoteRecords([]);
          return;
        }
        const { data, error } = await supabase
          .from("learner_mission_logs")
          .select(
            "id,speech_act,task_type,first_response,revised_response,revision_target_selected,completed_at,created_at",
          )
          .eq("auth_user_id", userId)
          .eq("mission_completed", true)
          .order("completed_at", { ascending: false, nullsFirst: false });
        if (error) throw error;
        if (!cancelled) {
          setRemoteRecords(((data ?? []) as MissionLogRecord[]).map(missionLogRecord));
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
  const marker = findRepeatedMarker(selectedRecords);
  const signature = SIGNATURE[selectedAct];
  const selectedWeek = actWeek(selectedAct, course);
  const latestRevision = revisions[0] ?? records[0] ?? null;

  const insight = useMemo(() => {
    const actLabel = SPEECH_ACT_UI[selectedAct];
    if (selectedRecords.length === 0) {
      return {
        title: `${actLabel} 수행 기록은 아직 없습니다.`,
        body: `${selectedWeek ? `${selectedWeek}주차` : "해당"} 수업을 마치면 최초 표현과 최종 선택을 바탕으로 패턴을 보여드립니다.`,
        evidence: "관찰 전",
      };
    }
    if (marker && marker.count >= 2) {
      return {
        title: `${actLabel}에서 “${marker.marker}” 표현을 반복해 활용했습니다.`,
        body: `${selectedRecords.length}건 중 ${marker.count}건의 최종 표현에서 확인되었습니다. 같은 기능을 다른 표현으로 구성해 선택 폭을 비교해 보세요.`,
        evidence: `비교 가능한 기록 ${selectedRecords.length}건`,
      };
    }
    if (selectedRevisions > 0) {
      return {
        title: `${actLabel}에서 최초 표현을 다시 검토하는 경향이 확인됩니다.`,
        body: `${selectedRecords.length}건 중 ${selectedRevisions}건에서 표현을 조정했습니다. 다음 비교 초점은 ${signature.next}입니다.`,
        evidence: `수정 기록 ${selectedRevisions}건`,
      };
    }
    return {
      title: `${actLabel} 기록이 ${selectedRecords.length}건 쌓였습니다.`,
      body: `현재 기록에서는 반복된 수정 패턴이 확인되지 않았습니다. 다음 비교 초점은 ${signature.next}입니다.`,
      evidence: `비교 가능한 기록 ${selectedRecords.length}건`,
    };
  }, [marker, selectedAct, selectedRecords.length, selectedRevisions, selectedWeek, signature.next]);

  if (recordsError || remoteRecords === null) {
    return (
      <LearnerJourneyShell nav>
        <div className="pb-24">
          <h1 className="text-[27px] font-bold tracking-[-0.025em] sm:text-[30px]">나의 통번역 학습 프로필</h1>
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
            <p className="text-[12px] font-semibold text-[#857653]">
              {course?.outline.title ?? "한·중 통번역 화용 학습"} · {course?.outline.week_count ?? 15}주 과정
            </p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.025em] sm:text-[30px]">
              나의 통번역 학습 프로필
            </h1>
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
            [String(revisions.length), "표현 수정 기록"],
            [`${actsCovered.size}/9`, "수행 화행"],
            [`${translationCount} · ${interpretingCount}`, "번역 · 통역"],
          ].map(([value, label]) => (
            <div key={label} className="px-5 py-4">
              <div className="text-[23px] font-bold leading-none text-[#15202B]">{value}</div>
              <div className="mt-2 text-[12.5px] font-medium text-muted-foreground">{label}</div>
            </div>
          ))}
        </section>

        <section className={`${panel} mt-5 p-5 sm:p-6`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold text-[#857653]">1–15주 수업 이력</p>
              <h2 className="mt-1 text-[19px] font-bold">9개 화행 학습 지도</h2>
            </div>
            <span className="text-[12.5px] font-medium text-muted-foreground">{actsCovered.size}/9 화행 수행</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="화행별 학습 이력">
            {ACTS.map((act) => {
              const count = records.filter((record) => record.speechAct === act).length;
              const week = actWeek(act, course);
              const active = selectedAct === act;
              return (
                <button
                  key={act}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedAct(act);
                    setShowEvidence(false);
                  }}
                  className={[
                    "relative min-h-[84px] min-w-0 rounded-xl border px-4 py-3 text-left transition-all",
                    active
                      ? "border-[#15202B] bg-[#F6F8FC] ring-2 ring-[#15202B] ring-offset-1"
                      : count >= 2
                        ? "border-[#CFE1D4] bg-[#EEF6F0] hover:-translate-y-0.5 hover:border-[#78A485]"
                        : count === 1
                          ? "border-[#D8E0F0] bg-[#F1F4FA] hover:-translate-y-0.5 hover:border-[#7A91B9]"
                          : "border-[#E6E2D8] bg-[#F4F2EC] text-[#777368] hover:border-[#BDB6A5]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute right-3 top-3 h-2.5 w-2.5 rounded-full",
                      count >= 2 ? "bg-[#5D9270]" : count === 1 ? "bg-[#6580AF]" : "bg-[#D9D4C7]",
                    ].join(" ")}
                    aria-hidden
                  />
                  <span className="block pr-5 text-[16px] font-bold">{SPEECH_ACT_UI[act]}</span>
                  <span className="mt-2 block text-[12px] text-muted-foreground">
                    {week ? `${week}주차` : "주차 미정"} · {count ? `${count}건 수행` : "수행 전"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground">
            <span>초록 · 반복 관찰</span><span>파랑 · 첫 수행</span><span>회색 · 수행 전</span>
          </div>
        </section>

        <section className={`${panel} mt-5 border-l-4 border-l-[#70A17E] p-5 sm:p-6`} aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF6F0] px-3 py-1.5 text-[12px] font-semibold text-[#426C50]">
                <Sparkles className="h-3.5 w-3.5" /> 최근 수행의 선택 패턴
              </span>
              <span className="text-[12px] text-muted-foreground">{insight.evidence}</span>
            </div>
            <h2 className="mt-4 text-[22px] font-bold leading-snug sm:text-[24px]">{insight.title}</h2>
            <p className="mt-2 text-[14px] leading-7 text-muted-foreground">{insight.body}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-[#5C6A7A]">
              <span className="inline-flex items-center gap-1.5"><MessageCircleMore className="h-4 w-4" />{SPEECH_ACT_UI[selectedAct]}</span>
              <span className="inline-flex items-center gap-1.5"><Languages className="h-4 w-4" />한↔중</span>
              <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{selectedWeek ? `${selectedWeek}주차` : "수업 기록"}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowEvidence((value) => !value)}
              className="mt-4 rounded-lg border border-[#D8D2C2] px-3.5 py-2 text-[12px] font-semibold hover:bg-[#FAF8F2]"
            >
              {showEvidence ? "근거 접기" : "근거 기록"}
            </button>
            {showEvidence && (
              <p className="mt-3 rounded-lg bg-[#F7F5EE] px-4 py-3 text-[12.5px] leading-relaxed text-[#5C665F]">
                {selectedRecords.length
                  ? `${SPEECH_ACT_UI[selectedAct]} 수행 ${selectedRecords.length}건 · 실제 수정 ${selectedRevisions}건${marker?.count ? ` · “${marker.marker}” 포함 ${marker.count}건` : ""}`
                  : "해당 화행의 완료 기록이 없어 패턴을 산출하지 않았습니다."}
              </p>
            )}
        </section>

        <aside className={`${panel} mt-4 bg-gradient-to-br from-white to-[#F1F4FA] p-5 sm:p-6`}>
          <div className="grid gap-5 sm:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)] sm:items-center">
            <div>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6C7480]">
              <Fingerprint className="h-4 w-4" /> 화용 시그니처 · 현재 기록
              </p>
              <h2 className="mt-3 text-[22px] font-bold leading-tight">
                {selectedRecords.length >= 2 ? signature.name : "패턴 형성 중"}
                <span className="mt-1 block text-[16px] font-semibold text-[#405164]">
                  {selectedRecords.length >= 2 ? signature.qualifier : `${SPEECH_ACT_UI[selectedAct]} 근거 ${selectedRecords.length}건`}
                </span>
              </h2>
            </div>
            <div className="space-y-3 text-[13px] text-[#485663]">
              <p className="flex gap-3 rounded-xl bg-white/70 px-4 py-3"><Check className="mt-0.5 h-4 w-4 shrink-0" />관찰 범위 · {SPEECH_ACT_UI[selectedAct]} {selectedRecords.length}건</p>
              <p className="flex gap-3 rounded-xl bg-white/70 px-4 py-3"><RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />재검토 경로 · 수정 {selectedRevisions}건</p>
              <p className="flex gap-3 rounded-xl bg-white/70 px-4 py-3"><Target className="mt-0.5 h-4 w-4 shrink-0" />다음 초점 · {ACT_FOCUS[selectedAct]}</p>
            </div>
          </div>
        </aside>

        <section className={`${panel} mt-4 p-5 sm:p-6`}>
            <p className="text-[12px] font-semibold text-[#857653]">수업 확장 연습 · 선택 사항</p>
            <h2 className="mt-1.5 text-[18px] font-bold">{SPEECH_ACT_UI[selectedAct]} 표현을 한 번 더 비교해 보세요.</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate("/scenario")}
                className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl bg-[#15202B] px-5 py-3.5 text-left text-white hover:bg-[#22303C]"
              >
                <span><strong className="block text-[14px]">동일 조건 재확인</strong><span className="mt-1 block text-[12px] text-[#B9C4CE]">다른 표현으로 다시 구성</span></span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/scenario?mode=transfer")}
                className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl border border-[#D8D2C2] px-5 py-3.5 text-left hover:bg-[#FAF8F2]"
              >
                <span><strong className="block text-[14px]">조건 간 비교</strong><span className="mt-1 block text-[12px] text-muted-foreground">상대·매체를 바꾸어 확인</span></span>
                <Search className="h-4 w-4 shrink-0" />
              </button>
            </div>
            <p className="mt-3 text-[11.5px] text-muted-foreground">정규 수업 미션과 별개이며, 학습 기록을 더 비교하고 싶을 때 선택합니다.</p>
        </section>

        <section className={`${panel} mt-4 p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[18px] font-bold"><FilePenLine className="h-5 w-5" />최근 수정 노트</h2>
            {revisions.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="text-[12px] font-semibold text-[#4F6070] hover:underline">전체 수정 노트 →</button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto bg-[#FAF8F2]">
                  <DialogHeader>
                    <DialogTitle>전체 수정 노트</DialogTitle>
                    <DialogDescription>완료한 미션에서 최초 표현과 최종 선택이 달라진 기록입니다.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {revisions.map((record) => (
                      <article key={record.id} className="rounded-xl border border-[#E4DFD0] bg-white p-4">
                        <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{record.speechAct ? SPEECH_ACT_UI[record.speechAct] : "통번역"} · {record.taskType === "interpreting" ? "통역" : "번역"}</span>
                          <span>{new Date(record.completedAt).toLocaleDateString("ko-KR")}</span>
                        </div>
                        <div className="grid gap-3 text-[12px] md:grid-cols-3">
                          <div><strong className="text-[11px] text-muted-foreground">최초 표현</strong><p className="mt-1 font-zh leading-relaxed">{record.firstResponse || "기록 없음"}</p></div>
                          <div><strong className="text-[11px] text-muted-foreground">재검토 지점</strong><p className="mt-1 leading-relaxed">{focusLabel(record)}</p></div>
                          <div><strong className="text-[11px] text-muted-foreground">최종 선택</strong><p className="mt-1 font-zh leading-relaxed">{record.revisedResponse || "기록 없음"}</p></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {latestRevision ? (
            <div className="mt-4 grid gap-4 text-[13px] sm:grid-cols-[minmax(0,1.15fr)_minmax(170px,.8fr)_minmax(0,1.15fr)] sm:divide-x sm:divide-[#EEE9DC]">
              <div className="min-w-0 sm:pr-4"><strong className="text-[11.5px] text-muted-foreground">최초 표현</strong><p className="mt-2 truncate font-zh" title={latestRevision.firstResponse}>{latestRevision.firstResponse || "기록 없음"}</p></div>
              <div className="min-w-0 sm:px-4"><strong className="text-[11.5px] text-muted-foreground">재검토 지점</strong><p className="mt-2 truncate" title={focusLabel(latestRevision)}>{focusLabel(latestRevision)}</p></div>
              <div className="min-w-0 sm:pl-4"><strong className="text-[11.5px] text-muted-foreground">최종 선택</strong><p className="mt-2 truncate font-zh" title={latestRevision.revisedResponse}>{latestRevision.revisedResponse || "기록 없음"}</p></div>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">최초 표현과 최종 선택이 달라진 기록이 아직 없습니다.</p>
          )}
        </section>
      </div>
    </LearnerJourneyShell>
  );
};

export default LearnerRecords;
