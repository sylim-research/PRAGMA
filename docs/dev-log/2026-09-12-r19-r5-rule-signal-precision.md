# R19·R5 규칙 정밀화 — 감사부터 배포까지 · 2026-09-12

대상 = 결정론 규칙 R19(세트 내 완전 중복)·R5(multi_judge 길이 단서).
결과 = **교수자가 항목별로 결정해야 하는 규칙 warning 107 → 17**. 규칙 삭제·강등·게이트 완화 0.
커밋 `618e295c` · PR #149 · main `b21c18b8` · **content-review Edge v37 → v38 배포 완료**.
감사 전문 = `docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/r19-r5-rule-audit.md`,
원자료 = 같은 폴더 `r19-r5-findings.json`(20건 전 문항의 P/D/R·원문·후보·대역·R19/R5 finding).

---

## 1. 왜 했나

운영 20건이 `next=professor`에 도달했을 때 교수자가 결정해야 할 항목이 **128건**이었다.
각 항목마다 `no_change` 같은 판정 + 10자 이상 사유가 필요하고 화면에 일괄 처리가 없다.

내역을 세어 보니 **규칙 warning 111건 중 R19 80 + R5 27 = 107건(84%)** 이었다.
「지적이 많다」가 아니라 **지적의 대부분이 한 곳에서 나온다**는 것이 출발점이었다.

## 2. 어떻게 측정했나 (read-only)

DB·콘텐츠·검수를 일절 건드리지 않고 사실만 뽑았다.

1. `tools/checklist-data.ts` — 운영 20건의 active 검수행 id·해시·게이트 상태를 뽑아
   `checklist-data.json`으로 저장(관리자 계정으로 read-only 조회).
2. `tools/r19-r5-extract.ts` — 그 20건의 `content_review_runs.rules.findings` 중 **R19·R5만**
   골라, 그 규칙이 실제로 읽은 문항 내용(문항별 type·item_focus·pdr·source·target·후보·대역·
   교정안)과 **나란히** `r19-r5-findings.json`에 저장. 규칙 출력과 입력을 같은 파일에 둔 것이
   이후 판정의 근거가 됐다.
3. 각 finding을 다섯 유형으로 분류했다 — **A** 표면상 정답 누설 / **B** 경계 / **C** 오탐 /
   **D** 구조 결함 / **E** 판단 불가.

**측정 결과**

| 규칙 | 건수 | 분류 |
|---|---|---|
| R19 | 80 | **C 80 · A 0 · B 0 · D 0 · E 0** — 실제 결함 0, 오탐률 100% |
| R5 | 27 | A 6 · B 11 · C 10 |

## 3. 무엇이 문제였나

### R19 — 설계가 만든 사실을 결함으로 세고 있었다

R19는 5문항의 `source`끼리, 그리고 `target`+교정안+MJT5 후보끼리 NFKC·trim 후 **완전 일치**만
본다. threshold 없음, warning 고정, 중복 쌍 하나당 finding 하나.

그런데 현행 계약은 **문항 2·3·4가 같은 Anchor A 사건**을 쓰도록 만들어져 있다. 학습자가 한 발화를
판단(MJT2)하고 고치고(MJT3) 이유를 찾는(MJT4) 구조다. 그리고 이 동일성은 권고가 아니라 강제다:

- 생성 프롬프트가 「MJT3·4는 정확히 복사, 서버도 A를 고정」이라 지시한다.
- **R27이 Anchor A 상황문이 다르면 `fail`** 로 막는다(`missionRules.ts` `checkV4ContextPlan`).

즉 R19의 finding 공간은 설계에 의해 **미션당 정확히 4건**(`source 2=3`, `source 2=4`,
`target 2=3`, `target 2=4`)으로 포화돼 있었고, 20건 × 4 = 80건이 전부 그것이었다.
진짜 결함(문항 1·5의 재사용, 후보=교정안)은 「5번째 finding」으로 나타나야 하는데 **0건**이었다.

이미 알려져 있던 문제다 — 카탈로그 설명문 자체가 "의도된 Anchor 공유도 함께 잡힌다"고 적고 있었고,
09-09 감사에서도 확인된 뒤 후속으로 미뤄져 있었다.

### R5 — 길이 차이에 여유(margin) 기준이 없었다

길이 단서 검사 3종이 **간격을 전혀 보지 않고** 발동했다.

| 검사 | 이전 조건 |
|---|---|
| ① 과잉안이 유일한 최장문 | 유일성만 봄, 2등과의 간격 무관 |
| ② 과소안이 전부 최단 | **유일성조차 안 봄** — 적정안이 같은 길이여도 발동 |
| ③ 대역 그룹 완전 분리 | 분리 여부만 봄, 두 무리 사이 간격 무관 |

