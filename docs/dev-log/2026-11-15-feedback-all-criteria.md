# 2026-11-15 · AI 피드백 설명 전부 표시 + 완료 화면 회차별 피드백 정리

결정: DEC-20261115-01 (research-trail/02_decision_log.md)

## 바꾼 것 (`src/pages/learner/CanonicalMissionRun.tsx`)
- `feedbackExplanationCriteria` + `FeedbackExplanationList`: 설명 대상 = 「수정 필요」·「수정 권장」(검수 통과), 의미 → 문법 → 화용 순, 접기 없음. 의미 `distorted`이면 「원문의 뜻을 먼저 보완하세요.」 + 의미 설명 + 기존 「다음 단계」 안내 문구. 세 기준 모두 「판정 보류」면 보류 문구 한 줄.
- AI 피드백 화면(1·2차)과 재검토 화면(입력창 위)의 설명 상자 1개 → 위 목록. 로컬 체험(AI 미실행) 경로는 그대로.
- `FeedbackRoundsSummary`: 완료 화면에서 완성본과 추천 표현 사이(`CompletionRecord`의 새 선택 prop `feedbackSummary`). 회차 스냅숏(`feedbackRounds`)을 `evaluationFromRuntimeFeedback`으로 다시 읽기만 한다. 실제 수행(runtime·비데모·비체험)에서만 그린다.
- `primaryFeedbackCriterion`은 다른 화면(완료 문항 다시 보기 등)에서 그대로 쓴다.

## 바꾸지 않은 것
AI 호출·프롬프트·Edge·DB·저장 구조·완료 로그(1차 기록 덮어쓰기 없음)·피드백 횟수·버튼·추천 표현 공개 시점.

## 검증
- `npm run typecheck` 통과.
- 새 테스트: `CanonicalMissionRun.allExplanations.test.ts`(4건), `CanonicalMissionRun.roundsSummary.test.tsx`(3건) 통과.
- 학습자 화면 테스트 파일은 단독 실행 시 모두 통과. 여러 파일을 한꺼번에 돌리면 10~12건이 시간 초과로 실패하는데, 변경 전 `origin/main`에서도 같은 묶음 실행에서 11건이 실패한다(부하에 따른 기존 현상).
- localhost 시연(`/demo/mission`, 한→중 번역): 1차 피드백·재검토 화면에 화용 설명이 목록으로 표시됨, 콘솔 오류 없음. 완료 화면 정리는 시연에서 그리지 않으므로 컴포넌트 테스트로 확인.
