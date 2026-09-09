# 자동 품질 점검 규칙 인벤토리 — R1~R33 전수 대조 (2026-09-09)

- 대상: `src/lib/pragma/missionRules.ts` (`origin/main` `b4265d17` 시점). `add(v, "R…", …)` 호출 **122건** 전수 추출.
- 목적: 「품질 점검 규칙」 읽기 전용 화면의 데이터 원본. **UI 구현 전 인벤토리 확정용.**
- 🔴 **분류 축을 섞지 않는다.** 아래 표의 「범주」는 코드·생성계약의 공식 taxonomy가 아니라
  **현행 규칙을 기능에 따라 귀납적으로 묶은 설명용 분류**다. 화면·논문에서는 그렇게 밝힌다.
- 🔴 **코드 사실**(상태·강도·범위·메시지·위치)과 **사람이 읽을 요약**(연구자 검토 대상 초안)은 열을 분리했다.
  요약은 위반 메시지를 풀어 쓴 것이며 규칙의 의미를 확대하지 않았다. **연구자 검토 전 초안이다.**

## 0. 확정된 사실

| 항목 | 값 | 근거 |
|---|---|---|
| 번호 범위 | R1~R33 | 파일 머리 주석 `:1` |
| 폐기 | **R22** 1개 | `RETIRED_MISSION_RULE_IDS = ["R22"]` (`:95`) |
| 현행 번호 규칙 | **32개** | R1~R33 − R22 |
| 하위 ID | **R1c** (코어 스키마·카탈로그 정합) — R1과 별도 ID로 `add()`됨 | `checkCore` |
| 현행 규칙 ID 총수 | **33개** (32 + R1c) | 추출 결과 |
| 검사 지점 수 | **122개** `add()` 호출 | 번호 수 ≠ 검사 수 |
| 검사 성격 | 결정론·외부 API 0회. **필드·선택지 수·중복·길이·형식·코드값 정합만** 검사. 의미 보존·자연성·화행 구현은 검사 불가 → AI 검토·교수자 감수의 몫 | 파일 머리 주석 `:4-6` |
| 진입점 | `checkCore(coreInput, ctx)` / `checkMission(mission, ctx, core?)` | `:367` / `:503` |

🔴 **파일 머리 주석의 「코어 서브셋 = R1c·R8·R9·R10·R15·R16·R17·R19·R25·R26」은 낡았다.**
실제 `checkCore` 호출 경로에는 **R15·R19가 없고**, **R29(v3 코어)·R30이 있다.** 아래 표는 코드 실측 기준이다.

🔴 **R21 섹션 주석은 「(warning)」이라 적혀 있으나 실제 강도는 `fail`이다.** 주석이 낡았다.

## 1. 적용 단계 (어디서 실행되는가)

| 진입점 | 호출처 | 단계 |
|---|---|---|
| `checkCore` | `coreBatchRun.ts:299` | 시나리오 배치 생성 직후 (클라이언트 검사 → `save_generated_core` RPC) |
| `checkCore` | `promoteMission.ts:913` | 미션 조립 **전** 코어 재검사 |
| `checkMission` | `promoteMission.ts:686·793·1087·1593` | 조립 5단계의 **「구조 검사」** · 문항 수리 후 재검사 · 교수자 수정본 저장 시 |
| `checkMission` | `contentReviewDomain.ts:39` | 품질 관리 파이프라인의 **「규칙 검사」** 단계 (무료·1단계) |
| `checkMission` | `lockCandidateAudit.ts:117` | 후보 잠금 감사 |

**R26만 예외 경로가 있다** — `coreBatchRun.ts:316`: R26 warning이 뜬 코어에 한해 기존 core-quality의
industry 축 AI 판정을 1회 추가 실행한다(bounded adjudication). 다른 규칙은 이런 후속이 없다.

## 2. 인벤토리

축 설명 — **상태**: 현행/폐기 · **강도**: 차단(fail)/경고(warning)/혼합 · **범위**: 코어 / 미션 / 코어+미션.
**구현 위치**는 라인 번호가 아니라 `파일 · 함수명`으로 적는다(운영 화면용 안정 식별자).

