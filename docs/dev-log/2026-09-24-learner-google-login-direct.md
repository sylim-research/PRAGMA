# 2026-09-24 · 학습자 Google 로그인 — Supabase 콜백 주소 노출 제거

- 문제: 학습자가 Google 로그인을 누르면 Google 계정 화면에 `tlnjxagqwvefeqdagtkq.supabase.co(으)로 이동`이 표시됐다. 이 줄은 앱 이름이 아니라 인증 콜백 호스트를 보여 주는 자리라서 Google 브랜딩 설정으로는 바뀌지 않았다(2026-08-22 확인).
- 검토한 대안
  - Supabase 커스텀 도메인: 유료 플랜·도메인·DNS와 Google·Supabase·앱 세 곳을 함께 교체해야 하고, 하나만 어긋나도 로그인 전체가 끊긴다. 기각.
  - Google Identity Services 팝업 버튼: 표시는 `PRAGMA`로 바뀌었으나 버튼 모양(어두운 테마의 흰 로고 상자)과 팝업 위치를 앱이 정할 수 없었다. 시험 후 대체.
  - **채택**: 앱이 Google OpenID Connect 인증 화면으로 전체 화면 이동(`response_type=id_token`, 해시 nonce, state) → Google이 `/student-login#id_token=…`으로 복귀 → `supabase.auth.signInWithIdToken`으로 세션 생성. Google 화면 표시는 `PRAGMA(으)로 이동`.
- 변경: `src/lib/auth/googleIdentity.ts`(인증 주소 생성·복귀 해시 검증) 신설, `src/pages/StudentLogin.tsx`는 자체 버튼(검정, 높이 54px)과 복귀 처리로 교체. 카드 폭 420→400px. 버튼 아래 보조 문구 1줄 삭제.
- 설정(연구자 실행): Google 콘솔 웹 클라이언트의 승인된 JavaScript 원본에 배포·로컬 주소, 승인된 리디렉션 URI에 `https://pragma.up.railway.app/student-login`·`http://localhost:8080/student-login` 추가. 기존 Supabase 콜백 URI는 되돌림 경로로 유지한다.
- 영향 없음: DB·RLS·프로필 생성·관리자 로그인(이메일·비밀번호). 같은 Google 계정은 같은 Supabase 사용자로 이어진다.
- 검증: typecheck, 인증 테스트 16개(nonce 해시, state 대조, 재사용 차단, 취소 처리), eslint 통과. localhost에서 연구자가 Google 화면 표시(`PRAGMA(으)로 이동`)와 로그인 복귀를 확인.

[논문 영향 3줄]
1. 수치: 변경 없음.
2. 화면: 학습자 로그인 카드의 버튼·폭 변경. 논문 도판 대상 화면 아님(그림 배치 계획 34번 비고).
3. 프롬프트·계약: 변경 없음.
