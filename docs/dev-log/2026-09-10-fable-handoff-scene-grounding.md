# FABLE 작업 인수인계 · 사건 근거와 생성 게이트 · 2026-09-10

> **🟢 FABLE 인수 실행 결과(2026-09-10, 이 블록이 아래 인계 시점 기록보다 우선):** 작업 소유권을 넘겨받아 실행했다. ①반대 코어를 시드 안에서 v2(85자)로 재작성 ②사과·요청·반대 v2 의미 검사 3/3 pass ③세 후보를 `save_generated_core`로 **새 draft 행 3개**(170e4b66·4eac0623·d9f1deb3)로 저장, 원본 3행 보존 ④새 행 3개+불만 원본(e4f36052)을 전체 MJT5+DCT1로 승격 — **사과·반대 v2·불만 자동 품질 pass, 요청 fail**(문항 4 오답 「주원인 모호」, 내 판정은 정당한 오개념 보기 → 연구자 override 권고, 재생성 안 함) ⑤네 미션 직접 검수 = 전부 교수자 검토 가능(유보 사항은 README 표) ⑥교체 경로 실측 = 2주차 pos 0 편성 1행에 로그 2건 귀속, `saveWeekAssignments` 삭제는 롤백 → 맨 아래 HIGH-RISK GATE. **교수자 승인·공개·편성·배포 0건, 앱 코드 e6892dc6 그대로.** 정본 = `docs/research-trail/evidence/2026-09-10-local-core-revisions/README.md`. 아래 「최신 중단 사유」·「미커밋 코드」 서술은 인계 시점 기록이다.

> **최신 중단 사유:** 세 로컬 수정 후보의 실제 의미 검사를 위해 `docs/research-trail/evidence/2026-09-10-local-core-revisions/check-semantic.ts`를 준비했다. 실행 명령은 수정 코어를 Supabase 외부 의미 검사에 보내는 구체적 승인이 부족하다는 자동 승인 검토로 프로세스 시작 전 거절됐다. 실제 전송/의미 검사/새 결과는 없다. README에 재개 범위를 기록했다. 승인 없이 우회 호출하지 않는다.

> **최신 실행 후보:** 사과·요청·반대 수정안을 `docs/research-trail/evidence/2026-09-10-local-core-revisions/`에 실제 로컬 JSON으로 작성했다. 스키마 3/3 통과, 규칙은 사과·요청 pass/반대 최소 분량 warning이다. README와 checks.json을 먼저 읽는다. 세 후보의 새 의미 검사와 전체 미션 검수는 아직이며 DB에 적용하지 않았다. 아래의 "편집안은 문서에만 있음"은 이전 시점 기록이다.

> **가장 최근 후속(잔여 1%):** 2차 코어 4개의 내용 대조를 `docs/dev-log/2026-09-10-confirmation-core-review.md`에 완료했다. 불만은 소수 미션 생성의 우선 후보, 사과는 원문 수용/중심 구간 보완, 요청은 내용 명료화 권고, 반대는 지시어·시드 밖 선행 이유 보완 전 보류다. 편집안은 문서에만 있으며 DB/코어 원본을 수정하거나 실제 미션을 생성하지 않았다. 다음 담당자는 이 판정을 읽고 국소 보완 및 전체 미션 검수부터 이어간다.

> **후속 상태 갱신:** 사용자가 남은 2%로 조금 더 진행하도록 요청했다. 아래의 "미커밋 코드 두 파일"은 로컬 반례 검증 후 **기각·철회**했다. 현재 앱 코드는 e6892dc6과 동일하며, 이전 미검증 초안을 다시 적용하지 않는다. 보관 patch는 역사 증거다. `unfinished-format-probe.json`에 과거 오류 4개 차단/신규 4개 통과 외에 정상 해요체·내부 인용 오탐과 평서형 대사·평가 힌트 누락을 기록했다. 인용 사례는 이 형식 helper만의 검사 결과이며 기존 2문장 검사까지 통과했다는 뜻이 아니다. 다음 작업은 아래 2차 코어 4개의 실제 품질 검토부터다. 이 갱신이 아래의 이전 인계 시점 상태보다 우선한다.