### 2-1. 문항 구조 (12)

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R1 | 현행 | 차단 | 미션 | `스키마 위반: …` / `현행 mission_v5 생성계약은 독립 맥락 대비 문항을 포함한 MJT5여야 함` / `유형 순서 위반` | missionRules · `checkMission` | 미션 JSON이 스키마에 맞고, 문항이 정해진 유형 순서(MJT1→5)로 있으며, 각 문항의 판정 초점과 대역 코드가 존재하는지 |
| R2 | 현행 | 차단 | 미션 | `네이티브 MJT5 맥락 대비 판단은 비적정 대역 1개여야 함` / `DCT와 같은 앵커 PDR이어야 함` | missionRules · `checkMission` | 「맥락 대비 판단」이 비적정 대역 1개를 답으로 두고, DCT 과제와 같은 앵커 P·D·R을 쓰는지 |
| R3 | 현행 | 차단 | 미션 | `현행 native fix_choice는 수정안 3개·권장안 1개여야 함` / `valid=… (정확히 2여야 함)` | missionRules · `checkMission` | 「판단하고 고쳐보기」가 수정안 3개·권장안 1개 형식이고, 유효한 수정안이 정확히 2개인지 |
| R4 | 현행 | 혼합 | 미션 | `accepted_reason_ids가 reasons에 없는 id 참조` / `이유 선택지 문구가 중복됨` / (경고) `reason_conf pdr이 production_task와 다른 조건대` | missionRules · `checkMission` | 「이유 찾기」의 정답 이유가 선택지에 실제로 있고, 선택지가 중복되지 않으며, 이유의 역할(주원인·화용 오개념 등)이 갖춰졌는지 |
| R5 | 현행 | 혼합 | 미션 | `현행 MultiJudge는 4후보·적정 2·조정 필요 2여야 함` / `BEST 후보는 적정 대역이어야 함` / (경고) `과잉안이 유일한 최장문 — 길이 단서` | missionRules · `checkMission`, `checkMultiJudgeLength` | 「여러 초안 비교」가 4후보(적정 2·조정 2 / BEST 1·WORST 1)이고 후보가 중복되지 않으며, **문장 길이가 정답 단서가 되지 않는지** |
| R6 | 현행 | 차단 | 미션 | `문항 …: highlight …` | missionRules · `checkTargetHighlights` | 문항의 강조(highlight) 구간이 해당 목표 문장 안에 실제로 있는지 |
| R7 | 현행 | 혼합 | 미션 | `scale4 accepted가 연속 구간이 아님` / `reference_scale_code가 accepted 방향에 포함되지 않음` | missionRules · `checkMission` | 4단계 척도 문항의 정답 범위가 연속 구간이고 같은 적절성 방향인지 |
| R11 | 현행 | 차단 | 미션 | `reference_alternatives는 1~2개` / `recommended_example 없음` | missionRules · `checkMission` | DCT 참고안이 1~2개이고, 모든 문항에 권장 예시가 있는지 |
| R12 | 현행 | 경고 | 미션 | `세트 accepted 분포가 전부 동일 방향` / `세트에 within_band 정답 문항이 없음` | missionRules · `checkSetDistribution` | 세트 전체의 정답 분포가 한 방향으로 쏠리지 않았는지 |
| R18 | 현행 | 차단 | 미션 | `fix_choice accepted에 적정 대역 포함 — 부적절 계열이어야 함` | missionRules · `checkMission` | 「고쳐보기」·「이유 찾기」의 문제 대상 쪽에 적정 대역이 섞여 들어가지 않았는지 |
| R19 | 현행 | 경고 | 미션 | `… 완전 중복: … = …` | missionRules · `checkInternalDuplicates` | 세트 안에 원문·후보 문장의 완전 중복이 없는지 |
| R21 | 현행 | 차단 | 미션 | `recommended_example가 부적절 target과 동일` / `invalid 교정안과 동일` | missionRules · `checkRecommendedConsistency` | 권장 예시가 그 문항의 판정(부적절 대상·무효 교정안)과 모순되지 않는지 |

### 2-2. 조건·카탈로그 정합 (6) — 🔴 신설 범주

요청한 셀 조건(화행·수준·도메인·주제)과 카탈로그 값에 생성물이 묶여 있는지. **AI가 요청 조건에서 이탈하는 것을 막는 묶음.**

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R1c | 현행 | 차단 | 코어 | `코어 스키마 위반` / `theme '…'는 domain '…'를 허용하지 않음` / `topic_code '…'가 카탈로그에 없음` | missionRules · `checkCore` | 코어 JSON이 스키마에 맞고, theme·domain·topic이 카탈로그에 있으며 서로 허용된 조합인지 |
| R13 | 현행 | 차단 | 미션 | `target_feature '…'가 카탈로그에 없음` / `target_feature_version ≠ 카탈로그` | missionRules · `checkMission` | 목표 특징·문항 초점이 카탈로그에 존재하고 버전이 맞는지 |
| R14 | 현행 | 차단 | 미션 | `learner_label이 카탈로그 값과 다름 (AI 생성 의심)` / `closing_ko가 …` | missionRules · `checkMission` | 학습자용 라벨·마무리 문구가 카탈로그 값 그대로인지(AI가 임의로 만들지 않았는지) |
| R15 | 현행 | 차단 | 미션 | `item_focus가 요청 화행(…)과 다름` / `카탈로그 화행 ≠ 요청 화행` | missionRules · `checkMission` | 학습 목표와 각 문항의 초점이 요청한 화행과 일치하는지 |
| R17 | 현행 | 차단 | 코어 | `industry는 domain='work'에서만 (현재 …)` | missionRules · `checkCoreCommon` | 산업 필드가 직장 도메인에서만 쓰였는지 |
| R24 | 현행 | 차단 | 미션 | `unit.target_feature(…) ≠ 계획 초점(…)` | missionRules · `checkMission` | 조립된 미션의 목표 특징이 승격 입력에서 계획한 초점과 같은지 |

