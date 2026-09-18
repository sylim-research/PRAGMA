import { supabase } from "@/integrations/supabase/client";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import {
  aggregateMissionResponses,
  type ClassResponseLogRow,
  type MissionPattern,
} from "@/lib/mission/classResponsePatterns";

export const classResponsePatternKey = (courseId: string, weekNo: number | undefined, missionId: string) =>
  ["class-response-pattern", courseId, weekNo, missionId] as const;

/** 학급 집계에 넣을 학습자인지 판단할 때 함께 읽는 프로필 열. */
export const CLASS_LEARNER_PROFILE_SELECT =
  "profiles!learner_mission_logs_profile_id_fkey(role,consent_class_record_sharing)";

type ProfileGate = { role?: string | null; consent_class_record_sharing?: boolean | null } | null | undefined;

/**
 * 학급 분포·참여 수에는 수업 기록 공유에 동의한 학습자 계정만 센다.
 * 관리자 계정과 동의 이전(NULL)·미동의 계정(개발 중 테스트 계정 포함)은 빠진다.
 */
export function isCountedClassLearner(profile: ProfileGate) {
  return profile?.role === "learner" && profile.consent_class_record_sharing === true;
}

/** 한 미션의 저장된 완료 응답을 익명 분포로 집계한다. */
export async function fetchMissionPattern(missionId: string): Promise<MissionPattern> {
  const [logsResult, missionResult] = await Promise.all([
    supabase.from("learner_mission_logs")
      .select(`mission_id,profile_id,completed_at,context_judgment,${CLASS_LEARNER_PROFILE_SELECT}`)
      .eq("mission_id", missionId),
    supabase.from("scenarios")
      .select("mission_content")
      .eq("scenario_id", missionId)
      .maybeSingle(),
  ]);
  if (logsResult.error) throw new Error(logsResult.error.message);
  if (missionResult.error) throw new Error(missionResult.error.message);
  const mission = normalizeMission(missionResult.data?.mission_content);
  const rows = ((logsResult.data ?? []) as unknown as Array<ClassResponseLogRow & { profiles?: ProfileGate }>)
    .filter((row) => isCountedClassLearner(row.profiles));
  return aggregateMissionResponses(missionId, rows, mission.ok ? mission.data ?? null : null);
}

type CourseLogDb = {
  from: (table: "learner_mission_logs") => {
    select: (columns: string) => Promise<{ data: Array<{ course_id: string | null; profiles?: ProfileGate }> | null; error: { message: string } | null }>;
  };
};

/** 교과목별 집계 대상 응답 수. 학급 분포 탭을 응답이 있는 교과목부터 열 때 쓴다. */
export async function fetchCountedResponsesByCourse(): Promise<Map<string, number>> {
  // course_id는 생성 타입 갱신 전이라 courseOperations와 같은 방식으로 좁혀 읽는다.
  const { data, error } = await (supabase as unknown as CourseLogDb)
    .from("learner_mission_logs")
    .select(`course_id,${CLASS_LEARNER_PROFILE_SELECT}`);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.course_id || !isCountedClassLearner(row.profiles)) continue;
    counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);
  }
  return counts;
}