## 중단 이유와 작업 소유권

사용자가 Codex 잔여 사용량 약 3%를 이유로 적절한 지점에서 중단하고 **Claude FABLE에게 구현 작업을 인계**하도록 지시했다. 종전의 Claude 읽기 전용 검토 요청과 구별한다. Codex는 아래 소수 생성 완료와 기록 보존까지만 수행하고 중단한다. 같은 worktree를 두 에이전트가 동시에 수정하지 않는다.

현재 세션에 FABLE로 직접 전달하는 도구나 확인된 FABLE 작업 ID가 없다. 이 파일은 사용자가 FABLE 세션에서 읽혀 이어가는 인계 문서다. Claude가 이미 수신·검토·실행했다고 주장하지 않는다. 비밀값이나 학생 응답을 이 문서에 포함하지 않았다.

## 반드시 사용할 작업공간

- worktree: `C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-takeover-2026-09-10`
- branch: `codex/scene-grounding-live-corrections-2026-09-10`
- 구현 기준 HEAD: `e6892dc63b2ab21510c78c26c84677338a5c8eeb` (PR132 merge). 인계 기록 커밋을 추가하면 그 부모가 이 SHA다.
- 루트 저장소는 별도 논문 작업의 dirty 작업공간이다. 루트를 정리하거나 덮어쓰지 않는다.
- 먼저 실제 Git 상태와 `AGENTS.md`, `docs/CANONICAL.md`, 관련 dev-log, evidence index를 대조한다. 삭제된 ACTIVE_HANDOFF 파일을 복원하지 않는다.

## 사용자와 합의한 범위

1. 화행의 계기·행위자·책임과 PDR 근거를 대조한다. P는 직함이 아니라 해당 사건의 실제 권한, D는 접촉 이력, R은 화행별 실제 부담 단서로 판정한다.
2. 생성 전 실현 가능성과 생성 후 의미 검사를 실제 진행 조건으로 연결한다. 한국어 문장을 인물 변수·조사로 재조립하지 않는다.
3. 알려진 오류와 소수 실제 신규 콘텐츠를 확인한 뒤, 아홉 화행·양방향·번역/통역·수준을 걸치는 **전체 미션**을 검수한다.
4. 검수된 교과목 콘텐츠로 교체한다. 기존 학습 기록을 보존한다.

Spencer-Oatey 이론은 해석의 보조 관점으로 유지한다. 권리·의무를 근거 없는 사건을 만드는 구실로 쓰지 않는다. 논문 원고는 수정하지 않았다. MJT5+DCT1 학습설계와 판단→직접 산출 순서를 확대·재설계하지 않는다. 불필요한 반복 검증과 대량 유료 생성을 피한다.

## 구현·배포 완료와 미완료 구분

### main에 포함된 구현

- PR131: https://github.com/sylim-research/PRAGMA/pull/131
  - 구현 `aea34363`, 검사/CI 보완 `80135098`, 스냅샷 보정 `72d105c3`, 아홉 화행 R 단서 `6634c6b3` 등.
  - merge `6d1252f096d5e254314562f6b0722e3f053c2af3`; 필수 CI 통과.
  - Railway deployment `6364125732`의 해당 SHA success 확인.
- PR132: https://github.com/sylim-research/PRAGMA/pull/132
  - `95f3aa1a`: observed_pdr 대조, 상황과 실제 대사 구분, 원 사건 시드 전달.
  - `ec90a631`: 남아 있던 "인물 관계를 P·D에 맞게 재설정 / 연구 축이 시드보다 우선" 및 최소 역할 조정 허용을 제거.
  - merge `e6892dc63b2ab21510c78c26c84677338a5c8eeb`; PR 필수 CI `34435454226` 통과.
  - 이 merge의 Supabase `generate-scenario`, `generation-jobs`, `content-review` 배포 성공.
  - Railway deployment `6364300740`의 SHA가 이 merge인 것까지 확인했다. **최종 success와 운영 smoke는 인계 시 미확인**이다. 마지막 상태 조회는 로컬 네트워크 sandbox에서 차단되어 결과를 얻지 못했다.

