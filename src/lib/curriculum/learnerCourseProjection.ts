import type { LearnerCourse, LearnerCourseSource, LearnerCourseWeek } from './learnerCourse';
import type { ComposerCore } from './composer';
import type { CurriculumWeekRow } from './types';
import type { ChannelUI, Domain, PdrBurden, PdrDistance, PdrPower, SpeechActUI } from '@/lib/pragma/enums';
import { isReviewedMission } from '@/lib/curriculum/composerEligibility';
import { expectedMissionModesForWeek, remainingMissionModes, type CourseMode } from './courseModePolicy';

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
    (week: CurriculumWeekRow) => {
      const expectedModes = expectedMissionModesForWeek(modePolicy, week.week_no);
      const reviewed = (byWeek.get(week.week_no) ?? []).filter((assignment) => {
        const core = coreById.get(assignment.scenario_id);
        return core && isReviewedMission(core);
      });
      const modesValid = remainingMissionModes(expectedModes, reviewed.map((item) => coreById.get(item.scenario_id)!.mode)) !== null;
      // 이전 편성은 보존하되, 새 유형의 모드 정원을 초과한 주차는 임의로 한 미션을 골라 노출하지 않는다.
      const visible = modesValid && week.type === "regular" && week.speech_act ? reviewed : [];
      visible.sort((left, right) => expectedModes.indexOf(coreById.get(left.scenario_id)!.mode)
        - expectedModes.indexOf(coreById.get(right.scenario_id)!.mode));
      return {
      week_no: week.week_no,
      expected_mission_modes: expectedModes,
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
      scenarios: visible.flatMap((assignment) => {
        const core = coreById.get(assignment.scenario_id);
        if (!core || !isReviewedMission(core)) return [];
        // 과거 13주 편성은 보존한다. 교강사가 한 화행을 정하기 전에는 실행 대상으로 삼지 않는다.
        if (core.speech_act !== week.speech_act || core.learner_level !== outline.level || core.direction !== outline.language_direction) return [];
        return [
          {
            assignment_id: assignment.id ?? "",
            scenario_id: assignment.scenario_id,
            situation_ko: core.situation_ko,
            source_text: core.source_text_ko,
            context: core.opening_context,
            domain: core.domain,
            speech_act: core.speech_act,
            mission_status: core.mission_status,
            target_feature: core.target_feature,
            mode: core.mode,
            runnable: true,
          },
        ];
      }),
    };
    },
  );

  return { outline, weeks: learnerWeeks };
}
