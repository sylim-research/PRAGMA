import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";

import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import { MODE_LABEL, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { isReinforcementWeek, weekActivityLabel } from "@/lib/curriculum/weekGuidance";
import { courseDisplayTitle } from "@/lib/pragma/scenarioTopics";
import { expectedMissionModesForWeek, remainingMissionModes, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { missionMenuTitle } from "@/lib/curriculum/missionMenuTitle";
import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import { LEGACY_TEACHING_MATERIALS as materialsOn } from "@/lib/admin/legacyFeatures";

function weekHeading(week: LearnerCourseWeek): string {
  if (!week.speech_act) return weekActivityLabel(week);
  const act = SPEECH_ACT_UI[week.speech_act];
  return `${act} 화행${isReinforcementWeek(week) ? " · 새 상황에 적용하기" : ""}`;
}

function savedWeek(key: string): number | null {
  try {
    const value = sessionStorage.getItem(key);
    return value !== null && /^\d+$/.test(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function activityCopy(week: LearnerCourseWeek): string {
  if (week.week_no === 7 || week.week_no === 14) {
    return "앞서 수행한 미션의 표현 선택과 수정 근거를 함께 돌아봅니다.";
  }
  if (week.type === "midterm" || week.type === "final") {
    return "교수자 안내에 따라 지금까지의 화용 판단과 산출을 통합해 점검합니다.";
  }
  return "강좌의 학습 흐름을 살펴보고 출발점 수행을 확인합니다.";
}

const LearnerCourseLive = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: course = null, error, isPending: loading } = useLearnerCourse(courseId);
  const weeks = [...(course?.weeks ?? [])].sort((left, right) => left.week_no - right.week_no);
  const memoryKey = `pragma:course-open-week:${courseId}`;
  const remembered = useMemo(() => savedWeek(memoryKey), [memoryKey]);
  const requested = searchParams.get("week");
  const preferred = requested !== null && /^\d+$/.test(requested) ? Number(requested) : remembered;
  const firstLearningWeek = weeks.find((week) => week.speech_act)?.week_no ?? weeks[0]?.week_no ?? 0;
  // Zero deliberately means all weeks are closed; an unavailable week falls back
  // to the first learning week. URL state also survives a mission/back navigation.
  const openWeek = preferred === 0 ? 0
    : weeks.some((week) => week.week_no === preferred) ? preferred!
      : firstLearningWeek;

  useEffect(() => {
    if (!course) return;
    try { sessionStorage.setItem(memoryKey, String(openWeek)); } catch { /* UI memory is optional. */ }
  }, [course, memoryKey, openWeek]);

  useEffect(() => {
    if (!course || !openWeek || preferred === null) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`week-toggle-${openWeek}`)?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [course, openWeek, preferred]);

  function toggleWeek(weekNo: number) {
    const next = new URLSearchParams(searchParams);
    next.set("week", String(openWeek === weekNo ? 0 : weekNo));
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  return (
    <LearnerJourneyShell>
      <main className="pb-24">
        {loading ? (
          <p className="mt-6 text-[13px] text-muted-foreground">강좌를 불러오는 중…</p>
        ) : error ? (
          <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error instanceof Error ? error.message : "강좌를 불러오지 못했습니다."}
          </div>
        ) : !course || !courseId ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#EAE4D2] bg-white px-6 py-10 text-center text-[13px] text-muted-foreground">
            선택한 교과목을 찾을 수 없습니다.
            <Link to="/learner/course" className="mt-3 block font-bold text-[#15202B]">교과목 선택으로 돌아가기</Link>
          </div>
        ) : (
          <>
            <Link to="/learner/course" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">← 교과목 선택</Link>
            <h1 className="mt-5 break-keep text-[22px] font-bold leading-snug tracking-tight text-[#15202B] sm:text-[24px]">{courseDisplayTitle(course.outline)}</h1>

            <h2 className="mb-2.5 mt-7 text-[16px] font-semibold tracking-tight text-[#15202B]">주차별 학습계획</h2>
            <ol aria-label="주차별 학습계획" className="overflow-hidden rounded-xl border border-[#E8E3D8] bg-white">
              {weeks.map((week) => {
                const expanded = openWeek === week.week_no;
                const title = weekHeading(week);
                const savedGoal = week.can_do[0];
                const goal = week.speech_act === "request" && (!savedGoal || savedGoal === "부탁을 부드럽고 분명하게 말하기")
                  ? `원문의 요청 의도를 유지하면서 상황과 상대에 맞게 ${course.outline.language_direction === "zh_ko" ? "한국어" : "중국어"}로 전달한다.`
                  : savedGoal;
                const weekPath = `/learner/course/${courseId}/week/${week.week_no}`;
                const modes = week.expected_mission_modes ?? expectedMissionModesForWeek({
                  courseMode: course.outline.course_mode as CourseMode,
                  interpretingWeekCount: course.outline.target_interpreting_week_count,
                }, week.week_no);
                const missions = week.scenarios.filter((scenario) => scenario.runnable && scenario.assignment_id && scenario.mode);
                const missingModes = remainingMissionModes(modes, missions.map((scenario) => scenario.mode)) ?? modes;
                const headingId = `week-toggle-${week.week_no}`;
                const panelId = `week-panel-${week.week_no}`;

                return (
                  <li key={week.week_no} className="border-b border-[#EEEAE2] last:border-b-0">
                    <h3>
                      <button
                        id={headingId}
                        type="button"
                        aria-label={`${week.week_no}주차 ${title}`}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => toggleWeek(week.week_no)}
                        className={`flex min-h-12 w-full scroll-mt-20 scroll-mb-24 items-center gap-3 border-l-2 px-4 text-left transition-colors duration-150 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B8860B] sm:gap-4 sm:px-5 ${expanded ? "border-[#CFAD3C] bg-[#F6F0DA] py-3.5 text-[#24323D]" : "border-transparent py-3 text-[#24323D] hover:bg-[#FAF8F2]"}`}
                      >
                        <span className={`flex w-12 shrink-0 items-baseline gap-1 tabular-nums sm:w-14 ${expanded ? "text-[#8A6B24]" : "text-[#8F8164]"}`}>
                          <span className="text-[17px] font-medium">{String(week.week_no).padStart(2, "0")}</span>
                          <span className="text-[10px]">주차</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block break-keep leading-5 ${expanded ? "text-[17px] font-semibold" : "text-[14px] font-medium"}`}>{title}</span>
                          {expanded && goal && <span className="mt-1 block break-keep text-[13px] font-normal leading-5 text-[#52606A]">학습목표 · {goal}</span>}
                        </span>
                        <ChevronDown aria-hidden="true" strokeWidth={1.5} className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180 text-[#8A6B24]" : "text-[#969E9E]"}`} />
                      </button>
                    </h3>
                    <div id={panelId} role="region" aria-labelledby={headingId} hidden={!expanded}>
                      {expanded && (
                        <div className="bg-[#FCFAF5] px-4 pb-4 pt-3 sm:px-5">
                          {modes.length > 0 ? (
                            <section aria-label="이번 주 학습 미션">
                              <h4 className="mb-2 text-[13px] font-semibold text-[#34434F]">이번 주 학습 미션 {modes.length}개</h4>
                              {week.speech_act && <p className="mb-3 break-keep text-[13px] leading-5 text-[#52606A]">
                                같은 {SPEECH_ACT_UI[week.speech_act]} 화행을 서로 다른 상황에서 {modes.includes("translation") && modes.includes("stt_interpreting") ? "번역과 통역으로" : modes.includes("translation") ? "번역으로" : "통역으로"} 연습합니다. 미션 1부터 차례로 진행하세요.
                              </p>}
                              <ul className="grid gap-2.5 sm:grid-cols-2">
                                {missions.map((scenario, index) => {
                                  const label = missionMenuTitle(scenario.brief_note_ko);
                                  const modeLabel = MODE_LABEL[scenario.mode!];
                                  const query = new URLSearchParams({ courseId, weekNo: String(week.week_no), assignmentId: scenario.assignment_id! });
                                  const missionPath = `/learner/practice/${scenario.scenario_id}?${query}`;
                                  return (
                                    <li key={scenario.scenario_id} className="flex h-full flex-col rounded-lg border border-[#EAE5DB] bg-white transition-colors duration-150 hover:border-[#C1AE7C]">
                                      <Link
                                        to={missionPath}
                                        aria-label={`${modeLabel} 미션 시작${label ? ": " + label : ""}`}
                                        className="group flex flex-1 flex-col rounded-lg p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
                                      >
                                        <span className="text-[11px] font-medium text-[#967B3E]">미션 {index + 1} · {modeLabel}</span>
                                        <h5 className="mb-3 mt-1.5 break-keep text-[15px] font-semibold leading-5 text-[#24323D]">{label ?? `${modeLabel} 학습 미션`}</h5>
                                        <span className="mt-auto inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-md bg-[#243441] px-3 py-2 text-[12px] font-medium text-white transition-colors group-hover:bg-[#354B5B]">
                                          {modeLabel} 미션 시작 <ArrowRight aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                      </Link>
                                    </li>
                                  );
                                })}
                                {missingModes.map((mode, index) => (
                                  <li key={`${mode}-${index}`} className="rounded-lg border border-dashed border-[#EAE5DB] p-3.5 text-[12px] text-muted-foreground">
                                    <p className="font-semibold">{MODE_LABEL[mode]}</p>
                                    <p className="mt-2">{week.speech_act ? "미션 준비 중" : "화행 선정 후 안내"}</p>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ) : (
                            <p className="mt-3 break-keep text-[12.5px] leading-5 text-[#68757F]">{activityCopy(week)}</p>
                          )}
                          {materialsOn && <div className="mt-4 border-t border-[#EAE5DB] pt-3">
                            <Link to={`${weekPath}/note`} className="inline-flex items-center gap-1 rounded text-[13px] text-[#52606A] underline-offset-4 hover:text-[#15202B] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]">이번 주 수업자료 <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
                          </div>}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </main>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseLive;
