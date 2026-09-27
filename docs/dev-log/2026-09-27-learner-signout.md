# 2026-09-27 · 학습자 계정 확인과 로그아웃

- [단독 진행 적합] 사용자가 Brave에서 기존 계정으로 바로 진입하고 로그아웃할 수 없다고 보고하여 계정 전환을 요청했다. 기존 인증·승인·동의 정책을 변경하지 않고 이미 사용하는 Supabase 로그아웃 API를 학습자 공통 헤더에 연결한 국소 UI 수정이다.
- 원인: `/student-login`은 유효한 PRAGMA 세션이 있으면 수업으로 즉시 보낸다. 로그아웃 버튼은 승인 대기 화면에만 있었고, 승인된 사용자의 수업·기록·미션 화면에는 없었다. Google 인증 URL에는 이미 `prompt=select_account`가 있다.
- 변경: 공통 헤더 `계정` 메뉴에서 현재 세션의 이메일과 `로그아웃`을 제공한다. 프로필 조회가 늦어도 이전 프로필 이메일보다 현재 세션 이메일을 우선한다. 현재 브라우저의 PRAGMA 세션만 종료(scope local)하고 로그인 화면을 새로 연다. 실패 시 오류 안내와 재시도를 제공하고 중복 요청을 막는다.
- 앱의 미완료 응답·피드백 캐시와 DB 학습 기록은 삭제하지 않는다. 초기 삭제 포함안은 자동 승인 검토가 요청 범위 밖의 데이터 삭제로 거절하여 실행되지 않았다. 삭제 코드 없는 방식으로 구현했다. Google 계정 자체의 로그아웃·보안 설정·OAuth 반환 주소·미션 콘텐츠·동의 상태 변경 없음.
- 로컬 실제 검증: 기존 연구자 계정의 분리된 시험 세션에서 HTTP 204(scope local), auth 저장값 제거, 로그인 화면 복귀, `/learner/records` 재접근 시 로그인 요구를 확인했다. PC 1440px·모바일 390px 계정 메뉴와 이메일 표시를 확인하고 캡처의 이메일은 가렸다. 기존 시도·피드백 캐시 보존 확인. Google 로그인이나 지정 시험 학습자의 대표 미션 E2E 성공 증거는 아니다.
- 검증: 관련 4파일 20개 PASS, 변경 파일 ESLint PASS, typecheck PASS, production build PASS. 전체 재검사 159파일 1,072개 PASS·9개 skip. 최초 전체 검사는 빌드와 병행 중 기존 미션 런타임 테스트 1건이 5초 제한을 넘었으나, 변경 없이 해당 파일 18개 및 maxWorkers=2 전체 재실행이 통과했다. CI·운영 반영은 후속 결과를 기록한다.
- 로컬 근거: `docs/research-trail/evidence/2026-09-27-parcel-vertical-slice/logout-localhost-result.json`, `logout-localhost-*.png`, `logout-focused-tests.log`, `logout-typecheck.log`, `logout-production-build.log`. 재현 스크립트 `.tmp/verify-learner-logout.mjs`. 원래 대표 미션 과제는 별도 `2026-09-27-parcel-vertical-slice.md`에서 이어간다.

[논문 영향 3줄]
1. 바뀐 수치: 관련 테스트 20 PASS. 대표 미션 유지·수정 E2E 상태는 별도이며 아직 NOT RUN.
2. 바뀐 화면: 학습자 공통 헤더에 계정 메뉴 및 로그아웃 추가. 교육 콘텐츠·수행 본문 동일.
3. 바뀐 프롬프트·계약: 없음. 동결본 재발행 없음.
