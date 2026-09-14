# mission_v6 — 구현 중단 시점 검토 보고

> 아래 검토 보고는 중단 시점의 기록을 보존한다. 이후 사용자 정식 채택 결정과 실제 E2E 준비 상태는 마지막 **「정식 채택 후속 · 정상 경로 E2E 사전 확인」** 절을 따른다.

- 일자: 2026-09-14
- 작업공간: `C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.tmp/request-course-pilot-20260914`
- branch / 기준 HEAD: `codex/request-course-pilot-2026-09-14` / `8dd14fbe8bd9518a11142b8a5db2936c8dadaf5f`
- 상태: 사용자 지시에 따라 구현은 보존하고 기능 수정 중단. **정식 format 채택은 미결정**이다. 코드 주석의 `adopted` 표현은 채택 완료의 증거가 아니다.
- [독립 검토 필수] 핵심 schema가 추가된 미확정 diff다. 구현·검증 근거를 먼저 제시하는 단계이며 독립 검토나 release 확정을 수행한 것은 아니다.
- SQL·DB·생성기·집계·교수자 화면 변경, 콘텐츠 확장, 운영 배포 없음. 기존 동결 fixture 내용도 수정하지 않았다.

## 1. 변경 파일과 핵심 diff

앱 파일은 기존 6개 수정 + 신규 4개, 총 10개다. 아래와 별개로 이 보고서만 기록했다. 이전 persistence blocker 기록은 앞선 작업에서 만든 문서다.

| 파일 | 상태 | 핵심 diff |
| --- | --- | --- |
| `src/lib/pragma/missionV6.ts` | 신규 | 별도 v6 Zod schema, 명시적 다섯 문항 tuple, learner 전용 normalization. 기존 `normalizeMission`은 수정하지 않음. |
| `src/lib/mission/missionV6Responses.ts` | 신규 | v6 전용 응답 tuple validator와 UI 응답→trace 변환. |
| `src/lib/mission/missionV6Sample.ts` | 신규 | 동결 fixture의 원문·후보·해설·참고문을 형식 검증용 v6 샘플로 투영. 기존 ID·승인·hash·모델 provenance를 복사하지 않음. 새 교과목 콘텐츠 3건은 아님. |
| `src/lib/mission/missionV6.test.ts` | 신규 | 22 tests: 기존 normalization 호환, v6 구조 거부 조건, fixture 내용 보존, 방향/통역 metadata, 응답 매핑·저장 행 검증. |
| `src/lib/mission/missionDb.ts` | 수정 | learner fetch에 `includeV6` 형식 선택 옵션 추가. 조회 쿼리·release guard 유지. 기존 기본 fetch·관리자 검수 parser는 그대로 v1~v5. |
| `src/lib/mission/canonicalMissionRuntime.ts` | 수정 | v6만 scale/scale/fix/free/spectrum으로 투영. 짧은 맥락과 저장된 요약 사용. 기존 DCT 구성 경로 재사용. |
| `src/lib/mission/canonicalMissionPreview.ts` | 수정 | view model에 선택적 `missionFormat`과 `learnerContextCopy` 추가. |
| `src/pages/learner/CanonicalMissionRun.tsx` | 수정 | v6 전용 응답 변환 진입, 도입 생략·직접 교정·짧은 맥락 표시. 기존 v5 응답 분기 유지. |
| `src/lib/mission/missionAttemptRow.ts` | 수정 | `revised_text?: string`, v6일 때만 응답 재검증. 기존 JSONB envelope `mpj_response_v2`와 `mission_schema_version: mission_v6` 사용. |
| `src/lib/mission/missionFeedback.ts` | 수정 | 입력 타입을 DCT 호출이 사용하는 `direction/unit/production_task`로 좁힘. 호출 body·평가 로직 변화 없음. |

## 2. validator의 구조적 조건 전체

### 2.1 최상위와 공통 조건

