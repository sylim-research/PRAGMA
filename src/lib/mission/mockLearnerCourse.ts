// 15주 과정 목록 — 공통 표준 15주 골격(2026-07-25, curriculum/template.ts STANDARD_15WEEK와 동기).
// 8주 중간·15주 기말 고정. 2~7·9~11주에 9화행을 각각 1회 주요 초점으로 배치.
// 단계 표기 = 기초 적용 → 관계 조정 → 통합 수행(구 '1/2/3순환'은 실제 반복 구조가
// 아니므로 폐기). 요청 주차(2주)만 진입 가능; 나머지는 잠금/예정(콘텐츠는 편성 배정분).

export type CourseWeekType =
  | "ot" // 오리엔테이션·출발점 확인
  | "speech_act" // 단일 화행 주요 초점 주차
  | "integration" // 복합 화용 조정
  | "contextualization" // 새 맥락에 적용하기
  | "project" // 통번역 의사결정 정리
  | "assessment"; // 중간·기말 수행 슬롯

export interface CourseWeekRow {
  weekNo: number;
  title: string;
  stageLabel: string;
  weekType: CourseWeekType;
  status: "done" | "current" | "locked";
}

export const COURSE_WEEKS: CourseWeekRow[] = [
  { weekNo: 1, title: "오리엔테이션 · 출발점 확인", stageLabel: "시작", weekType: "ot", status: "done" },
  { weekNo: 2, title: "요청", stageLabel: "기초 적용", weekType: "speech_act", status: "current" },
  { weekNo: 3, title: "감사", stageLabel: "기초 적용", weekType: "speech_act", status: "locked" },
  { weekNo: 4, title: "초대 · 공동행동 권유", stageLabel: "기초 적용", weekType: "speech_act", status: "locked" },
  { weekNo: 5, title: "칭찬하기", stageLabel: "기초 적용", weekType: "speech_act", status: "locked" },
  { weekNo: 6, title: "거절", stageLabel: "관계 조정", weekType: "speech_act", status: "locked" },
  { weekNo: 7, title: "사과 · 보상", stageLabel: "관계 조정", weekType: "speech_act", status: "locked" },
  { weekNo: 8, title: "중간 통합 점검", stageLabel: "중간 평가", weekType: "assessment", status: "locked" },
  { weekNo: 9, title: "불만 · 문제 제기", stageLabel: "관계 조정", weekType: "speech_act", status: "locked" },
  { weekNo: 10, title: "제안 · 조언", stageLabel: "관계 조정", weekType: "speech_act", status: "locked" },
  { weekNo: 11, title: "반대 · 이견 제시", stageLabel: "관계 조정", weekType: "speech_act", status: "locked" },
  { weekNo: 12, title: "복합 화용 조정", stageLabel: "통합 수행", weekType: "integration", status: "locked" },
  { weekNo: 13, title: "새 맥락에 적용하기", stageLabel: "통합 수행", weekType: "contextualization", status: "locked" },
  { weekNo: 14, title: "통번역 의사결정 정리", stageLabel: "통합 수행", weekType: "project", status: "locked" },
  { weekNo: 15, title: "기말 통합 수행 점검", stageLabel: "기말 평가", weekType: "assessment", status: "locked" },
];