배포된 후보 release는 `pragma_scene_grounding_candidate_20260910_03`, core v18 / core quality v11 / native mission v20 / mission quality v22다. 최종 콘텐츠 LOCK이 아니다. 프롬프트 버전 전체 문자열은 `_shared/contentRelease.ts`에서 확인한다.

진행 조건: 16개 의미 축 모두 근거 있는 pass여야 한다. 실패·누락·검사 호출 실패는 보류한다. 내용/요청 조건/검사 버전 해시가 맞으면 기존 검사를 재사용한다. 신규 단일·배치 생성과 기존 코어 승격을 연결했다. 조사 파손을 일으킨 A/B 자연어 재조립은 제거했다. R 단서는 운영상 확인 기준이며 새로 타당화한 척도로 주장하지 않는다.

### 지금 남겨 둔 미검증 코드 — 배포 금지, 채택부터 재판정

`src/lib/pragma/coreBatchRun.ts`와 `supabase/functions/_shared/sceneGrounding.ts` 두 파일에 **미커밋 수정**이 있다. 구현 diff 18줄 추가/1줄 삭제를 `docs/research-trail/evidence/2026-09-10-scene-grounding-confirmation-2/unfinished-scene-format.patch`에도 보존한다.

- `sceneDescriptionIssue()`가 ~다/~합니다 종결 및 직접 사과·감사 종결을 검사한다. 한국어를 수정하지 않고 보류한다.
- preflight와 프런트 `checkCoreSemanticFit`의 캐시 재사용 전에 연결했다.
- **테스트·버전 갱신·프롬프트 스냅샷·content-review 번들 갱신 미실행.** 서버 독립 core_quality_check/전체 미션 경로의 직접 연결도 미완료다.
- 이런 형식 검사는 정상적인 ~요 서술을 거부할 수 있고, 평서형으로 쓰인 대사는 통과시킬 수 있다. 상식·의미 정합성 보장으로 취급하지 않는다. 과잉 제약이면 폐기/수정해도 된다. 아래 새 4개 상황문은 이미 개선되어 있으므로 무조건 이 초안을 채택할 필요가 없다.

## 실제 생성 증거: 자동 pass와 내용 채택은 다르다

### 1차 (_02)

`docs/research-trail/evidence/2026-09-10-scene-grounding-pilot-1/index.json`에 원본 7개와 SHA-256이 있다.

- 부적합 3개 중 초대 거절→초대한 사람 사과, 권한 없는 조장 우위는 보류했다. 초면 버디를 acquaintance로 둔 입력은 잘못 통과했다.
- 새 코어 4개는 자동 pass였지만 상황문이 상대에게 하는 실제 대사여서 직접 검토 **0/4 채택**. 미션 승격·승인·공개하지 않았다.
- 이 반례에 대응한 것이 PR132다. 원자료는 실패 증거로 보존한다.

### 2차 (_03), 인계 직전 종료

`docs/research-trail/evidence/2026-09-10-scene-grounding-confirmation-2/index.json` 및 `.tmp/scene-grounding/scene_grounding_confirm_20260910/`를 읽는다.

- 같은 부적합 입력 **3/3 보류**를 실제 모델 호출로 확인했다.
- 기존 사과 코어의 대사형 상황문은 새 의미 검사도 pass로 오판했다. 기존 generation/검토 메타데이터를 제거해 재호출해도 pass였다. **메타데이터 제거가 해결책이라는 가설은 확인되지 않았다.** 더 유료 반복하지 않는다.
- 신규 코어 4개 생성 프로세스는 exit 0으로 종료했다. 자동 검사 pass, 네 상황문이 장면 서술로 나온 것까지 직접 확인했다. **전체 코어 품질 승인 또는 전체 미션 검수 완료가 아니다.** 원문 어조·사실 보존·MJT 후보/정답/해설은 후속 검토 대상이다.

