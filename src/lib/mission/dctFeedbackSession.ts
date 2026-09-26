import { requestFeedback, type FeedbackRequestResult } from "./missionFeedback";

export type DctFeedbackRound = 1 | 2;
export type DctFeedbackSnapshot = {
  round: DctFeedbackRound;
  answer: string;
  result: FeedbackRequestResult;
};
type Slot = { answer: string; result?: FeedbackRequestResult };

/** 수행당 두 슬롯만 사용한다. 실패·재렌더·중복 클릭도 같은 슬롯을 다시 호출하지 않는다. */
export function createDctFeedbackSession(storageKey?: string) {
  let slots: Partial<Record<DctFeedbackRound, Slot>> = {};
  const pending = new Map<DctFeedbackRound, Promise<FeedbackRequestResult>>();
  const unavailable = (error: string): FeedbackRequestResult => ({ ok: false, error });
  if (storageKey) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) slots = saved;
    }
    catch { slots = {}; }
  }
  const persist = () => {
    if (!storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(slots)); }
    catch { /* 저장소 제한 시 현재 수행의 메모리 슬롯으로 중복을 막는다. */ }
  };
  return {
    snapshot(): DctFeedbackSnapshot[] {
      return ([1, 2] as const).flatMap(round => {
        const slot = slots[round];
        return slot ? [{ round, answer: slot.answer, result: slot.result ?? unavailable("이 회차의 AI 피드백을 확인하지 못했습니다.") }] : [];
      });
    },
    request(round: DctFeedbackRound, mission: Parameters<typeof requestFeedback>[0], answer: string): Promise<FeedbackRequestResult> {
      if (round !== 1 && round !== 2) return Promise.resolve(unavailable("AI 피드백은 최대 두 번 제공합니다."));
      if (round === 2 && (!slots[1] || slots[1].answer === answer)) return Promise.resolve(unavailable("수정한 산출만 재확인합니다."));
      const slot = slots[round];
      if (slot) {
        if (slot.answer !== answer) return Promise.resolve(unavailable("이미 확인한 회차입니다. 현재 표현을 직접 검토해 주세요."));
        // 새로고침 전에 요청 중이었다면 재호출하지 않고 직접 결정할 수 있게 한다.
        return pending.get(round) ?? Promise.resolve(slot.result ?? unavailable("이 회차의 AI 피드백을 확인하지 못했습니다. 현재 표현을 직접 검토해 주세요."));
      }
      slots[round] = { answer };
      persist(); // 호출 전에 소비를 기록한다. 실패도 한 회차로 센다.
      const result = Promise.resolve().then(() => requestFeedback(mission, answer))
        .catch(() => unavailable("AI 피드백을 불러오지 못했습니다."))
        .then(value => {
          slots[round] = { answer, result: value };
          persist();
          return value;
        });
      pending.set(round, result);
      return result;
    },
  };
}

export type DctFeedbackSession = ReturnType<typeof createDctFeedbackSession>;