- 최상위 키: `schema_version`, `direction`, `learning_goal`, `unit`, `mpj_items`, `lesson_points`, `production_task`, 선택적 `provenance`. 다른 키는 `.strict()`로 거부한다.
- `schema_version`은 `mission_v6`만 허용한다.
- `direction`은 `ko_zh` 또는 `zh_ko`만 허용한다.
- `learning_goal`은 정확히 `kind: speech_act`, `speech_act: request`다. 이 객체도 미정의 키를 거부한다.
- `unit`: 기존 v5 schema 재사용. `target_feature`, `target_feature_version`, `learner_label`, `closing_ko`는 길이 1 이상 문자열이다. 추가 검사로 `target_feature`를 **`request_mitigation_optionality`에 고정**한다. unit 버전의 카탈로그 일치나 문구 일치는 여기서 검사하지 않는다.
- 각 MJT 공통 필수값: `id`, `type`, `short_label`, `title`, `prompt`, `source`, `situation_ko`, `relation_ko`, `channel`, `pdr`, `learner_context_ko`.
- v6 자체 정의의 일반 텍스트는 문자열이고 공백만으로 구성될 수 없다. 문자열 자체를 trim하여 바꾸지는 않는다. `learner_context_ko`는 필수 문자열이지만 빈 문자열도 허용한다.
- MJT의 `channel`: `email/messenger/facetoface/phone` 중 하나.
- PDR: p는 `speaker_lower/equal/speaker_higher`, d는 `close/acquaintance/distant`, r은 `low/mid/high` 중 하나씩 필요하다.
- 각 문항·교정 후보·스펙트럼 후보·요약 객체는 미정의 키를 거부한다. 재사용한 unit/provenance 및 일부 DCT 중첩 객체는 기존 Zod의 기본 unknown-key 처리(strip)를 따른다.

### 2.2 문항 구성

| 대상 | 강제 조건 |
| --- | --- |
| 전체 MJT | 정확히 5개, ID와 순서가 `1 scale4 / 2 scale4 / 3 fix_choice / 4 free_correction / 5 multi_judge`. |
| MJT1·2 | `target`, `explanation_ko` 필수. 참고 척도 코드는 매우 적절/다소 적절/다소 부적절/매우 부적절에 해당하는 네 코드 중 하나. `accepted_scale_codes`는 중복 없는 1~4개이며 `reference_scale_code`를 포함해야 함. 선택적 `revision_examples`는 있으면 1~2개 비공백 문자열. |
| MJT3 | `target`, `explanation_ko` 필수. 교정 후보 **정확히 3개**. 각 후보는 비공백 `text`, boolean `is_valid`, 비공백 `note_ko`. **최소 1개 `is_valid: true`** 요구. |
| MJT4 | `target`, `explanation_ko` 필수. 비공백 참고 표현 **1~2개**. 정답 일치·수정량·오류유형 필드는 없음. |
| MJT5 | 후보 **정확히 4개**. 각 후보에 비공백 `text`, `note_ko`, 중복 없는 참고 band 코드 **1~3개**. 코드 집합은 `too_direct/appropriate/too_indirect`로 고정. |
| 요약 | `lesson_points` **정확히 5개**, `item_id`가 배열 순서대로 1~5. 각 `label`, `text`는 비공백 문자열. |

### 2.3 DCT — 기존 schema를 상속한 조건 포함

- `production_task`는 한 객체이며 미정의 키를 거부한다. mode는 `translation/interpreting`, source_modality는 `written/spoken`이다.
- 번역↔written, 통역↔spoken 조합을 강제한다.
- `situation_ko`, `relation_ko`, `source_text`는 길이 1 이상 문자열. PDR은 위 enum을 따른다.
- `preceding_turn`은 키가 필요하며 문자열 또는 null. DCT `channel`은 선택값이며 있으면 위 channel enum이다.
- 추가 `learner_context_ko`는 필수 문자열이고 빈 문자열도 허용한다.
- `reference_alternatives`: **1~2개**. 각 text/note_ko는 길이 1 이상 문자열.
- `vocabulary_hints`: 선택 배열. 제공하면 **정확히 2개**, 각 source/target은 길이 1 이상 문자열.
- `usable_facts`: 선택 배열, 최대 8개, 각 값은 길이 1 이상 문자열.
- `replay_limit`: 제공하면 양의 정수. 통역에서는 필수. 번역일 때 제공하는 것을 별도로 거부하지는 않는다.
- `focal_segments`: **1~3개**, 각 role은 head/support, text는 길이 1 이상 문자열. **head가 정확히 1개**여야 하며 모든 text는 source_text의 부분문자열이어야 한다.
- 원문 2~4문장, 전체 문자 수, 힌트가 비화용 어휘인지 등의 의미 검사는 이 schema에 없다.

