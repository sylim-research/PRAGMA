import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, RefreshCw, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { ClassDiscussionBoard, INITIAL_BOARD_STATE, type ClassDiscussionBoardState } from "@/components/admin/ClassDiscussionBoard";
import { Button } from "@/components/ui/button";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { fetchCourseOperationLogs, summarizeCourseOperations } from "@/lib/curriculum/courseOperations";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import { missionMenuTitle } from "@/lib/curriculum/missionMenuTitle";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import { weekDisplayTitle } from "@/lib/curriculum/weekGuidance";
import { buildVirtualClassRows, VIRTUAL_CLASS_NOTICE } from "@/lib/demo/virtualClassRows";
import { buildClassDiscussion } from "@/lib/mission/classDiscussion";
import {
  closeClassResponses,
  getAdminClassResponseRelease,
  releaseClassResponses,
  reopenClassResponses,
} from "@/lib/mission/classResponseRelease";
import { classResponsePatternKey, fetchCountedResponsesByCourse, fetchMissionClassRows } from "@/lib/mission/classResponseFetch";

const MODE_LABEL: Record<string, string> = { translation: "번역", stt_interpreting: "통역" };

function learnerMissionPath(courseId: string, weekNo: number, scenarioId: string, assignmentId?: string) {
  if (!assignmentId) return `/learner/course/${encodeURIComponent(courseId)}/week/${weekNo}`;
  const query = new URLSearchParams({ courseId, weekNo: String(weekNo), assignmentId });
  return `/learner/practice/${scenarioId}?${query}`;
}

/**
 * 「학습 수행 기록」의 학습자 응답 분포 탭 — 학급 응답을 보고 토론할 지점을 고르는 화면.
 * 개별 수행 기록과 같은 학습 기록에서 익명 집계와 익명 사례만 보여 준다.
 * 들어오자마자 공개 교과목의 첫 미션 주차를 열고, 미션이 있는 주차를 칩으로 늘어놓는다.
 * 실제 응답과 데모 응답(가상 학습자 20명)은 명시적으로 전환하며, 데모는 운영 DB에 저장하지 않는다.
 */
