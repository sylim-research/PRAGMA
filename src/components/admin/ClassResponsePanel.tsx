import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, RefreshCw, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { ClassResponseDashboard } from "@/components/admin/ClassResponseDashboard";
import { Button } from "@/components/ui/button";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { fetchCourseOperationLogs, summarizeCourseOperations } from "@/lib/curriculum/courseOperations";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import { missionMenuTitle } from "@/lib/curriculum/missionMenuTitle";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import {
  closeClassResponses,
  getAdminClassResponseRelease,
  releaseClassResponses,
  reopenClassResponses,
} from "@/lib/mission/classResponseRelease";
import { classResponsePatternKey, fetchCountedResponsesByCourse, fetchMissionPattern } from "@/lib/mission/classResponseFetch";

const MODE_LABEL: Record<string, string> = { translation: "번역", stt_interpreting: "통역" };

function learnerMissionPath(courseId: string, weekNo: number, scenarioId: string, assignmentId?: string) {
  if (!assignmentId) return `/learner/course/${encodeURIComponent(courseId)}/week/${weekNo}`;
  const query = new URLSearchParams({ courseId, weekNo: String(weekNo), assignmentId });
  return `/learner/practice/${scenarioId}?${query}`;
}

/**
 * 「학습 수행 기록」의 학급 응답 분포 탭. 개별 수행 기록과 같은 학습 기록에서 익명 집계만 보여 준다.
 * 들어오자마자 공개 교과목의 첫 미션 주차를 열고, 미션이 있는 주차를 카드로 늘어놓는다.
 * 운영 화면에는 예시(mock) 분포를 두지 않는다 — 응답이 없으면 안내 한 줄로 끝낸다.
 */
