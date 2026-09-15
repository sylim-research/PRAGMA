# 관리자 대시보드 제목 정리 · 검토 단계에 모델 제공사 이름 표시

- 요청: 사용자 지시(2026-09-15). 운영 대시보드를 보며 두 가지를 요청했다.
- 기준: `origin/main` `ea4296d7`, branch `claude/admin-dashboard-heading-2026-09-15`.
- 범위: 표시 문구·배치만. 라우트·데이터 조회·집계·승인 조건·모델·프롬프트·Edge 실행 로직은 바꾸지 않았다.

## 1. 대시보드 머리 정리 (`/admin/dashboard`)

| Before | After | Why |
|---|---|---|
| 본문 큰 제목 「PRAGMA 운영 워크플로우」 | 화면에서 숨기고 보조기기용 `h1`로만 유지(`AdminShell` `hideTitle`) | 사이드바 첫 항목과 같은 이름이 두 번 보였다. 첫 화면의 주인공은 「지금 할 일」 |
| 오른쪽 위 단독 「DB 실시간」 배지 | 「전체 흐름」·「검수 단계별 현황」·「수업 운영·학습 수행 현황」 제목 옆에 각각 표시 | 지표 묶음마다 실시간임을 붙여 보이게 한다. 알림 영역(`aria-live`)은 첫 묶음 하나만 |
| 「검수 단계별 현황 — 승인 전 N개」 | 「검수 단계별 현황」 | 같은 수가 바로 위 「전체 흐름」의 「승인 전 미션」 칸에 있다 |

용어 「PRAGMA 운영 워크플로우」는 논문 원고에서 쓰이므로 사이드바 이름은 유지했다. 「AI 대시보드」 제안은 화면의 성격(사람이 점검·승인하는 흐름 관리)과 맞지 않아 채택하지 않았다.

## 2. 검토 단계 이름에 제공사 표시

`2026-09-08-admin-display-cleanup.md`에서 「OpenAI·Claude」를 「AI 검토 / AI 독립 검토 / AI 재검토」로 일반화했으나, 화면에서 단계가 서로 구별되지 않는다는 사용자 지적으로 제공사 이름을 다시 붙였다.

| 단계 키 | Before | After | 실제 호출(코드 확인) |
|---|---|---|---|
| `openai` | AI 검토 | OpenAI 검토 | `OPENAI_MODEL_ROUTES.critic.primary`(저장된 생성 품질점검도 같은 critic 경로) |
| `claude` | AI 독립 검토 | Claude 독립 검토 | `CLAUDE_AUDIT_MODEL` |
| `adjudication` | AI 재검토 | OpenAI 재검토 | OpenAI critic 경로 |

적용 위치: 공통 단계 상수(`_shared/contentReview.ts`), 대시보드 단계 카드, 콘텐츠 검수 패널(결과 제목·문제 항목 출처·재검토 칸·세부 추적의 모델 행), 교수자 대기열 진행 문구, 검수 준비 상태 문구. 모델 버전은 추적 정보라 이름에 넣지 않았다.

유지: 메뉴·절 이름 「자동 품질 점검·AI 검토」(묶음 이름), 「추가 모델 검토 선택」 버튼, 저장된 과거 본문·문제 항목 원문.

## 검증

| 실행 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `vitest run src/pages/admin src/components/admin src/lib/admin src/lib/pragma` | 85 files 통과 · 3 skipped, 591 tests 통과 · 9 skipped |
| `npm run review:bundle` | Edge 도메인 번들 내용 변화 없음(줄바꿈만 달라져 되돌림) → Edge 재배포 불필요 |
| `git diff --check` | 통과 |

운영 화면 확인은 머지·배포 후 관리자 세션에서 한다(비밀번호 입력 불가).

## 논문 재캡처 대상

운영 대시보드(`/admin/dashboard`) 머리·단계 카드, 콘텐츠 승인(`/admin/review`)·품질 점검(`/admin/ai-review`)의 단계 이름을 담은 캡처.
