# Claude 관리자 개편 인계·현행 문서 동기화

- 요청: Claude가 수정한 PRAGMA 관리자 화면을 Codex가 이어서 맡는다.
- 분류: `[단독 진행 적합]`. 현행 코드 대조·기존 회귀 검사·문서 동기화이며 새 UI나 설계 결정은 없다.

## 작업 기준

- 기본 루트는 `codex/mission-v4-workspace-checkpoint-2026-08-22`, HEAD `dffa5102`의 복구 원본이다.
  대량 미커밋 변경을 그대로 보존했다.
- Claude 작업 폴더 `.worktrees/admin-declutter-2026-09-09`는 `admin-absorb-2026-09-09`,
  HEAD `817e9f1a`이며 생성 스냅샷 두 파일에 기존 미커밋 변경이 있었다. 수정하지 않았다.
- `git ls-remote origin refs/heads/main`으로 원격 main `4bd78421432476a4e6199923deb2099cdc13f8d5`
  (PR #124)을 확인했다. 그 커밋에서 `.worktrees/admin-takeover-2026-09-10`,
  `codex/admin-takeover-2026-09-10`을 만들고 이 작업공간 안에 잠금 파일 기준 의존성을 설치했다.
- `docs/CANONICAL.md`와 논문 저장소 `01_정본/00_정본목록.md`의 제품 정본 세 경로는 일치한다.

## 인계한 최종 상태와 문서 수정

- 사이드바는 생성 기준·학습 미션 재료·학습 미션 제작/품질 관리·수업 운영·학습 기록/연구 자료의
  다섯 그룹이다. 미션 조립·AI 검토·교수자 최종 승인은 별도 화면이며 같은 미션 ID로 연결된다.
- 실제 자료 분석은 오전의 생성기 흡수 이후 다시 별도 화면과 보관함으로 분리됐다.
  `CODEX_AUTHENTIC_ANALYSIS_BRIEF_2026-09-09.md`의 완료 안내, `2d9b93de`, 현재 코드를 대조했다.
  분석 전체와 후보를 저장하고 후보 ID로 생성기에 전달하며 라운지 자동 저작·게시 연결은 보류됐다.
- 관리자 정본 §2는 여전히 4개 그룹·16개 링크·통합 검수 화면을 설명하고 있었다.
  §2의 현재 화면·그룹·인계 방식과 §3.1의 실제 자료 보관/전달을 코드에 맞췄다.
  저장 실패 시 라우터 state 대체 전달이 존재하므로 모든 전달이 DB 저장을 보장한다고 쓰지 않았다.
- 앱 코드·DB·프롬프트·권한·학습설계는 변경하지 않았다. 빌드가 만든 스냅샷 두 파일의
  커밋/시각 메타데이터 변경만 원복했다. 프롬프트·표면·artifact hash는 빌드 전후 동일했다.

## 검증

- `npm.cmd ci --offline --no-audit --no-fund`: 작업공간 내부 설치 성공. Node v24.18.0이며
  저장소 요구 버전과 CI는 Node 22다. 동일 실행환경으로 오인하지 않는다.
- `npm.cmd run typecheck`: 통과.
- 기존 표적 테스트 6파일, 고유 **37개 통과**:
  - `adminNavigation.test.ts` 4, `adminDashboardMetrics.test.ts` 9,
    `AuthenticAnalysis.test.tsx` 5, `qualitySignalFlow.test.ts` 8.
  - `ContentReviewPanel.test.tsx` 6, `InstructorReviewExperience.test.tsx` 5.
- 최초 Vitest는 샌드박스의 esbuild 상위 경로 읽기 제한으로 시작하지 못해 같은 표적 명령만 승인 실행했다.
  이어서 컴포넌트 2파일은 Supabase 환경값 누락으로 수집 실패했다. 저장소 CI의 가짜 환경값
  (`https://ci-placeholder.supabase.co`, `ci-static-placeholder`)을 사용해 해당 2파일만 재실행해 통과했다.
- `npm.cmd run build`: CI 가짜 환경값으로 운영용 번들 성공, 1,992 modules.
  기존 CSS `Expected identifier but found "-"`, 큰 청크, Browserslist 경고는 남았다.
- `git diff --check`: 공백 오류 없음. Windows LF/CRLF 안내만 있다.
- 전체 테스트, 실제 관리자 브라우저 조작, 운영 DB 보관·재조회·생성·승인 종단,
  Railway 배포 SHA는 이번에 검증하지 않았다. 로컬 테스트를 운영 완료 증거로 확대하지 않는다.

## 후속 항목

- **지금 반드시 해결 — 완료:** 오래된 복구 폴더와 최신 관리자 코드를 구별하고 현행 문서의 구조 불일치를 정리했다.
- **완성 전 해결 권장:** `AdminAuthentic.handleApply`·`sendStoredToGenerator`가 생성기 이동 전에
  `setCandidateStatus(id, "used")`를 호출한다. `AdminGenerator`에는 생성 성공 후 후보와 연결하는
  호출이 없고, 앱의 상태 변경 호출 세 곳 모두 `scenarioId` 인자를 주지 않는다.
  따라서 현행 `시나리오로 사용` 표시는 실제 시나리오 저장 완료의 증거가 아니다.
  기존 `used_scenario_id` 필드를 활용한 생성 성공 연결과 상태 변경 RPC 오류 처리가 다음의 좁은 구현 후보다.
- **후속 개선:** 학급 응답 현황의 주차별 운영 화면 통합, 개별/배치 생성 통합은 이번 인계로
  자동 착수하지 않는다. 미션 설계 기준 화면도 기존 보류 결정을 유지한다.
- 사용자 확인 필요: 이번 문서 동기화에 없음. 실제 운영 데이터·브라우저 검증은 후속 실행 범위다.

## 연구 기록

- `docs/research-trail/04_evidence_index.md`에 `EVD-20260910-01`로 코드 대조·검증 범위를 연결했다.
- 새 설계·평가·데이터 계약을 결정한 작업이 아니므로 design traceability·decision·iteration은 추가하지 않았다.

## 논문 영향 3줄

1. 수치: 기존 표적 37개·타입·운영용 빌드 통과. 운영 배포 상태 갱신 없음.
2. 화면: 이번 UI 변경 없음. 관리자 정본 설명을 이미 변경된 다섯 메뉴 그룹·분리 검토·분석 보관함에 동기화.
3. 프롬프트·계약: 생성·학습 계약 변경 없음. 프롬프트 동결본 재발행 불필요.
