import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MISSION_WEEK_NOS } from "@/lib/curriculum/courseModePolicy";

/** 교과목 하나의 계획 미션 수 — 미션 주차 10개 × 주차당 2개. 미준비 미션도 분모에서 빼지 않는다. */
export const PLANNED_MISSIONS_PER_COURSE = MISSION_WEEK_NOS.length * 2;

export interface LearnerProgressLog {
  course_id: string | null;
  mission_id: string;
  mission_completed: boolean | null;
  updated_at: string;
}

export interface CourseProgress {
  /** 이 교과목에서 완료한 미션(시나리오) ID. 주차 판정(pickCurrentWeek)의 입력과 같은 단위다. */
  completedMissionIds: Set<string>;
  lastActivityAt: string;
}

/**
 * 내 수행 기록을 교과목별로 모은다(순수 함수). 교과목 밖에서 수행한 기록(course_id 없음)은 세지 않는다.
 * `lastCourseId`는 마지막으로 활동한 교과목 — 「이어서 하기」가 이 교과목의 지금 할 주차를 가리킨다.
 */
export function summarizeLearnerProgress(logs: LearnerProgressLog[]): {
  byCourse: Map<string, CourseProgress>;
  lastCourseId: string | null;
} {
  const byCourse = new Map<string, CourseProgress>();
  let lastCourseId: string | null = null;
  let lastAt = "";
  for (const log of logs) {
    if (!log.course_id) continue;
    const course = byCourse.get(log.course_id) ?? { completedMissionIds: new Set<string>(), lastActivityAt: log.updated_at };
    if (log.updated_at > course.lastActivityAt) course.lastActivityAt = log.updated_at;
    if (log.mission_completed) course.completedMissionIds.add(log.mission_id);
    byCourse.set(log.course_id, course);
    if (log.updated_at > lastAt) {
      lastAt = log.updated_at;
      lastCourseId = log.course_id;
    }
  }
  return { byCourse, lastCourseId };
}

/** 로그인한 학습자 자신의 수행 기록만 읽는다. 실패하면 진행 표시 없이 목록만 보인다. */
export function useLearnerHomeProgress() {
  return useQuery({
    queryKey: ["learner-home-progress", "own"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user?.id;
      if (!userId) return summarizeLearnerProgress([]);
      const { data, error } = await supabase
        .from("learner_mission_logs")
        .select("course_id, mission_id, mission_completed, updated_at")
        .eq("auth_user_id", userId);
      if (error) throw error;
      return summarizeLearnerProgress((data ?? []) as LearnerProgressLog[]);
    },
    staleTime: 30_000,
  });
}
