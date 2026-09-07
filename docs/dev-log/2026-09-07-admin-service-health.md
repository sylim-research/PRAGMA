# 2026-09-07 — 관리자 「외부 서비스 연동 점검」 패널

브랜치 `claude/admin-service-health-2026-09-07` · 구현 Claude Code(연구자 지정) · 설계 브리프 = 논문 저장소
`08_작업관리/2026-09-07_UI브리프_외부서비스연동점검_Codex인계.md`(연구자 승인 2026-09-07).

## 무엇을

시연·수업 직전에 웹앱이 기대는 외부 서비스가 살아 있는지 한 화면에서 확인한다.
기존 `/admin/data-backup`(수업 데이터 백업·복원) 맨 위에 section 하나를 얹었다. **새 라우트·네비 항목·DB 테이블 없음.**

| 서비스 | 확인 방식 | 비고 |
|---|---|---|
| ElevenLabs | 기존 `GET /functions/v1/tts?action=usage`(PR #97) 그대로 호출 | 잔량 글자 수 · 50%/20% 기준은 `docs/operations/TTS_CREDIT_MONITOR.md`와 동일 |
| OpenAI · Anthropic | 신규 `GET /functions/v1/service-health` → 각 제공자 `/v1/models` 인증만 | 토큰 소비 0. 선불 잔액은 API로 조회 불가 → 화면에 「콘솔에서 자동 충전」 안내 + 링크 |
| Supabase · 앱 배포 | 세션 존재 · 화면 렌더링으로 판정 | 추가 호출 없음 |

- 페이지 진입 시 **자동 호출하지 않는다.** 「지금 점검」 버튼을 눌렀을 때만 두 요청이 나란히 나간다.
- 상태는 정상/주의/실패/미점검 넷. 점검 자체가 못 돌면 다섯 줄 모두 실패로 표시하고 재시도를 유도한다.
- 키·청구·조직 정보와 제공자 오류 본문은 응답·화면 어디에도 싣지 않는다. edge function은 정해진 코드
  (`ok / missing_key / auth_failed / unreachable / provider_error`)와 HTTP 상태·지연만 돌려준다.
- 관리자 가드는 `tts?action=usage`와 같다(Bearer 세션 → `is_admin()` RPC). `config.toml`에 `verify_jwt = true`.

## 파일

- `supabase/functions/service-health/index.ts` (신규) · `supabase/config.toml` (+3줄)
- `src/lib/admin/serviceHealthApi.ts` · `.test.ts` (신규, 순수 분류 함수 + fetch 경로 11건)
- `src/components/admin/ServiceHealthPanel.tsx` · `.test.tsx` (신규, 5건)
- `src/pages/admin/AdminDataBackup.tsx` (+6줄: import 1 · 패널 삽입)

## 확인

- `npm run typecheck` 통과 · eslint 통과 · `vitest` 신규 16건 통과 · `vite build --mode development` 통과.
- 구현 중 잡은 것: jsdom에 `AbortSignal.timeout`이 없어 fetch 전에 던지던 문제(브라우저는 지원 — 방어 코드로
  처리) · 패널이 점검 실패를 잡지 않아 unhandled rejection이 나던 것(수정).
- **미실시**: 관리자 로그인이 필요한 실제 화면 확인과 운영 배포. edge function `service-health`는 **배포 전**이라
  운영에서는 OpenAI·Anthropic 두 줄이 「응답이 없습니다」로 나온다. 배포는 별도 승인 후.

## 후속(범위 밖)

자동 주기 점검·알림(Codex 로컬 heartbeat 09:00·21:00가 ElevenLabs를 이미 봄) · 점검 이력 테이블 ·
Railway/Supabase 요금제 사용량 · Supadata.
