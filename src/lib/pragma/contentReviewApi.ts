import { supabase } from "@/integrations/supabase/client";
import type { InstructorExperience, ProfessorFindingDecision, ReviewInspection, ReviewTarget } from "../../../supabase/functions/_shared/contentReview";
import type { WeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";
import type { ReviewVersion } from "./reviewPreparation";
export type ContentReviewApproval = { reviewId: string; contentHash: string; professorNote: string; openaiFailOverride?: string };

export async function contentReviewRequest(target: ReviewTarget, action = "inspect", expectedVersion?: ReviewVersion): Promise<ReviewInspection> {
  const version = expectedVersion ? { contentHash: expectedVersion.contentHash, sourceHash: expectedVersion.sourceHash } : undefined;
  const { data, error } = await supabase.functions.invoke("content-review", { body: { target, action, ...(version ? { expectedVersion: version } : {}) } });
  if (error) {
    let message = "검수 서비스를 사용할 수 없습니다. 관리자 로그인과 content-review Edge·DB 배포 상태를 확인하세요.";
    if (error.context instanceof Response) {
      try { message = (await error.context.json())?.error || message; } catch { /* transport error */ }
    }
    throw new Error(message);
  }
  if (data?.error || !data?.contentHash) throw new Error(data?.error ?? "검수 응답이 올바르지 않습니다.");
  return data as ReviewInspection;
}
export async function approveContentReview(approval: ContentReviewApproval): Promise<void> {
  // New RPC pending generated type refresh; keep the exception local.
  const { error } = await (supabase as any).rpc("approve_content_review", {
    p_review_id: approval.reviewId, p_content_hash: approval.contentHash, p_note: approval.professorNote,
    p_openai_fail_override: approval.openaiFailOverride ?? null,
  });
  if (error) throw new Error(error.message);
}
export async function getApprovedWeeklyMaterial(outlineId: string, weekNo: number): Promise<{
  reviewId: string; contentHash: string; material: WeeklyCourseMaterial;
} | null> {
  // This RPC returns only the approved public material, never instructor notes or AI review results.
  const { data, error } = await (supabase as any).rpc("get_approved_weekly_material", {
    p_outline_id: outlineId, p_week_no: weekNo,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function saveProfessorDecisions(reviewId: string, contentHash: string, decisions: ProfessorFindingDecision[]): Promise<void> {
  const { error } = await (supabase as any).rpc("save_content_review_decisions", {
    p_review_id: reviewId, p_content_hash: contentHash, p_decisions: decisions,
  });
  if (error) throw new Error(error.message);
}

export async function saveInstructorExperience(reviewId: string, contentHash: string, experience: InstructorExperience): Promise<void> {
  const { error } = await (supabase as any).rpc("save_instructor_experience", {
    p_review_id: reviewId, p_content_hash: contentHash, p_experience: experience,
  });
  if (error) throw new Error(error.message);
}