| key | scenario ID | 인계 시 관찰 |
|---|---|---|
| w2-0 | 9e5e1bd9-cf65-4cb4-ae87-8df47c8e0b30 | 한→중 요청 번역. 이웃에게 택배 수령 부탁, 저녁 6시 회수. 장면은 서술형. 원문에서 보관 장소 생략과 완화 강도는 검토 필요. |
| w9-1 | 48854f5c-678f-4b46-a127-0aea54536b54 | 한→중 사과 통역. 본인이 시간을 착각해 10분 지각. 책임 근거가 있는 장면. 저부담 상황의 사과/재발 약속 강도는 검토 필요. |
| pilot-reverse-opposition | 6ff643a6-a3a5-4034-95c5-e55b3bb8ddc2 | 중→한 고급 반대 번역. 같은 조원의 설문 문항 삭제 제안에 반대. 장면은 서술형. |
| pilot-reverse-complaint | e4f36052-88a8-45cd-a33b-1a96f9d2ed5c | 중→한 초중급 불만 통역. 도표 전달 지연으로 합치기가 10분 늦어짐. 장면은 서술형. |

**새 코어 총 8개는 draft다. 전체 미션 생성 job은 시작하지 않았다. 교과목 편성·학생 수행 기록·승인 상태는 변경하지 않았다.** 인계 시 실행 중인 Codex 생성 프로세스는 없다.

## 재개에 필요한 로컬 자산

모든 상대 경로의 기준은 위 worktree다. `.tmp`는 Git 미추적이지만 현재 로컬에 보존되어 있다.

- `.tmp/scene-grounding/course-before.json`: 교과목 outline/주차/기존 20개 편성 및 코어·미션 snapshot. 학생 응답 없음.
- `.tmp/scene-grounding/reference-counts.json`: 기존 편성 참조 건수만 기록. learner_mission_logs 2건, events 0건.
- `.tmp/scene-grounding/plan.json`: 교과목 20개 + 중→한 보완 2개, 실제 사건 시드/PDR/모드/수준 포함. 아직 모두 생성·승인된 것은 아니다.
- `plan.cjs`는 초기 작성 스크립트다. **w2-0의 "이웃집 현관 안 / 저녁 6시" 보정은 plan.json에 직접 반영했다. plan.cjs 재실행으로 덮어쓰지 않는다.**
- `.tmp/scene-grounding/run.ts`: 현재 run ID 기본값 `scene_grounding_confirm_20260910`. `negative`, `scene-regression`, `core`, `mission` 모드. core 기본 4개, key 지정 가능. 기존 결과 파일을 보존/재사용한다. `mission`은 아직 실행하지 않았다.
- 실제 호출은 기존 Supabase Edge와 기존 모델 설정을 사용한다. 루트의 ../../.env에서 필요한 값을 process 환경으로 로드했으며 값을 출력하지 않았다. 비밀값·세션토큰을 문서/로그/프롬프트에 복사하지 않는다.
- 실행 예시는 runner 검토 후 `npx.cmd vite-node .tmp/scene-grounding/run.ts core`; key 및 release를 확인한 뒤만 실행한다. 인계 즉시 재생성하지 않는다.

## 교과목 교체에서 놓치면 안 되는 사항

대상 교과목/outline: `915fec24-cc38-4b00-a2a0-c3628abcd3f7`, AI 한중 화용 통번역. 현재 편성은 20개 모두 기존 release 20260904_02, ko_zh/intermediate다. 이전 ff47a6e1 감사는 **20 DCT의 상황·관계·원문·PDR만 1차 검토**했으며 20 전체 미션 후보/정답 검수가 아니다.

