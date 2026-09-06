import type { LearnerCourse, LearnerCourseSource, LearnerCourseWeek } from './learnerCourse';
import type { ComposerCore } from './composer';
import type { CurriculumWeekRow } from './types';
import type { ChannelUI, Domain, PdrBurden, PdrDistance, PdrPower, SpeechActUI } from '@/lib/pragma/enums';
import { isReviewedMission } from '@/lib/curriculum/composerEligibility';
import { expectedCoreModeForWeek, type CourseMode } from './courseModePolicy';
import { isReinforcementWeek } from './weekGuidance';

export function assembleLearnerCourse({
  outline,
  weeks,
  assignments,
  cores,
}: LearnerCourseSource): LearnerCourse {
  const modePolicy = {
    courseMode: outline.course_mode as CourseMode,
    interpretingWeekCount: outline.target_interpreting_week_count,
  };
  const coreById = new Map<string, ComposerCore>();
  for (const core of cores) coreById.set(core.scenario_id, core);

  // week_no → 배정(순서 유지)
  const byWeek = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    const items = byWeek.get(assignment.week_no) ?? [];
    items.push(assignment);
    byWeek.set(assignment.week_no, items);
  }

  const learnerWeeks: LearnerCourseWeek[] = weeks.map(
    (week: CurriculumWeekRow) => ({
      week_no: week.week_no,
      title: week.title ?? `${week.week_no}주차`,
      type: week.type,
      can_do: week.can_do ?? [],
      speech_act: (week.speech_act as SpeechActUI | null) ?? null,
      channel: (week.channel as ChannelUI | null) ?? null,
      pdr_power: (week.pdr_power as PdrPower | null) ?? null,
      pdr_distance: (week.pdr_distance as PdrDistance | null) ?? null,
      pdr_imposition: (week.pdr_imposition as PdrBurden | null) ?? null,
      review_released: week.review_released ?? false,
      competency_focus: week.competency_focus ?? null,
      domain: (week.domain as Domain | null) ?? null,
      scenarios: (byWeek.get(week.week_no) ?? []).flatMap((assignment) => {
        const core = coreById.get(assignment.scenario_id);
        if (!core || !isReviewedMission(core)) return [];
        // 과거 13주 편성은 보존한다. 교강사가 한 화행을 정하기 전에는 실행 대상으로 삼지 않는다.
        if (isReinforcementWeek(week) && (
          !week.speech_act ||
          core.speech_act !== week.speech_act
        )) return [];
        // 과목 정책 변경 전 배정은 DB에 보존하되, 다른 수행모드로 실행하지 않는다.
        const expectedMode = expectedCoreModeForWeek(modePolicy, week.week_no);
        if (expectedMode && core.mode !== expectedMode) return [];
        return [
          {
            assignment_id: assignment.id ?? "",
            scenario_id: assignment.scenario_id,
            situation_ko: core.situation_ko,
            source_text: core.source_text_ko,
            speech_act: core.speech_act,
            mission_status: core.mission_status,
            target_feature: core.target_feature,
            mode: core.mode,
            runnable: true,
          },
        ];
      }),
    }),
  );

  return { outline, weeks: learnerWeeks };
}
