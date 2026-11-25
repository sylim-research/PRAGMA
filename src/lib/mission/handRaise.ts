// 학습자 「손들기」(2026-11-25 연구자 승인 UI 브리프).
//
// MJT 해설이나 실시간 AI 피드백을 본 뒤, 수업에서 같이 토론하고 싶은 점을 이유와 함께 남긴다.
// - 이유는 10자 이상 필수: 이유 없는 표시는 교수자도 해석할 수 없고, 학습자도 토론 시간에 기억하지 못한다.
// - 제출 뒤에는 고치거나 지우지 않는다: 처음 든 의문을 그대로 남긴다(스스로 검열하지 않게).
// - 교수자 화면에는 익명으로 보인다. 학급 분포와 같이 수업 기록 공유에 동의한 학습자만 센다.

import { supabase } from "@/integrations/supabase/client";
import { isCountedClassLearner } from "@/lib/mission/classResponseFetch";

export const HAND_RAISE_MIN_LENGTH = 10;
export const HAND_RAISE_MAX_LENGTH = 1000;

/** mjt1~5 = 판단 문항의 저장 번호(학습자 제시 순서가 아님), dct_feedback_1·2 = 실시간 AI 피드백 회차. */
export type HandRaiseTarget = `mjt${1 | 2 | 3 | 4 | 5}` | "dct_feedback_1" | "dct_feedback_2";

export function handRaiseReasonIssue(reason: string): string | null {
  const length = reason.trim().length;
  if (length < HAND_RAISE_MIN_LENGTH) return `${HAND_RAISE_MIN_LENGTH}자 이상 적어 주세요.`;
  if (length > HAND_RAISE_MAX_LENGTH) return `${HAND_RAISE_MAX_LENGTH}자까지 적을 수 있어요.`;
  return null;
}

export interface HandRaiseInput {
  missionId: string;
  attemptId: string;
  courseId: string | null;
  target: HandRaiseTarget;
  reason: string;
}

export type HandRaiseResult = { ok: true } | { ok: false; message: string };

export async function submitHandRaise(input: HandRaiseInput): Promise<HandRaiseResult> {
  const issue = handRaiseReasonIssue(input.reason);
  if (issue) return { ok: false, message: issue };
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return { ok: false, message: "로그인한 뒤에 손들 수 있어요." };
  const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", authUserId).maybeSingle();
  const { error } = await supabase.from("learner_hand_raises").insert({
    auth_user_id: authUserId,
    profile_id: profile?.id ?? null,
    course_id: input.courseId && /^[0-9a-f-]{36}$/i.test(input.courseId) ? input.courseId : null,
    mission_id: input.missionId,
    attempt_id: input.attemptId,
    target: input.target,
    reason: input.reason.trim(),
  });
  // 같은 수행·같은 문항의 중복 제출은 이미 남은 것으로 본다.
  if (error && error.code !== "23505") return { ok: false, message: "저장하지 못했어요. 다시 시도해 주세요." };
  return { ok: true };
}

export interface HandRaiseView {
  target: HandRaiseTarget;
  reason: string;
  createdAt: string;
}

/** 교수자 토론 화면용. 이름 없이 문항과 이유만 돌려준다. */
export async function fetchHandRaises(missionId: string, courseId: string | null): Promise<HandRaiseView[]> {
  let query = supabase
    .from("learner_hand_raises")
    .select("target,reason,created_at,profiles!learner_hand_raises_profile_id_fkey(role,consent_class_record_sharing)")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true });
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{ target: HandRaiseTarget; reason: string; created_at: string; profiles?: Parameters<typeof isCountedClassLearner>[0] }>)
    .filter((row) => isCountedClassLearner(row.profiles))
    .map((row) => ({ target: row.target, reason: row.reason, createdAt: row.created_at }));
}

/** 표시 이름: 판단 문항은 학습자가 본 순서 이름으로, 피드백은 회차로. */
export function handRaiseTargetLabel(target: HandRaiseTarget, presentationOrder: readonly number[]): string {
  if (target === "dct_feedback_1") return "통번역 과제 · 1차 AI 피드백";
  if (target === "dct_feedback_2") return "통번역 과제 · 2차 AI 피드백";
  const itemId = Number(target.slice(3));
  const position = presentationOrder.indexOf(itemId);
  return `판단 ${position >= 0 ? position + 1 : itemId}`;
}