### 2-3. 언어 방향 (1 ID · 8 검사 지점)

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R10 | 현행 | 혼합 | 코어+미션 | `…: 한국어 원문이 아님` / `…: 중국어가 아님` / `선행 발화가 …가 아님` / `데이터 방향(…) ≠ 요청 방향(…)` / (경고) `후보 …` | missionRules · `checkSourceLang`, `checkTargetLangHard`, `checkTargetLangSoft`, `checkPrecedingLang`, `checkDirectionMatch` | 원문·목표문·후보·선행 발화가 요청한 언어 방향의 언어로 되어 있고, 데이터의 방향이 요청 방향과 같은지 |

### 2-4. 역할·상호작용 (2)

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R8 | 현행 | 차단 | 코어+미션 | `…는 인접쌍 둘째 짝 — preceding_turn 필수` / `native MJT5는 preceding_turn을 생성하지 않음` | missionRules · `checkCoreCommon`, `checkMission` | 응답형 화행(인접쌍의 둘째 짝)에는 선행 발화가 있고, 네이티브 MJT5는 선행 발화를 만들지 않는지 |
| R25 | 현행 | 차단 | 코어 | `신규 코어에 서버 주입 context_spec이 없음` / `통역 코어의 context_spec에 A/B/C 및 P·D·R=A↔B 역할 계약이 없음` | missionRules · `checkCore` | 신규 코어에 서버가 주입한 context_spec이 있고, 통역 코어는 원발화자 A·청자 B·학습자 통역사 C 역할 계약을 갖췄는지 |

### 2-5. 원문·상황 성립 (6)

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R16 | 현행 | 차단 | 코어+미션 | `통역은 source_modality='spoken'이어야 함` / `번역 셀인데 situation_ko가 구두 수행을 명시함` | missionRules · `checkCoreCommon`, `checkMission` | 번역/통역 모드와 원문 양식(서면/구두), 상황문이 말하는 수행 방식이 서로 맞는지 |
| R23 | 현행 | 차단 | 미션 | `production_task.source_text가 코어를 계승하지 않음` / `pdr가 …` / `미션 방향 ≠ 코어 방향` | missionRules · `checkInheritance` | 미션의 산출 과제가 코어의 원문·P·D·R·양식·방향을 그대로 이어받았는지 |
| R26 | 현행 | 경고 | 코어 | `지정 산업 '…'을 보여 주는 구체적 업무·대상·어휘가 없음` (subrule `industry_lexical_evidence`) | missionRules · `checkCoreCommon` · **후속** `coreBatchRun · checkIndustrySemanticFit` | 지정한 산업을 보여주는 구체적 업무·대상·어휘가 상황문에 있는지. 없으면 경고 후 산업 축 AI 판정 1회 |
| R27 | 현행 | 혼합 | 미션 | `Anchor A situation_ko가 MJT2와 동일하지 않음` / `learner situation은 140자 이내` / (경고) `상황문이 짧아 P/D/R 근거가 충분…` (subrule `dct_scene_shape`) | missionRules · `checkV4ContextPlan` | 문항별 상황문이 앵커/대비 구조를 지키고, 길이가 140자 이내이며, P·D·R 근거가 충분한지 |
| R28 | 현행 | 차단 | 미션 | `channel(…)이 … 수행 방식과 맞지 않음` | missionRules · `checkV4ContextPlan` | 문항의 채널(이메일·메신저·대면)이 산출 과제의 수행 방식과 맞는지 |
| R29 | 현행 | 혼합 | 코어(v3)+미션 | `focal_segments가 없음` / `head는 정확히 1개` / `support 구간은 최대 2개` / `원문의 부분문자열이 아님` / (경고) `… 문장 권장` (subrule 7종) | missionRules · `checkFocalDiscourse` | 미니 담화형 원문이 문장 수·글자 수 범위 안이고, 화용 집중 구간이 원문 안에 실제로 있으며 head 1개·support 최대 2개인지 |

### 2-6. 내용 금지선 (2)

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R9 | 현행 | 차단 | 코어+미션 | `국가 단위 일반화 표현: "…"` | missionRules · `checkCoreCommon`, `checkNationalization` | 상황문·해설·비고에 「중국인은/한국인은 …」식 국가 단위 일반화가 없는지 |
| R30 | 현행 | 차단 | 코어 | `학생용 situation_ko에 답안 평가 기준이 노출됨: …` | missionRules · `checkCoreCommon` | 학생에게 보이는 상황문에 답안 평가 기준이 드러나지 않았는지 |

