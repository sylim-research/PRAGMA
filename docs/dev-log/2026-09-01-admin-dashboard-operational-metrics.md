# 2026-09-01 · 관리자 대시보드 현행 운영 지표 정렬

## 배경과 최종 판정

- 분류: **[교차검증 권고]**. 대시보드 집계는 읽기 전용 UI지만 논문에서 생성·검수 운영 상태를
  설명하는 대표 화면이므로, 사용자가 전달한 GPT안과 현행 `/admin/review`·DB·검수 계약을
  대조했다.
- 작업 시작 기준: 브랜치 `codex/admin-ia-wording-order-2026-09-01`, HEAD `3c1d999`.
- `운영 현황`은 전체 DB 행, 구형 core `review_status`, 학습 수행 기록을 같은 층위에 놓아 무엇을
  운영하는 수치인지 불명확했다. 기존 `AI 점검 통과`도 생성·저장 단계의 quality critic과 현행
  content-review 5단계를 혼동하게 했다.
- GPT안의 세 영역, 다음 처리 단계 MECE 집계, 구형 지표 제거, 실제 작업 화면 연결은 수용했다.
  `수업 편성 미션/주차`를 준비와 수업 영역에 중복 표시하지 않고 **수업·학습 현황 한 곳**에만
  두었다. 선택 사항이었던 최근 학급 응답은 의미 있는 기간·수업 분모 없이 단순 총계를 추가하면
  오해가 커지므로 이번에는 넣지 않았다.

## 변경 전 / 후

### 변경 전

- `콘텐츠 단계별 현황`: 코어 → 생성 → AI 점검 → 교수자 검토 → 수업 배치의 단일 funnel처럼
  보였으나 코어와 미션의 단위가 다르고, `AI 점검`은 현행 5단계 검수 상태가 아니었다.
- `운영 현황`: 전체 시나리오, 구형 core 대기/승인, 학습 수행 기록을 함께 표시했다.
- `/admin/review`의 상태 카드 숫자가 현재 선택 상태를 분모에 다시 적용해 기본 `generated` 선택에서
  `reviewed` 카드가 0으로 보였다.

### 변경 후

1. **콘텐츠 준비 현황**: 현행 코어, 생성된 학습 미션, 현행 검수 대상, 현행 5단계 최종 승인.
2. **콘텐츠 검수 진행 현황**: 검수 대상 미션을 현재 필요한 다음 작업인 R 검사, OpenAI 1차,
   Claude 교차, OpenAI 정리, 교수자 최종 승인 중 한 곳에만 집계.
3. **수업·학습 현황**: 실제 편성 미션/주차, 승인 학습자, 학습자 수행 로그.

모든 카드는 해당 실제 작업 화면으로 이동한다. 구버전 형식은 현행 지표에서 제외하고 작은 호환
안내만 남겼다. `/admin/review` 상태 카드는 상태 이외의 공통 필터만 적용한 같은 분모에서 각각
계산하도록 고쳤고, 과거 `reviewed/released`를 포함하는 값은 `검토 완료(호환 포함)`으로 명시했다.

## 카드별 집계 정의

| 카드 | 단위와 조건 | 이동 경로 |
|---|---|---|
| 시나리오 코어 | `scenarios.content_format = scenario_core_v1`인 코어 수 | `/admin/library` |
| 생성된 학습 미션 | 현행 코어 중 미션 본문이 있고 `mission_status ∈ generated, reviewed, released` | `/admin/assembly` |
| 현행 검수 대상 | `/admin/review` 기본 분모와 동일: 현행 코어, 미션 본문 있음, `generated`, `revise_required` 제외 | `/admin/review` |
| 5단계 최종 승인 | `reviewed/released` 중 `mission_content.authoring.stage = professor_finalized` | `/admin/review` |
| 검수 5단계 | 현행 검수 대상별 현재 버전 `content_review_v2`의 최신 유효 run에서 다음 미완료 단계 한 곳 | `/admin/review` |
| 수업 편성 | `curriculum_week_scenarios`의 서로 다른 미션 수 / 서로 다른 강의계획서·주차 쌍 수, 전체 편성 행 병기 | `/admin/composer` |
| 승인 학습자 | `profiles.role = learner`이고 `approval_status = approved` | `/admin/learners` |
| 학습자 수행 기록 | `learner_mission_logs`의 저장 행 수 | `/admin/decision-traces` |

검수 run이 미션의 마지막 수정 시각보다 오래됐으면 과거 결과를 재사용하지 않고 R 검사로 돌린다.
R fail도 원본 수정 후 재검사가 필요하므로 R 단계에 남긴다. 생성·저장 시
`mission_content.quality_check`에 보존되는 production quality critic은 이 5단계 집계에서 읽지 않는다.

