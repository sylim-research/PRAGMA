import { CONTENT_REVIEW_STEPS, CONTENT_APPROVAL_POLICY, nextReviewStage, type ReviewInspection, type ReviewStage, type ReviewTarget } from "../../../supabase/functions/_shared/contentReview";

export type ReviewVersion = Pick<ReviewInspection, "contentHash" | "sourceHash">;
export type PreparationRequest = (target: ReviewTarget, action?: string, version?: ReviewVersion) => Promise<ReviewInspection>;
export type PreparationResult = { status: "ready" | "approved" | "held" | "stopped"; message: string; inspection?: ReviewInspection };

/** Each missing stage runs at most once. Never repairs, retries, decides findings, or approves. */
export async function prepareContentReview(target: ReviewTarget, options: {
  request: PreparationRequest;
  stopped: () => boolean;
  onStage?: (stage: ReviewStage) => void;
  onInspection?: (state: ReviewInspection) => void;
}): Promise<PreparationResult> {
  if (options.stopped()) return { status: "stopped", message: "실행 중단" };
  let state = await options.request(target, "inspect");
  if (state.run && !state.run.approved_at && state.run.approval_policy !== CONTENT_APPROVAL_POLICY
    && state.reusableGenerationQuality !== undefined && !state.run.running_stage) {
    state = await options.request(target, "rules", state);
  }
  const version = { contentHash: state.contentHash, sourceHash: state.sourceHash };
  const attempted = new Set<ReviewStage>();
  while (true) {
    options.onInspection?.(state);
    const hold = (message: string): PreparationResult => ({ status: "held", message, inspection: state });
    if (state.contentHash !== version.contentHash || state.sourceHash !== version.sourceHash) {
      return hold("실행 중 콘텐츠가 변경되어 중단했습니다. 새 버전을 확인하고 다시 시작하세요.");
    }
    if (options.stopped()) return { status: "stopped", message: "완료된 결과를 보존하고 중단했습니다.", inspection: state };
    const stage = nextReviewStage(state.run);
    if (stage === "approved") return { status: "approved", message: "이미 교수자 승인된 버전", inspection: state };
    if (state.run?.rules.verdict === "fail") return hold("규칙 오류 · 수정 후 다시 시작하세요.");
    if (stage === "professor") return { status: "ready", message: "OpenAI 검토 완료 · 교수자 판단 대기", inspection: state };
    if (state.run?.running_stage && state.run.lease_until && Date.parse(state.run.lease_until) > Date.now()) {
      return hold("다른 검토가 실행 중입니다. 완료 후 다시 시작하세요.");
    }
    if (stage === "claude" && !state.models.claude) return hold("Claude 독립 검토 모델 설정이 필요합니다. 유료 호출을 시작하지 않았습니다.");
    if (attempted.has(stage)) return hold("검토 단계가 진행되지 않았습니다. 저장 결과를 확인하세요.");
    attempted.add(stage);
    options.onStage?.(stage);
    state = await options.request(target, stage, version);
  }
}

export function reviewStageLabel(stage: ReviewStage) {
  return CONTENT_REVIEW_STEPS.find((step) => step.key === stage)!.label;
}