### 2.4 provenance와 응답

- `provenance` 객체 자체는 선택값이다. 제공하면 기존 schema대로 `model/prompt_version/mission_content_hash/generated_at`는 길이 1 이상 문자열, `generation_attempt`는 양의 정수다. provider/prompt_instance_hash/content_release_id는 선택적 비어 있지 않은 문자열, prompt_snapshot_hash는 선택 문자열이다. 여기서는 hash를 재계산하거나 승인 여부를 검증하지 않는다.
- 응답도 **정확히 5개 tuple**, 문항 ID/type/order가 본문과 동일한 고정 순서다. 모든 `completed_at`은 `z.string().datetime()` 형식이다.
- MJT1·2 응답은 네 척도 코드 중 하나. 참고 정답과 일치할 필요는 없다.
- MJT3 응답은 `correction_indexes` **정확히 1개**, 정수 0~2. `is_valid: true` 후보를 골라야만 저장되는 규칙은 없다.
- MJT4 응답은 `revised_text`가 필수이고 비공백 문자열이어야 한다. 처음 제시된 문장을 그대로 제출해도 허용하며, 변환 계층은 공백을 임의 변경하지 않는다. 기존 UI는 제출 전에 `.trim()`을 수행한다.
- MJT5 응답은 `candidate_band_codes` **정확히 4개**, 각 값은 위 세 band 코드 중 하나. 중복 응답 허용. 참고 정답 일치·분포를 검사하지 않는다.
- 응답 객체는 `.strict()`다. v6 MJT4에 reason/confidence를 넣거나 MJT5에 BEST/WORST를 넣는 식의 추가 필드를 허용하지 않는다.
- `buildMissionV6Responses`에서 한 번, `buildMissionAttemptRow`의 v6 분기에서 한 번 검증한다. 기존 v5에는 새 validator를 적용하지 않는다.

## 3. 정확히 MJT 5개를 고정했는가

**그렇다. 현재는 설명용 기본값이 아니라 하드 제약이다.** `missionV6.ts:36`의 tuple, `lesson_points.length(5)`, 응답 tuple, 1~5의 문항 ID가 모두 고정되어 있다. 러너도 기존 다섯 MJT 뒤 요약/DCT로 가는 구조를 사용한다. 설정값으로 문항 수를 변경할 수 없으며 바꾸려면 코드 변경이 필요하다. 이를 영구 교육 원칙으로 채택했는지는 아직 사용자가 결정하지 않았다.

사용자 후속 판단: **MJT 정확히 5개를 format의 절대 교육 규칙으로 고정하는 조건은 수정 대상**이다. MJT3 선택지 정확히 3개도 불필요한 고정값이면 완화하는 대상으로 둔다. MJT5 후보 4개와 MJT3 적절 후보 최소 1개는 현재 구조상 유지 가능한 조건으로 검토한다. 적절 후보 유일성이나 band 분포를 강제하지 않는다. 이번 보고에서는 이 판단만 기록했으며 validator는 변경하지 않았다.

## 4. 방향·분포·오류유형·적절 후보 수 고정 여부

