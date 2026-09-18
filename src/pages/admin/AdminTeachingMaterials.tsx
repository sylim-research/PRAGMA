import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { WeeklyMaterialDocument } from "@/components/curriculum/WeeklyMaterialDocument";
import { WeeklyInstructorNotes, type WeeklyMissionNotes } from "@/components/admin/WeeklyInstructorNotes";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourse";
import {
  buildWeeklyCourseMaterial,
  weeklyMaterialsPath,
} from "@/lib/curriculum/weeklyMaterials";
import { weekRole } from "@/lib/curriculum/template";
import { weekActivityLabel } from "@/lib/curriculum/weekGuidance";
import {
  fetchCourseOperationLogs,
  summarizeCourseOperations,
} from "@/lib/curriculum/courseOperations";
import { buildWeeklyMaterialsHtml, weeklyMaterialsHtmlFilename } from "@/lib/pragma/instructorGuideHtml";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { DEFENSE_COURSE_IDS } from "@/lib/pragma/scenarioTopics";
import { ContentReviewPanel } from "@/components/admin/ContentReviewPanel";
import { getApprovedWeeklyMaterial } from "@/lib/pragma/contentReviewApi";
import { supabase } from "@/integrations/supabase/client";
import { TeachingGeneratorPanel } from "@/components/admin/TeachingGeneratorPanel";
import { LEGACY_TEACHING_MATERIALS as materialsOn } from "@/lib/admin/legacyFeatures";
import { getTeachingState } from "@/lib/curriculum/teachingGenerationApi";
import { applyTeachingDraft } from "@/lib/curriculum/teachingGeneration";
import { teachingKind } from "../../../supabase/functions/_shared/teachingMaterial";

type MaterialReviewState = "approved" | "pending" | "unavailable";

function operationWeekLabel(week: Parameters<typeof weekActivityLabel>[0]) {
  if (week.type === "orientation") return `${week.week_no}주차 · 오리엔테이션`;
  if (week.type === "midterm") return `${week.week_no}주차 · 중간고사`;
  if (week.type === "final") return `${week.week_no}주차 · 기말고사`;
  return `${week.week_no}주차 · ${weekActivityLabel(week)}`;
}

function assignedMissionPath(courseId: string, weekNo: number, scenarioId: string, assignmentId?: string) {
  if (!assignmentId) return `/learner/course/${encodeURIComponent(courseId)}/week/${weekNo}`;
  const query = new URLSearchParams({ courseId, weekNo: String(weekNo), assignmentId });
  return `/learner/practice/${scenarioId}?${query}`;
}

const StatusChip = ({ children, tone = "neutral", className = "" }: {
  children: React.ReactNode;
  tone?: "good" | "attention" | "neutral";
  className?: string;
}) => <span className={[
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold",
  className,
  tone === "good"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "attention"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-600",
].join(" ")}>{children}</span>;

