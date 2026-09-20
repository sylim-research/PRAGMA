# 2026-09-01 · 생성·검수 거버넌스 화면 분리와 5단계 품질 검사 정렬

## 배경과 판정

- 분류: **[교차검증 필수]**. 프롬프트와 품질 검사 경계는 논문 4장의 개발·운영 설명과 실제
  교수자 승인 흐름을 함께 바꾸므로 사용자·GPT안·현행 코드·정본을 대조했다.
- 기준: `origin/main` `c7fdcc0`, 작업 시작 HEAD `03af14c`, 브랜치
  `codex/admin-ia-wording-order-2026-09-01`.
- 사용자 결정은 콘텐츠 생성을 품질 검사 단계에서 제외하고, 품질 검사를 정확히
  `R 검사 → OpenAI 1차 → Claude 교차 → OpenAI 정리 → 교수자 최종 승인`의 5단계로 고정하는
  것이다. `OpenAI 정리`는 전면 2차 재검수가 아니라 Claude 지적별 수용·보완·기각 판정이다.
- GPT안에서는 생성·저장 선행 게이트의 명시, 동일 mission ID·review run·content hash를 잇는
  운영 E2E 증거, DB·검수 로직 비변경을 수용했다. 화면을 6단계로 읽히게 만드는 표현과 이미
  사용자 승인된 `생성 계약·개발 프롬프트`를 옛 이름으로 되돌리는 안은 채택하지 않았다.

## 구현

### 관리자 IA와 두 화면

- 그룹 1의 `/admin/prompt-harness`는 **생성 계약·개발 프롬프트**로 한정했다. 코어 생성,
  미션 승격, 생성 중 교정, 생성·저장 전 critic과 실제 모델·버전·해시·fingerprint를 표시하고
  학습자 실행 중 runtime 프롬프트는 기본 생성 목록에서 제외했다.
- 그룹 2에 `/admin/review-criteria` **검수 기준·운영 프롬프트**를 추가해 `콘텐츠 검수·확정`
  바로 앞에 두었다. 관리자 직접 링크는 16개, 대시보드를 포함하면 17개다.
- 새 화면은 생성·저장 선행 게이트를 `5단계 밖`으로 별도 표시하고, 정확히 다섯 단계만 카드로
  보여 준다. R 카탈로그, 실제 운영 system prompt, 학습자 runtime prompt는 정보 과부하를 막기
  위해 기본 접힘 상태로 두었다.

### 규칙·프롬프트 단일 출처

- `missionRuleCatalog.ts`에 33개 번호와 R1c를 typed catalog로 정의했다. R22는 `retired`로
  보존하며 번호를 재사용하지 않는다. 규칙 ID 타입을 `missionRules.ts`의 violation ID에 연결했지만
  검사 로직·threshold는 바꾸지 않았다.
- 카탈로그 회귀 테스트는 생성계약 §6.5의 ID·검사 내용·판정과 정확히 대조하고, 실제 규칙 소스가
  카탈로그 밖 ID를 만들지 못하게 한다.
- 재감사에서 코드와 `DEC-20260830-19`는 R26 lexical miss를 `warning`으로 남기고 그 경우에만
  core quality industry 축을 1회 호출하지만 생성계약 표에는 아직 `fail`이라고 적힌 불일치를
  발견했다. 로직은 유지하고 생성계약·카탈로그를 승인된 현행 동작에 맞췄다.
- 콘텐츠 검수 Edge의 실제 세 system prompt를 공용 상수로 노출해 새 화면이 복사본이 아니라 같은
  소스를 읽게 했다. OpenAI 1차와 Claude는 서로의 결과를 보지 않고, OpenAI 정리는 Claude 지적만
  추가 입력으로 받는 기존 정보 격리를 표시한다.
- `ContentReviewPanel`과 공용 단계 상수의 사용자 문구만 다섯 단계 명칭에 정렬했다. 저장 순서,
  재시도·비용 안전장치, finding 보존, 교수자 결정·승인 gate는 변경하지 않았다.

### 사용자 후속 UI 수정

- 백업·복원 위의 전용 선·추가 여백은 같은 레벨 메뉴와 일관되지 않는다는 운영 캡처 피드백에
  따라 제거했다. 그룹·위치·라우트·접근성은 그대로다. 이 수정은 기능 변경과 분리해 커밋한다.

## 검증

- `npm.cmd run typecheck`: 통과.
- 표적 6파일 **31 tests 통과**:
  `adminNavigation`, `missionRuleCatalog`, `promptGovernance`, `contentReview`,
  `AdminReviewCriteria`, `ContentReviewPanel`.
- 환경변수를 적용한 전체 회귀: **115파일 689 tests 통과, 3파일 9 tests skip**.
  환경변수 없이 먼저 실행한 회귀는 106파일·621 tests가 통과하고 Supabase client를 import하는
  10 suite가 `supabaseUrl is required`로 로드 실패했다. 같은 코드에 실제 로컬 환경을 주입해
  재실행했을 때 모두 통과했다.