| 조건 | 현행 구현 |
| --- | --- |
| MJT1은 적절, MJT2는 부적절이어야 함 | 강제하지 않음. 각 문항의 참고 코드로 결정. |
| 4점 척도 수용 코드가 같은 극성이어야 함 | 강제하지 않음. 1~4개의 중복 없는 코드와 참고 코드 포함만 검사. |
| MJT3 적절 후보가 정확히 1개 | 강제하지 않음. **최소 1개는 강제**하므로 1~3개 적절 허용. |
| MJT5 적절 3개+직접적 1개 또는 적절 2개+비권장 2개 | 강제하지 않음. |
| MJT5에 적절/부적절 후보가 각각 최소 하나 존재 | 강제하지 않음. |
| 특정 오류유형·오류 수 | 강제하지 않음. 오류유형 필드도 없음. |
| 판단 축/코드의 종류 | **세 band 코드와 네 적절성 척도 코드는 고정**. 분포 고정과는 구별해야 함. |
| 후보 길이·문장 길이·장면 간 중복·후보 간 의미 차이 | 이 validator는 강제하지 않음. |

샘플의 MJT5 적절 3개·직접적 1개 및 MJT3의 특정 오류 대비는 동결 콘텐츠를 그대로 옮긴 결과다. 생성 규칙으로 추가한 것이 아니다.

## 5. 기존 v5 유지 근거와 한계

- `missionSchema.ts`, `missionRules.ts`, 기존 v5 테스트 파일, `learnerUxPilot.ts`는 미변경이다.
- 새 `normalizeLearnerMission`은 schema_version이 v6가 아니면 기존 `normalizeMission(input)`을 그대로 호출한다. v4, v5 legacy, v5 native에 대해 기존 결과와 동일하고 입력이 불변임을 새 테스트 3건으로 확인했다.
- `canonicalMissionRuntime.ts`는 v6 분기만 앞에 추가한다. 기존 v5 rendering 분기는 그대로 남고, v5에는 기존 recap 생성과 ContextCard 경로를 사용한다.
- `CanonicalMissionRun.tsx`는 v6일 때만 새 응답 변환으로 반환한다. 기존 v5의 A4 reason, A5 BEST/WORST 매핑은 변경하지 않았다.
- v5에는 기존 response envelope와 confidence 제거 규칙이 유지된다. v6 응답 validator는 v5에 적용하지 않는다.
- fetch 쿼리·release 조건·SQL 승인/편성/hash 검증은 변경하지 않았다. `includeV6`는 읽을 형식 선택이며 권한/저장 예외가 아니다.
- DCT 함수는 입력 타입만 바꾸었고 Edge action/요청 body/평가 로직은 같다.
- **이번 실행에서 UI 회귀 2파일은 `environment-blocked / not executed`이므로, 실제 rendering 전체 회귀까지 통과했다고 보고하지 않는다.**

## 6. serialize / restore 예시와 실제 구현 범위

UI가 제출한 값 예시:

```json
{
  "A4": { "revisedText": "내가 직접 쓴 다른 수정문" },
  "A5": { "candidateJudgments": {
    "A5-3": "appropriate", "A5-1": "too_direct",
    "A5-0": "too_indirect", "A5-2": "appropriate"
  } }
}
```

저장할 `context_judgment`는 `schema_version: mpj_response_v2`, `mission_schema_version: mission_v6`이며 기존 `mission_content_hash`를 함께 둔다. 아래는 전체 다섯 응답 중 **MJT4·5 두 원소만 발췌**한 것이다.

```json
[
  { "item_id": 4, "item_type": "free_correction", "completed_at": "2026-09-14T12:00:00.000Z",
    "revised_text": "내가 직접 쓴 다른 수정문" },
  { "item_id": 5, "item_type": "multi_judge", "completed_at": "2026-09-14T12:00:00.000Z",
    "candidate_band_codes": ["too_indirect", "too_direct", "appropriate", "appropriate"] }
]
```

