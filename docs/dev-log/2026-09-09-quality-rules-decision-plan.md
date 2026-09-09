# 자동 품질 점검 규칙 — 연구자 결정안·최소 수정 계획 (2026-09-09)

> 🔴 **대체됨(2026-09-09 당일).** Codex 독립 감사(`2026-09-09-quality-rules-codex-evidence.json`·`-probes.mjs`)와 판정서
> `2026-09-09-quality-rules-fable-adjudication.md`가 이 문서의 결정표를 대체한다. 연구자 결정 항목은 **Codex 감사 §10의 8개**를
> 쓴다. 아래 본문은 이력으로 남기며, 다음 진술은 코드 대조로 **틀린 것으로 확인**됐다.
>
> | 이 문서의 진술 | 정정 (코드 근거) |
> |---|---|
> | add() 122곳 / fail-only 22 | **127곳**(R1c 5곳 포함) / fail-only **23**·warning-only 4·혼합 6 |
> | R9: 장소구 2건만 제거하면 fail 유지 가능 | 「…일반화는 **피해야 한다**」(부정문)도 fail. 정규식으로 의미를 확정할 수 없다 → **warning + 검토 대상** |
> | R30: fail 유지, 문구만 축소 | 「조명의 **강도**를 조절한다」가 fail. 수리 경로는 멀쩡한 문장을 고쳐 쓰는 경로다 → **warning** |
> | R16: 장면 정규식만 warning으로 분리하면 됨 | 그것 + **실제 코어 payload 양식↔ctx 비교가 누락**돼 있다(`:434` ctx끼리만 비교). 구조 검사 보강도 필요 |
> | R31: 릴리스 상향 시 기존 미션 전부 fail | **반대.** `:925-927` 게이트 때문에 옛 미션은 검사를 **건너뛴다**. 위험은 차단이 아니라 감사 공백 |
> | R27 비대칭에 근거 없음 | 8/25·8/30 dev-log에 이유가 있다(수정 불가한 기존 DCT 상황). 근거를 **연결**할 일이지 새로 만들 일이 아니다 |
> | 대역 규칙군: 화면·논문·요약에서 「적정」 금지 | 과했다. **규칙 설명문**에서만 「적절성 판정」 표현을 피한다. 학습자용 판단 라벨 「적정/비적정」은 유지 |
> | R20: 서버가 해시 일치·버전 실재 보장 | Edge가 해시를 **계산**, SQL은 형식·검수 상태를 **확인**. 진위 검증 아님 |
> | R23: 계승하면 다른 검사도 자동 충족 | 근거 없음. 다섯 필드 정확 비교뿐 |
> | R4·R10 fail / R26 warning→AI 후속 공통 | R4·R10은 **혼합**. R26 AI 후속은 **배치 경로에서만** 확인 |
> | 「경고로 내리면 AI 검토 확인」(SHOULD) | 우선순위 오류. `contentReviewDomain.ts:40-42`가 규칙 finding을 전부 `needs_professor:false`·`where:""`로 변환 → **어댑터를 먼저 고치지 않으면 warning 강등 = 침묵**. 이것이 첫 번째 MUST |
>
> 유지되는 것: 「보완 수용」 결론, R16 분리는 새 R번호가 아닌 subrule, `RuleId` 유니온(Codex descriptor 구조의 1단계), R14 문구 중립화, R22 retired 유지.

- 선행: `2026-09-09-quality-rules-inventory.md`(존재) → `2026-09-09-quality-rules-design-audit.md`(타당성) → **이 문서(결정)**.
- 이번에 새로 대조한 코드: `missionRules.mode.test.ts`·`missionRules.audit.test.ts`·`contentRelease.ts`·`coreBatchRun.ts:296-312`·`add()`(`missionRules.ts:183`).
- 코드 수정 없음. 아래는 **연구자가 판정할 표**와 **승인 뒤 실행할 최소 계획**이다.

## A. 최우선 결정표

