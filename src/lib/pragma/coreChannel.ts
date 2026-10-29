import type { GenMode } from "./enums";

// 시나리오 생성(action:core)에 보내고 저장 직전 core_content.channel에 넣는 legacy 채널 토큰.
// channel은 연구 축이 아니지만, 서버가 이 값을 core_content.channel로 되돌려 주고
// 저장 전 의미 검토(GPT-6 Astra)가 상황문과 대조한다. 번역을 늘 messenger로 고정하면
// 이메일 장면 개요는 「상황문=이메일, channel=messenger」 불일치로 매번 보류된다(2026-10-29 실측).
// 그래서 번역은 개요(장면 시드)가 이메일을 말할 때만 email, 그 밖에는 messenger로 둔다.
const EMAIL_CUE = /이메일|메일|e-?mail|邮件|电邮/i;

export function legacyChannelOf(mode: GenMode, sceneSeedKo?: string | null): "facetoface" | "email" | "messenger" {
  if (mode === "stt_interpreting") return "facetoface";
  return sceneSeedKo && EMAIL_CUE.test(sceneSeedKo) ? "email" : "messenger";
}
