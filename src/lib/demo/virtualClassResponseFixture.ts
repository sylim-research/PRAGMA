// 논문 제5장 수업 활용 예시용 「가상 응답 분포」 시연 fixture.
//
// - 실제 학습자 자료가 아니다. 건수는 설명 목적으로 정한 가상 분포(Codex 지정)이며
//   계정·수행 기록·DB 행을 만들지 않는다. 개발 모드 시연 화면에서만 읽는다.
// - 콘텐츠는 운영 DB의 현행 v6 미션 MJT1을 그대로 옮겼다(임의 수정 금지).
//   출처: scenarios.scenario_id = 3cde65a4-173c-4bc2-b5af-85d806c1bacb
//   (schema mission_v6 · request · ko_zh · translation · reviewed 2026-09-16 · content_hash aac41d2f…,
//    편성 = 「AI 한중 화용 통번역」 2주차 1번). 2026-09-19 읽기 전용 조회로 확인.

import type { MissionPattern } from "@/lib/mission/classResponsePatterns";

export const VIRTUAL_RESPONSE_SOURCE = {
  scenarioId: "3cde65a4-173c-4bc2-b5af-85d806c1bacb",
  schemaVersion: "mission_v6",
  contentHash: "aac41d2fe6d69c8369e33b4d77ff5b8b20c601e3ce874f5e22ce643e52965fb2",
  reviewedAt: "2026-09-16T16:32:31Z",
  placement: "AI 한중 화용 통번역 · 2주차 · 1번",
  item: "MJT1 (mpj_items[0], scale4)",
} as const;

/** MJT1 콘텐츠 — DB 값과 글자 그대로 일치해야 한다. */
export const VIRTUAL_RESPONSE_MJT1 = {
  title: "이 정도로 짧아도 괜찮을까요?",
  prompt: "이 번역안은 이 상황에 얼마나 잘 맞나요?",
  situationKo: "친한 팀플 조원이 최종 발표 파일을 단톡방에 올리기로 했습니다. 발표 전날, 약속한 파일을 아직 못 받아 가볍게 말을 건넵니다.",
  relationKo: "친한 팀플 조원",
  source: "최종 PPT 단톡방에 올려줘.",
  target: "把最终版PPT发到群里吧。",
} as const;

/** 척도 순서 그대로(많이 고른 순으로 재정렬하지 않는다). 라벨은 학습자 화면 척도와 같다. */
export const VIRTUAL_RESPONSE_COUNTS = [
  { key: "very_appropriate", label: "매우 적절", count: 3 },
  { key: "somewhat_appropriate", label: "다소 적절", count: 7 },
  { key: "somewhat_inappropriate", label: "다소 부적절", count: 8 },
  { key: "very_inappropriate", label: "매우 부적절", count: 2 },
] as const;

export const VIRTUAL_RESPONSE_TOTAL = VIRTUAL_RESPONSE_COUNTS.reduce((sum, choice) => sum + choice.count, 0);

export const VIRTUAL_RESPONSE_NOTICE = `연구자가 구성한 가상 응답 ${VIRTUAL_RESPONSE_TOTAL}건 · 실제 학습자 자료 아님`;

export const VIRTUAL_DISCUSSION_QUESTIONS = [
  "같은 표현을 적절하거나 부적절하다고 판단한 근거는 무엇인가?",
  "관계·부담·선행 맥락 중 어떤 단서에 주목했는가?",
  "원문의 의미와 화행 목적을 유지하면서 어떻게 조정할 수 있는가?",
] as const;

/** 운영 학급 응답 대시보드가 읽는 모양으로 옮긴다. 정답 키·해설은 싣지 않는다. */
export const virtualResponsePattern: MissionPattern = {
  missionId: VIRTUAL_RESPONSE_SOURCE.scenarioId,
  learners: VIRTUAL_RESPONSE_TOTAL,
  dissents: 0,
  items: [{
    itemId: 1,
    title: `판단 1 · ${VIRTUAL_RESPONSE_MJT1.title}`,
    targetPreview: VIRTUAL_RESPONSE_MJT1.target,
    groups: [{
      heading: VIRTUAL_RESPONSE_MJT1.prompt,
      total: VIRTUAL_RESPONSE_TOTAL,
      choices: VIRTUAL_RESPONSE_COUNTS.map((choice) => ({ ...choice })),
    }],
  }],
};