export function ClassResponsePanel() {
  const queryClient = useQueryClient();
  const [params, setSearchParams] = useSearchParams();
  // 탭 주소(?tab=class)를 지키면서 교과목·주차·미션만 바꾼다.
  const setParams = (next: Record<string, string>, options?: { replace?: boolean }) =>
    setSearchParams({ tab: "class", ...next }, options);
  const [projector, setProjector] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
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

  const patternQuery = useQuery({
    queryKey: classResponsePatternKey(courseId, week?.week_no, missionId),
    enabled: Boolean(missionId),
    refetchInterval: releaseState && releaseState.status !== "collecting" ? false : 5000,
    queryFn: () => fetchMissionPattern(missionId),
  });

  const transition = useMutation({
    mutationFn: async (action: "close" | "reopen" | "release") => {
      if (!courseId || !missionId) return;
      if (action === "close") {
        if (!patternQuery.data) throw new Error("마감할 응답이 없습니다.");
        await closeClassResponses(courseId, missionId, patternQuery.data);
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

  const realPattern = releaseStatus !== "collecting" && releaseState?.pattern
    ? releaseState.pattern
    : patternQuery.data ?? null;
  const empty = patternQuery.isSuccess && !(realPattern && realPattern.learners > 0 && realPattern.items.length > 0);
  const hasResponses = Boolean(realPattern && !empty);

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
    setSelectedItemId(null);
    setParams({ courseId, weekNo: String(weekNo) });
  };
  const selectMission = (nextMissionId: string) => {
    setSelectedItemId(null);
    setParams({ courseId, weekNo: String(week?.week_no ?? ""), missionId: nextMissionId });
  };

  return <>
    <div className="max-w-[1120px] space-y-3">
      <section aria-label="교과목과 주차" className="rounded-xl border border-[#E2DED2] bg-white px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1 text-[12px] font-semibold text-[#6B7780]">교과목
            <select
              aria-label="응답 교과목"
              value={courseId}
              onChange={(event) => setParams(event.target.value ? { courseId: event.target.value } : {})}
              className="mt-1 h-9 w-full rounded-md border border-[#D9DED9] bg-white px-2.5 text-[14px] font-normal text-[#15202B]"
            >
              {!courseId && <option value="">교과목 선택</option>}
              {outlines.data?.map((outline) => <option key={outline.id} value={outline.id}>{outline.title}</option>)}
            </select>
          </label>
        </div>
        {courseQuery.isPending && courseId && <p role="status" className="mt-3 text-sm">주차를 불러오는 중…</p>}
        {courseQuery.isError && <p role="alert" className="mt-3 text-sm text-destructive">주차를 불러오지 못했습니다.</p>}
        {outlines.isError && <p role="alert" className="mt-3 text-sm text-destructive">교과목 목록을 불러오지 못했습니다.</p>}
        {course && missionWeeks.length === 0 && <p className="mt-3 text-sm text-muted-foreground">이 교과목에는 아직 편성된 미션이 없습니다. 수업 편성에서 먼저 미션을 배정해 주세요.</p>}
        {missionWeeks.length > 0 && <p className="mt-3 text-[12px] text-[#6B7780]">
          학습 미션이 편성된 주차만 표시합니다. 집계에는 수업 기록 공유에 동의한 학습자만 포함됩니다.
        </p>}
        {missionWeeks.length > 0 && <div role="group" aria-label="주차 선택" className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
          {missionWeeks.map((item) => {
            const active = item.week_no === week?.week_no;
            const summary = operations.get(item.week_no);
            return <button
              key={item.week_no}
              type="button"
              aria-pressed={active}
              aria-label={`${item.week_no}주차 · ${item.title}`}
              onClick={() => selectWeek(item.week_no)}
              className={[
                "min-w-0 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
                active ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#E2DED2] bg-[#FCFBF8] text-[#24323D] hover:border-[#B9B29C]",
              ].join(" ")}
            >
              <span className="block truncate text-[13px] font-semibold">{item.week_no}주차 · {item.title}</span>
              {summary && summary.participants > 0 && <span className={`mt-0.5 block text-[11px] tabular-nums ${active ? "text-[#D8DEE2]" : "text-[#7A858C]"}`}>
                {`참여 ${summary.participants}명 · 완료 ${summary.completedLearners}명${summary.dissents > 0 ? ` · 이견 ${summary.dissents}` : ""}`}
              </span>}
            </button>;
          })}
        </div>}
      </section>

      {week && selectedMission && <section className="rounded-2xl border border-[#E5E3DB] bg-[#FAFAF7] p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* 탭 이름이 이미 「학급 응답 분포」라 섹션 제목은 지금 보고 있는 미션으로 둔다. */}
              <h2 className="break-keep text-lg font-bold text-[#15202B]">
                {week.week_no}주차 · 미션 {missionIndex + 1} · {missionMenuTitle(selectedMission.brief_note_ko) ?? missionSituationSummary(selectedMission.situation_ko)}
              </h2>
              {hasResponses && <span className="rounded-full bg-[#EEF1F4] px-2 py-0.5 text-[11px] font-bold text-[#344150]">
                {releaseStatus === "collecting" ? "응답 수집 중" : releaseStatus === "closed" ? "분포 고정" : "학습자 공개"}
              </span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="응답 새로고침"
              disabled={patternQuery.isFetching}
              onClick={() => void patternQuery.refetch()}
            ><RefreshCw className="h-4 w-4" /></Button>
            {hasResponses && <Button variant="outline" onClick={() => setProjector(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />크게 보기
            </Button>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {week.scenarios.length > 1 && <div role="tablist" aria-label="응답을 볼 미션" className="flex flex-wrap gap-1.5">
            {week.scenarios.map((scenario, index) => {
              const title = missionMenuTitle(scenario.brief_note_ko);
              return <button
                key={scenario.scenario_id}
                type="button"
                role="tab"
                aria-selected={scenario.scenario_id === missionId}
                onClick={() => selectMission(scenario.scenario_id)}
                className={[
                  "rounded-md border px-3 py-1.5 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
                  scenario.scenario_id === missionId ? "border-[#15202B] bg-[#15202B] font-semibold text-white" : "border-[#DCD8CC] bg-white text-[#44525C] hover:border-[#B9B29C]",
                ].join(" ")}
              >미션 {index + 1}{scenario.mode ? ` · ${MODE_LABEL[scenario.mode] ?? ""}` : ""}{title ? ` · ${title}` : ""}</button>;
            })}
          </div>}
          <Link
            target="_blank"
            rel="noreferrer"
            to={learnerMissionPath(courseId, week.week_no, missionId, selectedMission.assignment_id)}
            className="ml-auto text-[12.5px] font-medium text-[#44525C] underline-offset-4 hover:underline"
          >학습 미션 열기 ↗</Link>
        </div>

        {hasResponses && <div aria-label="응답 공개 단계" className="mt-4 grid gap-2 rounded-lg border bg-[#FAFAF7] p-3 sm:grid-cols-3">
          {[
            { key: "collecting", label: "1 · 응답 수집", reached: true },
            { key: "closed", label: "2 · 분포 고정", reached: releaseStatus === "closed" || releaseStatus === "released" },
            { key: "released", label: "3 · 학습자 공개", reached: releaseStatus === "released" },
          ].map((step) => <div key={step.key} className={[
            "rounded-md border px-3 py-2 text-center text-xs font-bold",
            step.reached
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-400",
          ].join(" ")}>{step.label}</div>)}
        </div>}

        {patternQuery.isPending && <p role="status" className="mt-5 text-sm">응답 분포를 불러오는 중…</p>}
        {patternQuery.isError && <p role="alert" className="mt-5 text-sm text-destructive">응답 분포를 불러오지 못했습니다.</p>}
        {realPattern && !empty && <div className="mt-3"><ClassResponseDashboard
          pattern={realPattern}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        /></div>}
        {empty && <p className="mt-4 rounded-xl border border-dashed border-[#DAD6CA] bg-white p-5 text-sm text-[#5D6970]">
          아직 집계된 응답이 없습니다. 응답이 쌓이면 문항별 판단 분포를 확인할 수 있습니다.
        </p>}

        {realPattern && !empty && realPattern.learners < 5 && <p className="mt-5 rounded-xl border border-[#E5DFC9] bg-[#FFFDF4] p-4 text-sm leading-relaxed text-[#5F573D]">
          학습자에게 분포를 공개하려면 5명 이상의 응답이 필요합니다.
        </p>}

        {hasResponses && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
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
                disabled={transition.isPending || !patternQuery.data?.learners}
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

    {projector && realPattern && hasResponses && <div
      ref={projectorRef}
      role="dialog"
      aria-modal="true"
      aria-label="학급 응답 크게 보기"
      tabIndex={-1}
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#F8F6EE] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#B8860B]">익명 학급 집계</p>
            <h1 className="mt-1 break-keep text-3xl font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h1>
          </div>
          <Button variant="outline" onClick={() => setProjector(false)}>
            <X className="mr-2 h-4 w-4" />닫기
          </Button>
        </div>
        <ClassResponseDashboard pattern={realPattern} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} projector />
      </div>
    </div>}
  </>;
}
