# 2026-09-18 — MJT 판정 O/X 표시와 MJT2 흐름 변경

연구자 검수(v6 대표본 5건)의 공통 지적을 학습자 미션 화면에 반영했다. 결정 = DEC-20260918-02.

## 바뀐 것

- **O/X 한 줄** (`VerdictBanner`): MJT1(척도)·MJT2(척도+이유)·MJT3(교정 선택)·MJT5(후보 비교) 확인 직후 맨 위에 표시. 허용 범위 안이면 O. MJT5는 표현별 O/X + 「4개 중 N개」(일부 맞음은 노란색).
- **MJT2 흐름**: 판정 → 「판단 확인하기」 → 판정 O/X(네 선지 유지) → 이유 선택 → 「이유 확인하기」 → 이유 O/X + 참고 이유 → 해설. 이유 뒤 판정 수정 단계 삭제. 응답은 `{ pick, reasonId }`.
- **이유 정답 키**: `reason_choice.accepted_id`(선택). 스키마 refine으로 선택지 안의 id인지 검사. 없으면 이유 정오를 표시하지 않고 「내 판단 이유」만 보인다.
- **해설 서체** (`NoteLine`): MJT3·MJT5 후보 아래 해설을 「해설」 꼬리표·13.5px 회색·점선 구분. MJT4 해설은 문장 단위 불릿 목록.
- **상황 박스**: 「내가 할 말」을 적은 문장을 굵게·금색 대시. 말을 건네는 동사가 현재형으로 끝나는 마지막 문장을 고르고, 없으면 마지막 문장(`actionLineIndex`). 운영 v6 행 상황문으로 확인 — 승인된 요청 미션은 행동 문장이 앞, 조건 문장(「아직 …않았습니다」)이 뒤인 경우가 많아 「마지막 문장」 고정 규칙은 쓰지 않았다.
- 수정 예시 안내문의 요청 전용 표현(「부탁하는 방식」)을 일반화.
- `supabase/functions/content-review/domain.generated.mjs` 재생성(스키마 변경 반영).

## 검증

- `npm run typecheck` 통과 · `vitest` 전체 1014 통과 · `npm run build` 통과.
- 옛 흐름을 검사하던 테스트 4건을 새 흐름으로 교체(판정 O/X 즉시 표시·이유 O/X·참고 이유 표시·응답 `{ pick, reasonId }`). 샘플 미션에 `accepted_id` 추가. `actionLineIndex` 단위 테스트 3건 추가.
- localhost 로컬 체험(`/learner/practice?preview=v5&pilot=free-correction&variant=reason-contrast`)에서 MJT1~5 실제 클릭 확인, 콘솔 오류 0, 375px 폭 가로 스크롤 없음.

## 운영 반영 순서 (미실행)

1. PR 머지(= Railway 배포) + **content-review Edge 재배포** — 둘 다 새 스키마가 필요하다. 옛 코드는 strict 스키마라 `accepted_id`가 든 행을 거부한다.
2. 그 뒤에만 v6 대표본 6건(generated)에 `accepted_id` 입력. 순서를 바꾸면 운영 관리자 미리보기·검수 준비가 그 행에서 실패한다.
3. 승인·편성된 요청 v6 3건은 키가 없어 이유 정오가 안 보인다 — 편성 교체 때 키를 넣고 재승인.
