# 2026-11-25 · 실시간 AI 피드백 판정 체계 v2 + 학습자 손들기

결정: DEC-20261125-01, DEC-20261125-02 (research-trail/02_decision_log.md)

## 바꾼 것
- 피드백 계약(`src/lib/pragma/feedbackSchema.ts`): `pragmatic_appropriateness.scale_code`(MJT 네 단계, 선택), `blocks.hint`(reference_id·reference_text·reference_label·reference_note_ko·pattern_ko), `verdict_scheme`. `reconcilePragmaticScale`(대역 방향에 정도를 맞춤), `feedbackVerdictLevels`(세 기준 → 아주 좋음·보완 권장·수정 필요, 정도 없는 옛 기록은 옛 대응).
- 서버(`supabase/functions/generate-scenario/index.ts`): 피드백 프롬프트에 정도 판정·「수정 필요」 근거 요구·완화 편향 금지·표현 힌트 규칙(치환·핵심 선택), 요청서에 승인 표현 목록. 응답에 `verdict_scheme`. `_shared/feedbackConcreteness.ts`에 `sanitizeHintPattern`(답안·원문·승인 표현에 없는 6자 초과 목표어 조각이면 실마리 칸을 비움). 프롬프트 판본 `feedback_v1_minidiscourse_v8_scale4_hint`·`feedback_v1_feature_general_v5_scale4_hint`.
- 힌트 후보(`src/lib/mission/feedbackHintReferences.ts`): MJT의 적절 판정 표현·수정 예시·유효 수정안·적정 대역 후보만, 최대 8개. DCT 추천 표현은 넣지 않는다. 화면 문구는 모델이 아니라 이 목록에서 채운다(`normalizeFeedback.ts`).
- 학습자 화면(`CanonicalMissionRun.tsx`): 판정 이름 변경, 「표현 힌트」 칸, 배지 줄바꿈 방지, 손들기(MJT 해설 뒤 다섯 곳, DCT 피드백 1·2차 뒤).
- 손들기: `src/lib/mission/handRaise.ts`, `src/components/learner/HandRaise.tsx`, `src/components/admin/HandRaisePanel.tsx`, migration `supabase/migrations/20261125170000_learner_hand_raises.sql`(insert 본인·select 본인/학습자 데이터 관리자, update·delete 없음).
- 교수자 토론 화면(`classDiscussion.ts`, `ClassDiscussionBoard.tsx`): DCT 세 기준 판정 분포, 「화용의 방향」 분포 유지, 사례의 대안 문장 제거, 손들기 모음.
- 학습 기록 배지(`recordFlow.ts`), 대시보드 서비스 이름표(OpenAI 「AI 품질 심사·실시간 피드백·STT」, Gemini 「콘텐츠 생성」).
- 생성 파일: 프롬프트 스냅숏, 검수 번들.

## 바꾸지 않은 것
- 피드백 두 차례·학습자 최종 결정·초안 유지 경로·과정 메모·완료 조건. 대안 문장 비노출. 의미·문법 판정 기준. 옛 기록의 저장값.

## 검증
- `npm run typecheck` 통과. 새 단위 시험 9건(`src/lib/mission/feedbackVerdictV2.test.ts`) 통과.
- 전체 vitest(가짜 Supabase 환경 변수): 1,184건 중 학습자 화면 시험 5건이 전체 실행에서만 실패, 해당 두 파일 단독 실행 26건 모두 통과(부하에 따른 시간 초과로 판단 — 확인 필요). `npm run prompts:verify`, `npm run build` 통과.
- 로컬(8097) 시연 미션: MJT 1~5 해설 뒤 손들기 표시, DCT 피드백 새 이름·손들기 입력·완료 표시 확인. 개발용 토론 화면: 세 기준 분포·대안 문장 없음 확인.
- 아직 안 한 것: 실제 Astra 응답에서 scale_code·hint가 나오는지(Edge 배포 뒤 학습자 계정으로 확인), 손들기 저장·교수자 조회(migration 반영 뒤), 캡처 재촬영.
