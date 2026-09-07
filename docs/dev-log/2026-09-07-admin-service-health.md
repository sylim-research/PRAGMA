# 2026-09-07 — 관리자 「외부 서비스 연동 점검」 패널

브랜치 `claude/admin-service-health-2026-09-07` · 구현 Claude Code(연구자 지정) · 설계 브리프 = 논문 저장소
`08_작업관리/2026-09-07_UI브리프_외부서비스연동점검_Codex인계.md`(연구자 승인 2026-09-07).

## 무엇을

시연·수업 직전에 웹앱이 기대는 외부 서비스가 살아 있는지 한 화면에서 확인한다.
**운영 대시보드(`/admin/dashboard`) 맨 위**, 스크롤 없이 보이는 자리에 한 줄로 뒀다.
**새 라우트·네비 항목·DB 테이블 없음.**

> 배치는 두 번 옮겼다(연구자 검토). ①`/admin/data-backup` → 그 화면 제목은 「수업 데이터 백업·복원」이라
> 연동 점검이 제목 밖의 내용이 된다. ②대시보드 맨 아래 → 연동이 끊겨 있으면 아래 지표를 보기 전에 알아야
> 하는데 스크롤해야 보였다. 최종은 **맨 위 한 줄**이다.
>
> 통째로 위에 올리면 매일 보는 운영 지표가 아래로 밀리므로, **모두 정상이면 요약 한 줄로 접어 두고**
> (`5개 서비스 모두 정상 · 마지막 점검 …`) **정상이 아닌 항목이 있으면 스스로 펼친다**
> (`직접 확인 2건 · OpenAI · Anthropic`). 「자세히」로 직접 여닫을 수 있고, 그 선택이 자동 판단보다 앞선다.
> PC 폭 1440에서 접힌 줄은 46px 한 줄이다.

| 서비스 | 확인 방식 | 비고 |
|---|---|---|
| ElevenLabs | 기존 `GET /functions/v1/tts?action=usage`(PR #97) 그대로 호출 | 잔량 글자 수 · 50%/20% 기준은 `docs/operations/TTS_CREDIT_MONITOR.md`와 동일 |
| OpenAI · Anthropic | 신규 `GET /functions/v1/service-health` → 각 제공자 `/v1/models` 인증만 | 토큰 소비 0. 응답에 **설정된 모델명**도 함께 담는다 |
| Supabase · 앱 배포 | 세션 존재 · 화면 렌더링으로 판정 | 추가 호출 없음 |

- **화면을 열면 마지막 결과를 먼저 보여 준다**(브라우저 `localStorage`, 키 `pragma.admin.serviceHealth.v1`).
  보관된 결과가 없거나 **30분보다 오래됐을 때만** 조용히 다시 확인하고, 그 밖에는 버튼으로 갱신한다.
  🔑 빈 목록으로 시작하면 무엇을 보는 화면인지 알 수 없어 그냥 지나치게 된다는 연구자 지적을 반영했다
  (심사·시연에서 이 화면이 처음부터 최신 상태로 보여야 한다). 이 점검이 부르는 것은 잔량 조회와 인증
  확인뿐이라 토큰·글자 수를 쓰지 않으므로 자동 확인의 비용이 없다. `localStorage` 접근이 막혀도
  (사생활 보호 모드) 점검 자체는 그대로 동작한다.
- 상태는 **정상 / 주의 / 실패 / 직접 확인 / 미점검** 다섯이다.
- 🔑 **「실패」와 「직접 확인」을 구분한다**(연구자 지적으로 추가). 점검 함수에 닿지 못했을 때
  (미배포 404·네트워크 실패) 제공자를 빨간불로 칠하면 「OpenAI가 죽었다」로 읽히는데, 사실은
  **우리가 물어보지 못한 것**이지 제공자 상태를 아는 게 아니다. 이때는 회색 점 + 해당 콘솔 링크만 둔다
  (사정을 설명하는 문장은 두지 않는다 — 할 수 있는 일만 남긴다). 빨간불은 우리가 고칠 수 있는 실제 문제(키 미등록·키 인증 실패·관리자 로그인
  필요)에만 켠다.
- **각 줄에는 상태만 둔다.** 잔액 관리 안내는 목록 아래 한 줄로 모았다(행마다 되풀이하면 상태 목록이
  사과문처럼 읽힌다 — 연구자 지적). OpenAI·Anthropic 줄에는 대신 **설정된 모델명**을 적는다:
  `gpt-4o · gpt-4.1 · gpt-4o-transcribe` / `CLAUDE_AUDIT_MODEL` 값. 「키가 산다」보다 「이 키로 이 모델을
  부른다」가 시연 전 점검으로 더 쓸모 있고, 모델 교체가 실제로 반영됐는지도 여기서 확인된다.
  모델명은 비밀값이 아니며, 키가 죽어 있을 때도 표시한다.
- 키·청구·조직 정보와 제공자 오류 본문은 응답·화면 어디에도 싣지 않는다. edge function은 정해진 코드
  (`ok / missing_key / auth_failed / unreachable / provider_error`)와 HTTP 상태·지연만 돌려준다.
- 관리자 가드는 `tts?action=usage`와 같다(Bearer 세션 → `is_admin()` RPC). `config.toml`에 `verify_jwt = true`.

## 파일

- `supabase/functions/service-health/index.ts` (신규) · `supabase/config.toml` (+3줄)
- `src/lib/admin/serviceHealthApi.ts` · `.test.ts` (신규, 순수 분류 함수 + fetch 경로 11건)
- `src/components/admin/ServiceHealthPanel.tsx` · `.test.tsx` (신규, 5건)
- `src/pages/admin/AdminDashboard.tsx` (+6줄: import 1 · 마지막 절로 삽입)
- 라우트는 `<RequireAdmin>`이 이미 막고 조회 함수도 `is_admin()`으로 다시 막으므로 화면단 재확인은 두지 않았다.

## 확인

- `npm run typecheck` 통과 · eslint 통과 · `vitest` 신규 26건 통과 · `vite build --mode development` 통과.
- 구현 중 잡은 것: jsdom에 `AbortSignal.timeout`이 없어 fetch 전에 던지던 문제(브라우저는 지원 — 방어 코드로
  처리) · 패널이 점검 실패를 잡지 않아 unhandled rejection이 나던 것(수정).
- **미실시**: 관리자 로그인이 필요한 실제 화면 확인과 운영 배포. edge function `service-health`는 **배포 전**이라
  배포 전까지 OpenAI·Anthropic 두 줄은 회색 점 + 콘솔 링크로 나온다(빨간불 아님). 배포하면
  🟢 정상 + 모델명으로 바뀐다. 배포는 별도 승인 후.

## 후속(범위 밖)

자동 주기 점검·알림(Codex 로컬 heartbeat 09:00·21:00가 ElevenLabs를 이미 봄) · 점검 이력 테이블 ·
Railway/Supabase 요금제 사용량 · Supadata.
