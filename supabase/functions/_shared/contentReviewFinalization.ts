import { requiresReviewFinalization, reviewHash, type ContentReviewRun, type ReviewResult } from "./contentReview.ts";

/** Prepare once before human decisions; approval must consume this exact artifact. */
export async function prepareReviewFinalization(args: {
  run: ContentReviewRun;
  currentMission: Record<string, any>;
  finalize: () => Promise<Record<string, any>>;
  inspectFinalized: (mission: Record<string, any>) => { snapshot: Record<string, unknown>; rules: ReviewResult };
}) {
  if (!requiresReviewFinalization(args.run)) throw new Error("최종 검수 자료가 필요한 미션이 아닙니다.");
  if (args.run.prepared_finalization) return { prepared_finalization: args.run.prepared_finalization, rules: args.run.rules };
  // Historical finalized artifacts can be inspected without another paid attribution.
  const existing = args.currentMission;
  const prepared = existing.authoring?.stage === "professor_finalized" && existing.authoring?.lineage_status === "complete"
    ? existing : await args.finalize();
  if (prepared?.authoring?.stage !== "professor_finalized" || prepared?.authoring?.lineage_status !== "complete"
    || !/^[0-9a-f]{64}$/.test(prepared?.provenance?.mission_content_hash ?? "")
    || !prepared.hsk_lexical_audit || typeof prepared.hsk_lexical_audit !== "object") {
    throw new Error("최종 검수 자료의 생성이 완료되지 않았습니다.");
  }
  const domain = args.inspectFinalized(prepared);
  if (await reviewHash(domain.snapshot) !== args.run.content_hash) {
    throw new Error("최종 검수 자료가 검토 중인 콘텐츠와 다릅니다. 승인하지 않았습니다.");
  }
  // Preserve structural failures as evidence too; they must block human approval.
  return { prepared_finalization: prepared, rules: domain.rules };
}
