# 인계 · C7 마지막 국소수정과 공식 검수 재실행 · 2026-09-11

이전 세션이 컨텍스트 과부하로 끊겼다. 새 세션은 이 문서만 읽고 이어 간다. 상세 경위는 `docs/dev-log/2026-09-11-reason-item-contract-and-reaudit.md` 1–17절.

## 작업 환경

- worktree: `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.worktrees\admin-takeover-2026-09-10`
- 브랜치: `codex/scene-grounding-live-corrections-2026-09-10` (main에 병합된 뒤 문서 커밋만 앞서 있음)
- 관리자 스크립트 실행: worktree 루트에서 `node docs/research-trail/evidence/2026-09-11-reason-item-repair/tools/run-with-env.cjs <script.ts> [args]`. `.env`는 `../../.env`(메인 레포 루트)에서 읽고 값을 출력하지 않는다.
- Supabase CLI(`functions list`, `db query`)는 PowerShell에서, worktree 안에서 실행한다.
- 엣지 배포는 `npm run edge:deploy -- <fn>`만 쓴다(main lineage guard). 이번 단계에서는 배포할 것이 없다.

## 연구자 지시(현재 유효)

- 공식 검수 v3 결과를 수용. **A 13건은 동결**(수정·재검수 금지). **C 7건만 마지막 국소수정** 후 그 7건만 production gate + 공식 content-review 재실행.
- generator / Reason 계약 / critic / review policy 변경 금지. 20건 전체 새 review version 금지.
- 기존 행·검수 결과 보존. DB 직접 덮어쓰기 금지. 교수자 승인·편성 금지.
- 이번 수정이 **마지막 콘텐츠 정리**다.

## 이미 끝난 것

### C7 국소수정 (`c7-fix/content-fix.ts`, 결과 `c7-fix/<key>-fix.json`)

미션 수준 수정은 `reviseMissionDraft`로 새 content_hash와 lineage 판본을 남겼다. 코어 수준 수정(원문·상황문)은 코어 제자리 편집 경로가 없어서, 수정 코어를 의미 검사한 뒤 **새 코어 행**으로 저장하고 기존 미션을 그대로 옮긴 다음 미션 수정을 적용했다. 원본 행과 그 검수 행은 손대지 않았다.

| key | 방식 | 행 | 수정 | production gate |
|---|---|---|---|---|
| w6-0 | 미션 | def83b4f | Reason r3 → 「‘明天没办法…那一小时班’으로 날짜와 범위가 문장 끝에 와서, 무엇을 거절하는지가 끝에서야 드러나기 때문이다.」 | **pass** |
| w5-0 | 미션 | b9a5249f | MPJ1 target·권장안 「不收参加费」→「不收费」 · DCT 참고 2 「…你有空的话，想邀请你也一起来。不用有压力，轻轻松松来就好！」 | fail (r1 1건) |
| w5-1 | 미션 | 793a1576 | MJT2 해설에 활동 차이(주최 독서 모임 → 출연 공연 관람) 반영. **R=mid는 유지**(아래 판단) | fail (r3·r1 2건) |
| w13-1 | 미션 | 26412ba9 | 권장안·유효 교정안 「…时间上方便吗？」→「…意见请在明天上午之前告诉我。」(기한 원문대로), 관련 해설 3곳 정렬, MPJ5 「旁边的一支备用笔」→「旁边那支备用笔」 | fail (r3·r1 2건) |
| w12-0 | 코어 | 013cc144 → **97c4834a** | 원문·DCT 원문·focal 「가능한 빨리」→「가능한 한 빨리」, 「앞으로도」→「앞으로는」 · Reason r1(해설과 불일치하던 「这让我很不方便」 오답) → 「‘你在我预约的时段还一直用着会议室’로 첫머리부터 ‘你’를 주어로 상대의 행동을 서술해, 불만이 사실 확인보다 지적으로 먼저 들릴 수 있기 때문이다.」 | **pass** (코어 의미 검사 pass) |
| w6-1 | 코어 | 09bc6c81 → **34e8b1fd** | 상황문(코어·DCT)에 「내일 점심」 추가 · MPJ4 해설의 잔존 문구 「‘再接’이 업무를 반납했다는 뜻…」→「‘你’·‘吧’의 말투나 결론을 이유보다 앞에 둔 순서는 부차적인 관찰이지 주원인이 아닙니다.」 | **pass** (코어 의미 검사 pass) |
| w10-0 | 코어 | 1f6d8863 → **1baacb9c** | 상황문(코어·DCT)에 「이 단체방에서는 친한 사이여도 서로 존댓말을 쓴다.」 · MPJ1 「做些分区指示牌摆好」→「做几块分区指示牌摆在入口」(highlights 포함) · MPJ5 후보 4개·권장안 「那家有我们俩都爱吃的菜的面馆」→「那家面馆有我们俩都爱吃的菜，…」 | fail (r1·r2 2건) |

