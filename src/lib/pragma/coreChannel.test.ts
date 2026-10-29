import { describe, expect, it } from "vitest";
import { legacyChannelOf } from "./coreChannel";

describe("legacyChannelOf", () => {
  it("통역은 장면과 무관하게 facetoface", () => {
    expect(legacyChannelOf("stt_interpreting", "교수님께 이메일을 쓰는 상황")).toBe("facetoface");
  });

  it("이메일 장면 개요의 번역은 email", () => {
    expect(legacyChannelOf("translation", "학생이 교수님께 이메일을 쓰는 상황입니다.")).toBe("email");
    expect(legacyChannelOf("translation", "거래처에 메일로 일정을 묻는다.")).toBe("email");
  });

  it("메신저·문자 장면이나 시드가 없으면 messenger", () => {
    expect(legacyChannelOf("translation", "담당 조교에게 메시지를 보내는 상황입니다.")).toBe("messenger");
    expect(legacyChannelOf("translation", null)).toBe("messenger");
  });
});
