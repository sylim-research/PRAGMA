import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, RefreshCw, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ClassResponsePatterns } from "@/components/admin/ClassResponsePatterns";
import { Button } from "@/components/ui/button";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import { DEMO_CLASS_RESPONSE_PATTERN } from "@/lib/mission/classResponseDemo";
import {
  closeClassResponses,
  getAdminClassResponseRelease,
  releaseClassResponses,
  reopenClassResponses,
} from "@/lib/mission/classResponseRelease";
import {
  aggregateMissionResponses,
  type ClassResponseLogRow,
  type MissionPattern,
} from "@/lib/mission/classResponsePatterns";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { supabase } from "@/integrations/supabase/client";

const AdminClassResponses = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [demo, setDemo] = useState(() => !(params.get("courseId") && params.get("missionId")));
  const [projector, setProjector] = useState(false);
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
  const requestedWeek = Number(params.get("weekNo"));
  const week = Number.isInteger(requestedWeek) && requestedWeek > 0
    ? course?.weeks.find((item) => item.week_no === requestedWeek) ?? course?.weeks[0]
    : course?.weeks[0];
  const requestedMission = params.get("missionId");
  const selectedMission = week?.scenarios.find((item) => item.scenario_id === requestedMission)
    ?? week?.scenarios[0]
    ?? null;
  const missionId = selectedMission?.scenario_id ?? "";

  const releaseQuery = useQuery({
    queryKey: ["class-response-release", courseId, missionId],
    enabled: !demo && Boolean(courseId) && Boolean(missionId),
    queryFn: () => getAdminClassResponseRelease(courseId, missionId),
  });
  const releaseState = releaseQuery.data;

  useEffect(() => {
    if (courseId || !outlines.data?.[0]) return;
    setParams({ courseId: outlines.data[0].id }, { replace: true });
  }, [courseId, outlines.data, setParams]);

  const patternQuery = useQuery({
    queryKey: ["class-response-pattern", courseId, week?.week_no, missionId],
    enabled: !demo && Boolean(missionId),
    refetchInterval: demo || (releaseState && releaseState.status !== "collecting") ? false : 5000,
    queryFn: async (): Promise<MissionPattern> => {
      const [logsResult, missionResult] = await Promise.all([
        supabase.from("learner_mission_logs")
          .select("mission_id,profile_id,completed_at,context_judgment")
          .eq("mission_id", missionId),
        supabase.from("scenarios")
          .select("mission_content")
          .eq("scenario_id", missionId)
          .maybeSingle(),
      ]);
      if (logsResult.error) throw new Error(logsResult.error.message);
      if (missionResult.error) throw new Error(missionResult.error.message);
      const mission = normalizeMission(missionResult.data?.mission_content);
      return aggregateMissionResponses(
        missionId,
        (logsResult.data ?? []) as ClassResponseLogRow[],
        mission.ok ? mission.data ?? null : null,
      );
    },
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
      await queryClient.invalidateQueries({ queryKey: ["class-response-pattern", courseId, week?.week_no, missionId] });
    },
  });

  const visiblePattern = demo
    ? DEMO_CLASS_RESPONSE_PATTERN
    : releaseState?.status !== "collecting" && releaseState?.pattern
      ? releaseState.pattern
      : patternQuery.data ?? null;
  const hasResponses = Boolean(visiblePattern && visiblePattern.learners > 0);
  const releaseStatus = releaseState?.status ?? "collecting";

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

  const selectCourse = (nextCourseId: string) => {
    setParams(nextCourseId ? { courseId: nextCourseId } : {});
  };
  const selectWeek = (weekNo: number) => {
    setParams({ courseId, weekNo: String(weekNo) });
  };
  const selectMission = (nextMissionId: string) => {
    setParams({ courseId, weekNo: String(week?.week_no ?? ""), missionId: nextMissionId });
  };

  return <AdminShell
    title="실시간 학급 응답"
    description="개별 판단을 익명 학급 분포로 비교하고 수업 토론으로 연결합니다."
  >
    <div className="max-w-[1120px] space-y-5">
      <section className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold">교과목
            <select
              aria-label="응답 교과목"
              value={courseId}
              onChange={(event) => selectCourse(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
            >
              {!courseId && <option value="">교과목 선택</option>}
              {outlines.data?.map((outline) => <option key={outline.id} value={outline.id}>{outline.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">주차
            <select
              aria-label="응답 주차"
              value={week?.week_no ?? ""}
              disabled={!course}
              onChange={(event) => selectWeek(Number(event.target.value))}
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
            >
              {!week && <option value="">주차 선택</option>}
              {course?.weeks.map((item) => <option key={item.week_no} value={item.week_no}>{item.week_no}주차 · {item.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">미션
            <select
              aria-label="응답 미션"
              value={missionId}
              disabled={!week?.scenarios.length}
              onChange={(event) => selectMission(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
            >
              {!missionId && <option value="">편성 미션 없음</option>}
              {week?.scenarios.map((item, index) => <option key={item.scenario_id} value={item.scenario_id}>
                미션 {index + 1} · {missionSituationSummary(item.situation_ko)}
              </option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={!demo ? "default" : "outline"} aria-pressed={!demo} onClick={() => setDemo(false)}>실제 데이터</Button>
          <Button size="sm" variant={demo ? "default" : "outline"} aria-pressed={demo} onClick={() => setDemo(true)}>예시 데이터 보기</Button>
          {!demo && <span className="ml-1 text-xs text-muted-foreground">5초마다 자동 갱신</span>}
          {courseId && week && <Button size="sm" variant="ghost" className="ml-auto" asChild>
            <Link to={`/admin/package?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}#weekly-material-detail`}>
              주차 운영으로 돌아가기 →
            </Link>
          </Button>}
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${demo ? "border-[#D8B84A] bg-[#FFF9E5]" : "bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${demo ? "bg-[#FAD338] text-[#15202B]" : "bg-[#EEF1F4] text-[#344150]"}`}>
              {demo ? "DEMO · 예시 데이터" : "실제 완료 응답"}
            </span>
            <h2 className="mt-3 text-lg font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {demo
                ? "실제 학습자 수행 기록이 아닌 코드 내 고정 예시입니다."
                : selectedMission
                  ? missionSituationSummary(selectedMission.situation_ko)
                  : "교과목·주차·미션을 선택해 주세요."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {!demo && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {releaseStatus === "collecting" ? "응답 수집 중" : releaseStatus === "closed" ? "분포 고정" : "학습자 공개"}
              </span>}
              {visiblePattern && <>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">응답 {visiblePattern.learners}명</span>
                <span className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  visiblePattern.dissents > 0
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-700",
                ].join(" ")}>이견 {visiblePattern.dissents}건</span>
              </>}
            </div>
          </div>
          <div className="flex gap-2">
            {!demo && <Button
              variant="outline"
              size="icon"
              aria-label="응답 새로고침"
              disabled={!missionId || patternQuery.isFetching}
              onClick={() => void patternQuery.refetch()}
            ><RefreshCw className="h-4 w-4" /></Button>}
            <Button variant="outline" disabled={!hasResponses} onClick={() => setProjector(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />크게 보기
            </Button>
          </div>
        </div>

        {!demo && missionId && <div aria-label="응답 공개 단계" className="mt-5 grid gap-2 rounded-lg border bg-[#FAFAF7] p-3 sm:grid-cols-3">
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

        {!demo && patternQuery.isPending && missionId && <p role="status" className="mt-5 text-sm">응답 분포를 불러오는 중…</p>}
        {!demo && patternQuery.isError && <p role="alert" className="mt-5 text-sm text-destructive">응답 분포를 불러오지 못했습니다.</p>}
        {!demo && !missionId && <p className="mt-5 text-sm text-muted-foreground">이 주차에 편성된 미션이 없습니다.</p>}
        {visiblePattern && <div className="mt-5"><ClassResponsePatterns patterns={[visiblePattern]} /></div>}

        {!demo && missionId && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
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

        {demo && <p className="mt-4 border-t border-[#E5D28A] pt-3 text-xs font-semibold text-[#6A5516]">
          DEMO · 예시 데이터 — 실제 학습자 수행 기록이 아니며 DB에 저장되지 않습니다.
        </p>}
      </section>
    </div>

    {projector && visiblePattern && <div
      ref={projectorRef}
      role="dialog"
      aria-modal="true"
      aria-label="학급 응답 크게 보기"
      tabIndex={-1}
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#F8F6EE] p-6 sm:p-10"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#B8860B]">{demo ? "DEMO · 예시 데이터" : "익명 학급 집계"}</p>
            <h1 className="mt-1 text-3xl font-black text-[#15202B]">우리 반은 어떻게 판단했을까?</h1>
            <p className="mt-2 text-base text-muted-foreground">가장 많이 선택된 응답이 정답을 의미하지는 않습니다.</p>
          </div>
          <Button variant="outline" onClick={() => setProjector(false)}>
            <X className="mr-2 h-4 w-4" />닫기
          </Button>
        </div>
        <ClassResponsePatterns patterns={[visiblePattern]} projector />
      </div>
    </div>}
  </AdminShell>;
};

export default AdminClassResponses;