- **w12-0의 「问题都在你这边」**: 앵커(MJT2·3·4) 중국어에 대응 한국어 문장이 없는 것은 사실이지만, 이것은 over_attributed 대역을 만드는 **의도된 조작**(정답 r2와 해설이 바로 이 추가를 문제로 짚음)이라 수정하지 않았다. 연구자가 「실제로 의미 추가가 존재한다면 최소 수정」이라고 했으므로 **보고 때 이 판단을 명시하고 확인받을 것**.
- **w5-1 R=mid 판단**: R은 청자에게 드는 시간·비용·일정 부담이다. 토요일 오전 교외 방문 + 발표 뒤 짧은 강평은 주말 반나절 이동을 요구하지만, 강평은 「짧게」로 한정되고 교수의 통상 지도 업무 범위 안이다. 같은 미션의 MPJ1(주말 90분 독서 모임)·MJT2(주말 90분 공연)도 mid다. 방어 가능하다고 보고 PDR은 바꾸지 않았다. **보고 때 근거를 명시하고 확인받을 것.**
- 새 행으로 옮긴 3건의 원본(013cc144·09bc6c81·1f6d8863)과 옛 w6-1 700f0bdd는 **보관·삭제 없이 보존**. 보관은 새 행 교수자 승인 뒤 별도 승인.
- 새 manifest = `v3-manifest-after-c7.json` (20건 canonical; w12-0·w6-1·w10-0이 새 행).

### production gate의 남은 fail (w5-0·w5-1·w13-1·w10-0, 모두 Reason 오답)

critic note가 「오답이 주원인과 무관하거나 부차적이어야 하나 … 부차적 설명이 되지 못한다」처럼 앞선 절과 같은 자기모순 패턴이다. 이번 지시(마지막 정리, critic 튜닝 금지)에 따라 **더 고치지 않았다**. 공식 검수 결과와 함께 교수자 판단 사항으로 보고한다.

## 진행 중이던 것 (세션 종료 시점)

공식 content-review를 7건에 대해 실행 중이었다: `official-review.ts prepare` 7건 → **7/7 professor 단계 도달**(rules·finalization 완료), 이어서 `official-review.ts independent` 7건. 끊긴 시점까지 결과:

| key | Claude | adjudication |
|---|---|---|
| w5-0 | finding 1 | 1 |
| w5-1 | finding 0 | 불필요 |
| w6-0 | finding 2 | 2 |
| w6-1 · w10-0 · w12-0 · w13-1 | 실행 중이었음 | — |

백그라운드 프로세스는 이전 세션과 함께 계속 돌았을 수 있다. **먼저 DB 상태를 확인한 뒤** 빠진 것만 실행한다.

**완료(다음 세션):** 1–6단계 끝. 결과는 `2026-09-11-reason-item-contract-and-reaudit.md` 18절. 이 인계 문서는 더 이상 진행 안내가 아니다.