const AdminTeachingMaterials = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const courseId = params.get("courseId") ?? "";
  const requestedWeek = params.get("weekNo");
  const [reviewOpen, setReviewOpen] = useState(params.get("review") === "1");
  const [notesOpen, setNotesOpen] = useState(false);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const projectorRef = useRef<HTMLDivElement>(null);
  const projectorButtonRef = useRef<HTMLButtonElement>(null);
  const materialDetailRef = useRef<HTMLDetailsElement>(null);

  const openMaterialDetail = () => {
    setReviewOpen(true);
    window.requestAnimationFrame(() => {
      const detail = materialDetailRef.current;
      if (!detail) return;
      detail.open = true;
      detail.focus({ preventScroll: true });
      detail.scrollIntoView({ block: "start" });
    });
  };

  const outlines = useQuery({ queryKey: ["teaching-outlines"], queryFn: listCurriculumOutlines });
  const courseQuery = useQuery({
    queryKey: ["teaching-course", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const [curriculum, assignments, cores] = await Promise.all([
        getCurriculumOutline(courseId), listWeekAssignments(courseId), listCoreScenarios(),
      ]);
      return assembleLearnerCourse({ ...curriculum, assignments, cores });
    },
  });
  const course = courseQuery.data;
  const week = requestedWeek !== null
    ? course?.weeks.find((item) => item.week_no === Number(requestedWeek))
    : course?.weeks[0];
  const generationKey = ["teaching-generated-material", courseId, week?.week_no];
  const generated = useQuery({ queryKey: generationKey,
    enabled: Boolean(course && week && teachingKind(week.week_no, week.type)),
    queryFn: () => getTeachingState(courseId, week!.week_no), retry: false,
  });
  const draft = generated.data?.current ? generated.data.draft : null;
  const baseMaterial = course && week ? buildWeeklyCourseMaterial(course.outline, week) : null;
  const material = baseMaterial && draft ? applyTeachingDraft(baseMaterial, draft) : baseMaterial;
  const missionIds = week?.scenarios.map((scenario) => scenario.scenario_id) ?? [];
  const allMissionIds = course?.weeks.flatMap((item) => item.scenarios.map((scenario) => scenario.scenario_id)) ?? [];

  const operationLogs = useQuery({
    queryKey: ["teaching-course-operation-logs", courseId, allMissionIds.join("|")],
    enabled: Boolean(courseId) && allMissionIds.length > 0,
    queryFn: () => fetchCourseOperationLogs(courseId, allMissionIds),
  });
  const operationSummaries = course
    ? summarizeCourseOperations(course.weeks, operationLogs.data ?? [])
    : new Map();

  const weeklyReviewStates = useQuery({
    queryKey: ["teaching-weekly-review-states", courseId, course?.weeks.map((item) => item.week_no).join("|")],
    enabled: Boolean(courseId) && Boolean(course),
    queryFn: async (): Promise<Map<number, MaterialReviewState>> => {
      const states = await Promise.all((course?.weeks ?? []).map(async (item) => {
        try {
          const approved = await getApprovedWeeklyMaterial(courseId, item.week_no);
          return [item.week_no, approved ? "approved" : "pending"] as const;
        } catch {
          return [item.week_no, "unavailable"] as const;
        }
      }));
      return new Map(states);
    },
  });

  const missionNotes = useQuery({
    queryKey: ["teaching-mission-notes", courseId, week?.week_no, missionIds],
    enabled: notesOpen && Boolean(week) && missionIds.length > 0,
    queryFn: async (): Promise<WeeklyMissionNotes[]> => {
      const { data, error } = await supabase.from("scenarios")
        .select("scenario_id,speech_act,mission_status,mission_content")
        .in("scenario_id", missionIds);
      if (error) throw new Error(error.message);
      return missionIds.flatMap((id, index) => {
        const row = data?.find((item) => item.scenario_id === id);
        if (!row || !isMissionReleasedForLearner(row)) return [];
        const mission = normalizeMission(row.mission_content);
        if (!mission.ok || !mission.data) return [];
        return [{
          scenarioId: id,
          label: `미션 ${index + 1}`,
          guide: buildInstructorMissionGuide(mission.data, SPEECH_ACT_UI[row.speech_act as SpeechActUI] ?? "화행"),
        }];
      });
    },
  });

  useEffect(() => {
    setNotesOpen(false);
    setProjectorOpen(false);
    setActiveSection(0);
  }, [courseId, requestedWeek]);

  // SPA 링크는 hash만 바꾸므로, 비동기 주차 자료가 준비된 뒤 상세를 열고 이동한다.
  // location.key를 사용해 같은 주차의 버튼을 다시 눌러도 이동한다.
  useEffect(() => {
    if (!week || location.hash !== "#weekly-material-detail") return;
    setReviewOpen(true);
    const frame = window.requestAnimationFrame(() => {
      const detail = materialDetailRef.current;
      if (!detail) return;
      detail.open = true;
      detail.focus({ preventScroll: true });
      detail.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.hash, courseId, week]);

  // 화면 진입 시 첫 교과목을 기본 선택해, 빈 화면 대신 1주차 자료를 바로 보여 준다.
  // 미션 단독 주소로 들어온 경우에는 교강사가 직접 고르도록 자동 선택하지 않는다.
  const outlineList = outlines.data;
  const missionParam = params.get("mission");
  useEffect(() => {
    if (courseId || missionParam) return;
    const firstOutline = outlineList?.[0];
    if (!firstOutline) return;
    const next = new URLSearchParams(params);
    next.set("courseId", firstOutline.id);
    setParams(next, { replace: true });
  }, [courseId, missionParam, outlineList, params, setParams]);

  const sectionCount = material?.sections.length ?? 0;
  useEffect(() => {
    if (!projectorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    projectorRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const buttons = projectorRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = buttons?.[0];
        const last = buttons?.[buttons.length - 1];
        if (document.activeElement === projectorRef.current || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
      if (event.key === "Escape") setProjectorOpen(false);
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setActiveSection((current) => Math.min(sectionCount - 1, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setActiveSection((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      projectorButtonRef.current?.focus();
    };
  }, [projectorOpen, sectionCount]);

  const exportHtml = () => {
    if (!material) return;
    const blob = new Blob([buildWeeklyMaterialsHtml(material)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = weeklyMaterialsHtmlFilename(material);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  // 상단 작업대가 쓰는 선택 주차 요약. 표시만 하며 상태 판정 기준은 아래 15주 현황과 같다.
  const selectedWeekIndex = course && week ? course.weeks.findIndex((item) => item.week_no === week.week_no) : -1;
  const prevWeek = course && selectedWeekIndex > 0 ? course.weeks[selectedWeekIndex - 1] : undefined;
  const nextWeek = course && selectedWeekIndex >= 0 ? course.weeks[selectedWeekIndex + 1] : undefined;
  const selectedExpected = week && (week.speech_act || weekRole(week.week_no) === "contextualization") ? 2 : 0;
  const selectedMaterialState = week ? weeklyReviewStates.data?.get(week.week_no) : undefined;

  return <AdminShell title="주차별 수업 운영" description={materialsOn ? "선택한 주차의 수업자료를 준비·승인하고, 교실 화면과 학급 응답을 확인합니다." : "선택한 주차의 편성 미션을 열어 수업에 쓰고, 학급 응답과 운영 현황을 확인합니다."}>
    <div className="max-w-[1080px] space-y-5">
      {/* 이 화면의 주인공은 지금 고른 주차다. 15주 전체 현황은 맨 아래 개요로 둔다. */}
      <section aria-label="선택 주차 작업대" className="rounded-2xl border border-[#E2DED2] bg-white">
        <div className="flex flex-wrap items-end gap-3 border-b border-[#EFEBE1] px-5 py-3">
          <label className="min-w-[240px] flex-1 text-[12px] font-semibold text-[#6B7780]">교과목
            <select aria-label="수업자료 교과목" value={courseId} onChange={(event) => setParams(event.target.value ? { courseId: event.target.value } : {})} className="mt-1 h-9 w-full rounded-md border border-[#D9DED9] bg-white px-2.5 text-[14px] font-normal text-[#15202B]">
              {!courseId && <option value="">교과목 선택</option>}
              {outlines.data?.map((outline) => <option key={outline.id} value={outline.id}>{outline.title}</option>)}
            </select>
          </label>
          <label className="min-w-[220px] text-[12px] font-semibold text-[#6B7780]">주차
            <select aria-label="수업자료 주차" value={week?.week_no ?? ""} disabled={!course} onChange={(event) => setParams({ courseId, weekNo: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-[#D9DED9] bg-white px-2.5 text-[14px] font-normal text-[#15202B]">
              {!week && <option value="">주차 선택</option>}
              {course?.weeks.map((item) => <option key={item.week_no} value={item.week_no}>{operationWeekLabel(item)}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" className="h-9" disabled={!prevWeek} onClick={() => prevWeek && setParams({ courseId, weekNo: String(prevWeek.week_no) })}>◀ 이전 주차</Button>
            <Button variant="outline" className="h-9" disabled={!nextWeek} onClick={() => nextWeek && setParams({ courseId, weekNo: String(nextWeek.week_no) })}>다음 주차 ▶</Button>
          </div>
        </div>
        {course && week && <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] text-[#8A9299]">{course.outline.title}</p>
              <h2 className="mt-0.5 text-[22px] font-bold leading-tight text-[#15202B]">{operationWeekLabel(week)}</h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#5D6970]">
                <span>{selectedExpected > 0 ? `편성 미션 ${week.scenarios.length}/${selectedExpected}` : "수업 안내 주차"}</span>
                {materialsOn && <>
                <span aria-hidden className="text-[#C9CED0]">·</span>
                <span className={selectedMaterialState === "approved" ? "text-emerald-800" : selectedMaterialState === "pending" ? "text-amber-800" : ""}>
                  수업자료 {selectedMaterialState === "approved" ? "확정됨" : selectedMaterialState === "pending" ? "승인 전" : "상태 확인 중"}
                </span>
                </>}
                <span aria-hidden className="text-[#C9CED0]">·</span>
                <span>{course.outline.status === "published" ? "학습자에게 공개 중인 강좌" : "비공개 강좌"}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="선택 주차 작업">
              {materialsOn && teachingKind(week.week_no, week.type) && <Button asChild>
                <Link to={`/admin/teaching-generator?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}`}>수업자료·토론 만들기</Link>
              </Button>}
              {week.scenarios[0] && <Button variant="outline" asChild>
                <Link to={`/admin/class-responses?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}&missionId=${encodeURIComponent(week.scenarios[0].scenario_id)}`}>학급 응답 확인</Link>
              </Button>}
            </div>
          </div>
          {/* 미션을 쓰지 않는 주차(오리엔테이션·시험 등)에는 빈 안내를 띄우지 않는다. */}
          {material && (selectedExpected > 0 || material.missions.length > 0) && <div>
            <p className="text-[12px] font-semibold text-[#6B7780]">편성 미션</p>
            {material.missions.length ? <ul className="mt-1.5 divide-y divide-[#EFEBE1] rounded-lg border border-[#EFEBE1]">
              {material.missions.map((mission) => <li key={mission.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                <span className="text-[13.5px] font-medium text-[#15202B]">{mission.label}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-8 text-[12.5px]" asChild><Link target="_blank" rel="noreferrer" to={assignedMissionPath(courseId, week.week_no, mission.id, week.scenarios.find((scenario) => scenario.scenario_id === mission.id)?.assignment_id)}>{mission.label} 열기 ↗</Link></Button>
                  <Button size="sm" variant="ghost" className="h-8 text-[12.5px]" asChild><Link to={`/admin/class-responses?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}&missionId=${encodeURIComponent(mission.id)}`}>{mission.label} 응답</Link></Button>
                </span>
              </li>)}
            </ul> : <p className="mt-1 text-[13px] text-muted-foreground">연결된 공개 미션이 없습니다. 미션을 사용하는 주차는 수업 편성에서 먼저 편성해 주세요.</p>}
          </div>}
        </div>}
      </section>
      {outlines.isError && <p role="alert">교과목 목록을 불러오지 못했습니다.</p>}
      {outlines.isSuccess && outlines.data.length === 0 && <p className="text-sm">조회 가능한 교과목이 없습니다. 관리자 로그인과 <Link className="underline" to="/admin/composer">저장된 교과목</Link>을 확인해 주세요.</p>}
      {!courseId && <div className="rounded-xl border border-dashed p-5 text-sm">
        교과목과 주차를 선택해 주세요.{materialsOn && " 미편성 주차는 계획만 미리 보고, 편성 후 해당 미션에 맞춰 자료를 구성합니다."}
        {params.get("mission") && <p className="mt-2">미션 단독 주소로 들어왔습니다. 이 미션을 사용할 교과목과 주차를 선택해 주세요.</p>}
      </div>}
      {courseId && courseQuery.isPending && <p role="status">주차 계획을 불러오는 중…</p>}
      {courseQuery.isError && <p role="alert">주차 계획을 불러오지 못했습니다. 교과목 선택을 확인해 주세요.</p>}
      {course && !week && <p role="alert">해당 주차를 찾을 수 없습니다.</p>}
      {materialsOn && course && week && material && <>
        {!projectorOpen && <TeachingGeneratorPanel key={`${courseId}-${week.week_no}`} course={course} week={week}
          state={generated.data} loading={generated.isPending} loadError={generated.isError}
          onReload={() => { void generated.refetch(); }} onReview={openMaterialDetail}
          onSaved={(state) => {
            queryClient.setQueryData(generationKey, state);
            void queryClient.invalidateQueries({ queryKey: ["content-review", "weekly_material", courseId, week.week_no] });
            void queryClient.invalidateQueries({ queryKey: ["teaching-weekly-review-states", courseId] });
          }} />}
        {!projectorOpen && <details ref={materialDetailRef} id="weekly-material-detail" tabIndex={-1} open={reviewOpen} onToggle={(event) => setReviewOpen(event.currentTarget.open)} className="scroll-mt-5 rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">이 주차 수업자료 승인</summary>
          {reviewOpen && <ContentReviewPanel key={`${courseId}-${week.week_no}-${draft?.revision ?? 0}`} refreshKey={String(draft?.revision ?? 0)} target={{ kind: "weekly_material", targetId: courseId, weekNo: week.week_no }} />}
        </details>}
        <div className="flex flex-wrap items-center gap-2">
          <Button ref={projectorButtonRef} onClick={() => { setNotesOpen(false); setActiveSection(0); setProjectorOpen(true); }}>프로젝터 화면</Button>
          <Button variant="outline" onClick={exportHtml}>HTML</Button>
          <Button variant={notesOpen ? "default" : "outline"} onClick={() => setNotesOpen((open) => !open)} aria-pressed={notesOpen}>교수자 전용 메모</Button>
          {course.outline.status === "published" && DEFENSE_COURSE_IDS.includes(courseId) && <Button variant="outline" asChild><Link target="_blank" rel="noreferrer" to={`/learner/course/${courseId}/week/${week.week_no}/note`}>학생 유인물 ↗</Link></Button>}
        </div>
        {notesOpen && !projectorOpen ? <>
          {missionNotes.isFetching && missionIds.length > 0 && <p role="status">미션 해설을 불러오는 중…</p>}
          {missionNotes.isError && <p role="alert">미션 해설을 불러오지 못했습니다. 공통 수업자료는 계속 사용할 수 있습니다.</p>}
          <WeeklyInstructorNotes week={week} direction={course.outline.language_direction} missions={missionNotes.data ?? []} generatedNotes={draft?.content.instructor_notes} />
        </> : !projectorOpen && <WeeklyMaterialDocument material={material} />}
        {projectorOpen && <div ref={projectorRef} role="dialog" aria-modal="true" aria-label="주차 프로젝터" tabIndex={-1} className="fixed inset-0 z-[100] overflow-y-auto bg-[#F8F6EE] p-5 sm:p-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="text-sm">{activeSection + 1} / {sectionCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={activeSection === 0} onClick={() => setActiveSection((current) => current - 1)}>이전</Button>
                <Button variant="outline" disabled={activeSection === sectionCount - 1} onClick={() => setActiveSection((current) => current + 1)}>다음</Button>
                <Button variant="outline" onClick={() => setProjectorOpen(false)}>닫기</Button>
              </div>
            </div>
            <div className="[&_.material-section]:min-h-[45vh] [&_.material-section_h2]:text-3xl [&_.material-section_p]:text-xl [&_.material-section_p]:leading-9 [&_.material-section_li]:text-xl [&_.material-section_li]:leading-9">
              <WeeklyMaterialDocument material={material} activeSection={activeSection} />
            </div>
          </div>
        </div>}
      </>}
      {/* 15주 전체 현황 — 개요라서 선택 주차 작업대보다 조용하게, 맨 아래에 둔다.
          행마다 같은 문구를 반복하지 않도록 강좌 공개 여부는 머리에 한 번만 보이고, 행에는 주차별로 다른 것만 남긴다. */}
      {course && !projectorOpen && <section aria-labelledby="course-operation-heading" className="rounded-xl border border-[#E6E1D5] bg-[#FBFAF7]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <h2 id="course-operation-heading" className="text-[15px] font-semibold text-[#15202B]">15주 운영 현황</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip tone={course.outline.status === "published" ? "good" : "attention"}>
              {course.outline.status === "published" ? "강좌 공개" : "강좌 비공개"}
            </StatusChip>
            <Button size="sm" variant="ghost" className="h-8 text-[12.5px]" aria-expanded={overviewOpen} onClick={() => setOverviewOpen((open) => !open)}>
              {overviewOpen ? "접기 ▴" : "펼치기 ▾"}
            </Button>
          </div>
        </div>
        {operationLogs.isError && <p role="alert" className="px-5 pb-2 text-xs text-destructive">수행 현황을 불러오지 못했습니다. 편성·자료 상태는 계속 확인할 수 있습니다.</p>}
        {overviewOpen && <div className="divide-y divide-[#EFEBE1] border-t border-[#EFEBE1] bg-white">
          {course.weeks.map((item) => {
            // 기존 수업자료와 같은 2미션 기준을 읽되 검수·생성 계약은 변경하지 않는다.
            const expected = item.speech_act || weekRole(item.week_no) === "contextualization" ? 2 : 0;
            const assigned = item.scenarios.length;
            const missionsReady = expected === 0 || assigned >= expected;
            const materialState = weeklyReviewStates.data?.get(item.week_no);
            const operation = operationSummaries.get(item.week_no);
            const firstMission = item.scenarios[0];
            const selected = item.week_no === week?.week_no;
            // 자료 상태와 강좌 공개 여부는 칩·머리에 이미 보이므로 확인 문구는 미배정만 남긴다.
            const issue = !missionsReady ? `미션 ${expected - assigned}개 미배정` : null;
            return <article key={item.week_no} className={[
              "grid gap-2 px-5 py-2.5 xl:grid-cols-[16rem_minmax(0,1fr)_9rem] xl:items-center",
              selected ? "bg-[#FFFBEA] shadow-[inset_3px_0_0_#15202B]" : "",
            ].join(" ")}>
              <div>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => setParams({ courseId, weekNo: String(item.week_no) })}
                  className={["text-left text-[13.5px] hover:underline", selected ? "font-bold text-[#15202B]" : "font-semibold text-[#34444D]"].join(" ")}
                >{operationWeekLabel(item)}</button>
                {issue && <p className="mt-0.5 text-[11.5px] font-medium text-amber-800">확인 · {issue}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip tone={missionsReady ? "good" : "attention"}>
                  {expected > 0 ? `미션 ${assigned}/${expected}` : "수업 안내"}
                </StatusChip>
                {materialsOn && <StatusChip tone={materialState === "approved" ? "good" : materialState === "pending" ? "attention" : "neutral"}>
                  {materialState === "approved" ? "자료 확정" : materialState === "pending" ? "자료 승인 대기" : "자료 상태 확인 중"}
                </StatusChip>}
                {operation && operation.participants > 0 && <StatusChip>
                  참여 {operation.participants}명 · 완료 {operation.completedLearners}명
                </StatusChip>}
                {operation && operation.dissents > 0 && <StatusChip tone="attention">이견 {operation.dissents}건</StatusChip>}
              </div>
              <div className="flex flex-wrap gap-0.5 xl:justify-end">
                {materialsOn && <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" asChild>
                  <Link onClick={openMaterialDetail} to={`${weeklyMaterialsPath(courseId, item.week_no)}#weekly-material-detail`}>수업자료</Link>
                </Button>}
                {firstMission && <>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" asChild>
                    <Link target="_blank" rel="noreferrer" to={assignedMissionPath(courseId, item.week_no, firstMission.scenario_id, firstMission.assignment_id)}>미션</Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" asChild>
                    <Link to={`/admin/class-responses?courseId=${encodeURIComponent(courseId)}&weekNo=${item.week_no}&missionId=${encodeURIComponent(firstMission.scenario_id)}`}>응답 분포</Link>
                  </Button>
                </>}
              </div>
            </article>;
          })}
        </div>}
      </section>}
    </div>
  </AdminShell>;
};

export default AdminTeachingMaterials;
