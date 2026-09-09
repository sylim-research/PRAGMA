# 62206a5b 품질 규칙 변경 코드 감수

- 날짜: 2026-09-09. 대상: admin-absorb-2026-09-09 / 62206a5b2f7de8f5b75907b8e2301b71a6b24c0b.
- 판정: **보완 후 수용. 현 상태의 배포는 보류 권고.** [단독 진행 적합].
- 사용자 요청은 Fable 구현의 감수다. 앱 코드를 수정하거나 커밋·푸시·배포하지 않았다.
- 핵심 규칙 변경은 유효하지만 “의심 신호가 교수자 판단까지 도착한다”, “20% 초과는 더 이상 차단하지 않는다”는 완료 보고는 실제 전체 경로와 다르다.

## 배포 전에 해결할 세 가지

### CR-01 · P1 · 코어 신호를 품질관리 입력에 연결해야 함

**발생 조건:** 코어 situation_ko에서 R9 국가 일반화 신호, R30 평가 단서 신호, R16 수행 장면 신호가 warning으로 발생한다.

**현재 결과:** 코어 생성 저장 payload에는 auto_check_result만 남고, 품질관리는 checkMission만 실행한다. coreInput은 R23 계승 비교에 사용되며 checkCore의 상황·관계 검사는 재실행하지 않는다. 따라서 어댑터의 needs_professor 변환에 도달하기 전에 해당 신호가 빠진다.

**재현:** 세 합성 코어 모두 checkCore에서 해당 warning 1건씩 발생했으나 buildContentReviewDomain 결과의 해당 finding은 0건이었다. 미션 자체는 구조적으로 유효한 기준 입력이다.

**수정 방향:** 저장된 코어와 실제 요청 조건을 사용해 필요한 코어 신호를 품질관리에서 재계산하거나, 버전·대상 필드를 포함한 신호를 보존하여 검수 입력으로 연결한다. 신규 context_spec 요구를 모든 과거 코어에 무조건 적용하는 방식은 피한다. 이 문제는 R30을 새 미션 장면 전체로 확장하는 후속 개선과 다르다. 이미 코어에서 발생한 신호의 전달 누락이다.

- 변경 지점: [contentReviewDomain.ts:41](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/contentReviewDomain.ts:41).
- 저장 경로: [coreBatchRun.ts:368](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/coreBatchRun.ts:368), [AdminGenerator.tsx:781](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/pages/admin/AdminGenerator.tsx:781).
- 통과 조건: 코어 warning → 저장/재조회에 상당하는 입력 → 품질관리 finding에 같은 규칙·대상·경고 사유가 유지됨.

### CR-02 · P1 · needs_professor 플래그를 실제 판단·승인 조건에 연결해야 함

**발생 조건:** checkMission의 R9 경고 등 어댑터까지 도착한 finding에 needs_professor=true가 설정된다.

**현재 결과:** professorReviewFindings는 AI 검토·생성 품질 결과만 모으고 run.rules.findings를 포함하지 않는다. SQL content_review_required_findings도 p_review.rules를 포함하지 않는다. 따라서 일반 규칙 결과에는 “교수자 확인 필요”가 보일 수 있지만, 개별 판단·근거 저장 대상과 필수 승인 조건에서는 빠진다.

**재현:** 실제 어댑터가 만든 R9 finding은 needs_professor=true다. 그러나 다른 AI 지적이 없는 focused_v1 run에서 교수자 필수 finding은 0건, 빈 판단 목록의 완료 검사는 true였다. 실제 migration의 SQL helper를 격리 PGlite에서 실행한 결과도 빈 배열이었다. 전체 운영 승인 우회를 실측한 결과가 아니라, 해당 규칙 신호가 필수 판단 입력에 빠진다는 증거다. 교수자 승인 버튼·기타 승인 조건 자체가 사라진 것은 아니다.

**수정 방향:** 프런트 교수자 판단 목록과 SQL 필수 finding 집합에 규칙 신호를 일관되게 포함한다. 검사 버전·finding ID·개별 판단 저장을 함께 대조하고, 경고만 있다는 이유로 자동 승인되지 않도록 확인한다.

- 변경 지점: [contentReviewDomain.ts:48](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/contentReviewDomain.ts:48).
- 소비 경로: [contentReview.ts:106](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/_shared/contentReview.ts:106), [ContentReviewPanel.tsx:58](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/components/admin/ContentReviewPanel.tsx:58).
- SQL: [20260906100000_focused_content_review.sql:8](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/migrations/20260906100000_focused_content_review.sql:8).
- 통과 조건: 규칙 warning이 필수 판단에 나타나고, 판단 미작성/보류 시 승인 불가, 근거를 갖춘 처리 후에만 승인 가능. 프런트와 격리 SQL 모두 같은 결과.

### CR-03 · P1 · 20% 비차단 정책이 서버 최종화에 반영되지 않음

**발생 조건:** 문항별 모델 귀속을 산출한 결과 model_unattributed 비율이 20%를 초과한다.

**현재 결과:** missionRules에서는 R32 warning으로 바뀌었지만 generate-scenario의 attributeMissionItemLineage는 여전히 같은 비율에서 ok:false를 반환한다. finalize_mission은 이를 HTTP 502로 반환한다. 즉 교수자가 판단하여 최종화할 수 있다는 변경이 실제 서버 경로에서는 성립하지 않는다.

