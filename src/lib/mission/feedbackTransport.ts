/** 학습자가 피드백 화면에서 무한 대기하지 않게 하는 런타임 상한. 작성 + 검수를 합친 시간(2026-10-26 30초 → 60초). */
export const FEEDBACK_TIMEOUT_MS = 60_000;

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  context?: { name?: unknown; message?: unknown };
};

/**
 * Supabase FunctionsFetchError는 실제 AbortError를 context에 감싼다.
 * SDK 버전에 따른 메시지 차이를 흡수해 화면에는 안정적인 사유만 돌려준다.
 */
export function feedbackInvokeErrorMessage(error: unknown): string {
  const e = (error ?? {}) as ErrorLike;
  const parts = [e.name, e.message, e.context?.name, e.context?.message]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  if (parts.includes("abort") || parts.includes("timeout") || parts.includes("time out")) {
    return "피드백 요청 시간이 초과되었습니다.";
  }
  if (typeof e.message === "string" && e.message.trim()) return e.message;
  return "피드백 호출에 실패했습니다.";
}
