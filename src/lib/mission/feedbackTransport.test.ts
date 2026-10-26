import { describe, expect, it } from "vitest";

import {
  FEEDBACK_TIMEOUT_MS,
  feedbackInvokeErrorMessage,
} from "./feedbackTransport";

describe("feedback transport", () => {
  it("uses a bounded learner wait time", () => {
    expect(FEEDBACK_TIMEOUT_MS).toBe(60_000);
  });

  it("recognizes direct and Supabase-wrapped abort errors", () => {
    expect(feedbackInvokeErrorMessage({
      name: "AbortError",
      message: "This operation was aborted",
    })).toBe("피드백 요청 시간이 초과되었습니다.");

    expect(feedbackInvokeErrorMessage({
      name: "FunctionsFetchError",
      message: "Failed to send a request to the Edge Function",
      context: { name: "AbortError", message: "signal is aborted" },
    })).toBe("피드백 요청 시간이 초과되었습니다.");
  });

  it("keeps useful network errors and supplies an opaque fallback", () => {
    expect(feedbackInvokeErrorMessage({ message: "Network unavailable" }))
      .toBe("Network unavailable");
    expect(feedbackInvokeErrorMessage(null))
      .toBe("피드백 호출에 실패했습니다.");
  });
});