| 항목 | 현행 (코드 사실) | 문제 | Fable 권고 | 판정 |
|---|---|---|---|---|
| **R9** | `NATIONALIZE` 정규식 10구. 코어 `situation_ko`·`relation_ko` + 미션 해설·note·이유·후보 note. **fail** | `중국에서는`·`한국에서는`은 장소 부사구 → 사실 진술 오탐. `중국 사람들은`은 **현행 미탐**(GPT 차단 예시가 지금은 통과) | **수용** — ① 장소구 2종 제거(MUST) ② `(중국\|한국)\s*사람(들)?은` 추가는 별건 확장(SHOULD, 자체 fixture) | 수용 / 보완 / 기각 |
| **R16** | 구조 2건(mode↔modality) + 장면 정규식 2건, 모두 **fail**, 한 ID. `evidence.subrule` 기제 존재(R26·R27·R29가 사용) | 장면 정규식은 2026-07-31 본배치 오탐 4건·3차 확장 이력. `mode.test.ts:43`이 장면 차단을 **fail로 고정** | **수용 — subrule 방식.** `mode_modality_mismatch`(fail) / `scene_modality_cue`(warning). 새 R번호는 감사 키 이력을 끊어 **비권장** | 수용 / 보완 / 기각 |
| **R30** | `coreLearnerSceneIssue` 3패턴. **코어 `situation_ko`만.** fail. 수리 프롬프트(`PROBE_LEARNER_SCENE_EVALUATION_ERROR`)가 1회 자동 교정 | 패턴 ②(`정중하게 요청`)가 상대 행위 서술에 오탐. 미션 문항 장면 미검사 | **수용 — fail 유지**(수리 경로가 있어 차단 비용 낮음). 문구 축소 MUST. 확대는 **신규 규칙(R34)** — R30 범위를 바꾸면 과거 R30 기록의 뜻이 바뀐다 | 수용 / 보완 / 기각 |
| **R31** | `attribution.prompt_version !== CURRENT_ITEM_LINEAGE_PROMPT_VERSION` → fail. 상수 출처 = `contentRelease.ts:33` = **`CURRENT_CONTENT_RELEASE.itemLineagePromptVersion`** | 릴리스 상향 = 규칙 동작 변경. 교수자에게 보이지 않음 | **수용 — 유지 + 적용 조건 공개.** 결합은 임의 프롬프트 편집이 아니라 **콘텐츠 릴리스 승격**에 걸려 있다(대시보드 대기열도 같은 상수 사용) — 체계적 결합 | 수용 / 보완 / 기각 |
| **R33** | `provenance.prompt_version === CURRENT_MISSION_PROMPT_VERSIONS[0]`일 때만 실행. 상수 = `contentRelease.ts:32` | 구버전 미션은 조용히 건너뜀. 「현행」으로 나열하면 과장 | **수용 — 유지 + 「현행 릴리스 버전 미션 한정」 표기 필수** | 수용 / 보완 / 기각 |
| **대역 규칙군** R2·R3·R5·R7·R12·R18 | `accepted_band_codes`가 `within_band_code`를 포함/배제하는지 등 **생성기 자기 라벨의 일관성**. 적절성 계산 없음 | 메시지·주석의 「적정 대역」이 적절성 판정으로 읽힘 | **수용 — 로직 불변, 사람용 표현만 교정**: 「참조 대역 라벨 정합성 확인」 | 수용 / 보완 / 기각 |
| **taxonomy** | 없음(설명용) | — | **보완 수용** — 7범주 확정, **예외 1건 명시**(R16이 두 성격) | 수용 / 보완 / 기각 |
| **catalog 구조** | `add(id: string)` · `RuleViolation.id: string` | 복제하면 두 번째 정본 | **수용** — `RuleId` 유니온 + `add(id: RuleId)` + `Record<RuleId, HumanMetadata>`. 보증 범위는 「ID 누락」까지라고 명시 | 수용 / 보완 / 기각 |

## B. MUST / SHOULD / CAN

**MUST — 논문 기준본 전 수정 필수**
1. **R9 코드**: `중국에서는|한국에서는` 2구 제거. (`중국 문화에서는`·`한국 문화에서는`·`일반적으로 …`·`…어 화자는`·`…인(들)?은`은 유지)
2. **R16 코드**: 장면 정규식 2건 → `warning` + `evidence.subrule`. 구조 2건에도 subrule 부여.
3. **R30 문구**(문서·화면·논문): 「코어 상황문의 정형 평가 단서 차단(정중·완화·선택권·강도류 표현)」. 「정보 공개 통제」로 쓰지 않음.
4. **R31·R33 적용 조건 문구**: 「현행 콘텐츠 릴리스(`CURRENT_CONTENT_RELEASE`) 버전 미션에 적용」.
5. **대역 규칙군 문구**: 화면·논문·요약에서 「적정」 대신 「참조 대역 라벨 정합성」.
6. **논문 4.3.3**: 규칙이 보는 것 = 「필드·선택지 수·중복·길이·형식·코드값 정합, 생성기 라벨 일관성, 정형 표현」이라는 한 문장(원고는 연구자·Codex).

