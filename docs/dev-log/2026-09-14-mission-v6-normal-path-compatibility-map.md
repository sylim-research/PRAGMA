# mission_v6 정상 승인·저장 경로 — 호환성 blocker map

- 날짜: 2026-09-14
- 분류: [단독 진행 적합] — 실행 경로의 읽기 확인과 메모리 내 순수 함수 probe. 구현·운영 DB 적용 없음.
- 작업공간: `C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.tmp/request-course-pilot-20260914`
- branch / HEAD: `codex/request-course-pilot-2026-09-14` / `8dd14fbe8bd9518a11142b8a5db2936c8dadaf5f`
- 기존 v6·Reason/Contrast 미커밋 구현을 유지했다. 동결 콘텐츠·커리큘럼·60개를 재검토하지 않았다.
- 상태: **v6 설계/계약 채택 완료, 운영 E2E 0/3 및 runtime/DB 호환성 검증 미완료**.
- 아래는 변경 후보다. 앱 코드·SQL migration·프롬프트·운영 데이터는 이번에 변경하지 않았다.

## 결론

승인 parser와 DB CHECK의 두 허용 목록만 수정하면 완료되는 상태가 아니다. 편성 후보 필터 외에 **승인 검수의 v5 구조 의존, 정상 승인 metadata를 거부하는 v6 strict schema**가 있다. 별도로 실제 learner runtime 초기 응답 직렬화 문제도 확인했다.

현재 정상 경로의 상태·권한·hash·승인 계보 규칙을 바꿀 이유는 찾지 못했다. v5 검수에 v6를 억지로 넣거나 검사 전체를 pass로 반환하는 수정은 제외한다.

## 실제 경로의 gate

A = 단순 allowlist/버전 parser 확장 가능. B = v5 구조 의존이라 별도 검토 필요. C = 기존 v5 전용 분기로 유지.

| 순서·지점 | 분류 | 확인한 조건과 최소 수정 후보 |
| --- | --- | --- |
| 승인 자료 읽기: `src/lib/mission/missionDb.ts:101,112` | A | `fetchMissionForReview`가 기존 `normalizeMission`만 호출한다. 정상 승인 진입에서 v6-aware parser를 사용하고 반환 타입을 전달한다. `AdminAssembly.tsx:456,706`에서 실패하면 승인 workbench 자체가 열리지 않는다. |
| 승인 검사: `src/lib/pragma/contentReviewDomain.ts:33,44` 및 `missionRules.ts:553,559` | B | 첫 parser에서 v6가 R1 fail. parser만 바꿔도 유형 순서·axis/item_focus·fix_choice의 accepted_band_codes·세트 분포 등이 v5/legacy 전제다. 기존 v6 validator와 적용 가능한 기존 공통 검사를 별도 버전 분기로 연결해야 한다. |
| 검수 기준: `contentReviewDomain.ts:107–115` | B | AI 검수 snapshot의 mission_design이 Anchor A 공유를 단정한다. v6에만 채택된 흐름·Reason/Contrast 설명과 별도 rules_version을 제공한다. 기존 검수 실행·교수자 판단·결과 형식은 유지한다. |
| 승인 체험 모델: `src/lib/pragma/instructorExperience.ts:24–25` | A | parser가 v6를 거부한다. 기존 canonical v6 adapter로 연결한다. 8개 section ID·승인 상태·판단 저장 형식은 유지한다. 단, 현행 focused 승인에서는 체험 완료가 항상 강제 gate인 것은 아니므로 이를 모든 승인 차단으로 과장하지 않는다. |
| 최종 승인 클라이언트: `src/lib/pragma/promoteMission.ts:1657,1675` | A | prepared_finalization을 기존 parser로 검사해 RPC 전에 거부한다. 이 함수의 parser/반환 타입만 v6 지원으로 연결한다. RPC에는 검사 전의 정확한 prepared artifact를 그대로 전달한다. |
| 승인 artifact / learner load: `src/lib/pragma/missionV6.ts:51–61` | B | strict top-level schema에 authoring·quality_check·hsk_lexical_audit·item_lineage가 없다. 기존 필드 계약을 동일하게 재사용해 명시적인 optional 4개만 추가한다. finalization이 metadata를 붙인 뒤 재검사하거나 learner가 DB 원본을 읽으면 현재 schema가 거부한다. |
| generated/reviewed 저장: `supabase/migrations/20260815010000_authoritative_mission_release.sql:236–247` | A | scenarios_mission_ck가 v1~v5만 허용한다. 새 migration에서 동일 CHECK의 목록에 v6만 추가한다. 기존 migration 파일을 고치지 않는다. 이 결과는 저장소 정의 기준이며 운영 catalog 실측은 아니다. |
| 편성 후보: `src/lib/curriculum/composer.ts:134–137` | A | is_native_mpj5가 schema=v5 AND 문항 5개만 허용한다. (v5 OR v6) AND 문항 5개로 한정 확장한다. composerPlanning의 자동/수동 후보·필터가 이 값을 소비하므로 운영 metadata나 편성 규칙 변경은 필요하지 않다. |
| published course 연결·learner release 조건 | 변경 없음 | reviewed/released, 현행 release, course/assignment/week/scenario/hash 조건을 그대로 충족해야 한다. v6 전용 우회는 없다. |
| learner load parser: `missionDb.ts:71`, `CanonicalMissionRun.tsx:2585` | 연결 있음 | 실제 canonical 호출은 이미 includeV6=true다. 위 승인 metadata 수용 문제를 먼저 해결해야 한다. DEV generated 허용을 정상 3건 E2E의 근거로 사용하지 않는다. |
| attempt 직렬화·insert: `missionAttemptRow.ts:118–140`, `missionLog.ts:77` | 연결 있음 | v6 tuple 검사와 기존 JSONB 응답 envelope를 사용한다. 여기에는 추가적인 v1~v5 저장 allowlist를 찾지 못했다. DB round-trip은 아직 실행하지 않았다. |