## 운영 데이터 읽기 전용 확인

- localhost UI가 운영 Supabase를 읽어 확인한 현재 값:
  - 코어 **1,623개**, 생성 미션 **235개**, 현행 검수 대상 **213개**, 현행 5단계 최종 승인 **2개**.
  - 다음 단계: R **212**, OpenAI 1차 **0**, Claude 교차 **0**, OpenAI 정리 **0**, 교수자 최종 승인
    **1**. 합계 **213**으로 검수 대상과 일치하며 중복은 없다.
  - 수업 편성 **16개 미션 / 14개 강의계획서·주차 쌍**, 전체 편성 행 **23건**.
  - 승인 학습자 **2명**, 학습자 수행 기록 **63건**, legacy 형식 **34개**.
- `/admin/review`는 같은 필터 기준으로 검수 대기 **213개**를 표시한다. 상태 카드 수정 후
  `검토 완료(호환 포함)`은 **19개**이며, 이는 현행 `professor_finalized` 2개와 의도적으로 다른
  역사 호환 분모다.
- 최초 구현은 Supabase 응답 1,000행 제한 때문에 코어 1,623개를 잘라 셀 위험이 있었다. 1,000행씩
  페이지를 읽고 4,000행을 넘으면 조용히 오계산하지 않고 화면에 오류를 표시하도록 보정했다.
- 운영 데이터 쓰기, AI provider 호출, 교수자 승인, 편성 변경은 실행하지 않았다.

## 검증

- 대시보드 집계 helper **4 tests 통과**: 단위 분리, 단계 상호배타, 수정 후 R 복귀와 critic 제외,
  편성 미션/주차 분리.
- 표적 4파일 **28 tests 통과**: dashboard metrics, navigation, ContentReviewPanel, contentReview.
- 전체 회귀: **116파일 693 tests 통과, 3파일 9 tests skip**.
- `npm.cmd run typecheck`: 통과.
- 변경 TS/TSX ESLint: 통과.
- Vite production build: **1,962 modules**, 성공. 기존 Browserslist, CSS `-: T`, 500kB chunk
  경고만 유지됐다.
- localhost 데스크톱에서 세 영역, 카드 이동 경로, 운영 수치와 `/admin/review` 213/19 표시를
  로그인 세션으로 확인했다. 모바일 실기기/좁은 뷰포트 캡처는 이번 확인에서 수행하지 않았다.

## 변경하지 않은 것

- DB schema·migration·RLS, 생성·R 검사·AI 검수·교수자 승인 로직, prompt·threshold,
  학습자 공개 조건은 변경하지 않았다.
- 현재 화면은 운영 상태의 읽기 전용 관측면이며 콘텐츠 품질이나 학습효과를 입증하지 않는다.

## 커밋·배포와 운영 재확인

- 기능·정본·검증 기록 커밋 `701d165`를 원격 브랜치
  `codex/admin-ia-wording-order-2026-09-01`에 push했다. main 병합은 하지 않았다.
- DB·Edge 변경이 없어 Railway 프런트만 배포했다. deployment
  `5e0a8f44-7fc2-4f57-a5fd-65069960a0c0`은 `SUCCESS`, instance
  `0d1c546c-aae4-4f6a-952b-1e418b61f400`은 `RUNNING`, image digest는
  `sha256:7c46b1f75095b20e8ab87e9f8a3d27fdec035c212a023859ddb20a202b2040a8`이다.
- 로그인 운영 `/admin/dashboard`에서 세 영역, 카드 조건·경로, 준비 1,623/235/213/2,
  단계 212/0/0/0/1, 편성 16/14·23행, 학습자 2명·수행 63건을 재확인했다.
  `/admin/review`는 대기 213, `검토 완료(호환 포함)` 19와 분모 차이 안내를 표시했다.
- 사용자 운영 캡처 피드백에 따라 후속 UI 커밋 `d2e7ab8`에서 카드 최소 높이를 148px에서
  116px로 줄이고 padding·section gap을 압축했다. 반복 DB 배지, legacy·critic·단계 방어 문구,
  사이드바와 중복된 바로가기 카드, 큰 개발 도구 박스를 제거했다. 정확한 집계식은 이 문서와
  코드에 유지하고 화면에는 자연어 상태만 남겼다. 프로필 초기화는 작은 보조 액션으로 보존했다.