export function ClassResponsePanel() {
  const queryClient = useQueryClient();
  const [params, setSearchParams] = useSearchParams();
  // 기본은 데모 응답(가상 학습자 20명). 실제 응답으로 바꾸면 ?demo=0을 남긴다.
  const demo = params.get("demo") !== "0";
  // 교과목·주차·미션·데모만 주소에 남긴다.
  const setParams = (next: Record<string, string>, options?: { replace?: boolean }) =>
    setSearchParams({ ...(demo ? {} : { demo: "0" }), ...next }, options);
  const setDemo = (on: boolean) => {
    const next: Record<string, string> = {};
    for (const key of ["courseId", "weekNo", "missionId"]) {
      const value = params.get(key);
      if (value) next[key] = value;
    }
    if (!on) next.demo = "0";
    setSearchParams(next);
  };
  const [projector, setProjector] = useState(false);
  const [board, setBoard] = useState<ClassDiscussionBoardState>(INITIAL_BOARD_STATE);
  const projectorRef = useRef<HTMLDivElement>(null);
  const courseId = params.get("courseId") ?? "";

  const outlines = useQuery({
    queryKey: ["class-response-outlines"],
    queryFn: listCurriculumOutlines,
  });
  const courseQuery = useQuery({
    queryKey: ["class-response-course", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const [curriculum, assignments, cores] = await Promise.all([
        getCurriculumOutline(courseId),
        listWeekAssignments(courseId),
        listCoreScenarios(),
      ]);
      return assembleLearnerCourse({ ...curriculum, assignments, cores });
    },
  });
  const course = courseQuery.data;
  const missionWeeks = course?.weeks.filter((item) => item.scenarios.length > 0) ?? [];
  const allMissionIds = missionWeeks.flatMap((item) => item.scenarios.map((scenario) => scenario.scenario_id));
  const operationLogs = useQuery({
    queryKey: ["class-response-operation-logs", courseId, allMissionIds.join("|")],
    enabled: Boolean(courseId) && allMissionIds.length > 0,
    queryFn: () => fetchCourseOperationLogs(courseId, allMissionIds),
  });
  const operations = course ? summarizeCourseOperations(course.weeks, operationLogs.data ?? []) : new Map();

  // 주차를 지정하지 않았으면 응답이 있는 첫 주차를, 없으면 첫 미션 주차를 연다.
  const requestedWeek = Number(params.get("weekNo"));
  const week = missionWeeks.find((item) => item.week_no === requestedWeek)
    ?? missionWeeks.find((item) => (operations.get(item.week_no)?.participants ?? 0) > 0)
    ?? missionWeeks[0];
  const requestedMission = params.get("missionId");
  const missionIndex = Math.max(0, week?.scenarios.findIndex((item) => item.scenario_id === requestedMission) ?? 0);
  const selectedMission = week?.scenarios[missionIndex] ?? null;
  const missionId = selectedMission?.scenario_id ?? "";

  const releaseQuery = useQuery({
    queryKey: ["class-response-release", courseId, missionId],
    enabled: Boolean(courseId) && Boolean(missionId),
    queryFn: () => getAdminClassResponseRelease(courseId, missionId),
  });
  const releaseState = releaseQuery.data;
  const releaseStatus = releaseState?.status ?? "collecting";

  const responseCounts = useQuery({
    queryKey: ["class-response-course-counts"],
    queryFn: fetchCountedResponsesByCourse,
  });

  // 집계 대상 응답이 가장 많은 교과목을 먼저 연다. 응답이 없으면 공개 중인 교과목, 그다음 첫 교과목.
  useEffect(() => {
    if (courseId || !outlines.data?.length || responseCounts.isPending) return;
    const counts = responseCounts.data ?? new Map<string, number>();
    const withResponses = [...outlines.data]
      .filter((outline) => (counts.get(outline.id) ?? 0) > 0)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
    const next = withResponses
      ?? outlines.data.find((outline) => outline.status === "published")
      ?? outlines.data[0];
    setParams({ courseId: next.id }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams는 매 렌더 새로 만들지만 setSearchParams만 감싼다.
  }, [courseId, outlines.data, responseCounts.isPending, responseCounts.data]);

  const rowsQuery = useQuery({
    queryKey: classResponsePatternKey(courseId, week?.week_no, missionId),
    enabled: Boolean(missionId),
    refetchInterval: demo || (releaseState && releaseState.status !== "collecting") ? false : 5000,
    queryFn: () => fetchMissionClassRows(missionId),
  });

  const transition = useMutation({
    mutationFn: async (action: "close" | "reopen" | "release") => {
      if (!courseId || !missionId) return;
      if (action === "close") {
        if (!rowsQuery.data) throw new Error("마감할 응답이 없습니다.");
        await closeClassResponses(courseId, missionId, rowsQuery.data.pattern);
      } else if (action === "reopen") {
        await reopenClassResponses(courseId, missionId);
      } else {
        await releaseClassResponses(courseId, missionId);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["class-response-release", courseId, missionId] });
      await queryClient.invalidateQueries({ queryKey: classResponsePatternKey(courseId, week?.week_no, missionId) });
    },
  });

  const missionContent = rowsQuery.data?.missionContent ?? null;
  const realRows = useMemo(() => rowsQuery.data?.rows ?? [], [rowsQuery.data]);
  const virtualRows = useMemo(
    () => (missionId && missionContent ? buildVirtualClassRows(missionId, missionContent) : null),
    [missionId, missionContent],
  );
  const demoAvailable = virtualRows !== null;
  const showingDemo = demo && demoAvailable;
  const discussion = useMemo(() => {
    if (!missionId || !rowsQuery.data) return null;
    return buildClassDiscussion(missionId, showingDemo ? virtualRows ?? [] : realRows, missionContent);
  }, [missionId, rowsQuery.data, showingDemo, virtualRows, realRows, missionContent]);
  const realLearners = rowsQuery.data?.pattern.learners ?? 0;
  const realEmpty = rowsQuery.isSuccess && realLearners === 0;
  const hasRealResponses = rowsQuery.isSuccess && realLearners > 0;
  const boardVisible = Boolean(discussion) && (showingDemo || hasRealResponses);

  useEffect(() => {
    if (!projector) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    projectorRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjector(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [projector]);

  const selectWeek = (weekNo: number) => {
    setBoard(INITIAL_BOARD_STATE);
    setParams({ courseId, weekNo: String(weekNo) });
  };
  const selectMission = (nextMissionId: string) => {
    setBoard(INITIAL_BOARD_STATE);
    setParams({ courseId, weekNo: String(week?.week_no ?? ""), missionId: nextMissionId });
  };

  const statusPill = hasRealResponses && !showingDemo
    ? <span className="rounded-full border border-[#15202B] px-2 py-0.5 text-[13px] font-bold text-[#15202B]">
      {releaseStatus === "collecting" ? "응답 수집 중" : releaseStatus === "closed" ? "분포 고정" : "학습자 공개"}
    </span>
    : null;

  const ghost = "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[14.5px] font-medium text-[#44525C] hover:bg-[#F1EFE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] disabled:opacity-50";
  const plainSelect = "h-9 rounded-md border border-[#D9DED9] bg-white px-2.5 text-[14.5px] text-[#15202B]";
  const segment = (selected: boolean) => selected
    ? "bg-[#EEF0F3] font-semibold text-[#15202B]"
    : "bg-white text-[#5D6970] hover:bg-[#F6F5F0]";

  return <>
    <div className="max-w-[1120px] space-y-4">
      {/* 고르는 것은 한 줄(교과목 · 주차 · 미션), 보조 동작은 오른쪽의 작은 글자 버튼. 검은 강조는 아래 MJT 탭 하나만 쓴다. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2DED2] pb-3">
        <select
          aria-label="응답 교과목"
          value={courseId}
          onChange={(event) => setParams(event.target.value ? { courseId: event.target.value } : {})}
          className={`${plainSelect} min-w-[200px]`}
        >
          {!courseId && <option value="">교과목 선택</option>}
          {outlines.data?.map((outline) => <option key={outline.id} value={outline.id}>{outline.title}</option>)}
        </select>
        {missionWeeks.length > 0 && <select
          aria-label="주차 선택"
          value={week?.week_no ?? ""}
          onChange={(event) => selectWeek(Number(event.target.value))}
          className={plainSelect}
        >
          {missionWeeks.map((item) => {
            const summary = operations.get(item.week_no);
            const joined = summary && summary.participants > 0 ? ` (참여 ${summary.participants}명)` : "";
            // 선택 상자를 짧게 — 집중 보완 주차의 「· 새 상황에 적용하기」는 이 목록에서만 뺀다(2026-10-09).
            return <option key={item.week_no} value={item.week_no}>{`${item.week_no}주차 · ${weekDisplayTitle(item).replace(" · 새 상황에 적용하기", "")}${joined}`}</option>;
          })}
        </select>}
        {week && week.scenarios.length > 1 && <div role="tablist" aria-label="응답을 볼 미션" className="flex overflow-hidden rounded-md border border-[#D9DED9]">
          {week.scenarios.map((scenario, index) => <button
            key={scenario.scenario_id}
            type="button"
            role="tab"
            aria-selected={scenario.scenario_id === missionId}
            onClick={() => selectMission(scenario.scenario_id)}
            className={`px-3 py-1.5 text-[14.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] ${segment(scenario.scenario_id === missionId)}`}
          >미션 {index + 1}{scenario.mode ? ` · ${MODE_LABEL[scenario.mode] ?? ""}` : ""}</button>)}
        </div>}
        <div className="ml-auto flex flex-wrap items-center gap-0.5">
          {demoAvailable && <div role="radiogroup" aria-label="응답 자료" className="mr-1 flex overflow-hidden rounded-md border border-[#D9DED9]">
            {([[false, "실제 응답"], [true, "데모 응답"]] as const).map(([on, label]) => <button
              key={label}
              type="button"
              role="radio"
              aria-checked={showingDemo === on}
              onClick={() => { setBoard(INITIAL_BOARD_STATE); setDemo(on); }}
              className={`px-3 py-1.5 text-[14.5px] ${segment(showingDemo === on)}`}
            >{label}</button>)}
          </div>}
          <button type="button" aria-label="응답 새로고침" title="응답 새로고침" disabled={rowsQuery.isFetching} onClick={() => void rowsQuery.refetch()} className={ghost}><RefreshCw className="h-3.5 w-3.5" /></button>
          {boardVisible && <button type="button" onClick={() => setProjector(true)} className={ghost}><Maximize2 className="h-3.5 w-3.5" />크게 보기</button>}
          {week && selectedMission && <Link
            target="_blank"
            rel="noreferrer"
            to={learnerMissionPath(courseId, week.week_no, missionId, selectedMission.assignment_id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#15202B] bg-white px-3 text-[14.5px] font-semibold text-[#15202B] hover:bg-[#F3F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
            title="이 응답이 나온 학습 미션을 새 창에서 학습자 화면으로 엽니다."
          >해당 학습 미션 열기 ↗</Link>}
        </div>
        {courseQuery.isPending && courseId && <p role="status" className="basis-full text-sm">주차를 불러오는 중…</p>}
        {courseQuery.isError && <p role="alert" className="basis-full text-sm text-destructive">주차를 불러오지 못했습니다.</p>}
        {outlines.isError && <p role="alert" className="basis-full text-sm text-destructive">교과목 목록을 불러오지 못했습니다.</p>}
        {course && missionWeeks.length === 0 && <p className="basis-full text-sm text-muted-foreground">이 교과목에는 아직 편성된 미션이 없습니다. 수업 편성에서 먼저 미션을 배정해 주세요.</p>}
      </div>

      {week && selectedMission && <section>
        {/* 미션 제목 줄은 두지 않는다 — 위 선택 줄이 이미 주차·미션을 보인다(2026-10-09). 실제 응답일 때만 공개 단계 꼬리표를 둔다. */}
        {statusPill && <div className="flex flex-wrap items-center gap-2">{statusPill}</div>}
        {/* 데모 표시는 그것이 가리키는 응답 분포 바로 위, 보드 폭 전체의 띠로 둔다 — 아래 모든 수치가 가상 응답임이 먼저 읽힌다. */}
        {showingDemo && <div role="note" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-[#EAD58A] bg-[#FFF8DC] px-4 py-2.5">
          <span className="text-[14px] font-bold text-[#15202B]">{VIRTUAL_CLASS_NOTICE}</span>
          <span className="text-[14px] text-[#5F573D]">운영 기록에 저장되지 않으며, 실제 응답과 같은 집계·표시 코드로 그립니다.</span>
        </div>}
        {!showingDemo && <p className="mt-1 text-[13px] text-[#7A858C]">집계에는 수업 기록 공유에 동의한 학습자만 포함됩니다.</p>}

        {hasRealResponses && !showingDemo && <div aria-label="응답 공개 단계" className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { key: "collecting", label: "1 · 응답 수집", reached: true },
            { key: "closed", label: "2 · 분포 고정", reached: releaseStatus === "closed" || releaseStatus === "released" },
            { key: "released", label: "3 · 학습자 공개", reached: releaseStatus === "released" },
          ].map((step) => <div key={step.key} className={[
            "rounded-md border px-3 py-1.5 text-center text-[13px] font-bold",
            step.reached ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#D9D5C8] bg-white text-[#15202B]",
          ].join(" ")}>{step.label}</div>)}
        </div>}

        {rowsQuery.isPending && <p role="status" className="mt-4 text-sm">응답 분포를 불러오는 중…</p>}
        {rowsQuery.isError && <p role="alert" className="mt-4 text-sm text-destructive">응답 분포를 불러오지 못했습니다.</p>}
        {boardVisible && discussion && <div className="mt-4"><ClassDiscussionBoard
          data={discussion}
          demo={showingDemo}
          state={board}
          onChange={setBoard}
        /></div>}
        {realEmpty && !showingDemo && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#DAD6CA] bg-white px-5 py-4">
          <p className="text-sm text-[#5D6970]">아직 집계된 응답이 없습니다. 응답이 쌓이면 문항별 판단 분포를 확인할 수 있습니다.</p>
          {demoAvailable && <Button variant="outline" size="sm" onClick={() => setDemo(true)}>데모로 살펴보기</Button>}
        </div>}

        {hasRealResponses && !showingDemo && realLearners < 5 && <p className="mt-3 rounded-xl border border-[#E5DFC9] bg-[#FFFDF4] px-4 py-3 text-sm text-[#5F573D]">
          학습자에게 분포를 공개하려면 5명 이상의 응답이 필요합니다.
        </p>}

        {hasRealResponses && !showingDemo && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-sm font-black">
              {!releaseState || releaseState.status === "collecting"
                ? "응답 수집 중"
                : releaseState.status === "closed"
                  ? `응답 마감 · ${releaseState.learnerCount}명`
                  : `학습자 공개 완료 · ${releaseState.learnerCount}명`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {!releaseState || releaseState.status === "collecting"
                ? "마감하면 현재 익명 분포가 고정됩니다."
                : releaseState.status === "closed" && releaseState.learnerCount < 5
                  ? "5명 이상 모여야 학습자에게 공개할 수 있습니다."
                  : releaseState.status === "closed"
                    ? "고정된 분포를 확인한 뒤 학습자에게 공개하세요."
                    : "마감 이후 재시도는 공개된 분포를 변경하지 않습니다."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(!releaseState || releaseState.status === "collecting") && (
              <Button
                size="sm"
                disabled={transition.isPending || !realLearners}
                onClick={() => transition.mutate("close")}
              >응답 마감</Button>
            )}
            {releaseState?.status === "closed" && (
              <>
                <Button size="sm" variant="outline" disabled={transition.isPending} onClick={() => transition.mutate("reopen")}>응답 다시 수집</Button>
                <Button size="sm" disabled={transition.isPending || releaseState.learnerCount < 5} onClick={() => transition.mutate("release")}>학습자에게 공개</Button>
              </>
            )}
          </div>
          {transition.isError && <p role="alert" className="w-full text-xs text-destructive">{transition.error.message}</p>}
        </div>}
      </section>}
    </div>

    {projector && discussion && boardVisible && <div
      ref={projectorRef}
      role="dialog"
      aria-modal="true"
      aria-label="학습자 응답 크게 보기"
      tabIndex={-1}
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#F8F6EE] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#B8860B]">{showingDemo ? VIRTUAL_CLASS_NOTICE : "익명 응답 집계"}</p>
            <h1 className="mt-1 break-keep text-3xl font-black text-[#15202B]">이 수업은 어떻게 판단했을까?</h1>
          </div>
          <Button variant="outline" onClick={() => setProjector(false)}>
            <X className="mr-2 h-4 w-4" />닫기
          </Button>
        </div>
        <ClassDiscussionBoard data={discussion} demo={showingDemo} state={board} onChange={setBoard} projector />
      </div>
    </div>}
  </>;
}