A의 타입 전달은 승인 경로를 잇는 범위에 한정한다. `AdminAssembly`의 preview state, `ProfessorMissionWorkbench`의 mission prop 등은 타입 영향 대상이다. 교수자 화면 개편이나 문항 editor 일반화는 포함하지 않는다.

## B의 구체적인 최소 diff 후보

### 1. 승인 metadata를 기존 계약으로 수용

`MissionV6Schema`의 raw object에 아래 네 필드만 추가한다. 각 shape에는 이미 optional이 포함되어 있다.

```ts
authoring: MissionV5NativeSchema.shape.authoring,
quality_check: MissionV5NativeSchema.shape.quality_check,
hsk_lexical_audit: MissionV5NativeSchema.shape.hsk_lexical_audit,
item_lineage: MissionV5NativeSchema.shape.item_lineage,
```

top-level strict·문항 tuple·MJT3 3개·MJT5 4개·Reason ID 검사 등 채택된 validator는 유지한다. optional은 기존 metadata 없는 v6 checkpoint의 읽기 호환을 위한 것이며, 정상 승인 RPC의 필수 metadata 요건을 면제하지 않는다. 임의 pass·가짜 provenance를 채우지 않는다.

### 2. 기존 승인 검사 안에서 v6만 분리

- 기존 `normalizeMission`의 v1~v5 의미는 유지한다. 승인 입구는 이미 있는 `normalizeLearnerMission`의 version dispatch를 재사용할 수 있다.
- `checkMission`에는 v6 분기를 두고 `MissionV6Schema`로 채택된 구조를 검사한다. 기존 v1~v5 본문은 유지한다.
- 공통 적용 대상은 실제 교과목/코어와의 direction·speech_act·target_feature 일치, mode/source_modality, 실제 provenance, DCT 원문·PDR·usable_facts 계승, 해당 scope의 최종화 lineage 정합이다. 기존 검사 함수·RuleResult·fail/warning 의미를 재사용한다.
- 기존 장면·언어 관련 교수자 확인 신호도 적용 가능한 입력에 한해 유지한다. 이를 새 정답 판정이나 고정 오류 taxonomy로 만들지 않는다.
- v5 전용 유형 순서, axis_feature/item_focus, contrast_plan/Anchor A, accepted_band_codes 구조, 정확한 적절안 수·세트 분포·카탈로그 closing 문구 등을 v6에 복사하지 않는다.
- `contentReviewDomain`의 v6 criteria는 “scale4 → scale4+inline reason → fix_choice → free_correction+optional feedback contrast → multi_judge → DCT”라는 확정 계약을 설명한다. 이유 선택의 정답·설명 능력 점수를 만들지 않는다.
- `supabase/functions/content-review/domain.generated.mjs`는 기존 `scripts/build-content-review-domain.mjs`로 재생성해야 실제 Edge 검사에 반영된다. 새 생성기를 만드는 작업이 아니며, 이번에는 실행하지 않았다.

### 3. A의 최소 변경 모양

```diff
- r.mission_schema_version === "mission_v5" &&
+ (r.mission_schema_version === "mission_v5" ||
+  r.mission_schema_version === "mission_v6") &&
  Array.isArray(r.mission_mpj_items) && r.mission_mpj_items.length === 5
```

CHECK의 최종 조건은 현재와 동일하며 허용 값만 추가한다.

