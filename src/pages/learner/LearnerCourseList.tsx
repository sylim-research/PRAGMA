import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { courseModeSummary, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { useLearnerCourse, useLearnerCourses } from "@/lib/curriculum/useLearnerCourse";
import { PLANNED_MISSIONS_PER_COURSE, useLearnerHomeProgress } from "@/lib/curriculum/learnerHomeProgress";
import { pickCurrentWeek } from "@/lib/curriculum/learnerProgress";
import {
  LEVEL,
  SPEECH_ACT_UI,
  type LanguageDirection,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import { COURSE_PRESETS, courseDisplayTitle, THEME_CODES, type ThemeCode } from "@/lib/pragma/scenarioTopics";

// 카드에서만 짧게 표시한다. 생성·검색·편성용 주제 정본은 그대로 둔다.
const COURSE_TOPIC_LABEL: Record<ThemeCode, string> = {
  campus_study: "대학생활",
  international_exchange: "유학·교류",
  relationship_social: "대인관계",
  daily_living: "일상생활",
  career_workplace: "취업·직장",
  commerce_customer: "거래·고객응대",
  digital_content: "콘텐츠·SNS",
};
const COURSE_DIRECTION: Record<LanguageDirection, string> = {
  ko_zh: "한국어 → 중국어",
  zh_ko: "중국어 → 한국어",
};
const LEVEL_ORDER: Record<LearnerLevel, number> = {
  beginner_intermediate: 0,
  intermediate: 1,
  advanced: 2,
};

/**
 * 「이어서 하기」 — 마지막으로 활동한 교과목의 지금 할 주차로 바로 간다. 주차 판정은 pickCurrentWeek
 * (진행 중인 주차 → 아직 시작 안 한 가장 빠른 주차)를 그대로 쓴다. 할 미션이 없으면 그리지 않는다.
 */
function ResumeCard({ courseId, courseTitle, completed }: { courseId: string; courseTitle: string; completed: ReadonlySet<string> }) {
  const { data: course } = useLearnerCourse(courseId);
  const current = course ? pickCurrentWeek(course.weeks, completed) : null;
  if (!current) return null;
  const { week, assigned, doneCount } = current;
  const weekLabel = week.speech_act ? `${SPEECH_ACT_UI[week.speech_act]} 화행` : week.title;
  return (
    <Link
      to={`/learner/course/${courseId}/week/${week.week_no}`}
      className="group mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#15202B] bg-[#FFFBEA] px-5 py-4 transition-colors hover:bg-[#FFF6D1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 sm:px-6"
    >
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-[#786022]">이어서 하기</p>
        <p className="mt-0.5 break-keep text-[17px] font-bold leading-7 text-[#15202B]">
          {courseTitle} · {week.week_no}주차 {weekLabel}
        </p>
        <p className="text-[13px] font-medium text-[#46515A]">이번 주차 미션 {doneCount}/{assigned.length} 완료</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#15202B] px-4 py-2 text-[13.5px] font-bold text-white">
        이어서 하기
        <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </span>
    </Link>
  );
}

const LearnerCourseList = () => {
  const { data: courses = [], error, isPending } = useLearnerCourses();
  const { data: progress } = useLearnerHomeProgress();
  const resumeCourse = progress?.lastCourseId ? courses.find((course) => course.id === progress.lastCourseId) : undefined;
  // 목록의 표시 순서만 변경하고, 공유 쿼리 데이터와 실제 편성 순서는 보존한다.
  const sortedCourses = [...courses].sort((left, right) =>
    (LEVEL_ORDER[left.level as LearnerLevel] ?? 99) - (LEVEL_ORDER[right.level as LearnerLevel] ?? 99),
  );

  return (
    <LearnerJourneyShell nav>
      <main className="pb-[4.5rem] pt-1 md:pb-8" aria-labelledby="course-list-title">
        <section className="mb-6">
          <h1 id="course-list-title" className="border-l-4 border-[#FAD338] pl-3 text-[26px] font-bold leading-9 tracking-[-0.04em] text-[#15202B]">
            내 수업
          </h1>
        </section>

        {progress && resumeCourse && (
          <ResumeCard
            courseId={resumeCourse.id}
            courseTitle={courseDisplayTitle(resumeCourse)}
            completed={progress.byCourse.get(resumeCourse.id)?.completedMissionIds ?? new Set()}
          />
        )}

        {isPending ? (
          <p className="mt-8 text-[13px] text-muted-foreground">교과목을 불러오는 중…</p>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error instanceof Error ? error.message : "교과목을 불러오지 못했습니다."}
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#EAE4D2] bg-white px-6 py-10 text-center text-[13px] text-muted-foreground">
            아직 게시된 교과목이 없습니다.
          </div>
        ) : (
          <ul className="space-y-4" aria-label="교과목 목록">
            {sortedCourses.map((course) => {
              const preset = COURSE_PRESETS.find((item) => item.outline_id === course.id);
              const themeCodes = course.composition_theme_codes?.length ? course.composition_theme_codes : THEME_CODES;
              const themePriority = [...(preset?.included_themes ?? []), ...THEME_CODES];
              const themes = [...new Set(themePriority)]
                .filter((code) => themeCodes.includes(code))
                .map((code) => COURSE_TOPIC_LABEL[code]);
              const topicSummary = `${themes.slice(0, 4).join(", ")}${themes.length > 4 ? " 등" : ""}`;
              const modeSummary = courseModeSummary({
                courseMode: course.course_mode as CourseMode,
                interpretingWeekCount: course.target_interpreting_week_count,
              });
              const courseProgress = progress?.byCourse.get(course.id);
              const completedMissions = Math.min(courseProgress?.completedMissionIds.size ?? 0, PLANNED_MISSIONS_PER_COURSE);
              const progressPercent = Math.round((completedMissions / PLANNED_MISSIONS_PER_COURSE) * 100);
              const titleId = `course-title-${course.id}`;
              const levelId = `course-level-${course.id}`;
              const detailsId = `course-details-${course.id}`;
              return (
                <li key={course.id}>
                  <Link
                    to={`/learner/course/${course.id}`}
                    aria-labelledby={titleId}
                    aria-describedby={`${levelId} ${detailsId}`}
                    className="group grid gap-3 rounded-2xl border border-[#E5E1D6] bg-white px-4 py-4 text-left shadow-[0_2px_8px_rgba(21,32,43,0.025)] transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#C7BB96] hover:bg-[#FFFDF7] hover:shadow-[0_6px_20px_rgba(21,32,43,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span id={levelId} className="shrink-0 rounded-md border border-[#DED4B9] bg-[#F1EBD9] px-2.5 py-1.5 text-[14px] font-bold leading-5 text-[#69562D]">
                          <span className="sr-only">수준: </span>
                          {LEVEL[course.level as LearnerLevel] ?? course.level}
                        </span>
                        <h2 id={titleId} className="break-keep text-[18px] font-bold leading-7 tracking-[-0.035em] text-[#15202B] sm:whitespace-nowrap sm:text-[20px]">
                          {courseDisplayTitle(course)}
                        </h2>
                      </div>
                      <dl id={detailsId} className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-[13px] leading-5 text-[#5C6A7A]">
                        <div className="flex items-baseline gap-1.5">
                          <dt className="sr-only">언어방향</dt>
                          <dd className="font-medium text-[#15202B]">{COURSE_DIRECTION[course.language_direction as LanguageDirection] ?? course.language_direction}</dd>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <dt className="sr-only">수행모드</dt>
                          <dd className="font-medium text-[#15202B]">
                            <span aria-hidden="true" className="mr-3 font-normal text-[#C7C2B4]">|</span>
                            {modeSummary}
                          </dd>
                        </div>
                        <div className="flex w-full items-baseline gap-2">
                          <dt className="shrink-0 font-semibold text-[#786022]">주제</dt>
                          <dd className="break-keep">{topicSummary}</dd>
                        </div>
                        <div className="flex w-full items-center gap-3">
                          <dt className="shrink-0 font-semibold text-[#786022]">진행</dt>
                          <dd className="flex min-w-0 flex-1 items-center gap-3">
                            {courseProgress ? (
                              <>
                                <span
                                  className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-[#EFEBDD]"
                                  role="progressbar"
                                  aria-label={`${courseDisplayTitle(course)} 진행`}
                                  aria-valuemin={0}
                                  aria-valuemax={PLANNED_MISSIONS_PER_COURSE}
                                  aria-valuenow={completedMissions}
                                >
                                  <span className="block h-full rounded-full bg-[#FAD338]" style={{ width: `${progressPercent}%` }} />
                                </span>
                                <span className="shrink-0 font-medium text-[#15202B]">미션 {completedMissions}/{PLANNED_MISSIONS_PER_COURSE} 완료</span>
                              </>
                            ) : (
                              <span className="font-medium text-[#1F3A5F]">아직 시작 전</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="flex items-center justify-end border-t border-[#EFECE3] pt-2 md:border-l md:border-t-0 md:py-3 md:pl-6">
                      <span className="inline-flex min-h-7 shrink-0 items-center gap-2 text-[12px] font-semibold text-[#15202B] sm:text-[13px]">
                        수업 들어가기
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F4EC] transition-colors duration-200 group-hover:bg-[#FAD338] group-focus-visible:bg-[#FAD338] motion-reduce:transition-none">
                          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </LearnerJourneyShell>
  );
};

export default LearnerCourseList;