**SHOULD — 화면 전 보완**
7. R9 총칭 주어 확장 `(중국|한국)\s*사람(들)?은` (자체 fixture).
8. R21 주석 「(warning)」→ 「(fail)」 · `missionRules.ts` 코어 서브셋 주석 실측치로 · `promoteMission.ts:4` 「R1~R24」→ 「R1~R33」.
9. R14 메시지 「AI 생성 의심」 → 「카탈로그 고정 문구와 다름」.
10. AI 검토 기준에 「수행 매체(서면/구두) 일치」가 포함돼 있는지 확인 — R16 장면 검사를 warning으로 내리면 그 판단이 AI·교수자로 가야 하는데 **검토 프롬프트가 그것을 보는지 미확인**.
11. `RuleId` 유니온 리팩터 + 카탈로그 골격(내용은 비워도 됨).
12. R27 비대칭(문항 fail / DCT warning) 근거 주석.

**CAN — 후속**
13. 주석 MPJ→MJT 25곳. 14. R30 패턴 ② 오탐 축소. 15. R26 정규식 적중 시 AI 판정 생략 구멍. 16. R34(미션 장면 평가 단서) 신규 설계.

## C. 최소 코드 수정 계획 (승인 후 실행)

| # | 파일 | 대상 | 변경 성격 | 시험 | 회귀 위험 |
|---|---|---|---|---|---|
| 1 | `missionRules.ts` `:125` `NATIONALIZE` | R9 | 정규식에서 `중국에서는\|` · `한국에서는\|` 제거 | `audit.test.ts:175` 기존 fixture(`중국인들은 일반적으로`) **그대로 통과** + 신규 fixture §D-1 | 낮음. 과거에 이 2구로 차단된 코어가 있었다면 지금은 통과 — **재검사 시 결과가 바뀌는 콘텐츠 수**를 배포 전 1회 계수 |
| 2 | `missionRules.ts` `:436-456` `checkCoreCommon` | R16 | 장면 2건 `"fail"`→`"warning"` + `{ subrule: "scene_modality_cue", context: { mode } }`. 구조 2건에 `{ subrule: "mode_modality_mismatch" }` | `mode.test.ts:43`「저장 전 차단한다」→ 「경고로 남기고 저장한다」로 재작성. `r16Warnings` 헬퍼 활용 | **중간**. 지금까지 버려지던 코어가 **저장**된다(`coreBatchRun:299` fail만 폐기). AI·교수자 검토 부하 증가. 저장은 되지만 승인은 규칙 verdict `warning` 허용이라 막히지 않음 → **10번 SHOULD 확인 필수** |
| 3 | `missionRules.ts` `:79-85` + `:183` | 타입 | `export type RuleId = "R1" \| "R1c" \| … \| "R33"` (R22 제외) · `export type RetiredRuleId = "R22"` · `add(v, id: RuleId, …)`. **`RuleViolation.id`는 `string` 유지**(DB에 저장된 과거 violations JSON 호환) | 컴파일. 122개 호출이 전부 유니온에 있어야 통과 — **R1c는 여기서 강제로 잡힌다** | 없음(타입만) |
| 4 | 신규 `src/lib/pragma/qualityRuleCatalog.ts` | 카탈로그 | `Record<RuleId, { category; human_summary; applicability_note? }>` + `retired: Record<RetiredRuleId, {…}>`. 강도·메시지·범위 **없음** | 컴파일(누락 시 실패) | 없음 |
| 5 | `missionRules.ts` 주석 `:8` `:501` `:1353`(R21) · `promoteMission.ts:4` | 주석 | 실측치로 교정 | — | 없음 |
| 6 | `missionRules.ts` `:819` `:822` | R14 메시지 | 「AI 생성 의심」 → 「카탈로그 고정 문구와 다름」 | 메시지 단언 시험 있으면 갱신 | 없음 |

**순서**: 3 → 4(골격) → 1 → 2 → 5 → 6. 3을 먼저 하면 1·2를 고칠 때 컴파일러가 ID 오타를 막는다.