```diff
- IN ('mission_v1','mission_v2','mission_v3','mission_v4','mission_v5')
+ IN ('mission_v1','mission_v2','mission_v3','mission_v4','mission_v5','mission_v6')
```

승인 parser 세 곳과 체험 parser는 raw v6 분기/기존 v1~v5 분기를 분리한다. hash를 계산하거나 RPC로 넘길 때 normalized 객체로 원본을 덮어쓰지 않는다.

## 실제 차단과 구분할 조건부 경로

- **B — candidate 최초 점검/수정에 기존 quality_check를 사용할 때:** `generate-scenario/index.ts:4721–4723`의 nativeMpj5는 v5만 true이며, v6는 `buildQualitySystemPrompt:3283`에서 legacy MPJ4 지시를 받는다. 이는 즉시 schema reject와는 다른 **검수 계약 오적용**이다. 해당 경로를 3건 준비에 사용한다면 기존 critic의 format 설명을 v6용으로 한정 분기해야 한다. nativeMpj5=true만 부여하면 v5 Anchor/분포 규칙까지 적용되므로 불가하다. 기존 모델·응답 형식·finding 코드·승인 절차는 유지하며 생성 prompt 일반화는 하지 않는다.
- **B — 같은 draft에서 수정 저장을 실제 사용하는 경우:** `promoteMission.ts`의 `reviseMissionDraft`도 기존 parser/check/critic에 의존한다. 이번 정상 승인 map을 이유로 전체 생성·수리 경로의 normalizeMission을 일괄 교체하지 않는다. 필요한 경우 이 경로만 별도 범위를 확정한다.
- **C — 구형 관리자 조립 미리보기:** `MissionPreview.tsx:146–154`는 fix_choice/free_correction에서 accepted_band_codes를 전제한다. 정상 최종 승인 화면(reviewMode)에는 이 컴포넌트가 렌더되지 않는다(`AdminAssembly.tsx:708`). 이를 모든 승인 경로의 blocker로 세지 않는다. 타입 전파 시 v5 전용 경계를 유지해야 하며 조립 화면의 v6 표시 지원을 완료했다고 보고하지 않는다.
- **추가 목표어 필드의 최종화 coverage:** 현행 lineage target 수집/검사(`generate-scenario/index.ts:1423`, `itemLineage.ts:112`)와 HSK 수집(`_shared/hskLexicalAudit.ts:88`)은 v6 revision_examples·MJT4 reference_alternatives·contrast.target을 열거하지 않는다. 현재의 버전 reject gate는 아니며 hash 누락도 아니다. 이번 허용 목록 수정에 자동 포함하지 않고 coverage 한계로 남긴다. 기존 최종화 검증 전체를 생략하는 근거로 사용하지 않는다.

## 그대로 유지할 v5 분기와 승인·저장 불변조건

- **C:** `missionSchema.normalizeMission`의 v1~v5 normalization, canonical adapter의 v5 rendering, `CanonicalMissionRun.tsx:2082`의 v5 response mapping. v6가 먼저 별도 분기된다.
- **C:** `save_generated_mission_revision`의 기존/새 schema_version 동일 조건(`20260825033000_mission_authoring_pipeline.sql:222`). 같은 공개 ID를 v5→v6로 바꾸는 경로로 사용하지 않는다.
- **C:** v5 특정 prompt_version에만 적용하는 native_mpj5/item_lineage/streamlined_comparison/authoring SQL trigger. v6에 옛 prompt_version을 거짓으로 부여하거나 v5 교육 규칙을 확장하지 않는다.
- 최종화 함수(`generate-scenario/index.ts:4482–4557`)는 version allowlist 없이 raw mission을 보존하고 authoring·lineage·HSK·hash를 붙인다. Reason/Contrast도 기존 hash 본문에 포함된다.
- `instructionalMission`과 SQL instructional projection은 기존 metadata만 제외하므로 새 학습 콘텐츠를 hash에서 누락하지 않는다. hash 알고리즘 변경 후보 없음.
- `finalize_reviewed_mission`은 현재 검수 ID/hash·prepared artifact·교수자 판단·generated 상태·최종화 metadata·원문 일치·lineage를 검증한다. 최신 본체 `20260906100000_focused_content_review.sql:166` 및 후속 quality-signal/v3 approval/gate-rebind 보정을 확인했으며 추가 v5 format gate를 찾지 못했다.
- `save_generated_mission`은 실제 quality metadata와 미션 없는 코어를 요구한다. version 차단은 CHECK에서 발생한다. 이번에 candidate 3건을 저장하지 않았다.
- `assert_learner_course_assignment`(`20260829183000_scope_lock_attempt_lineage.sql:56–98`)의 published course·assignment·reviewed/released lineage/hash 검증과 로그 trigger를 유지한다.
- 기존 DCT feedback 호출에는 추가 v5 format gate를 찾지 못했다. 기존 evaluator를 재사용한다.

