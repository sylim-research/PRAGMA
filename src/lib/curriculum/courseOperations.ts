import { supabase } from "@/integrations/supabase/client";
import { parseJudgmentEnvelope } from "@/lib/mission/classResponsePatterns";
import { CLASS_LEARNER_PROFILE_SELECT, isCountedClassLearner } from "@/lib/mission/classResponseFetch";
import type { LearnerCourseWeek } from "./learnerCourse";

export interface CourseOperationLogRow {
  mission_id: string;
  profile_id: string;
  mission_completed: boolean | null;
  completed_at: string | null;
  updated_at: string | null;
  context_judgment: unknown;
  profiles?: { role?: string | null; consent_class_record_sharing?: boolean | null } | null;
}

export interface WeekOperationSummary {
  weekNo: number;
  participants: number;
  completedLearners: number;
  dissents: number;
}

type OperationQueryResult = {
  data: CourseOperationLogRow[] | null;
  error: { message: string } | null;
};

type OperationDb = {
  from: (table: "learner_mission_logs") => {
    select: (columns: string) => {
      eq: (column: "course_id", value: string) => {
        in: (column: "mission_id", values: string[]) => Promise<OperationQueryResult>;
      };
    };
  };
};

// course_id·week_no는 2026-08-29 scope-lock migration에서 추가됐지만 생성 타입은
// 아직 갱신 전이다. 새 컬럼 우회는 이 조회 모듈 하나에만 가둔다.
const operationDb = supabase as unknown as OperationDb;

/** 선택한 교과목의 미션 수행만 읽는다. 같은 미션이 다른 교과목에 재사용돼도 섞이지 않는다. */
export async function fetchCourseOperationLogs(
  courseId: string,
  missionIds: string[],
): Promise<CourseOperationLogRow[]> {
  if (!courseId || missionIds.length === 0) return [];
  const { data, error } = await operationDb
    .from("learner_mission_logs")
    .select(`mission_id,profile_id,mission_completed,completed_at,updated_at,context_judgment,${CLASS_LEARNER_PROFILE_SELECT}`)
    .eq("course_id", courseId)
    .in("mission_id", missionIds);
  if (error) throw new Error(error.message);
  // 학급 분포와 같은 기준 — 수업 기록 공유에 동의한 학습자 계정만 센다.
  return (data ?? []).filter((row) => isCountedClassLearner(row.profiles));
}

const attemptTime = (row: CourseOperationLogRow) => row.completed_at ?? row.updated_at ?? "";
const isCompleted = (row: CourseOperationLogRow) => row.mission_completed === true || Boolean(row.completed_at);

/**
 * 주차 운영용 비채점 집계. 최신 시도만 세며 새 점수·위험도·학습자 판정을 만들지 않는다.
 * completedLearners는 그 주차에 편성된 모든 미션을 완료한 관찰 학습자 수다.
 */
export function summarizeCourseOperations(
  weeks: LearnerCourseWeek[],
  rows: CourseOperationLogRow[],
): Map<number, WeekOperationSummary> {
  const latest = new Map<string, CourseOperationLogRow>();
  for (const row of rows) {
    const key = `${row.profile_id}:${row.mission_id}`;
    const previous = latest.get(key);
    if (!previous || attemptTime(row) >= attemptTime(previous)) latest.set(key, row);
  }

  return new Map(weeks.map((week) => {
    const missionIds = new Set(week.scenarios.map((scenario) => scenario.scenario_id));
    const weekRows = [...latest.values()].filter((row) => missionIds.has(row.mission_id));
    const participants = new Set(weekRows.map((row) => row.profile_id));
    const completedByLearner = new Map<string, Set<string>>();
    let dissents = 0;

    for (const row of weekRows) {
      if (!isCompleted(row)) continue;
      const completed = completedByLearner.get(row.profile_id) ?? new Set<string>();
      completed.add(row.mission_id);
      completedByLearner.set(row.profile_id, completed);
      if (parseJudgmentEnvelope(row.context_judgment).dissent) dissents += 1;
    }

    const completedLearners = missionIds.size === 0
      ? 0
      : [...completedByLearner.values()].filter((completed) =>
          [...missionIds].every((missionId) => completed.has(missionId)),
        ).length;

    return [week.week_no, {
      weekNo: week.week_no,
      participants: participants.size,
      completedLearners,
      dissents,
    }];
  }));
}