`src/lib/curriculum/composer.ts`의 `saveWeekAssignments`는 새 시나리오 upsert 후 stale 편성을 삭제한다. 기존 편성에 learner_mission_logs 2건이 연결되어 있다. `20260829183000_scope_lock_attempt_lineage.sql`의 ON DELETE SET NULL과 course-context all-or-none CHECK 때문에 삭제가 실패하거나 귀속 보존 문제가 생길 수 있다. **교체 함수를 그대로 호출하지 않는다.** 현재 archived_at/is_current 필드는 없고 기록 보존 해법은 아직 구현하지 않았다. 기존 ID를 새 콘텐츠로 덮어써 과거 학습을 새 미션으로 오인시키지 않는다.

## 다음 실행 순서

1. 이 기록과 실제 diff를 읽고 작업 소유권을 넘겨받는다. 미검증 형식 게이트의 채택 여부를 먼저 판단한다. 과거 반례 + 정상 장면 소수로 필요한 회귀 검사만 한다. 채택한다면 공유 경로/버전/스냅샷/번들을 함께 정리한다.
2. 이미 생성된 2차 코어 4개를 상황·PDR·원문·어조까지 직접 검토한다. 불필요한 재생성 대신 기존 증거를 사용한다. 통과한 코어만 전체 MJT5+DCT1 생성으로 올린다.
3. 전체 미션의 상황→후보·정답·해설→DCT→피드백 정합성을 검수한다. 작은 표본에서 결함이 사라진 뒤 아홉 화행/양방향/모드/수준의 범위를 넓힌다. 전수 품질 보증이나 학습효과를 표본으로 주장하지 않는다.
4. 20개 교체 후보를 검수 가능한 형태로 만든다. 기존 2개 수행 로그의 귀속을 보존할 교체 경로를 구현/검증하고 승인된 콘텐츠만 편성한다.
5. 필요한 변경은 main PR·필수 CI·Railway 절차를 따른다. 기존 사용자 배포 승인은 이 작업 범위에 있지만 미검수 후보를 자동 승인하는 권한은 아니다. 최신 배포 success/운영 smoke 확인을 구분해 마무리한다.

## 기록과 논문 영향

- 관련 기록: `docs/dev-log/2026-09-10-scene-grounding-gate.md`, DEC-20260910-09, EVD-20260910-10. 이번 인계와 2차 원자료를 evidence index에 연결한다. 다른 세 연구 문서를 중복 갱신하지 않는다.
- 바뀐 수치: 두 PR 필수 CI 통과, 2차 부적합 입력 3/3 보류, 신규 4코어 생성·전체 미션 검수 0개. 새 미커밋 게이트 테스트 없음.
- 바뀐 화면: 인계 단계의 UI 수정 없음. 교과목 내용은 그대로다. 최종 콘텐츠 교체 후 해당 미션 캡처를 다시 확보해야 한다.
- 바뀐 프롬프트·계약: 후보 _03까지 main 반영. 미완성 형식 제약은 미배포. 최종 검수/편성 후 프롬프트·콘텐츠 동결본을 발행해야 하며 지금은 동결 완료가 아니다.

## FABLE 인수 후 판정 · 교과목 교체 경로 (2026-09-10)

실측: 기존 편성 20행 중 learner_mission_logs가 참조하는 행은 **2주차 position 0(assignment `1b7b468e-d47b-46ab-ba16-642ad8be5bc5`, 시나리오 `f8de3f59-cd86-4636-b516-a8ead78ac0ac`) 하나**이며 로그 2건이 모두 여기에 귀속된다. events는 0건. 나머지 19행은 참조가 없어 통상 교체가 가능하다.

왜 `saveWeekAssignments`를 그대로 못 쓰는가: stale 삭제가 이 한 행에 닿으면 `ON DELETE SET NULL`이 로그 행을 UPDATE하고, `learner_mission_logs_course_context_complete` CHECK와 `trg_validate_learner_mission_log_course_context`가 예외를 던져 삭제문이 롤백된다. upsert가 먼저 실행되므로 실패 시 2주차는 옛 2행+새 2행이 되고 학습자 투영은 모드 정원 초과로 2주차 미션을 전부 숨긴다.

