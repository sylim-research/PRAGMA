# 2026-11-18 · 학습자 피드백: Astra 단독 작성, 판정 보류 제거

결정: DEC-20261118-03 (research-trail/02_decision_log.md)

## 바꾼 것
- `supabase/functions/_shared/openaiRequestContract.ts`: 피드백 경로 `primary = gpt-6-astra`, `fallback = gemini-3.1-pro-preview`(기존 Gemini → gpt-5.5).
- `supabase/functions/_shared/feedbackRequestLimits.ts`: `FEEDBACK_MAX_COMPLETION_TOKENS` 1,200 → 12,000. Astra는 추론 토큰이 이 한도에 들어가므로 기존 피드백 검토 호출과 같은 값으로 맞췄다.
- `supabase/functions/generate-scenario/index.ts` (`action: 'feedback'`)
  - 대체 모델 재시도: HTTP 400·404일 때만 → 어떤 실패든 한 번.
  - Astra 축별 검토 호출과 `applyFeedbackReview`(보류 축 설명 삭제)를 뺐다. 응답에 `review`가 없으므로 화면은 세 기준의 판정·설명을 모두 보인다(`normalizeFeedback.readHeldAxes`가 빈 배열을 돌려준다).
  - 구체성 검사는 1회 재작성만 한다(시작 20초 안일 때). 남은 문제는 `quality.concreteness`에 기록만 한다.
  - 대안 문장(`blocks.alternatives`)은 지금처럼 비운다.
- 관리자 프롬프트 화면: `promptWorkflow.ts`에서 「재검토」 단계를 빼고 결과 문구를 「판정과 설명을 모두 학습자에게 보여 줌(판정 보류 없음)」으로 바꿨다. `scripts/snapshot-prompts.mjs`에서 피드백 재검토 프롬프트 2종을 뺐다(스냅숏 62 → 60종). 생성 파일 재생성.

- 학습자 화면(`src/pages/learner/CanonicalMissionRun.tsx`, UI 브리프 연구자 승인 2026-11-18)
  - 세 기준의 판정과 설명을 언제나 모두 펼친다. 「좋음」도 설명 칸을 보인다(초록 테두리).
  - 의미가 「수정 필요」여도 문법·화용을 「다음 단계」로 미루지 않는다(DEC-20260918-04 대체). 맨 위 「원문의 뜻을 먼저 보완하세요.」 한 줄과 상단 문구는 순서 안내로 남긴다.
  - 예전에 저장된 피드백에 보류 축이 있으면 그 칸에 보류 문구를 보인다(하위 호환).

## 바꾸지 않은 것
- 피드백 프롬프트 본문·버전, DB.
- 판정 기준·색 약속·재검토 흐름·완료 조건·MJT 화면. 대안 문장 비노출.
- `feedbackReview.ts` 모듈과 그 테스트(더는 런타임에서 부르지 않음).

## 검증
- `npm run typecheck` 통과. `npm run prompts:verify` 통과.
- `src/lib/pragma`·`src/lib/mission`·`src/pages/learner`·`src/components` 테스트: 876 통과, 9 건너뜀(로컬에는 가짜 Supabase 환경 변수를 넣고 실행). `npm run build` 통과.
- 실제 Astra 응답 시간과 피드백 품질은 Edge 배포 뒤 학습자 계정으로 확인해야 한다(아직 안 함). 학습자 쪽 대기 상한은 60초다.
