import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContentReviewPanel } from "./ContentReviewPanel";
import type { ContentReviewApproval } from "@/lib/pragma/contentReviewApi";
import type { LearnerMissionRuntime } from "@/lib/pragma/missionV6";
import type {
  ProfessorIssueOverride,
  ProfessorMissionEdits,
} from "@/lib/pragma/promoteMission";

const ITEM_LABELS = [
  "첫인상 판단",
  "맥락 대비 판단",
  "판단하고 고쳐보기",
  "이유 찾기",
  "여러 초안 비교",
];

export function ProfessorMissionWorkbench({
  scenarioId,
  mission,
  busy,
  onSave,
  onReview,
  approvalHref,
  traceHash,
}: {
  scenarioId: string;
  mission: LearnerMissionRuntime;
  busy: boolean;
  onSave: (edits: ProfessorMissionEdits) => Promise<void>;
  onReview: (overrides: ProfessorIssueOverride[], approval: ContentReviewApproval) => Promise<void>;
  /**
   * 승인이 이 화면의 일이 아닐 때 넘긴다. 점검·승인 패널 대신 교수자 최종 승인로 가는
   * 링크를 보여 준다 — 미션을 만드는 자리와 승인하는 자리를 가른다.
   */
  approvalHref?: string;
  /** 미션 콘텐츠 해시 전체. 승인 흐름의 세부 추적 정보에 그대로 남긴다. */
  traceHash?: string | null;
}) {
  const initialItems = useMemo(
    () => mission.mpj_items.map((item) => JSON.stringify(item, null, 2)),
    [mission],
  );
  const initialReferences = useMemo(
    () => JSON.stringify(mission.production_task.reference_alternatives, null, 2),
    [mission],
  );
  const [itemTexts, setItemTexts] = useState(initialItems);
  const [referenceText, setReferenceText] = useState(initialReferences);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rationales, setRationales] = useState<Record<number, string>>({});
  const failFindings = (mission.quality_check?.findings ?? [])
    .map((finding, issueIndex) => ({ finding, issueIndex }))
    .filter(({ finding }) => finding.severity === "fail");

  const save = async () => {
    try {
      const itemBlocks = itemTexts.flatMap((text, itemIndex) => {
        if (text === initialItems[itemIndex]) return [];
        const item = JSON.parse(text) as unknown;
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new Error(`${ITEM_LABELS[itemIndex] ?? `${itemIndex + 1}번 문항`} JSON은 객체여야 합니다.`);
        }
        return [{ itemIndex, item: item as Record<string, unknown> }];
      });
      const referencesChanged = referenceText !== initialReferences;
      const references = referencesChanged ? JSON.parse(referenceText) as unknown : undefined;
      if (referencesChanged && !Array.isArray(references)) {
        throw new Error("DCT 참고안 JSON은 배열이어야 합니다.");
      }
      if (itemBlocks.length === 0 && !referencesChanged) {
        throw new Error("변경한 문항이나 DCT 참고안이 없습니다.");
      }
      setParseError(null);
      await onSave({
        itemBlocks,
        ...(referencesChanged ? { referenceAlternatives: references as unknown[] } : {}),
      });
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
    }
  };

  const overrides: ProfessorIssueOverride[] = failFindings.map(({ finding, issueIndex }) => ({
    issue_index: issueIndex,
    code: finding.code,
    where: finding.where,
    rationale_ko: rationales[issueIndex]?.trim() ?? "",
  }));
  const canReview = overrides.every((override) => override.rationale_ko.length >= 10);
  const dirty = referenceText !== initialReferences || itemTexts.some((text, index) => text !== initialItems[index]);

  const failFindingsBlock = failFindings.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="font-semibold text-red-900">남은 AI 결함 {failFindings.length}건</p>
          {failFindings.map(({ finding, issueIndex }) => (
            <label key={`${finding.code}-${issueIndex}`} className="block">
              <span className="block text-[12px] text-red-900">
                {finding.code}{finding.where ? ` · ${finding.where}` : ""} — {finding.note_ko}
              </span>
              <Textarea
                className="mt-1 min-h-16 bg-white text-[12px]"
                value={rationales[issueIndex] ?? ""}
                onChange={(event) => setRationales((current) => ({
                  ...current,
                  [issueIndex]: event.target.value,
                }))}
                placeholder="수정하지 않고 승인한다면 교수자 판단 근거를 10자 이상 기록하세요. 수정할 경우 먼저 아래 수정본을 저장해 critic을 다시 실행하세요."
              />
            </label>
          ))}
        </div>
  );

  const editor = (
      <details className="mt-3 rounded-lg border border-[#E3E6E7] bg-[#FAFBFB] p-3">
        <summary className="cursor-pointer font-medium text-[#34444D]">
          {approvalHref ? "문항 block 직접 수정" : "원본 수정하기 · 문항 block 직접 수정"}
        </summary>
        {!approvalHref && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            수정본은 구조검사·AI 재점검을 거쳐 새 버전으로 저장됩니다.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {itemTexts.map((text, itemIndex) => (
            <label key={itemIndex} className="block">
              <span className="mb-1 block font-medium">
                MJT {itemIndex + 1} · {ITEM_LABELS[itemIndex] ?? "문항"}
              </span>
              <Textarea
                className="min-h-52 font-mono text-[11px] leading-4"
                value={text}
                onChange={(event) => setItemTexts((current) =>
                  current.map((value, index) => index === itemIndex ? event.target.value : value))}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block font-medium">DCT 참고안</span>
            <Textarea
              className="min-h-28 font-mono text-[11px] leading-4"
              value={referenceText}
              onChange={(event) => setReferenceText(event.target.value)}
            />
          </label>
          {parseError && <p className="text-red-700">{parseError}</p>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void save()}>
            수정본 구조검사·AI 재점검 후 저장
          </Button>
        </div>
      </details>
  );

  // 미션을 만드는 자리(approvalHref)는 기존 배치 그대로 둔다.
  if (approvalHref) {
    return (
      <section className="space-y-1 border-t border-[#ECE8DE] pt-3 text-[12px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-[14px] font-bold text-[#233542]">① 교수자 감수</h4>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              학생에게 제시할 화면과 참고 판정을 확인하고, 수정·유지·보류를 판단합니다.
            </p>
          </div>
        </div>
        {failFindingsBlock}
        {editor}
        <div className="mt-4 rounded-xl border border-[#D8D3C4] bg-[#FBFAF6] px-4 py-3 text-[13.5px]">
          <p className="text-[#3F4E57]">
            이 화면은 미션을 만들고 고치는 자리입니다. 다음 단계는 자동 품질 점검·AI 검토이고,
            그 뒤 교수자가 콘텐츠를 감수해 최종 승인합니다.
          </p>
          <Link to={approvalHref} className="mt-2 inline-block font-semibold text-[#15202B] underline underline-offset-4">
            품질 점검 화면에서 이 미션 열기 →
          </Link>
        </div>
      </section>
    );
  }

  // 교수자 최종 승인: ① 내용 확인 → ② 판정 → ③ 승인을 한 흐름으로 두고, 원본 수정은 흐름 아래 접어 둔다.
  // 작업대 상자 안에 놓이므로 바깥 상자·중복 머리말 없이 ①②③ 흐름만 둔다.
  return (
    <section aria-label="교수자 감수·최종 승인" className="space-y-3 text-[12px]">
      <ContentReviewPanel experiential framed={false} target={{ kind: "mission", targetId: scenarioId }}
        refreshKey={mission.provenance?.mission_content_hash ?? "draft"}
        approvalDisabled={busy || !canReview || dirty}
        missionContentHash={traceHash ?? mission.provenance?.mission_content_hash}
        decisionSlot={failFindingsBlock || undefined}
        onApprove={(approval) => onReview(overrides, approval)} />
      {editor}
    </section>
  );
}

export default ProfessorMissionWorkbench;