학습자 노출 경로 실측: 학습자는 `DEFENSE_COURSE_IDS`(코드 고정 3개 outline ID) 안의 published outline만 본다. 주차 안에서는 `isReviewedMission`(mission_status reviewed/released + release ID 허용 목록 `_03`·`20260910_01`·`20260904_02`)인 편성만 남긴 뒤 모드 정원을 검사한다. `curriculum_week_scenarios`에 보관·대체 표시 컬럼은 없고 `slot_role`은 자유 text(기본 'primary')다.

```text
HIGH-RISK GATE
- 결정이 필요한 사항: 2주차 옛 편성 1행(로그 2건 귀속)을 어떻게 보존하며 교체할 것인가
- 확인된 사실: 위 실측. 로그 2건의 주체·시각은 조회하지 않았다(연구자 본인 시연 기록일 가능성은 확인 필요)
- 선택지와 각 위험:
  A. 그 1행을 남기고 옛 시나리오 f8de3f59의 mission_status를 검수 밖 상태로 바꿔 학습자 투영에서 제외 → 코드·migration 없음. 위험: 승인된 미션의 상태 변경, 관리자 편성 화면에 2주차 3행이 남아 A/B 계약 검사(`pair_item_count`)가 다음 저장을 막는다
  B. `slot_role='superseded'` 표시 + 학습자 투영·A/B 검사가 그 행을 무시하도록 코드 수정 → migration 없음, PR·배포 1회. 위험: 학습자 콘텐츠 선택 로직 변경(UI 게이트 대상), 새 관례가 코드에만 있다
  C. `curriculum_week_scenarios.archived_at` 추가 migration + 투영 필터 → 가장 정직한 모델. 위험: migration push·배포 승인 게이트, 심사 전 스키마 변경
  D. 로그 2건을 삭제하고 통상 교체 → 가장 단순. 위험: 학습 기록 삭제(합의 범위 4항 위반이 될 수 있음). 시연 기록이면 연구자가 판단
- Claude 권고안: 먼저 로그 2건이 연구자 시연 기록인지 확인한다(연구자만 판단 가능). 시연 기록이면 D, 보존해야 하면 B(코드 소량·되돌리기 쉬움·migration 없음)
- 영향받는 파일·데이터: src/lib/curriculum/composer.ts(saveWeekAssignments), learnerCourseProjection.ts, weeklyMissionPair.ts, curriculum_week_scenarios 1행, learner_mission_logs 2행
- GPT 교차검증 권장: No (데이터 손상 위험은 실측으로 닫혔고, 남은 것은 연구자의 기록 보존 판단)
```

어느 쪽이든 20개 교체 후보가 검수될 때까지 편성은 바꾸지 않는다. 지금까지 교체 가능한 검수 미션은 아래 절의 4개뿐이다.

### 연구자 결정과 게이트 해소 (2026-09-10)

- 요청 미션 AI fail: 연구자가 「문제없음, 오히려 설계가 잘된 것」으로 판정 → 재생성 없이 교수자 최종 승인 화면 override로 처리.
- 로그 2건: 연구자 본인 시연 기록 → 삭제 승인. 백업(로컬 미추적) 후 CLI `db query`로 id 지정 삭제, 재확인 logs 0·events 0. 위 HIGH-RISK GATE는 **D로 종결**. B/C 코드·migration 변경은 불필요해졌다.
- 남은 순서: ①연구자가 4미션을 최종 승인 화면에서 검토 ②나머지 교과목 셀 18개(plan.json의 w2-1~w13-1, w2-0·w9-1 제외) 코어·미션 생성과 검수 ③20개 reviewed 확보 후 `saveWeekAssignments` 통상 경로로 교체 ④학습자 화면 캡처 재확보.
