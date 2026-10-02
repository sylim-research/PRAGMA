# 2026-10-02 학급 응답 분포 탭 → 토론 보드 재구성

대상: `/admin/decision-traces?tab=class` (학습 수행 기록 › 학급 응답 분포). 논문 5.2.2 「판단 분포 → 근거 비교 → 토론 질문」이 화면에서도 이어지도록 재구성했다. 설계안은 2026-10-02 Codex 검토 의견을 그대로 따랐다.

## 바뀐 것

- **첫 화면**: 교과목 선택과 주차 칩을 한 줄로 줄이고, 그 아래에 선택한 미션 요약(화행·번역/통역·방향·학습 초점) + 응답 현황(집계 학습자·응답 있는 문항·이견 제시) + MJT 판단 문항 5개의 작은 분포 카드(학습자 제시 순서 1→2→5→3→4) + 선택 문항 상세 + DCT형 통번역 과제 + 토론 관점을 둔다.
- **문항별 시각화** (`src/lib/mission/classDiscussion.ts`, `src/components/admin/ClassDiscussionBoard.tsx`)
  - MJT1 단일 표현 판단: 4점 척도 가로 누적 막대(척도 순서 고정, 0건도 표시).
  - MJT2 판단과 이유: 척도 분포 + **판단 × 선택 이유 교차표** + 「이유를 본 뒤 판단을 바꾼 응답」 건수. 분포는 최초 판단(`scale_code`) 기준이며 `revised_scale_code`로 덮어쓰지 않는다.
  - MJT5 복수 표현 비교: 후보별 적절성 범주(과잉·적정·과소) 누적 막대를 나란히.
  - MJT3 수정안 선택: 수정안 전문 + 선택 막대.
  - MJT4 직접 수정: 원래 표현과 익명 수정문 카드(같은 문장은 건수만 묶음, 분류하지 않음).
  - v6 이전 형식(judge3·reason 등)은 기존 축별 분포로 그대로.
- **DCT형 통번역 과제**: 「학급 전체」(최종 결정 유지/수정 · 이견 제시 · AI 1차 화용 판정 분포)와 「사례 비교」(익명 응답을 2개까지 골라 원문 → 최초 산출 → AI 피드백 → 이견·근거 → 최종 산출을 나란히). **수정 여부와 이견 여부는 따로 센다.** 「이견 사례 열기」는 이견 사례 2건을 비교 칸에 올린다.
- **토론 관점 3개**(복수의 적절한 선택 가능성 · 판단 근거의 차이 · 콘텐츠의 불명확성)는 교수자가 검토하는 관점으로 제시한다. 시스템은 원인을 확정하지 않는다.
- **데모 응답** (`src/lib/demo/virtualClassRows.ts`): 선택한 v6 미션의 실제 문항·선택지·참고 표현에서 가상 학급 20명의 응답 행을 조립하고, 운영 화면과 같은 `buildClassDiscussion`으로 집계한다. 상단에 「데모 · 가상 학급 20명 · 실제 학습자 자료 아님」을 표시하고, 「실제 응답 / 데모 응답」을 명시적으로 전환하며(`?demo=1`), 응답이 없는 운영 화면에는 「데모로 살펴보기」 입구를 둔다. 데모에서는 마감·공개 운영 단계를 숨긴다. 운영 DB에 저장하지 않는다.
  - 중국어 문장을 지어내지 않는다: MJT4 수정문은 그 문항의 `reference_alternatives`·`contrast.target`(+대표 미션이면 2026-09-28 연구자 실제 수정문), DCT 산출과 AI 피드백은 대표 미션의 기록된 실제 수행(`representativeDemoFeedback`: A·B 초안과 gpt-4.1-mini 피드백 원문)만 쓴다. 다른 미션은 참고 표현을 최종 산출로 두고 피드백 기록 없이 둔다.
  - 이견 사유(한국어 4건)만 가상 학급 구성의 일부로 작성했다.
  - 분포: MJT1 3·7·8·2(제5장 가상 분포와 동일) / MJT2 2·6·9·3, 이유 6·10·4, 판단 변경 2 / MJT5 첫 후보 13·6·1로 갈림 / MJT3 5·12·3 / DCT 유지 10·수정 10·이견 4(수정하면서 이견 1 포함).
- **개발용 도판 경로** `/dev/class-discussion-demo` (`src/pages/dev/ClassDiscussionDemo.tsx`, DEV 번들만): 대표 미션(95209155) + 가상 학급 20명을 로그인 없이 연다. `?item=2`로 문항, `?dct=cases`로 사례 비교를 바로 연다. 논문 캡처 후보 = ① `?item=2`(MJT 분포 + 판단 × 이유 교차표) ② `?dct=cases`(DCT 이견 사례 비교).
- 조회: `fetchMissionClassRows`(`classResponseFetch.ts`)가 `first_response`·`revised_response`·`target_feature_observed`를 함께 읽는다. 마감(`closeClassResponses`)에 넘기는 `pattern`은 종전과 같은 `aggregateMissionResponses` 결과다.

## 바뀌지 않은 것

- 응답 수집 → 분포 고정 → 학습자 공개 흐름과 RPC. 학습자에게 공개되는 것은 종전과 같은 `pattern`(건수)뿐이며 산출·수정문·이견 사유는 학습자에게 가지 않는다.
- 집계 대상(수업 기록 공유에 동의한 학습자만), 학습자별 최신 완료 1건 규칙, 「많이 고른 응답이 정답을 뜻하지 않는다」 문구.
- 학습자 화면, DB, 에지 함수. `ClassResponseDashboard`·`/dev/virtual-response-demo`(제5장 MJT1 도판)는 그대로 둔다.

## 주의

- 토론 보드는 항상 현재 저장된 행에서 집계한다. 분포 고정 뒤에도 보드는 살아 있는 행을 보여 주며, 고정된 `pattern`은 학습자 공개 화면에서만 쓰인다.
- 개별 수행 기록에서 이미 교수자가 보는 산출·수정문·이견 사유를 이 탭에서는 익명 번호(응답 n)로만 보인다. 프로필 ID·이름은 뷰 모델에 넣지 않는다.
- 요청 화행은 콘텐츠·응답이 가운데 범주를 `appropriate`로, AI 피드백은 `within_band`로 적는다 — `normalizeBand`로 한 범주로 읽는다.

## 검증

- `npm run typecheck` 통과. 표적 테스트: `classDiscussion.test.ts`(9) · `ClassResponsePanel.test.tsx`(5, 데모 전환 포함) · `AdminDecisionTraces.test.tsx`(4) 통과. admin·mission·demo 영역 307건 중 `AdminDashboard.test.tsx` 1건이 병렬 실행에서 5초 초과로 실패했으나 단독 실행 통과(무관한 타임아웃).
- 로컬 8080(`.worktrees/class-discussion-2026-10-02`)에서 `/dev/class-discussion-demo`의 MJT1·MJT2 교차표·MJT5·DCT 사례 비교 화면을 1366px 폭으로 확인. 운영 탭(`/admin/decision-traces?tab=class`)은 관리자 로그인이 필요해 연구자 확인 몫.
