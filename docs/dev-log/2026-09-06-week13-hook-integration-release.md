# 13주 운영안·주차 HOOK 통합과 운영 반영

- 사용자 승인: 13주안과 HOOK 통합·검증 후 main 병합, content-review Edge 및 운영 앱 배포.
- 기준: `origin/main b6da0b6`, 13주 기능 `ca8fc73`, HOOK `44eef0e`.
- 작업공간: clean으로 시작한 `.worktrees/e2e-completion-2026-09-05`, 기존 PR #83 확장.
- 분류: 단독 진행 적합. 확정된 두 기능의 통합과 원인이 확인된 맥락 연결 오류 수정이다.
  DB schema·권한·생성/평가 프롬프트·콘텐츠 승인 정책을 변경하지 않는다.

## 통합에서 해결한 문제

- 수업자료 생성 import·공유 Edge 번들의 충돌은 두 기능을 보존하고 공식 번들을 재생성해 해결했다.
- 겹친 연구 기록 번호는 main 기록을 보존하고 HOOK을 `DEC-20260905-04`·`ITER-20260905-04`로 정리했다.
- HOOK은 주차에 P/D/R·목표가 직접 저장돼 있어야 열렸지만 현행 주차는 맥락을 미션에 보관한다.
  기존 학습목표 제안을 재사용하고 편성 미션 하나의 코어 맥락을 별도 예시 구성에 참조한다.
  맥락이 없으면 임의 값을 채우지 않고 교수자가 장면을 제시하는 진행안을 제공한다.
- 검수 RPC는 별도 scenario_p/d/r 행 컬럼을 반환하지 않는다. 브라우저와 Edge 모두 검수 원본에
  포함된 core_content.pdr를 동일한 함수로 해석하도록 맞췄다. 두 미션의 맥락은 덮어쓰지 않는다.
- 두 글자 화행명·13주 제목·유연한 중심 질문을 도입에도 연결했다. 단서를 본 뒤 판단을 유지하는
  선택을 함께 명시하고 모바일 단계 이름의 낱말 줄바꿈을 정리했다.
- HOOK과 중심 질문은 주차 검수 content hash에 포함된다. 과거 승인으로 새 자료를 승인하지 않는다.
  교수자 메모·미션 답안은 HOOK에 가져오지 않으며 응답·채점·승인 기록을 자동 생성하지 않는다.

## 검증

- 전체 Vitest: 125 files / 750 tests 통과, 기존 외부 생성·원격 의존 3 files / 9 tests skip.
- 타입 검사·변경 구현 ESLint 통과. 로컬 PostgreSQL 승인 경계 회귀 7 tests 통과.
- 운영용 build 통과(1,977 modules), 검수 번들 최신 검사·34종 프롬프트 지문 생성 통과.
  기존 CSS·큰 청크·Browserslist 경고는 유지됐다. 프롬프트 본문 변경은 없다.
- 브라우저: 화행 선택·저장·재조회·두 미션 편성·강의계획서·학습자 표시·HOOK 첫 판단·단서 공개·
  자유 이동·초기화·Escape·포커스 복귀·390px 가로 넘침 없음·페이지 오류 0을 확인했다.
  `scripts/manual-checks/week13-smoke.mjs`는 메모리 HTTP fixture만 사용하며 실제 수업 수행 검증이 아니다.
  캡처: `tmp/week13-smoke/opening-desktop.png`, `opening-mobile.png`.
- 배포 전 인증 관리자 읽기 조회: content-review v12 ACTIVE/JWT 검증 사용. 검수 행 4개,
  대상 교과목 2·13주의 현재 승인 없음. 원본·내용 hash를 `.tmp/hook-release-before.json`에 보존했다.

## 운영 반영

PR·CI·main 포함·Edge 버전·Railway 배포와 인증 조회 결과는 실제 확인한 뒤 아래에 추가한다.
중국어 TTS 별도 브랜치, DB migration, 실제 교수자 승인·편성·학습 수행과 유료 AI 호출은 이번 범위 밖이다.
