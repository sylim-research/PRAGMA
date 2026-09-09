import type { ScenarioTopic } from "@/lib/pragma/scenarioTopics";

// 현행 생성·선택 목록에서 제외한 메타데이터. 기존 저장 자료의 원래 계약 검사에만 사용한다.
// 다른 테마로 재분류하거나 삭제해 기존 승인 자료의 R1c 판정이 바뀌지 않도록 보존한다.
export const LEGACY_SCENARIO_TOPICS: Array<Omit<ScenarioTopic, "themeCode"> & { themeCode: "travel_mobility" }> = [
  {
    code: "hotel_request",
    labelKo: "숙소 요청·문제 해결",
    themeCode: "travel_mobility",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "complaint"],
    situationSeedKo: "호텔·숙소에 방 변경이나 문제 해결을 요청하는 상황",
  },
  {
    code: "direction_help",
    labelKo: "길·교통 도움 요청",
    themeCode: "travel_mobility",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "thanks"],
    allowedPowers: ["equal"],
    allowedDistances: ["formal"],
    situationSeedKo: "낯선 사람에게 길·교통편을 묻고 도움에 감사하는 상황",
  },
  {
    code: "booking_change",
    labelKo: "예약 변경·취소",
    themeCode: "travel_mobility",
    allowedDomains: ["daily"],
    allowedSpeechActs: ["request", "apology"],
    situationSeedKo: "식당·투어 예약을 변경하거나 취소를 알리며 양해를 구하는 상황",
  },
];
