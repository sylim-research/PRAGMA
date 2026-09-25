# 2026-09-25 · 학습자 자동 승인과 프로필 문항 표기 정리

## 한 일

- `supabase/migrations/20260925160000_auto_approve_completed_learners.sql`
  - `profiles`에 BEFORE INSERT OR UPDATE 트리거 `profiles_zz_auto_approve_completed_learner`를 추가했다.
  - 조건: role=learner · approval_status=pending_approval · profile_completed=true → approved, 익명 참여 ID가 없으면 `anon_<uuid>`로 만든다.
  - 트리거 이름을 기존 방어 트리거(`profiles_prevent_privilege_escalation`) 뒤에 오도록 정했다. 방어 트리거는 원래 값을 보고 통과시키고, 승인 변경은 서버 트리거만 한다. 학습자가 approval_status를 직접 바꾸는 것은 여전히 막힌다.
  - rejected·inactive는 대상이 아니므로 프로필을 다시 저장해도 자동 승인되지 않는다.
  - 기존에 프로필을 마치고 승인 대기에 있던 learner도 같은 규칙으로 일괄 승인한다.
- 프로필 마법사·관리자 학습자 상세
  - 「주 사용 언어」 → 「모국어」.
  - 「한중 통번역 학습·수행 경험」 → 「한↔중 통번역 경험」. 선택지 라벨: 없음 / 학원·대학교에서 관련 수업 수강 / 실습·현장 보조 경험 / 전문 통번역 경력. 저장 코드(none·coursework·assisted·professional)는 그대로다.
- 프론트 흐름은 바꾸지 않았다. 저장 → 프로필 다시 읽기 → `/learner/course` 이동이 원래 흐름이고, 트리거가 승인하면 승인 대기 화면을 거치지 않는다.

## 확인

- `npm run typecheck` 통과.
- 표적 테스트: ProfileWizardForm·AdminLearners·ProfileSetup·lib/auth·PendingApproval 5파일 20건 통과.
- 반려 경로는 기존 그대로다: 관리자 학습자 관리의 반려·비활성 버튼 → 접근 함수(`has_completed_learner_profile` 등)가 approved를 요구하므로 즉시 차단.

## 미확인·남은 일

- 원격 DB 적용 뒤 실제 신규 가입 계정으로 끝까지 확인하는 일은 학습자 계정 로그인이 필요하다.
- 논문 4.1.3의 「교수자의 학습 참여 승인」 서술은 「자동 승인 + 사후 반려」로 바뀌어야 한다(원고는 연구자 몫).
