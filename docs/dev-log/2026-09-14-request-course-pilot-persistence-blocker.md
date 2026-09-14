# 2주 요청 3건 integration pilot — persistence 사전 확인

- 날짜: 2026-09-14
- 분류: [단독 진행 적합] — 현행 코드·SQL 읽기 확인. backend 변경 실행 없음.
- 작업공간: `C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.tmp/request-course-pilot-20260914`
- branch: `codex/request-course-pilot-2026-09-14`
- 기준 HEAD: `8dd14fbe8bd9518a11142b8a5db2936c8dadaf5f`
- 동결 checkpoint: 별도 `learner-ux` 작업공간의 같은 HEAD. 원래 대표 미션·MJT4 해설·후반 부담 검토는 재개하지 않았다.

## 범위와 상태

- 사용자 승인 범위는 기존 공개 60개를 보존한 2주 요청 슬롯의 교과목별 새 candidate 1건, 총 3건이다. 기존 ID의 공개 콘텐츠를 덮어쓰지 않는다.
- 최종 사용자 지시에 따라 먼저 MJT4 자유교정·MJT5 후보별 독립판단의 저장 형식과 격리된 candidate의 승인·편성·수행 저장 경로만 확인했다.
- 별도 worktree와 그 안의 의존성 설치까지 준비했다. 앱 구현 변경은 남기지 않았다. 준비 중 잠시 변경했던 schema export도 원상 복구했다.
- candidate 생성·DB insert·교수자 승인·편성 변경·학습 응답 저장은 아직 실행하지 않았다. 실제 persistence E2E 완료로 보고하지 않는다.
- 13주 근거 확인은 사용자가 충분하다고 판단하여 종료했다. 이 기록에서 다시 검토하지 않는다.

## 응답 저장 형식 확인

| 대상 | 현행 상태 | 3건 연결에 필요한 최소 범위(미구현) |
| --- | --- | --- |
| 공통 attempt | `learner_mission_logs.context_judgment`는 JSONB이고, 기존 응답 envelope가 `responses` 배열·미션 schema·콘텐츠 hash를 함께 저장한다. | 기존 로그 테이블·attempt ID·course/week/assignment·hash 연결을 재사용한다. 응답 때문에 새 테이블이나 SQL 컬럼을 만들 필요는 확인되지 않았다. |
| MJT4 자유교정 | 화면은 `revisedText`를 반환한다. 현재 실제 러너의 v5 trace 변환은 A4에서 `reason_id`·`reason_kind`를 읽으므로 수정문을 저장하지 못한다. | 문항별 비채점 trace에 수정문 전용 필드(예: `revised_text`)를 추가하는 최소 타입·검증·매핑 확장이 필요하다. `reason_id`나 DCT의 `revised_response`를 대신 쓰지 않는다. |
| MJT5 독립판단 | 화면은 후보 ID별 `candidateJudgments`를 반환한다. 응답 trace에는 이미 후보 순서별 `candidate_band_codes`가 있지만 현행 v5 러너는 BEST/WORST index만 기록한다. | 실행 콘텐츠의 후보 순서에 맞춰 네 실제 응답을 기존 배열에 연결할 수 있다. 후보별 응답 누락·허용 코드·콘텐츠 hash를 확인해야 하며 BEST/WORST로 축약하지 않는다. |

- `mission_v5` native validator는 여전히 `scale4 / judge3 / fix_choice / reason / multi_judge` tuple이다. 화면 객체를 그대로 DB에 넣거나 응답 필드만 추가하는 것으로 새 흐름이 연결됐다고 볼 수 없다.
- 응답 계약을 구분할 최소 version/validation 확장의 필요성은 있으나, backend 격리 경로 blocker 때문에 실제 계약을 새로 확정하거나 구현하지 않았다. 기존 `mission_v5`·과거 응답 읽기를 변경하지 않았다.
- 근거: `src/lib/mission/missionAttemptRow.ts:44,66,124`, `src/pages/learner/CanonicalMissionRun.tsx:651,681,2000,2052`, `src/lib/pragma/missionSchema.ts:637`, `supabase/migrations/20260721120000_learner_mission_logs.sql:29`.

## 지금 반드시 해결 — 격리된 candidate E2E 경로 blocker

확인한 현행 저장 검증 함수 `assert_learner_course_assignment`는 다음 두 조건을 모두 요구한다.

1. 전달된 course/week/assignment/scenario가 실제 편성과 일치하며 **교과목 상태가 `published`**여야 한다.
2. 해당 scenario와 content hash의 lineage 단계가 **`reviewed` 또는 `released`**여야 한다.

`learner_mission_logs`의 INSERT/관련 UPDATE trigger가 이 함수를 호출한다. 함수에는 admin·draft·candidate의 별도 예외가 없다. 저장된 migration 전체에서 이 함수의 후속 재정의를 찾지 못했다.

- 승인된 candidate를 비공개 draft 교과목에 편성해도 1번 조건을 통과하지 못한다.
- 관리자 조회/미리보기 권한이 이 저장 조건을 면제하지 않는다. learner 시나리오 SELECT 정책도 일반 학습자에게 published 교과목 편성을 요구한다.
- course/week/assignment를 모두 비우면 함수가 반환하지만, 이는 요청된 **승인→편성→수행→저장** 검증을 충족하지 않는다. 이 방식으로 우회하지 않는다.
- 다른 교과목을 published로 바꿔 시험하는 것도 비공개 candidate 검증으로 간주하지 않는다.
- 근거: `supabase/migrations/20260829183000_scope_lock_attempt_lineage.sql:56,84,93,126`; `supabase/migrations/20260826125000_professor_release_and_expert_archive.sql:12`.

따라서 현재 확인 가능한 앱 코드·SQL에서는 사용자 조건을 충족하는 격리된 candidate persistence 경로가 없다. 사용자 지시대로 여기서 중단한다. staging, 새 테이블, 새 evaluator/scoring, RLS 우회, migration 변경, 공개 60개 변경을 실행하지 않는다.

## 검증 범위와 기록

- 확인: 위 schema·UI 응답·trace 변환·기존 로그 insert·편성 검증 SQL·learner 공개 경계의 정적 대조, branch/HEAD 대조.
- 운영 DB에 실패 유도 insert를 보내거나 운영 catalog/함수 정의를 직접 조회한 결과는 아니다. 로컬 SQL 정의와 실제 배포 상태가 동일하다는 추가 실측 주장은 하지 않는다.
- 앱 코드 변경이 없어 테스트·빌드·동결 대표 미션 체험을 반복하지 않았다. 실제 E2E 검증은 미실행이다.
- dev-log: 이 파일.
- research-trail: 갱신 없음. 새 학습설계/계약을 채택하지 않았고, 실제 저장 실행 증거도 아직 없다.
- 다음 판단 대상: 비공개 candidate의 기존 승인·편성·저장 경로를 허용하는 최소 변경을 별도로 승인할지 여부. 이번 작업에서는 그 변경을 설계·실행하지 않는다.

[논문 영향 3줄]
1. 수치: 3건 persistence E2E 미실행. 기존 공개 60개·운영 버전·배포 상태 변경 없음.
2. 화면: 변경 없음. 동결한 localhost 대표 미션 유지.
3. 프롬프트·계약: 변경 없음. 동결본 재발행 없음.