- 객체 입력 키 순서와 무관하게 콘텐츠 후보 순서 0~3으로 직렬화한다. DCT 최초안/최종안은 기존 `first_response/revised_response`에 별도로 남는다.
- JSON으로 읽으면 `revised_text`는 같은 문자열이고 배열 인덱스 i는 **동일 content hash의 i번째 후보**를 가리킨다. 화면 형태로 되돌릴 때의 대응은 `A4.revisedText = trace4.revised_text`, `A5.candidateJudgments['A5-'+i] = trace5.candidate_band_codes[i]`다.
- **v6 DB 응답을 가져와 수행 화면/진행 상태를 복원하는 기능은 구현하지 않았다.** 위 역매핑은 자료의 대응 예시이지 실행된 restore 기능이나 복원 테스트의 성공 보고가 아니다.
- 현재 `readLocalPilotProgress`는 기존 로컬 fixture 전용이다. v6를 그 sessionStorage 경로에 연결하지 않았다. 새 v6 미리보기 URL도 추가하지 않았다.

restore의 미구현 범위를 다음처럼 구분한다. **P0 여부는 사용자가 v6 정식 채택 검토에서 판단하며, 여기서 기능을 추가하지 않는다.**

| 범위 | 현재 상태 | 3건 E2E 판단에 필요한 구분 |
| --- | --- | --- |
| 응답→저장 행 구성 | 구현 및 단위 테스트 통과. UI의 MJT4 문자열·MJT5 선택을 JSONB에 넣을 행으로 구성함. | 실제 DB INSERT 성공 증거는 아직 아님. |
| 저장 완료 후 DB 재조회·원응답 대조 | 실제 v6 DB 행이 없어 미실행. 기존 로그 테이블과 일반 JSON 상세조회 경로는 존재하지만 v6 저장·재조회 증거는 없음. | 정상 경로 E2E에서 저장값·문항 순서·content hash·최초/최종 DCT 산출이 보존됐는지 검증하는 일. 학습자 화면 복원 기능을 새로 만드는 것과는 다름. |
| DB 응답→학습 화면 상태 복원 | 미구현. `revised_text`를 MJT4 입력/응답으로, 배열을 동일 콘텐츠 후보의 선택 상태로 되돌리는 mapper·화면 연결이 없음. | JSON을 읽을 수 있다는 사실만으로 학습 화면 restore 완료라고 할 수 없음. |
| 중도 이탈·새로고침 후 이어하기 | v6 전용 구현 없음. 진행 단계·미제출 초안·후보 선택을 복구하지 않음. | 완료 응답 저장 검증과 구별되는 기능이며 자동으로 이번 E2E 범위에 포함하지 않음. |
| 복원 시 콘텐츠 일치·재시도 검증 | v6 restore 자체가 없으므로 해당 통합 검증도 없음. 기존 정상 저장 경로의 hash/attempt 검증은 유지됨. | 다른 콘텐츠의 후보 순서나 과거 응답을 잘못 연결하지 않는지 확인할 근거가 아직 없음. |

## 7. 실행한 테스트 결과

사용자 중단 지시 당시 실행 중이던 다음 한 번의 테스트 실행만 끝냈다. 이후 수정·재실행·추가 테스트·build·브라우저 검증은 하지 않았다.

```text
npm.cmd test -- src/lib/mission/missionV6.test.ts
  src/lib/mission/missionAttemptRow.test.ts
  src/lib/mission/canonicalMissionRuntime.test.ts
  src/pages/learner/CanonicalMissionRun.runtime.test.tsx
  src/pages/learner/CanonicalMissionRun.pilot.test.tsx
```

| 파일 | 결과 |
| --- | --- |
| `missionV6.test.ts` | 22/22 통과 |
| `missionAttemptRow.test.ts` | 기존 9/9 통과 |
| `canonicalMissionRuntime.test.ts` | 기존 7/7 통과 |
| `CanonicalMissionRun.runtime.test.tsx` | **environment-blocked / not executed** — 환경값 부재로 suite 초기화 중단 |
| `CanonicalMissionRun.pilot.test.tsx` | **environment-blocked / not executed** — 환경값 부재로 suite 초기화 중단 |