### 2-7. 출처·계보 (4)

| ID | 상태 | 강도 | 범위 | 실제 위반 메시지 (대표) | 구현 위치 | 사람이 읽을 요약 (초안) |
|---|---|---|---|---|---|---|
| R20 | 현행 | 차단 | 미션 | `mission_content.provenance 객체가 없음` / `provenance.… 누락` | missionRules · `checkProvenance` | 생성 출처(provenance) 객체와 필수값이 기록돼 있는지 |
| R31 | 현행 | 차단 | 미션 | `item_lineage는 교수자 최종 검수 전 pending 상태여야 함` / `coverage_summary 누락` | missionRules · `checkMission` | 문항 계보가 교수자 검수 전 pending 상태이고 coverage 요약이 있는지 |
| R32 | 현행 | 경고 | 미션 | `교수자가 우선 확인할 model_unattributed claim …개` | missionRules · `checkMission` | 모델 출처가 붙지 않은 주장이 몇 개인지 — 교수자 우선 확인 대상 |
| R33 | 현행 | 차단 | 미션 | `서로 다른 진단차원을 2~6개 포함해야 함` / `…: 근거 위치·설명 계약 위반` | missionRules · `checkMission` | 진단 차원이 2~6개이고 코드가 중복되지 않으며, 각 차원의 근거 위치·설명이 계약대로인지 |

### 2-8. 폐기 (1) — 현행과 섞지 않는다

| ID | 상태 | 폐기 시점 | 대체 | 현재 검사를 막는가 | 근거 |
|---|---|---|---|---|---|
| R22 | **폐기** | 2026-08-09 | 별도 **비차단** HSK lexical audit | **아니오** — 검사에 참여하지 않음 | `RETIRED_MISSION_RULE_IDS` 주석: 「번호는 연구·운영 기록의 감사 키이므로 재사용하지 않는다. R22의 수준·HSK 휴리스틱은 2026-08-09부터 별도 비차단 lexical audit가 담당한다.」 |

폐기 사유·시점·대체는 위 주석에 있는 것이 전부다. 더 만들지 않는다.

## 3. 범주 합계 (검산)

| 범주 | ID 수 | ID |
|---|---:|---|
| 문항 구조 | 12 | R1 R2 R3 R4 R5 R6 R7 R11 R12 R18 R19 R21 |
| 조건·카탈로그 정합 | 6 | R1c R13 R14 R15 R17 R24 |
| 언어 방향 | 1 | R10 |
| 역할·상호작용 | 2 | R8 R25 |
| 원문·상황 성립 | 6 | R16 R23 R26 R27 R28 R29 |
| 내용 금지선 | 2 | R9 R30 |
| 출처·계보 | 4 | R20 R31 R32 R33 |
| **합계** | **33** | = 현행 32 + R1c ✓ |
| (폐기) | 1 | R22 |

강도별: 차단만 22 · 경고만 4(R12·R19·R26·R32) · 혼합 7(R4·R5·R7·R10·R27·R29 + R21은 차단만) → 정정: 혼합 6.
범위별: 코어만 5(R1c·R17·R25·R26·R30) · 코어+미션 5(R8·R9·R10·R16·R29) · 미션만 23.

## 4. 사람이 읽을 요약 — 작성 원칙

- 각 줄은 **해당 규칙의 위반 메시지들을 한 문장으로 풀어 쓴 것**이다. 메시지에 없는 의도·이론·설계 원리를 붙이지 않았다.
- **연구자 검토 전 초안**이다. 틀린 곳·과한 곳은 연구자가 고친다.
- 해석 경계(연구자 지시): 한 규칙이 논문의 설계 원리 전체를 대표한다고 쓰지 않는다.
  예) R30은 「정보 공개 통제를 구현하는 규칙 **중 하나**」이지 「3.5의 정보 공개 설계를 구현한다」가 아니다.
  R20·R33은 「출처·계보 관리와 **연결되는** 자동 통제」이지 추적 체계 전체의 입증이 아니다.

## 5. 이 인벤토리에서 코드로 바로 가져올 수 있는 것 / 새로 쓴 것

| 바로 가져옴 (코드 사실) | 새로 씀 (연구자 검토 대상) |
|---|---|
| 규칙 ID · 강도 · 위반 메시지 원문 · subrule 이름 · 함수명 · 폐기 목록 · 진입점과 호출처 | **범주 7개의 이름과 경계** · **규칙별 요약 33줄** · 범주별 한 줄 설명(미작성) · 화면 머리말(미작성) |
