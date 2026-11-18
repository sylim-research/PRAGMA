# 2026-11-18 · DCT 피드백·재검토 화면에 「핵심 정리 다시 보기」

결정: DEC-20261118-04 (research-trail/02_decision_log.md)

## 바꾼 것
- 학습자 화면(`src/pages/learner/CanonicalMissionRun.tsx`, UI 브리프 연구자 승인 2026-11-18, Astra 교차 검증 「조건부 진행」)
  - MJT 뒤 전환 화면의 문항별 핵심 정리 목록을 `LessonPointList`로 떼어 냈다. 전환 화면은 같은 목록을 그대로 쓴다.
  - DCT 1차 피드백, 재검토 입력, 2차 피드백(최종 결정) 화면의 피드백 카드 아래에 접힌 「핵심 정리 다시 보기」를 둔다. 누르면 그 자리에서 같은 목록(내용·순서 동일)이 펼쳐진다.
  - 핵심 정리가 없는 미션에서는 그리지 않는다. 다른 자료로 대신하지 않는다.
- 기록: 최종 확정 때 보내는 기존 `feedback_received` 이벤트 JSON에 `lesson_recap_reopen`을 덧붙였다.
  - 형식: `{ schema_version: 1, available, opens: { first_feedback, revision_input, second_feedback } }` — 단계별 펼친 횟수.
  - 해석: 기록 없음(이전 수행) = 미기록, `available: false` = 미제공, 모두 0 = 미열람. 펼침만 뜻하며 읽음·이해·활용은 뜻하지 않는다.
  - 단계가 바뀌면 접힌 상태로 다시 그려 단계별로 따로 센다.

## 바꾸지 않은 것
- AI 호출·프롬프트·Edge 함수, DB·migration(이벤트 종류 목록 그대로).
- 피드백 최대 두 차례, 자동 확정 없음, 「수정하기」·「최종안으로 정하기」 배치, 완료 조건.
- DCT 추천 표현의 확정 후 공개, 대안 문장 비노출. 핵심 정리에 DCT 추천 표현·AI 대안을 섞지 않는다.

## 한계
- `feedback_received`는 최종 확정 때 한 번 보내므로, 확정 전에 이탈하거나 새로고침하면 펼침 기록이 남지 않는다.
- 핵심 정리에 MJT에서 다룬 중국어 표현이 들어 있으므로, 이미 본 자료의 재열람이지만 수정 시점의 표현 지원은 늘어난다. 「지원 조건이 이전과 같다」고 서술하지 않는다.
- 이 기능은 사례 A(2026-10-04) 수행 당시에는 없었다. 그때 화면으로 제시하지 않는다.

## 검증
- `npm run typecheck` 통과.
- `src/pages/learner/CanonicalMissionRun.recheck.test.tsx`에 재열람·단계별 기록 테스트 1건 추가. 이 파일과 `connections`·`pilot` 테스트 통과(로컬 가짜 Supabase 환경 변수).
- `src/pages/learner` 전체 실행에서는 `recheck`의 「all-good A」 2건이 실패한다. 변경 전 `origin/main`에서도 같은 2건이 같은 방식으로 실패하고, 파일 단독 실행에서는 통과한다(병렬 실행 시 시간 문제로 보임, 확인 필요).
- 브라우저 확인·운영 저장 확인은 아직 안 함.
