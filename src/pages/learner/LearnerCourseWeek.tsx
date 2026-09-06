import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { ROLE_LABEL, weekRole } from "@/lib/curriculum/template";
import { CENTRAL_QUESTION_GUIDANCE, isReinforcementWeek, REINFORCEMENT_DESCRIPTION, weekActivityLabel, weekCentralQuestion } from "@/lib/curriculum/weekGuidance";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import { MODE_LABEL, SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import { courseDisplayTitle } from "@/lib/pragma/scenarioTopics";
import { listCompletedMissionIds } from "@/lib/mission/missionLog";
import { hasIntroArc } from "@/lib/mission/mockIntroArc";
import { missionModesSummary, remainingMissionModes } from "@/lib/curriculum/courseModePolicy";

function specialWeekCopy(weekNo: number): string {
  const role = weekRole(weekNo);
  if (role === "metapragmatic") {
    return "앞서 완료한 미션의 표현 선택과 수정 근거를 수업에서 다시 검토합니다.";
  }
  if (role === "contextualization") {
    return REINFORCEMENT_DESCRIPTION;
  }
  if (role === "assessment") {
    return "교수자 안내에 따라 지금까지의 화용 판단과 산출을 통합해 점검합니다.";
  }
  return "교수자 안내에 따라 앞선 학습 기록을 연결하고 정리합니다.";
}

function emptyWeekCopy(weekNo: number, isSpeechActWeek: boolean): string {
  if (isSpeechActWeek) {
    return "이번 주의 학습 미션을 준비하고 있습니다. 교수자가 편성을 완료하면 이곳에서 시작할 수 있습니다.";
  }
  const role = weekRole(weekNo);
  if (role === "contextualization") {
    return "교강사가 보완할 화행을 선정하고 있습니다. 편성 후 같은 화행의 새 상황 미션 두 개를 이곳에서 수행합니다.";
  }
  return `${specialWeekCopy(weekNo)} 교수자 수업 안내에 따라 진행합니다.`;
}

const LearnerCourseWeek = () => {
  const { courseId, weekNo: weekNoParam } = useParams<{
    courseId: string;
    weekNo: string;
  }>();
  const weekNo = Number(weekNoParam);
  const { data: course = null, error, isPending } = useLearnerCourse(courseId);
  const week = Number.isInteger(weekNo)
    ? course?.weeks.find((item) => item.week_no === weekNo) ?? null
    : null;
  const missionIds = useMemo(
    () => week?.scenarios.map((scenario) => scenario.scenario_id) ?? [],
    [week],
  );
  const {
    data: completedIds = [],
    isError: progressFailed,
    isPending: progressPending,
  } = useQuery({
    queryKey: ["learner-course-week-progress", courseId, weekNo, missionIds],
    queryFn: () => listCompletedMissionIds(missionIds),
    enabled: missionIds.length > 0,
  });
  const completed = useMemo(() => new Set(completedIds), [completedIds]);
  const coursePath = courseId ? `/learner/course/${courseId}` : "/learner/course";

  if (isPending) {
    return (
      <LearnerJourneyShell>
        <p className="mt-6 text-[13px] text-muted-foreground">주차 계획을 불러오는 중…</p>
      </LearnerJourneyShell>
    );
  }

  if (error || !course || !week || !courseId) {
    return (
      <LearnerJourneyShell>
        <div className="mt-6 rounded-xl border border-[#EAE4D2] bg-white p-5">
          <p className="text-[13px] text-muted-foreground">
            {error instanceof Error ? error.message : "이 주차 계획을 찾을 수 없습니다."}
          </p>
          <Link to="/learner/course" className="mt-3 inline-block text-[13px] font-bold">
            ← 교과목 선택으로 돌아가기
          </Link>
        </div>
      </LearnerJourneyShell>
    );
  }

  const roleLabel = ROLE_LABEL[weekRole(week.week_no)];
  const reinforcement = isReinforcementWeek(week);
  const speechActLabel = weekActivityLabel(week);
  const centralQuestion = weekCentralQuestion(week);
  const expectedModes = week.expected_mission_modes ?? [];
  const remainingModes = remainingMissionModes(expectedModes, week.scenarios.map((scenario) => scenario.mode));
  const goal = week.can_do[0] ?? null;
  const introAvailable = week.scenarios.some(
    (scenario) => scenario.runnable && hasIntroArc(scenario.target_feature),
  );

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">{courseDisplayTitle(course.outline)}</span>}
    >
      <div className="pb-24">
        <Link to={coursePath} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
          ← 15주 계획으로 돌아가기
        </Link>

        <section className="mt-4 rounded-xl bg-[#15202B] px-5 py-5 text-white">
          <div className="text-[11px] font-bold text-[#FAD338]">
            {week.week_no}주차 · {roleLabel}
          </div>
          <h1 className="mt-1 text-[22px] font-black">{speechActLabel}</h1>
          {reinforcement && <p className="mt-2 text-[13px] text-[#FAD338]">{week.speech_act ? `선택 화행 · ${SPEECH_ACT_UI[week.speech_act as SpeechActUI]}` : "화행 선정 예정"}</p>}
          {goal && <p className="mt-1 text-[13px] text-[#B9C4CE]">{goal}</p>}
          {(!week.speech_act || reinforcement) && (
            <p className="mt-3 text-[12.5px] leading-5 text-[#B9C4CE]">{specialWeekCopy(week.week_no)}</p>
          )}
        </section>

        {centralQuestion && <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-[#FAF8F2] p-4">
          <h2 className="text-[12px] font-bold text-[#7A5E00]">중심 질문</h2>
          <p className="mt-1 text-[14px] font-semibold leading-6">{centralQuestion}</p>
          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{CENTRAL_QUESTION_GUIDANCE}</p>
        </section>}

        <div className="mt-4 flex flex-wrap gap-2">
          {introAvailable && (
            <Button asChild className="bg-[#15202B] text-white hover:bg-[#22303C]">
              <Link to={`${coursePath}/week/${week.week_no}/intro`}>먼저 배우기 →</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`${coursePath}/week/${week.week_no}/note`}>강의 유인물 →</Link>
          </Button>
        </div>

        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-black text-[#15202B]">
              {week.speech_act ? "이번 주 학습 미션 2개" : "이번 주 학습 활동"}
            </h2>
            {missionIds.length > 0 && (
              <span className="text-[12px] text-muted-foreground">
                {progressFailed
                  ? "진행 상태 확인 필요"
                  : progressPending
                    ? "진행 상태 확인 중…"
                    : `${completed.size}/${expectedModes.length || missionIds.length} 완료`}
              </span>
            )}
          </div>

          {expectedModes.length > 0 && <p className="mt-2 text-[12px] text-muted-foreground">
            {missionModesSummary(expectedModes)}
            {remainingModes?.length ? ` · ${missionModesSummary(remainingModes)} 편성 준비 중` : ""}
          </p>}
          {week.scenarios.length === 0 ? (
            <div className="mt-3 rounded-xl border border-[#EAE4D2] bg-[#FAF8F2] p-5 text-[13px] leading-6 text-muted-foreground">
              {emptyWeekCopy(week.week_no, Boolean(week.speech_act))}
            </div>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {week.scenarios.map((scenario, index) => {
                const done = completed.has(scenario.scenario_id);
                const setLabel = week.speech_act
                  ? `미션 ${index + 1}`
                  : `활동 ${index + 1}`;
                const practicePath = `/learner/practice/${scenario.scenario_id}?courseId=${encodeURIComponent(courseId)}&weekNo=${week.week_no}&assignmentId=${encodeURIComponent(scenario.assignment_id ?? "")}`;
                return (
                  <li key={scenario.scenario_id} className="flex flex-col rounded-xl border border-[#EAE4D2] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-black text-[#B8860B]">{setLabel}</span>
                      <span className={done ? "text-[11.5px] font-bold text-[#2E6F63]" : "text-[11.5px] text-muted-foreground"}>
                        {done ? "완료" : "시작 전"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-5 text-[#15202B]">
                      {missionSituationSummary(scenario.situation_ko)}
                    </p>
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      {scenario.mode === "stt_interpreting"
                        ? MODE_LABEL.stt_interpreting
                        : MODE_LABEL.translation}
                      {" · 표현 판단 5개 + 직접 산출 1개"}
                    </p>
                    <Button asChild variant={done ? "outline" : "default"} className="mt-4 w-full">
                      <Link to={practicePath}>{done ? "다시 하기 →" : `${setLabel} 시작하기 →`}</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {week.speech_act && week.scenarios.length === 1 && (
            <div className="mt-3 rounded-lg border border-dashed border-[#E4DED0] bg-[#FAF8F2] px-4 py-3 text-[12px] text-muted-foreground">
              두 번째 학습 미션을 준비하고 있습니다.
            </div>
          )}
        </section>
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseWeek;
