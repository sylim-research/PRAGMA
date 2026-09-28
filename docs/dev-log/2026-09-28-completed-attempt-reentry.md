# 2026-09-28 · 완료 후 재진입 시 수행 ID 분리

- 분류: [단독 진행 적합]. 현재 main의 대표 택배 미션을 실제 학습자 UI로 KEEP 완료하고 기록 새로고침 뒤 같은 슬롯에 재진입했을 때, 화면은 빈 응답으로 시작하지만 mission_session_opened가 이전 attempt ID를 재사용했다. 서로 다른 KEEP/REVISE 수행을 분리해야 하는 이번 검증의 blocker다.
- 원인: live runner의 응답 상태는 mount마다 초기화되지만 attempt initializer는 localStorage 값을 재사용했고, AI 피드백 슬롯도 같은 attempt 키를 사용했다.
- 변경: live runtime의 새 mount에서 기존 rotateMissionAttemptId를 호출한다. 같은 mount 안의 재렌더·저장 재시도는 동일 ID를 유지한다. 미리보기/로컬 pilot의 기존 initializer는 보존했다. 콘텐츠·프롬프트·DB·AI 회차 계약은 변경하지 않았다.
- 대안: 완료 저장 뒤 키만 지우면 이미 완료된 브라우저에 남은 키를 처리하지 못한다. 이번 수정은 이미 비어 있는 live UI 상태와 수행 식별자를 맞춘다. 중단된 미션 재개 기능을 추가하지 않는다.
- 검증: 완료·저장 후 unmount/remount 회귀 assertion이 수정 전 동일 ID로 실패했고, 수정 후 관련 runtime 18 tests가 통과했다. typecheck·production build 통과. 전체 검사 첫 실행은 1070 pass/9 skip 및 UI 검사 2건의 5초 timeout이었다. worker 수만 2로 제한해 재실행한 전체 검사는 1,072 pass / 9 skip으로 통과했다(159 files pass / 3 skip). local Node 24.18, CI는 저장소 지정 Node 22다.
- 운영 상태: 이 기록 작성 시점은 배포 전이다. 사용자 지시(실제 blocker 최소 수정 → focused test → 배포 → 실패 지점부터 live 재검증)에 따라 PR·필수 CI·main 배포 뒤 별도 두 attempt를 수행한다. 운영 성공을 로컬 테스트로 대신하지 않는다.
- 근거: 로컬 논문 증거 폴더 C:/PRAGMA_THESIS_LOCAL/05_증거/앱통합검증/2026-09-28_택배대표_LiveUI의 attempt-entry-lock.json, attempt-regression-before-configured.log, attempt-regression-after.log. 연구자 대행 시험이며 실제 학생 학습효과 자료가 아니다.

[논문 영향 3줄]
1. 바뀐 수치: 새 live 진입마다 수행 ID가 분리된다. 학습·평가 수치는 바꾸지 않았다.
2. 바뀐 화면: 없음. 기존 빈 응답 시작 화면에 맞춰 저장 식별자만 정합화했다.
3. 바뀐 프롬프트·계약: 없음. content hash와 최대 AI 2회 계약을 유지한다.
