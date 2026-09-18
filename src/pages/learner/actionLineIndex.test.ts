import { describe, expect, it } from "vitest";
import { actionLineIndex } from "./CanonicalMissionRun";

const lines = (text: string) => text.split(/(?<=[.!?。！？])\s+/).filter(Boolean);

describe("actionLineIndex", () => {
  it("picks the sentence that says what the learner does, not a trailing condition", () => {
    expect(actionLineIndex(lines("출석 앱에서 지난주 수업이 결석으로 표시된 것을 보고 조교에게 연락합니다. 표시가 잘못된 것인지는 아직 확인되지 않았습니다."))).toBe(0);
    expect(actionLineIndex(lines("신제품 출시를 앞두고 처음 거래하는 포장재 협력사 담당자에게 이메일로 샘플을 부탁합니다. 협력사가 금요일까지 보낼 수 있는지는 아직 답을 받지 않았습니다."))).toBe(0);
  });
  it("picks a trailing action sentence", () => {
    expect(actionLineIndex(lines("팀 공유 폴더에서 제가 실수로 중요한 파일을 지웠습니다. 팀장에게 메신저로 사과하려고 합니다."))).toBe(1);
    expect(actionLineIndex(lines("친한 팀플 조원이 최종 발표 파일을 단톡방에 올리기로 했습니다. 발표 전날, 약속한 파일을 아직 못 받아 가볍게 말을 건넵니다."))).toBe(1);
  });
  it("falls back to the last sentence when no sentence states the action", () => {
    expect(actionLineIndex(lines("광고 대행사에서 받은 배너 시안에 제품 가격이 예전 가격으로 보입니다. 대행사가 잘못 넣은 것인지는 아직 확인되지 않았습니다."))).toBe(1);
    expect(actionLineIndex(["한 문장뿐입니다."])).toBe(0);
  });
});
