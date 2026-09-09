# 자동 품질 점검 규칙 — 신호/구조 분리 구현 (2026-09-09)

- 근거: Codex 독립 감사 `2026-09-09-quality-rules-codex-independent-audit.md` §10 결정 8개에 대한 연구자 결정(2026-09-09, 채팅). 선행 Fable 결정안은 `2026-09-09-quality-rules-decision-plan.md` 머리말대로 대체됨.
- 원칙: **기계적 계약 검사 = fail, 정규식·집계로 위험을 추정하는 검사 = warning(교수자 확인 신호).** warning은 저장을 막지 않는다.
- 검증: `npm run typecheck` 통과 · vitest 전체 139 파일 882 tests 통과 · `scripts/build-content-review-domain.mjs --check` 통과 · Codex 반례 스크립트(`docs/research-trail/evidence/2026-09-09-quality-rules-codex-probes.mjs`) 재실행.
- 하지 않은 것: Edge `content-review` 배포(번들만 재생성·커밋), migration, 생성계약 정본 §8.1의 R26 강도 표기 수정(정본 변경은 별도 승인), 프롬프트 변경.

## 연구자 결정 8개와 반영

| # | 결정 | 반영 |
|---|---|---|
| 1 | R9 → warning + 교수자 표시 | `missionRules.ts` 코어·미션 R9 두 지점 warning, `subrule: nationalization_cue` |
| 2 | R30 → warning; PDR 칩·정상 업무 서술·명시적 학습 지원 허용 | 코어 R30 warning, `subrule: learner_scene_evaluation_cue`. 서버 1회 자동 수리(`coreSourceRepair`)는 유지 |
| 3 | R16 구조 fail 유지 + payload 비교 추가, 장면 정규식 warning | 코어: `mode_modality_mismatch`(fail) · **신규 `payload_modality_mismatch`**(fail, 코어 `source_modality` ≠ 요청) · `scene_modality_cue`(warning). 미션: 번역 방향도 대칭 검사(`translation ↔ production_task.mode`, `translation ↔ written`) |
| 4 | R31 구조 fail 유지, 20% 초과 차단은 교수자 판단으로 | 20% 초과 → **R31 fail 대신 R32 warning**(`subrule: unattributed_over_reference_ratio`) |
| 5 | R33 현행 유지, 「선언 구조 검사」로 표기 | 코드 불변. 카탈로그 설명에 적용 조건·한계 명시 |
| 6 | 과거 콘텐츠: 저장 당시 계약 기준, 미검사를 pass로 표시하지 않음 | 코드 불변(게이트 유지). UI 구현 시 카탈로그 `applicability_ko` 사용 |
| 7 | R26 후속: 배치·개별 통일 | `checkIndustrySemanticFit` export(`IndustryCriticCell`) → `AdminGenerator.generateCores`가 R26 warning일 때 배치와 같은 industry AI 검토 1회. fail·호출 실패 = 저장 안 함 |
| 8 | Codex 7분류 채택 | 신규 `src/lib/pragma/qualityRuleCatalog.ts` — `Record<RuleId, …>`, 범주·`nature`(structural/signal/governance)·요약·적용 조건. 검토 상태 `draft_pending_researcher_review` |

## 함께 고친 것

- **어댑터 우선 수정**(`contentReviewDomain.ts`): 규칙 finding을 전부 `needs_professor:false`로 넘기던 것을 → warning은 `needs_professor:true`·`problem_type_ko:"교수자 확인 신호"`, `issue_ko`에 `R16/scene_modality_cue:` 형태로 subrule 노출. `rules_version` → `mission_rules_v12_signal_warnings`(검수 해시가 바뀌어 기존 run을 덮지 않음).
- `RuleId` 유니온 + `ACTIVE_RULE_IDS`: `add(id: RuleId)`로 미등록 ID는 컴파일 실패. `RuleViolation.id`는 저장 JSON 호환을 위해 string 유지.
- R10 필드 공백: `recommended_example`·`production_task.reference_alternatives`도 target 언어 검사(중국어 산출의 한글 혼입 fail, 그 외 warning). `checkTargetLangSoft` 라벨 인자 문자열화.
- R14 메시지 「AI 생성 의심」 → 「카탈로그 고정 문구와 다름」.
- 주석 정정: 파일 머리(API 0회 범위·코어 서브셋 실측·설명층 위치), `looksChinese`, `checkTargetLangSoft`, `checkCoreCommon`(미션 미호출), R21(fail), R12(within 보장 출처), `assertCatalogIntegrity`(호출처 없음), `promoteMission.ts:4`, `missionSchema.ts:214`.

## 시험

- `missionRules.mode.test.ts` 재작성: R16 장면 = warning·저장 허용, 구조 2종(`mode_modality_mismatch`·`payload_modality_mismatch`) = fail, 부정 표현 회귀 4건은 「R16 없음」으로 유지, R30 warning + 「조명의 강도」 알려진 오탐이 저장을 막지 않음을 고정.
- `missionRules.audit.test.ts`: R9 warning, 부정문 fixture 추가.
- `itemLineage.test.ts`: 미귀속 100% → R31 없음·R32 `unattributed_over_reference_ratio`.
- `qualityRuleCatalog.test.ts`(신규): 카탈로그 키 = `ACTIVE_RULE_IDS`, 7범주 각 ≥1, signal 규칙 설명에 warning/교수자 확인 명시, 실행 결과 `violation.id ⊆ ACTIVE_RULE_IDS`.

## Codex 반례 스크립트 재실행(변경 전 → 후)

| 반례 | 전 | 후 |
|---|---|---|
| R9 부정문 「일반화는 피해야 한다」 | fail | warning |
| R30 「조명의 강도를 조절한다」 | fail | warning |
| R16 코어 payload 양식 불일치 | 미탐 | fail/payload_modality_mismatch |
| R16 번역 요청 + interpreting payload | 미탐 | fail/mode_modality_mismatch |
| R10 참고 산출안 언어 오류 | 미탐 | fail |
| R9 우회 표현·미션 상황문, R30 미션 상황문, R20 가짜 hash, R23 invalid core 생략, R27 소수점, R11 R1 선행 차단 | 그대로 | **그대로(후속)** |

## 운영 영향 — 배포 전 확인할 것

- R9·R16 장면·R30이 warning이 되어 **이전에 버려지던 코어가 저장된다.** 그 신호는 품질관리 화면에서 `needs_professor=true`로 교수자에게 간다(어댑터 수정). 배포 후 첫 배치에서 warning 건수를 한 번 본다.
- Edge `content-review`는 번들만 갱신했다. **배포는 승인 후** `npx supabase functions deploy content-review --use-api`.
- 개별 생성(`/admin/generator`)에서 R26 warning 시 유료 AI 호출이 1회 추가된다.

## 후속(CAN)

R30 미션 상황문 확대(신규 규칙 또는 R30 범위 + `rules_version`), R9 총칭 주어 확장 `(중국|한국)\s*사람(들)?은`, R27 문장부호 계수 보정, R23 invalid coreInput 명시, R20 hash 형식 검사, 저장 계층의 evidence 보존, MPJ→MJT 주석, 생성계약 §8.1 R26 표기.