- `npm.cmd run review:bundle -- --check`: 통과, generated domain **268,570자**.
- Vite production build: **1,962 modules**, 성공. 기존 Browserslist, CSS `-: T`, 500kB chunk
  경고는 남았으며 이번 변경에서 새 오류는 만들지 않았다.
- 변경 파일 ESLint에서 신규 화면·카탈로그·내비게이션에는 오류가 없었다. 기존 검수 테스트·Edge의
  `no-explicit-any` 10건과 생성 Edge의 기존 `prefer-const` 1건은 이번 범위 밖이라 수정하지 않았다.
- localhost 데스크톱과 390×844 모바일에서 새 경로, 5개 카드, 접힌 상세, 모바일 선택기, 두 화면
  상호 링크와 백업 항목의 동일 간격을 확인했다. 새 브라우저 탭의 console error는 0건이다.
- 로그인 운영 `/admin/review`는 현재 배포 기준 213개 검수 대기·검토 완료 0건임을 읽기 전용으로
  확인했다. 첫 후보의 generation critic warning과 5단계 패널 진입은 확인했지만 유료 검수 호출,
  교수자 판단, 승인·편성·학습자 공개 상태 변경은 실행하지 않았다.

## 운영 E2E 완료 경계

- 다음 운영 E2E는 가능하면 Defense Representative 후보 1건을 고르고 동일 `mission_id`,
  `review_run_id`, content/source hash, criteria/prompt version, provider/model/timestamp를 1–4단계에서
  연결한다.
- 교수자 단계는 연구자가 원본·Claude finding·OpenAI 정리를 비교해 각 finding의 결정과 근거를
  직접 입력해야 한다. Codex는 이 판단을 대신하거나 AI 선택을 미리 채우지 않는다.
- 그 뒤 `reviewed`/`professor_finalized`, 승인 content hash, Composer 편성 가능, 편성 전 learner
  자동 공개 없음까지 확인해야 E2E 완료로 판정한다. 현재 구현·화면 검증은 이 운영 종단 증거를
  대신하지 않는다.

## 변경하지 않은 것

- DB schema·migration·RLS, R 규칙 로직·threshold, provider 호출 순서·모델, 자동 수정·자동 승인,
  교수자 결정 의미, 학습자 공개 조건은 변경하지 않았다.
- 운영 유료 호출·교수자 승인·수업 편성·learner 공개는 수행하지 않았다.

## 커밋·배포

- 백업 메뉴 구분선 제거: `27966c4` (`fix(admin): remove backup navigation separator`).
- 생성·검수 거버넌스 화면 분리: `7ed39a4`
  (`feat(admin): separate generation and review governance screens`).
- 정본·검증 기록 `154b65f`, clean provenance 스냅샷 `ce0f53e`까지 기능 브랜치
  `codex/admin-ia-wording-order-2026-09-01`에 push했다. main 병합은 하지 않았다.
- `content-review`를 Supabase Edge **v10**으로 배포했다. status `ACTIVE`, `verify_jwt=true`,
  bundle SHA-256은 `4c35e958ba29622c5bddb5e58520dac532a892d552f7130b663c6815aa568628`다.
- clean `ce0f53e` worktree를 Railway production에 직접 업로드했다. deployment
  `9ba77b08-e18f-455a-8cae-2357fc5688b0`은 `SUCCESS`, instance
  `da2f4a22-0450-49ed-adf2-921f48171e5a`는 `RUNNING`, image digest는
  `sha256:a8da5472825945c0b67b614a44d77210dffc10aa2c418f636b9c5da538e57254`다.
- 로그인 운영 화면에서 `/admin/review-criteria`의 정확한 5개 단계·R22 retired·선행 gate와
  `/admin/prompt-harness`의 생성 전용 제목·검수 화면 링크·runtime 비노출을 확인했다.
  `/admin/review`는 새 단계명을 표시하고 213개 대기·0개 완료 상태를 유지했다. 사이드바의 백업
  구분선 제거와 browser console error 0건도 확인했다.
- Railway는 기존 `railway.json`의 2026-12-01 지원 종료 예정과 `.railway/railway.ts` 이전을 다시
  안내했다. 현 배포는 성공했으며 설정 이전은 이번 범위에 포함하지 않았다.

## [논문 영향 3줄]

1. 바뀐 수치: 관리자 직접 링크 16개(대시보드 포함 17개), 품질 검사 5단계, 전체 689 tests 통과·9 skip, Edge v10·Railway SUCCESS, 운영 E2E 미완료.
2. 바뀐 화면: 운영 `/admin/prompt-harness` 생성 전용 정리, `/admin/review-criteria` 신규, `/admin/review` 단계 용어, 백업 메뉴 구분선 제거.
3. 바뀐 프롬프트·계약: 운영 검수 프롬프트 내용·판정 로직은 불변, 공용 상수 노출과 R26 현행 판정·5단계 서술 정렬. 새 동결본 발행은 하지 않음.