**재현:** 실제 Edge 함수 본문과 상수를 TypeScript AST로 추출해 모델·네트워크 의존성만 대체한 로컬 실행에서, 1/5(20%)는 성공했지만 2/5(40%)와 5/5(100%)는 “20% 초과”로 실패했다. 유료 AI나 운영 HTTP를 호출한 결과는 아니다.

**수정 방향:** Edge의 비율 차단도 결정한 정책과 일치시키고, 최종 귀속 결과의 R32 신호를 교수자에게 전달·확인하는 순서를 연결한다. 현재 저작 초안의 lineage_status=pending 동안 R31/R32는 생략되며, reviewMission은 교수자 승인 요청 뒤 귀속을 생성하고 최종화 결과에 checkMission을 재호출하지 않는다. 서버의 if 하나만 삭제하면 “교수자 판단”까지 완성되는 것은 아니다.

- 변경 지점: [missionRules.ts:1015](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1015).
- 남은 차단: [generate-scenario/index.ts:1874](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/generate-scenario/index.ts:1874).
- 실제 최종화 연결: [generate-scenario/index.ts:4585](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/generate-scenario/index.ts:4585), [promoteMission.ts:1661](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:1661).
- 역사 SQL에도 20% 조건이 있지만 별도 옛 prompt 게이트가 있으므로 이를 현행 모든 미션의 DB 차단이라고 확대하지 않는다.
- 통과 조건: 20% 초과라도 구조가 올바른 귀속 결과가 생성되고 교수자 확인 대상으로 제시됨. 근거 누락·개수 모순 등 구조 오류는 계속 차단됨. 최종화 결과와 실제 승인 기록의 연결까지 확인.

## 잘 반영된 부분

- R9/R30의 warning 전환과 R16의 구조·서술 분리, 코어 실제 source_modality 대 요청 조건 비교, 번역 방향의 대칭 검사.
- R10 권장안·참고 산출안 필드 추가 및 R14 중립 메시지.
- RuleId와 Record 기반 설명 누락 검사, 설명용 7분류와 R33의 조건·한계 명시.
- 개별 생성 화면에서 기존 R26 산업 AI helper를 공유하며 실패 시 저장하지 않는 경로.
- 검수 rules_version 변경과 Edge 번들 재생성. 과거 검수 이력을 덮어쓰지 않으려는 방향.

이 변경을 전부 버리거나 규칙을 다시 설계할 필요는 없다. 위 세 연결을 보완하면 현재 개선을 이어 갈 수 있다.

## 추가 문서 보완

생성계약 정본의 불일치는 R26만이 아니다. §8.1의 R9·R16·R30·R31·R32도 구 강도·상한을 설명한다([정본:594](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/contracts/PRAGMA_생성계약_정본.md:594)). 확정된 결정과 실제 구현을 동기화해야 하며, 단순 실행 사실 정정을 새로운 정책 선택으로 무조건 미룰 이유는 없다. 이번 요청은 코드 감수이므로 정본은 수정하지 않았다.

카탈로그는 설명층 초안으로 유용하지만 실시간 교수자 표시의 완료 증거는 아니다. 본 커밋의 문서가 선언한 신호 전달 완료와 위 실제 경로의 누락을 구분해 기록해야 한다.

## 검증·증거·한계

- 독립 재실행: npm.cmd run typecheck 통과. 관련 9개 테스트 파일 95 tests pass / 0 fail. Fable이 보고한 전체 882개는 이번에 재실행하지 않았다.
- Edge 번들: node scripts/build-content-review-domain.mjs --check 통과, 302,189 chars.
- 새 반례: 코어 신호 3종의 전달 누락, 미션 신호의 교수자 판단 목록·격리 SQL helper 누락, Edge 비율 20/40/100% 경계.
- [재현 스크립트](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/research-trail/evidence/2026-09-09-62206a5b-review-probes.mjs) / [재현 결과 JSON](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/research-trail/evidence/2026-09-09-62206a5b-review-probes.json).
- 최초 R16 합성 문장은 해당 정규식에 걸리지 않아 재현 스크립트가 실패했다. 실제 기존 R16 테스트의 명시적 구두 수행 문장으로 대조해 수정한 뒤 세 신호를 모두 확인했다. 이는 앱 테스트 실패로 집계하지 않는다.
- esbuild의 샌드박스 상위 경로 읽기 차단은 해당 읽기·검증 명령만 좁게 승인받아 해결했다. Vite 보안 설정을 바꾸지 않았다.
- 격리 SQL은 실제 helper 정의와 최소 composite 입력 타입으로 실행했다. 전체 migration·승인 RPC·운영 DB 통합 검증은 아니다.
- 운영 DB·실제 모델·브라우저 E2E·배포 상태의 새 실측은 하지 않았다. 배포 보류 판단은 검증된 로컬 결함에 근거한다.

이 문서가 dev-log다. 연구 증거 색인 EVD-20260909-02에 교차 감수 근거를 추가한다. 이번 감수 자체는 새로운 연구 설계 선택이나 구현이 아니므로 DEC/ITER/TRC를 추가하지 않는다. 수정 작업이 시행되면 정책 동기화와 전체 검수 흐름의 통과 근거를 해당 작업 기록에 남긴다.

[논문 영향 3줄]

1. 수치: 이번 독립 검증은 95 tests 통과와 로컬 반례다. 882개 전체 재검증·운영 오류율·수업 효과를 주장하지 않음.
2. 화면: 변경 없음. 경고의 일반 표시와 필수 교수자 판단 목록의 누락을 구분해 확인함.
3. 프롬프트·계약: 변경 없음. 20% 비차단 정책과 서버 최종화의 불일치를 확인함.