- 후속 표적 2파일 **7 tests**, typecheck, 변경 파일 ESLint, production build 1,962 modules와
  localhost/로그인 운영 데스크톱 시각 확인이 통과했다. 최종 Railway deployment
  `1d7e4460-4ef7-479d-9946-df8c1b023fa4`은 `SUCCESS`, instance
  `66e7235d-b52a-456d-8715-0cbbb050afd2`는 `RUNNING`, image digest는
  `sha256:9c5ad95c90571ef4595f4d388715cb2ebe6b9a9079dc56dfa0068db2c1c86bb8`이다.
- 운영 현장감을 보완한 후속 UI 커밋 `0428bde`에서 제목 옆에 단일 `LIVE · 운영 DB` 상태와
  마지막 갱신 시각·수동 갱신을 복원했다. 검수 5단계는 연결된 흐름으로 표시하고, 가장 큰 다음
  작업을 `현재 집중`으로 강조한다. 준비·검수·수업 영역은 서로 다른 색과 아이콘을 사용하며 실제
  값이 바뀐 카드만 잠시 강조한다. 가짜 추세·증감률·활동 데이터는 추가하지 않았다.
- 열린 탭은 30초마다 갱신하고 숨은 탭에서는 중단하며, 다시 보일 때 즉시 갱신한다. 반복 조회는
  `mission_content` 전체 대신 `schema_version`과 `authoring.stage`만 투영한다. 갱신 실패 뒤에는
  마지막 정상 수치를 유지하고 LIVE 상태만 `갱신 지연`으로 바꾼다.
- 표적 2파일 **7 tests**, typecheck, 변경 4파일 ESLint, production build 1,962 modules가 통과했다.
  로그인 운영 화면에서 준비 **1,623/235/213/2**, 검수 **212/0/0/0/1**, 수업·학습
  **16/2/63**과 `현재 집중 · R 검사 212개`를 확인했다. 수동 갱신과 30초 자동 갱신 모두 표시
  시각이 전진했다. 최종 Railway deployment `13dc6183-99c0-4a24-8c62-3fc17634a409`은
  `SUCCESS`·서비스 `Online`, image digest는
  `sha256:8bd38c1d3b395e0c477f308e577a0f699217febb30f6db98fff34e088dfdd63f`이다.
- 최종 화면 보정 커밋 `613f1d6`에서 첨부 기준과 동일하게 세 영역 제목 바로 옆에 작은
  `DB 실시간` 태그를 각각 배치했다. 상단의 전역 LIVE·갱신 시각·수동 갱신과 화면의 30초
  안내는 제거하되, 열린 탭 자동 갱신과 숨은 탭 중단·복귀 즉시 갱신은 그대로 유지했다.
  실패 시에는 세 태그만 `갱신 지연`으로 바뀐다. 검수 단계명은 공용 `CONTENT_REVIEW_STEPS`를
  사용하고, 반복 조회는 큰 검수 JSONB 대신 verdict·response ID 스칼라만 투영한다. 준비 카드의
  `5단계 최종 승인`은 단계명과 충돌하지 않도록 `교수자 승인 완료`로 고쳤다.
- 최종 보정 후 대시보드 helper·내비게이션 **7 tests**, typecheck, 변경 4파일 ESLint,
  production build **1,962 modules**가 통과했다. localhost 로그인 운영 화면에서 같은 실데이터 수치,
  정확히 3개의 `DB 실시간` 태그와 상단 전역 LIVE 제거를 확인했다.
- Railway deployment `dc3174ee-afa9-4a28-b873-3471d44072d1`은 `SUCCESS`·서비스
  `Online`이다. 로그인 운영 `/admin/dashboard`에서 세 태그가 각 제목 바로 옆에 있고 상단 전역
  LIVE·갱신 시각·수동 갱신·30초 안내가 없는 것, 준비 **1,623/235/213/2**, 검수
  **212/0/0/0/1**, 수업·학습 **16/2/63**이 유지되는 것을 재확인했다.
- Railway는 기존 `railway.json`의 2026-12-01 지원 종료 예정과 `.railway/railway.ts` 이전을
  안내했다. 현 배포에는 영향이 없으며 설정 이전은 이번 범위에서 하지 않았다.

## [논문 영향 3줄]

1. 바뀐 수치: 현행 분모 1,623 코어·235 생성 미션·213 검수 대상·2 최종 승인과 5단계 212/0/0/0/1 유지. 최종 보정 7 tests·typecheck·build·Railway SUCCESS/Online.
2. 바뀐 화면: `/admin/dashboard`의 세 영역 제목 옆에 `DB 실시간` 태그를 각각 배치하고 상단 전역 LIVE·갱신 시각·수동 갱신·화면의 30초 안내를 제거.
3. 바뀐 프롬프트·계약: 없음. 생성계약·운영 프롬프트·검수 로직 불변이므로 동결본 재발행 불필요.