- 합계: **실행된 개별 테스트 38/38 통과, 파일 3개 통과·2개 environment-blocked / not executed**. 도구 원출력은 `2 failed | 3 passed`, 프로세스 exit 1이지만, 두 파일의 테스트 assertion 실패가 아니라 환경 초기화 차단으로 분류한다. 전체 통과로 표현하지 않는다.
- 두 suite의 공통 원인은 `supabaseUrl is required`. 새 worktree의 Supabase URL 환경값이 없는 상태에서 기존 client가 초기화되었다. runtime suite는 mocking 오류로 감싸져 표시됐지만 cause는 같은 URL 오류다. 코드 회귀 여부를 이 결과만으로 판정하지 않는다.
- 사용자 지시에 따라 환경값 보충·코드 수정·두 suite 재실행은 하지 않았다.
- 최초 sandbox 실행은 esbuild 상위 경로 읽기 차단으로 시작하지 못했고, 같은 지정 테스트 명령에 한해 좁은 권한으로 실행했다. 자동 승인 거절은 아니었다.
- `npm.cmd run typecheck`는 앱 구현과 샘플 추가 뒤 통과했다. 이후 새 테스트 파일을 추가했으며 그 추가 뒤 typecheck는 재실행하지 않았다.
- v6 대표 검증은 **schema/adapter/응답→저장 행의 단위 테스트**다. 실제 교수자 승인·편성·수행·DB 저장 E2E 및 새 v6 UI 종단 테스트 결과가 아니다. 운영 learner 데이터는 쓰지 않았다.

## 채택 판단 시 드러난 미완성 경계

- 현재 v6는 요청 전용이고 수량 제약이 고정된 구현이다. 정식 채택은 이번 보고서 검토 이후다.
- v6의 strict 최상위에는 기존 승인 과정의 `authoring`, `quality_check`, `item_lineage` 등이 정의돼 있지 않다. 이를 포함하는 정상 승인 데이터와의 연결은 아직 완료되지 않았다. 기존 교수자 parser도 v6를 받지 않는다.
- 기존 DB의 mission format 허용 CHECK에는 v6가 없다(`20260730120000_core_v3_mission_v5_minidiscourse.sql:24`). SQL 변경 금지 범위를 유지했으므로 실제 정상 저장/승인 경로를 완료했다고 주장하지 않는다.
- 기존 집계·교수자 화면·생성기·운영 데이터 및 문서는 바꾸지 않았다. 배포 또는 정식 채택으로 표시한 정본 갱신도 없다.
- research-trail은 추가 갱신하지 않았다. 이 보고서가 미확정 구현과 실행 결과를 남기며, 확정 설계·운영 E2E·연구 효과의 증거로 승격하지 않는다.
- 미커밋 구현 보존. 이번 보고 이후 기능 수정이나 3건 콘텐츠 확장을 계속하지 않는다.

[논문 영향 3줄]
1. 수치: 38개 개별 테스트 통과, UI suite 2개 environment-blocked / not executed. 운영 버전·공개 60개 변경 없음.
2. 화면: v6용 러너 분기만 구현. 이번 실행의 UI 검증은 미완료, 동결 fixture 유지.
3. 프롬프트·계약: 정식 v6 채택 미결정. 생성 프롬프트·SQL·운영 계약·동결본 재발행 없음.

## 정식 채택 후속 · 정상 경로 E2E 사전 확인