## 별도 P0 — 미완성 v6 응답을 learner 최초 render에서 직렬화

- **v6-specific 여부: 예.** 호출부는 공통이지만, 빈 응답을 거부하는 완료 tuple serializer는 v6 분기에만 연결되어 있다. 기존 v5 trace builder는 미완성 필드를 허용한다.
- **3건 E2E 차단 여부: 예(P0).** 선행 승인/DB gate를 해결해도 정상 v6 runtime이 초기 responses={}로 이 경로를 호출하면 수행 전에 예외가 난다. 근거는 호출 경로의 정적 대조와 순수 함수 예외 재현이며, 인증된 실제 화면 E2E는 아직 실행하지 않았다.
- **최소 수정 가능 여부: 예.** 기존 completed 상태를 사용해 v6의 완료 전 peerChoices 직렬화만 보류하고, 완료 후 기존 함수를 호출한다. 저장 validator·v5 분기·집계 semantics는 유지한다.
- `CanonicalMissionRun.tsx:2407–2410`의 peerChoices useMemo가 runtime이 있으면 매 render에 `buildRuntimeMpjTraces`를 호출한다.
- v6 분기(:2034)는 완료된 5문항 응답을 요구하는 `buildMissionV6Responses`를 호출한다. 최초 responses={}일 때 예외가 발생한다. 순수 함수 호출로 예외를 확인했으며 authenticated learner 화면에서 재현한 결과는 아니다.
- 최소 수정 후보: v6에서는 완료 전 이 파생값 계산을 보류하고, 완료 후 기존 serializer를 호출한다. v5 동작과 저장 시 strict validation은 유지한다. 응답 복원 UI·새 집계 상태/필터·집계 계산 변경은 필요하지 않다.
- 이는 v5 allowlist 문제가 아니라 실제 learner 진입의 선행 결함이다. 이번에 수정하지 않았다.
- 사용자 후속 지시에 따라 이 세 판정으로 조사를 종료한다. 범용 learner lifecycle·restore 문제로 확장하지 않는다.

## 검증 및 다음 실행 경계

- branch/HEAD 및 현재 실행 경로를 대조했다. 운영 DB catalog·원격 함수 배포 상태는 조회하지 않았다.
- 파일 출력 없는 esbuild 메모리 bundle로 대표 Reason/Contrast fixture의 네 동작을 확인했다: 기존 v6 schema pass / 기존 parser와 checkMission은 거부(R1 fail) / metadata 4개는 unrecognized_keys / 빈 응답 직렬화는 예외.
- metadata probe의 빈 객체는 필드 내용의 유효성 검사가 아니라 **최상위 키 자체가 미지원인지** 확인하는 데만 사용했다.
- 첫 probe는 샌드박스 상위 경로 읽기 차단으로 시작하지 못했다. 같은 읽기 전용 명령만 좁게 승인 후 재실행해 위 결과를 얻었다. 앱·Vite 설정 변경 없음.
- 이번에는 회귀 suite·빌드·DB 저장 E2E를 실행하지 않았다. 이전 61개 통과를 정상 운영 E2E의 증거로 대체하지 않는다. 과거 UI 테스트 2개의 environment-blocked / not executed 기록도 유지한다.
- 향후 3건의 P0: 제출 시 확정된 MJT2 scale_code/reason_id, MJT4 revised_text, MJT5 후보 순서별 candidate_band_codes가 DB 저장 후 재조회한 JSON에서 동일해야 한다. 현행 MJT4 UI는 제출 전 trim하므로 “원응답” 비교 기준은 제출된 값이다. raw 입력의 양끝 공백 보존까지 구현됐다고 주장하지 않는다.
- 이번 산출물은 최소 diff **후보와 blocker map**이다. B의 검수 분기까지 연결되어야 정상 호환성 수정이 완료된다. 운영 E2E 전에는 실제 배포 gate 확인도 필요하다.
- dev-log: 이 파일. DEC-20260914-02에 상태/근거 링크를 보강하고 EVD-20260914-02로 probe 증거를 연결했다. 새 학습설계 결정은 없다.

[논문 영향 3줄]
1. 수치·버전·배포: 설계 채택 유지, 운영 E2E 0/3, 배포·공개 60개 변경 없음.
2. 화면: 기존 localhost Reason/Contrast 유지, 화면 구현 변경 없음.
3. 프롬프트·계약: 기존 계약 유지, 호환성 변경 후보만 제시하고 미구현.