**갱신(이전 세션 종료 직전):** 백그라운드 작업이 exit 0으로 끝났다. 러너 로그상 7건 모두 `next=professor`, 오류 없음.

| key | Claude finding | adjudication |
|---|---|---|
| w5-0 | 1 | 1 |
| w5-1 | 0 | 불필요 |
| w6-0 | 2 | 2 |
| w6-1 | 1 | 1 |
| w10-0 | 3 | 3 |
| w12-0 | 2 | 2 |
| w13-1 | 3 | 3 |

따라서 할 일 2(빠진 Claude 실행)는 필요 없을 것이다. 할 일 1(status)과 3(DB 검증)으로 **DB에서 이 결과를 확인**한 뒤 4~6으로 간다. finding 원문과 adjudication 판정(accept/refine/reject)은 아직 읽지 않았다.

## 새 세션의 할 일 (순서)

1. **상태 확인(읽기 전용)** — worktree 루트에서:
   ```
   node docs/research-trail/evidence/2026-09-11-reason-item-repair/tools/run-with-env.cjs docs/research-trail/evidence/2026-09-11-reason-item-repair/official-review.ts status w5-0,w5-1,w6-0,w6-1,w10-0,w12-0,w13-1
   ```
   각 줄의 `next`가 `professor`이고 `claude`가 숫자(0 포함)이며 Claude finding이 있는 건은 `adj`가 채워져 있어야 한다. `running_stage`가 남아 있으면 lease(5분) 만료를 기다린다.
   - 주의: `official-review.ts`는 `status-20cells-20260911-frozen.json`의 key→id를 쓰지 않고 run 파일(`.tmp/scene-grounding/scene_grounding_course_20260910/<key>-core.json`)에서 id를 읽는다. 세 건의 run 파일은 이미 새 행으로 바뀌어 있다.
2. **Claude가 빠진 건만** `official-review.ts independent <keys>` 실행(이미 끝난 단계는 서버가 재사용, 재호출 없음). 반복 재시도 금지 — 실패하면 1회만.
3. **DB 검증(읽기 전용)**:
   ```
   node .../tools/run-with-env.cjs .../tools/v3-verify.ts docs/research-trail/evidence/2026-09-11-reason-item-repair/v3-manifest-after-c7.json docs/research-trail/evidence/2026-09-11-reason-item-repair/v3-content-review-runs-after-c7.json
   ```
   20/20 v3 행, rules, finalization, Claude 대상 7의 결과, adjudication, professor-ready, 원본 행 보존을 확인한다. (`v3-verify.ts`의 OLD 상수는 700f0bdd만 본다. 새로 대체된 3건 원본의 보존은 `scenarios`에서 따로 확인.)
4. **Claude/adjudication 원문 덤프**: `tools/claude-findings-2.ts`는 content_hash 앞 8자리로 key를 매긴다. 새 해시에 맞게 KEYS 맵을 갱신해 쓰거나, `v3-verify.ts` 출력 파일의 `claude_and_adjudication`을 읽는다.
5. **연구자 보고**(요청 형식 그대로):
   1. 7건별 before → after (위 표)
   2. production gate 결과 7/7 (pass 3 · fail 4, fail은 Reason 오답 자기모순 패턴)
   3. 공식 content-review professor-ready n/7
   4. 남은 accept/fail finding (Claude·adjudication + production fail)
   5. A 13 + 수정 7 = 최종 20건 승인 준비 상태
   + 판단 요청 2건: w12-0 「问题都在你这边」 유지 근거, w5-1 R=mid 유지 근거.
6. dev-log `2026-09-11-reason-item-contract-and-reaudit.md`에 18절로 기록, evidence 커밋·push. 메모리 `pragma-current-status.md` 갱신.

## 금지 (다시 확인)

콘텐츠 추가 수정 · Reason 계약/generator/critic/review policy 변경 · 20건 재검수 · 교수자 승인 · override 입력 · 편성 · 원본 행 보관/삭제 · DB 직접 수정.