그 결과 **1자·3자 차이**나 **9%** 차이가 정답 누설 신호로 올라왔다. 같은 화용 자원을 다르게
실현하면 한두 글자는 당연히 달라진다. ②는 ①에 있는 유일성 검사가 빠져 있어 동률에서도 발동하는
비대칭이 있었다.

## 4. 무엇을 바꿨나

### R19 — Anchor 슬롯 면제

```ts
const ANCHOR_SLOT_ITEM_IDS = new Set([2, 3, 4]);
const slotOf = (itemId) => anchorSlotShared && ANCHOR_SLOT_ITEM_IDS.has(itemId) ? "anchor" : null;
// 중복을 찾았을 때, 두 항목이 같은 슬롯 안이면 보고하지 않는다
if (first.slot !== null && first.slot === (value.slot ?? null)) continue;
```

- `slot`은 **`source`와 `target`에만** 붙는다. **교정안·MJT5 후보는 `slot: null`** 이라 면제 대상이 아니다.
- `anchorSlotShared`는 `checkMission`의 `isCurrentNativeV5`를 그대로 받는다 = `contrast_plan_v1`을
  선언한 현행 계약 미션에만 적용. **R27이 동일성을 강제하는 조건과 정확히 같은 조건**이다.
  옛 데이터의 판정은 전혀 바뀌지 않는다.
- 여전히 발동: 문항 1(X)·5(Y)가 앵커와 같은 원문/판단 대상을 쓸 때, 교정안·후보 문장의 재사용.

### R5 — 여유 하한 + 최단 유일성

```ts
const CUE_MIN_GAP_CHARS = 4;
const CUE_MIN_GAP_RATIO = 0.1;
const isLengthCue = (gap, shorterSide) =>
  gap >= CUE_MIN_GAP_CHARS && shorterSide > 0 && gap / shorterSide >= CUE_MIN_GAP_RATIO;
```

**4자 이상 AND 짧은 쪽의 10% 이상** — 둘 다 넘어야 신호. 세 검사 모두에 적용.

- ① 최장문: 2등과의 간격에 적용.
- ② 최단: **최단이 아닌 후보들의 최소 길이와의 간격**에 적용 → 간격 조건이 유일성까지 겸한다
  (적정안이 최단과 동률이면 간격 0이라 미발동). ①과의 비대칭 해소.
- ③ 분리: 「분리됨」만 보던 것을 **두 무리 사이의 실제 간격**으로 바꿈.
- ④ 최장/최단 비율 > 3 → **변경 없음**(이번 20건 발동 0).
- R5의 **구조 fail 6종**(후보 수·대역 분포·문장 중복·PDR 한 축) → **전부 그대로 `fail`**.

### 카탈로그 설명 동기화

`qualityRuleCatalog.ts`의 R19·R5 `summary_ko`를 실제 동작에 맞게 고쳤다. R19의 "의도된 Anchor
공유도 함께 잡힌다"는 서술은 더 이상 사실이 아니다.

## 5. 어떻게 검증했나

검증을 **네 층**으로 나눠 돌렸다. 특히 ①이 이번 작업의 핵심이다.

### ① 실데이터 재현 — 예측과 실측을 맞춰 봄

감사가 "R19 80→0, R5 27→17"을 예측했으므로, **고친 predicate를 `r19-r5-findings.json`의
실제 20건에 그대로 재생**해 숫자가 맞는지 확인했다(스크래치패드 스크립트, DB 접근 0·모델 호출 0).

```
w2-0   R19 4→0   R5 2→1      w9-1   R19 4→0   R5 1→0
w2-1   R19 4→0   R5 1→1      w10-0  R19 4→0   R5 2→1
…
R19 total 80 → 0    (감사 예측 80 → 0)
R5  total 27 → 17   (감사 예측 27 → 17)
교수자 결정 규칙 warning: 107 → 17
```

**예측과 정확히 일치.** 이 단계가 없으면 "줄어들긴 했다"까지만 말할 수 있다.

### ② 회귀 테스트 2건 신규 (`missionRules.audit.test.ts`)

기존 샘플 `SAMPLE_MISSION_V5_NATIVE`에는 `contrast_plan`이 없어서 **새 경로를 타지 않는다**.
그래서 `contrast_plan_v1`을 선언한 미션을 만드는 헬퍼를 두고 세 가지를 한 테스트에서 검사했다.

- Anchor 공유 미션: `R27 == []`(설계대로) **이면서** `R19 == []`(더 이상 안 셈)
- 문항 1이 앵커 원문을 복사 → R19 **여전히 발동**
- MJT5 후보가 교정안을 재사용 → R19 **여전히 발동**

R5는 길이를 직접 지정해 세 가지를 검사했다.

- `[20,20,20,22]`(2자·10%) → 최장문 경고 **미발동**
- `[20,20,20,30]`(10자·50%) → 최장문 경고 **발동**
- `[12,20,12,25]`(적정안이 최단과 동률) → 최단 경고 **미발동**