- 일자: 2026-09-14. 사용자 검토 수용 후 `mission_v6` 정식 채택. DEC-20260914-02와 생성계약·학습자 구조 정본·CANONICAL에 적용 범위를 기록했다. 앞선 미결정·수량 완화 검토 기록은 이 후속 결정으로 대체한다.
- 실제 branch/HEAD는 위 기준과 동일하다. v6 구현은 보존했으며 이번 후속에서 앱 코드·테스트·SQL을 수정하지 않았다. [단독 진행 적합] 범위는 사용자 결정의 문서 반영과 기존 정상 경로의 읽기 확인이다.
- MJT 5개·MJT3 선택지 3개·MJT5 후보 4개를 이번 v6 구현 계약으로 유지한다. 화용교육의 보편적 최적값으로 해석하지 않으며 범용화하지 않는다. 기존 v5와 과거 응답을 유지한다.
- 3건 E2E의 P0는 실제 DB 재조회 값의 원응답 일치다. 같은 attempt·scenario/version·content hash의 응답에서 `revised_text`는 공백·개행을 포함해 원문 문자열과 같고, `candidate_band_codes`는 콘텐츠 후보 순서대로 길이·각 인덱스의 값이 같아야 한다. 허용 band의 반복도 그대로 보존해야 한다. 중도 이어하기 UI는 선행 blocker가 아니다.

### 지금 반드시 해결 — 현행 정상 경로의 format 지원 누락

| 위치 | 읽기 대조 결과 | 3건 E2E 영향 |
| --- | --- | --- |
| `src/lib/pragma/promoteMission.ts:1675` | 정상 `reviewMission` 최종화가 기존 `normalizeMission(finalized)`를 호출한다. 기존 parser는 v6를 받지 않는다. | 정상 승인 전에 거부된다. v6의 strict 최상위도 기존 승인 산출물의 `authoring` 등 metadata와 아직 연결하지 않았다. |
| `supabase/migrations/20260815010000_authoritative_mission_release.sql:237` | 저장소에서 마지막으로 정의한 `scenarios_mission_ck`는 reviewed/released를 허용하지만 schema_version 목록은 v1~v5다(243행). 이후 migration에 v6 추가가 없다. | 현행 정의 그대로라면 새 v6 미션 행 저장이 불가능하다. 이전 보고의 7월 CHECK 참조보다 이 최종 정의를 근거로 사용한다. |

위 결과는 **확인한 현행 코드·migration 기준**이다. 운영 DB catalog 조회나 실패 INSERT를 실행한 결과로 보고하지 않는다.
`20260829183000_scope_lock_attempt_lineage.sql`의 published course·assignment·reviewed/released lineage/hash 검증은 그대로 유지한다.
SQL 변경이 금지된 현재 범위에서는 정상 format 지원 누락을 해결할 수 없어 실제 쓰기를 시작하지 않았다.
해결 대상은 정상 승인·저장 경로의 v6 호환성이며, draft 저장 예외나 검증 우회가 아니다. 이 후속에서 수정안 구현은 하지 않았다.

- 실제 교과목별 candidate 생성·승인·편성·학습자 수행·DB 저장/재조회: **미실행, E2E 완료 0/3**. 기존 공개 60개 및 운영 응답 변경 없음.
- 테스트 재실행 없음. 기존 38개 개별 테스트 통과를 새 실행으로 중복 집계하지 않는다. UI suite 2개는 계속 **environment-blocked / not executed**이며 코드 실패로 수정하지 않았다.
- DB 응답→학습 화면 restore는 여전히 미구현이지만 이번 저장 E2E의 P0로 추가하지 않는다. 실제 DB 보존 확인과 화면 복원을 구별한다.
- 문서 검증: SQL 허용 목록·승인 parser·v6 schema/응답 mapper를 읽기 대조했다. 논문 작업공간 정본목록의 앱 정본 3개 경로도 일치한다. 저장소 앱 구현 10파일의 문서 수정 전후 SHA-256을 대조해 보존을 확인한다.
- research-trail은 확정 결정에 해당하는 `02_decision_log.md`만 갱신한다. 새 실제 E2E 증거가 없으므로 운영 검증 완료로 evidence를 추가하지 않는다.

[논문 영향 3줄]
1. 수치: format v6 채택, 실제 E2E 완료 0/3. 새 테스트·배포 없음.
2. 화면: 없음. 대표 localhost checkpoint 유지, 중도 이어하기 미구현 유지.
3. 프롬프트·계약: v6 채택과 버전별 계약을 정본에 기록. 생성 프롬프트 변경·운영 동결본 재발행 없음.