## D. 수정 후 시험

**D-1 R9** (`audit.test.ts` 또는 신규 `missionRules.nationalize.test.ts`)
- 통과: `한국에서는 설 연휴에 많은 기관이 쉰다.` · `중국에서는 이 서비스를 모바일로 이용할 수 있다.` · `중국인 담당자는 이번 주에 출장 중이다.`(특정 인물 — `중국인`+명사)
- 차단(현행 유지): `중국인은 원래 직접적으로 말한다.` · `중국인들은 일반적으로 이렇게 요청을 받아들인다.`(기존) · `한국 문화에서는 체면이 중요하다.` · `일반적으로 중국 회사는 회신이 늦다.`
- 경계(문서화만): `중국인은 A씨다.`(특정 지시인데 총칭형 → 오탐 허용) · `한국 사람들은 대체로 거절을 돌려서 한다.`(**SHOULD 7 적용 전에는 통과 = 미탐**, 적용 후 차단)

**D-2 R16** (`mode.test.ts` 재작성)
- 구조: 번역+`spoken` → `R16` fail, subrule `mode_modality_mismatch`
- 장면: 번역 셀 「글로 남기지 않고 직접 말하는」 → `R16` **warning**, subrule `scene_modality_cue`, `result === "warning"`(저장됨)
- 부정 처리 회귀(주석 ①②③): 「남기지는 않습니다」「남기려는 목적은 아닙니다」「남지 않으며」 → warning으로 잡힘(fail 아님)

**D-3 R30** (`mode.test.ts` 기존 `r30Fails` 확장)
- 차단: 「부담을 주지 않도록 정중하게 …」 · 「완화 표현을 유지하며 …」
- **오탐 기록용**(현행 통과 기대 아님, 문서화): 「고객이 정중하게 환불을 요청했다.」→ 현행 fail. CAN-14의 기준선

**D-4 R31/R33** (`audit.test.ts`)
- `CURRENT_CONTENT_RELEASE`와 다른 `prompt_version`을 가진 v5 미션 → R33 **미발생**(건너뜀) 을 명시적으로 단언 — 「조건부 적용」을 시험이 문서화
- `attribution.prompt_version` 불일치 → R31 fail

**D-5 RuleId/catalog**
- 컴파일이 시험이다. 추가로: fixture 세트에 `checkCore`·`checkMission`을 돌려 **emitted id ⊆ RuleId** 단언(오타 방지). **누락 탐지는 시험이 아니라 `add` 타입이 한다** — 시험 이름에 그렇게 적는다

## E. 수정 후 UI에 보여도 되는 것

| 그대로 | 연구자 설명문 승인 후 | 여전히 과장 금지 |
|---|---|---|
| RuleId · 강도(실행 결과에서) · 위반 메시지 원문(실행 결과에서) · subrule · 폐기 R22와 대체물 · 파일 머리 주석의 범위 한정 문장 · R31/R33 「현행 릴리스 버전 한정」 조건 · 범주(「연구자가 기능에 따라 묶은 설명용」 표기) | human_summary 33줄 · 범주별 한 줄 설명 7개 | 「적절성을 판정」 · 「문화 일반화를 방지」(→ 「정형 총칭 표현 차단」) · 「정보 공개를 통제」(→ 「코어 상황문의 정형 평가 단서 차단」) · 「출처를 보장」(→ 「출처 필드 존재 검사」) · 규칙 수·`add()` 수 · 적용 단계를 실측 시점 없이 |

## F. 최종 판정

> 자동 규칙이 맡을 수 있는 명시적 조건은 자동화하되, 의미·화용 판단은 AI 검토와 교수자 감수에 남겨두는 역할 분리가 실제 코드에서도 지켜지는가?

**33개 중 30개는 지킨다.** 넘은 것은 R9의 장소구 2건·R16의 장면 정규식 2건·R30의 패턴 ②이고, 앞의 둘은 **코드 한 줄·두 줄**로 되돌아온다. R30은 수리 경로가 있어 fail을 두되 **말을 줄이면** 된다.

> 최소한 무엇을 고쳐야 논문·코드·운영 화면의 설명이 다시 일치하는가?

코드 2건(R9·R16) + 문구 4건(R30·R31/R33 조건·대역 어휘·4.3.3 한 문장). 이 여섯이 끝나면 규칙 체계는 자기가 하는 일만큼만 말하게 된다.