기존 9건도 전부 통과 → 파일 **11/11**.

### ③ 전체 회귀

- `npx vitest run` → **928 passed · 0 failed**(3 skipped)
- `npm run typecheck` clean (⚠️ `tsc --noEmit` 단독은 가짜 통과 — `npm run typecheck`만 신뢰)
- `node --test scripts/content-review-db.test.mjs` → **32/32**
- `npm run build` 성공
- CI(Typecheck, tests, production build) green

### ④ 운영 영향 확인 — 무엇이 안 바뀌는가

- `professorReviewFindings()`가 **저장된 `run.rules`** 를 읽는 것을 코드로 확인
  (`supabase/functions/_shared/contentReview.ts:115-123`). SQL `content_review_required_findings`도
  같은 저장 행을 쓴다 → **화면이 보여 주는 결정 목록과 승인 검증이 어긋나지 않는다.**
- `content-review/index.ts`의 `rules` 액션은 기존 행의 `rules`를 **덮어쓰지 않는다**
  (미승인 행에 대해 `approval_policy`·`generation_quality`만 갱신) → 기존 20건은 그대로.

## 6. 배포

```
scripts/build-content-review-domain.mjs  →  supabase/functions/content-review/domain.generated.mjs 재생성
npx supabase functions deploy content-review --use-api      →  v37 → v38
```

`missionRules`는 이 번들을 통해 **content-review Edge에서만** 실행된다. `generate-scenario`는
자체 topology 검사기를 쓰므로 **재배포 불필요**. DB·RPC·RLS·migration 변경 0.

## 7. 🔴 `rules_version`을 올리지 않은 결정과 그 대가

`contentReviewDomain.ts`의 스냅숏에는 규칙 카탈로그 버전 문자열이 들어 있다.

```ts
const snapshot = { content, criteria: { version: CONTENT_REVIEW_VERSION,
  // Rule corrections get a new content hash without replacing prior runs.
  rules_version: "mission_rules_v13_professor_signal_flow", … } };
```

`content_hash = reviewHash(snapshot)`이므로 **이 문자열을 올리면 20건의 content_hash가 전부 바뀌고,
`inspect()`가 기존 active 행을 찾지 못해 승인 경로가 끊긴다.** 그 20건은 Claude 검토·adjudication·
prepared_finalization까지 끝나 사람 단계만 남은 상태였다.

그래서 **의도적으로 올리지 않았다.** 귀결은 둘 다 참이다.

- ✅ 기존 20건의 검수 행·승인 경로는 **온전히 보존**된다.
- ⚠️ 기존 20건의 교수자 지적은 **128건 그대로**다. 고친 규칙은 **앞으로 계산되는 검수부터** 적용된다.
- ⚠️ 한 버전 문자열이 **두 predicate 개정**을 가리키게 된다. 재현성은 커밋 `618e295c`로 추적한다.

**다음에 규칙을 고칠 사람에게**: 기존 검수 행을 살릴 필요가 없는 시점(예: 새 release/run으로 콘텐츠를
새로 만들 때)이라면 `rules_version`을 올리는 쪽이 정상 경로다. 살려야 한다면 위 대가를 받아들이거나,
`rebind_content_review_gate`와 같은 방식으로 의미 증거를 새 해시의 행으로 옮기는 RPC가 필요하다.

## 8. 함정 (다음 배포 때 재발함)

- **worktree `.env.local`에 BOM(`EF BB BF`)이 있어 `supabase` CLI가 config 파싱에서 죽는다.**
  `failed to parse environment file: … unexpected character "" in variable name`.
  BOM을 임시로 제거하고 배포한 뒤 원복했다. 이 파일은 gitignore 대상이고 값은 CI 플레이스홀더다.
- `npx tsx`가 worktree에 설치돼 있지 않아 첫 실행에서 임시 설치된다.

## 9. 이번에 하지 않은 것

- **교수자 최종 승인 20건** — 여전히 대기. 승인자 계정 미결.
- **신호/판단 분리**(감사 §D의 공통 지렛대) — 107건 중 101건은 규칙이 아니라
  `contentReviewDomain.ts`의 `isSignal = level === "warning"` → `needs_professor: true` 어댑터에서
  나온다. 결정론 warning을 「표시 신호」와 「판단 요구 신호」로 나누면 R9·R30·R16·R32만 남는다.
  **approval contract 변경이라 이번 범위에서 제외**했고 선택지로만 남긴다.
- R5에 남은 17건(A 6 + B 11)은 **눈검사 대상으로 의도적으로 남긴 것**이다. 초과분이 초점 자원
  자체(과잉 유보·메타 언급 등)인 건들이라 규칙이 자동으로 가릴 수 없다.
- 범위 밖 관찰: MJT5 후보 저장 순서가 20/20 모두 `within·under·within·over`로 동일하다.
  학습자 화면에서 섞이는지는 확인하지 않았다.
