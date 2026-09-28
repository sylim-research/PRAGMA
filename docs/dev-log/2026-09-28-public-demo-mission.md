# 2026-09-28 대표 미션 시연 비로그인 공개

- 문제: README 첫 화면의 대표 미션 링크(/demo/mission)가 로그인 팝업으로 넘어갔다. 2026-09-26 택배 미션 연결 때 시연 경로에 승인 사용자 관문이 붙었다.
- 확인: 공개 키로 scenarios를 조회하면 `permission denied for table scenarios`. 관문만 걷으면 로그인 대신 로드 오류가 난다. AI 피드백 서버도 로그인 사용자만 받는다.
- 변경: 시연 경로의 관문 제거. 세션이 없으면 `src/lib/demo/representativeMissionSnapshot.ts`(2026-09-26 승인 콘텐츠 증거 기록의 mission_content, provenance hash = 승인 v3 hash 확인)를 읽고 runtime 없이 실행한다. DCT 피드백은 AI 미실행 · 작성된 확인 기준으로 표시한다. 세션이 있으면 종전 DB 경로.
- DB·RLS·Edge 변경 없음. 검증: typecheck, 관련 테스트 32파일 214건 통과(비로그인 시연 테스트 1건 추가), 로컬 비로그인 브라우저에서 첫 화면→DCT 제출→피드백까지 확인.
- 결정: DEC-20260928-01.
