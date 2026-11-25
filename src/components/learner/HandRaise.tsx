import { useState } from "react";
import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  HAND_RAISE_MAX_LENGTH,
  HAND_RAISE_MIN_LENGTH,
  handRaiseReasonIssue,
  submitHandRaise,
  type HandRaiseInput,
} from "@/lib/mission/handRaise";

type Props = Omit<HandRaiseInput, "reason"> & {
  /** 시연 화면: 버튼과 입력은 보이되 저장하지 않는다. */
  demo?: boolean;
};

const PLACEHOLDER = "예: 친한 조원 사이라면 ‘吧’로 끝내도 괜찮을 것 같은데, 왜 ‘다소 부적절’인지 모르겠어요.";

/**
 * 손들기(2026-11-25 승인 UI 브리프). 해설·피드백을 본 뒤에만 그려진다.
 * 이유는 10자 이상 필수, 익명 표시, 제출 뒤에는 고치거나 지우지 않는다.
 */
export function HandRaise({ demo = false, ...input }: Props) {
  const [stage, setStage] = useState<"idle" | "open" | "saving" | "done">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const length = reason.trim().length;
  const issue = handRaiseReasonIssue(reason);

  const submit = async () => {
    if (issue) { setError(issue); return; }
    if (demo) { setStage("done"); return; }
    setStage("saving");
    setError(null);
    const result = await submitHandRaise({ ...input, reason });
    if (result.ok) setStage("done");
    else { setStage("open"); setError("message" in result ? result.message : "저장하지 못했어요. 다시 시도해 주세요."); }
  };

  if (stage === "done") {
    return (
      <section aria-label="손들기" className="mt-3 rounded-xl border border-[#E6D49A] bg-[#FFFCEB] px-4 py-3">
        <p className="flex items-center gap-1.5 text-[14px] font-bold text-[#5F4A12]">
          <Hand aria-hidden className="h-4 w-4" />손 들었어요! 수업 시간에 같이 봐요.
        </p>
        <p className="mt-1 break-keep text-[13.5px] leading-6 text-[#3E4A57]">
          <span className="text-[#6D7788]">내가 쓴 이유: </span>“{reason.trim()}”
        </p>
        {demo && <p className="mt-1 text-[11.5px] text-[#6D7788]">시연 화면에서는 저장하지 않습니다.</p>}
      </section>
    );
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStage("open")}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-[#E6D49A] bg-[#FFFCEB] px-4 py-3 text-left hover:bg-[#FFF7D6]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4D44E] text-[#15202B]">
          <Hand aria-hidden className="h-[18px] w-[18px]" />
        </span>
        <span>
          <span className="block text-[14.5px] font-bold text-[#15202B]">손들기</span>
          <span className="block text-[13px] text-[#5A6673]">수업에서 같이 토론해 봐요!</span>
        </span>
      </button>
    );
  }

  return (
    <section aria-label="손들기" className="mt-3 rounded-xl border border-[#E6D49A] bg-[#FFFCEB] px-4 py-3">
      <label htmlFor={`hand-raise-${input.target}`} className="flex items-center gap-1.5 text-[14px] font-bold text-[#15202B]">
        <Hand aria-hidden className="h-4 w-4" />어떤 점이 궁금하거나 이상했나요?
      </label>
      <Textarea
        id={`hand-raise-${input.target}`}
        value={reason}
        onChange={(event) => { setReason(event.target.value); setError(null); }}
        placeholder={PLACEHOLDER}
        maxLength={HAND_RAISE_MAX_LENGTH}
        rows={3}
        className="mt-2 resize-y bg-white text-[15px] leading-6"
      />
      <div className="mt-1 flex items-center justify-between text-[11.5px] text-[#6D7788]">
        <span>익명으로 표시됩니다</span>
        <span className={length >= HAND_RAISE_MIN_LENGTH ? "text-[#286247]" : undefined}>{length}자 · {HAND_RAISE_MIN_LENGTH}자 이상</span>
      </div>
      {error && <p role="alert" className="mt-1 text-[12.5px] text-[#8D3B36]">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={() => { setStage("idle"); setError(null); }} disabled={stage === "saving"}>취소</Button>
        <Button type="button" className="h-9 bg-[#15202B] text-white hover:bg-[#26323D]" onClick={submit} disabled={stage === "saving" || Boolean(issue)}>
          {stage === "saving" ? "저장 중…" : "손 번쩍!"}
        </Button>
      </div>
    </section>
  );
}
