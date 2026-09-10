# 사건 근거와 코어 의미 검토의 진행 조건 · 2026-09-10

- 기준 작업트리: admin-takeover-2026-09-10 / codex/apology-plausibility-audit-2026-09-10.
- 선행: ff47a6e1의 20 DCT 1차 감사. 이는 20 전체 미션의 후보·정답 검수가 아니다.
- 사용자 결정: 사건·행위자·책임/PDR 기준 → 조사 후처리 제거·의미 게이트 → 오류 및 신규 소수 확인 → 전체 미션 검토 → 검수 콘텐츠 교체.
- 이론: Spencer-Oatey 관계관리·권리·의무는 해석의 보조 관점으로 유지한다. 원고는 수정하지 않았다.

## 구현

1. 원문 작성 전 별도 장면 검토에서 고정 조건과 사건의 실현 가능성을 확인한다. 사실이 모순되면 원문을 생성하지 않는다. 장면·실제 인물·PDR 사실 근거를 함께 반환한다.
2. 직함별 역할 예시 표를 생성 경로에서 제거했다. 사전 확인한 인물·장면으로 원문을 만들고, 길이 등의 보정이 장면을 바꾸지 못하게 한 뒤 전체 코어를 다시 의미 검토한다.
3. 기존 16축의 근거 있는 pass만 다음 단계로 보낸다. 단일·배치 생성과 기존 코어 승격이 같은 검사를 사용하며, 검사 실패·누락·호출 실패는 통과로 추정하지 않는다. 보류 초안과 중단 사유를 반환한다.
4. 검사 버전과 실제 원문·장면·관계·PDR·focal_segments·usable_facts·맥락 및 요청 조건의 SHA-256이 일치하면 중복 모델 호출을 하지 않는다. JSONB 키 순서 변화는 내용 변화로 세지 않는다.
5. 한국어 명사를 추측해 A/B와 조사를 재조립하던 처리를 제거했다. 구자료의 인물 표기는 보존하고, 알려진 통역사 소개 문장만 제거한다. 새 자료는 자연스러운 한국어로 생성한다.
6. 초대 거절 시드의 사과 허용을 제거하고 버디의 접촉 이력을 명시하게 했다. 아홉 화행의 사건 성립과 PDR 근거 규칙을 생성·코어/미션 검토 지시문에 공유한다.
7. 새 후보 pragma_scene_grounding_candidate_20260910_02, core v17 / core quality v10 / native mission v19 / mission quality v21. 기존 공개 세대 읽기·과거 수행 기록은 보존한다. 최종 LOCK이 아니다.

## 로컬 검증

- 전체 Vitest: 919 통과, 후보 ID 조회 SQL 불일치 1 실패, 9 skip. 해당 SQL 수정 후 영향 범위 3파일 13 tests 통과(재실행은 전체 통과 수에 중복 가산하지 않음).
- Edge 실함수 모의 제공자 검사 5개 통과: 사전 부적합 중단 / 전체 pass 표기 속 축 fail 중단 / 사전 장면 고정 및 해시 / critic 호출 실패 / 독립 검토 응답의 근거 누락 보수적 처리.
- 타입 검사와 운영 빌드 통과. 변경 뒤 검수 도메인 번들 stale 경고를 발견해 재생성했다. 기존 CSS minifier·bundle-size 경고는 이번 변경과 무관하다.
- 회귀 근거: learnerScene.test.ts, sceneGrounding.test.ts, coreBatchRun.test.ts, scripts/scene-grounding-edge.test.mjs. 원문·조건 변경 시 재검사와 DB JSON 키 재배열 시 재사용을 포함한다.
- 위 결과는 모의 제공자 및 코드 경계 검증이다. 실제 AI가 상황 타당성을 보장한다거나 기존 미션이 모두 수정됐다는 근거가 아니다.

## 독립 검토와 운영 후속

[독립 검토 필수] 대량 콘텐츠 생성·교체 전에 이 구현 커밋과 게이트·캐시·기존 자료 보존만 범위를 정해 읽기 전용 검토한다. 실생성·전체 미션 품질·교과목 교체·배포 상태는 후속 증거를 확보한 뒤 이 문서에 추가한다. 현재 완료로 주장하지 않는다.

### 독립 검토 방식에 대한 사용자 결정

- aea34363을 고정한 뒤 Claude Code 읽기 전용 검토를 시도했으나 외부 소스 전송 승인이 없어 자동 승인 검토가 실행을 거절했다. 실제 전송·Claude 검토는 없었다.
- 사용자는 외부 전송 없이 Codex 검토로 진행하도록 명시적으로 지시했다. 이번 작업의 독립 벤더 검토는 생략하고 코드·회귀 증거와 실제 신규 콘텐츠를 직접 대조한다. 독립 검토 완료로 주장하지 않는다.
- 운영 읽기 확인: 지정 과목의 편성 20행·미션 20개는 모두 ko_zh/intermediate, 과거 release 20260904_02였다. 진행 중인 생성 작업은 0개였다. 학생 응답은 조회하지 않았다.
- 직접 검토에서 나머지 여섯 화행의 R 지시가 포괄적임을 확인해 사건별 확인 단서를 추가했다. 기존 세 화행의 근거 있는 조작적 정의와 구별하고, 새 검증 척도나 화행별 고정 점수로 주장하지 않는다.
- PR CI에서 마지막 소스 수정 뒤 생성 스냅샷 해시가 갱신되지 않은 오류를 발견했다. 스냅샷을 다시 생성하고 해당 16개 테스트를 통과시켰다. 실제 모델 검증과 구별한다.

## 실제 생성 1차 확인과 보완

- PR131 필수 CI 통과 후 main 6d1252f096d5e254314562f6b0722e3f053c2af3에 병합했다. 같은 소스의 generate-scenario·generation-jobs·content-review를 배포했다.
- 실제 부적합 입력 3개: 초대 거절만을 계기로 초대한 사람이 사과 / 권한 없는 조장을 상대 우위로 설정은 사전 보류했다. 초면 버디를 acquaintance로 지정한 입력은 잘못 통과했다. 모델의 distance 근거가 "오늘 처음 만난 사이로 acquaintance 조건에 부합"이라고 명시해 코드 뜻을 잘못 해석한 것이 확인됐다.
- 실제 신규 코어 4개(한→중 요청 번역·사과 통역, 중→한 반대 번역·불만 통역)는 자동 검사를 통과했으나 직접 검토에서는 모두 상황 설명 대신 실제 대사를 쓴 결함을 확인했다. 미션으로 승격하지 않았으며 공개·승인하지 않았다. 이 수량을 품질 통과로 세지 않는다.
- 대응: PDR 코드 뜻을 명시하고 preflight가 사건에서 관찰한 observed_pdr와 지정값을 서버가 대조한다. 불일치면 feasible=true여도 보류한다. 장면은 실제 대사나 원문의 한국어 번역이 될 수 없으며 기존 learner_scene 축에서 검사한다. 원문 생성에는 원 사건 시드도 전달해 축약 장면에서 빠진 시간·소유자·대상을 보존한다.
- 새 후보 _03, core v18 / core quality v11 / native mission v20 / mission quality v22로 구별한다. 기존 1차 후보와 원자료는 보존한다.
- 원문 생성기에는 "인물 관계를 P·D에 맞게 재설정한다. 연구 축이 시드보다 우선한다"는 구지시, 코어 비평에는 "P/D에 맞춘 최소 역할 조정" 허용이 남아 있었다. 새 사건 보존 원칙과 충돌하므로 제거하고 범용 시드의 구체화와 명시 사실의 변경을 구별했다. scenarioTopics의 작성 주석도 같은 기준으로 맞췄다.
- 기존 편성 참조 건수만 조회한 결과 learner_mission_logs 2건, events 0건이었다. 학습자 응답은 읽지 않았다. 편성 삭제로 기록 귀속이 사라지지 않도록 교체 시 보존이 필요하다.

## 2차 확인 후 사용자 요청으로 FABLE 인계

- PR132 main e6892dc6 및 Supabase 3함수 반영 후 같은 부적합 입력 3개는 모두 보류했다. 기존 대사형 상황문은 새 critic도 오판했으며, 과거 generation 메타데이터 제거 후에도 오판이 재현됐다.
- 새 코어 4개 생성이 종료됐고 네 상황문이 장면 서술로 개선된 것까지 확인했다. 전체 코어 승인·MJT 후보/정답/해설 검수는 아직이다. 전체 미션 생성·교과목 교체는 실행하지 않았다.
- 사용자가 잔여 사용량 약 3%로 Claude FABLE에게 인계를 요청했다. 미검증 형식 검사 초안 2파일을 그대로 보존하고 구현을 중단한다. 직접 수신 가능한 FABLE 도구/작업 ID가 없어 문서로 인계하며 실제 Claude 실행은 주장하지 않는다.
- 재개 위치·배포 구분·원자료·미검증 diff·기록 보존 위험·다음 순서: `docs/dev-log/2026-09-10-fable-handoff-scene-grounding.md`.

### 잔여 사용량 2%에서 추가로 마무리한 판정

- 사용자 요청으로 미검증 형식 게이트만 소수 반례로 검토했다. 과거 대사형 오류 4개는 차단하고 새 서술형 4개는 허용했지만, 정상 해요체와 내부 인용 문장도 차단했다. 평서형 직접 대사와 평가 힌트는 통과했다. 이는 helper 단위 진단이며 일반 오류율이나 기존 2문장 검사 결과가 아니다.
- 판정: 의미 검사 보완책으로 이 종결어미 강제안을 채택하지 않는다. 두 앱 파일의 미배포 변경을 철회해 e6892dc6과 diff가 없음을 확인했다. 이미 배포된 사건/PDR 게이트와 프롬프트는 유지한다.
- 재현 스크립트와 결과: `docs/research-trail/evidence/2026-09-10-scene-grounding-confirmation-2/probe-unfinished-format.mjs`, `unfinished-format-probe.json`. 스크립트는 보관 patch를 적용한 당시 코드에 대한 진단용이며 제품 회귀 테스트가 아니다. 새 유료 생성·교과목 교체·배포는 하지 않았다.
- 철회 후 기존 sceneGrounding.test.ts 1파일 4 tests 통과. 전체 테스트·배포를 재실행한 결과는 아니다. 인계 단계의 추가 UI·프롬프트·계약 변경 없음.

## FABLE 인수 후 실행 · 2026-09-10

작업 소유권을 넘겨받았다. 앱 코드는 e6892dc6과 동일하며 이 절의 변경은 evidence·기록과 DB의 draft 행 추가뿐이다.

- 반대 코어 v1(48자)은 고급 번역 원문으로 채택하지 않았다. 시드 범위 안에서 이견 서두·근거·단체 대상 재고 요청을 더한 v2(유효 85자, 권장 80~110)를 만들어 스키마·규칙 검사를 경고 없이 통과시켰다. v1은 이력으로 보존한다. 재현: `prepare-opposition-v2.ts`.
- 사과·요청·반대 v2 세 후보를 배포된 `core_quality_check`(gpt-4.1, core_quality_v11)로 검사했다. 세 건 모두 16축 pass이며 각 축의 reason이 사건·관계·부담 근거를 실제로 서술함을 직접 확인했다. 결과 파일 `*-semantic.json`에 후보 SHA-256을 고정했다.
- 세 후보를 기존 `save_generated_core` RPC로 **새 draft 행**(needs_review·archived_only)으로 저장했다. 원본 행 3개는 수정하지 않았고, 새 행의 `generation.local_revision`이 원본 scenario ID·초안 파일·SHA-256·편집 시각을 가리킨다. 원본 generation 메타데이터(프롬프트 버전·scene_plan)는 원본 행의 기원 기록으로만 남는다. 원본 draft 3행은 관리자 대기열에 남아 있으므로 정리 여부는 연구자 결정이다.
- 기존 편성 참조 실측: learner_mission_logs 2건은 **모두 2주차 position 0(assignment 1b7b468e, 시나리오 f8de3f59)** 한 행에 귀속된다. events 0건. 학습자·프로필 행은 조회하지 않았다.
- 전체 미션 승격 4건(새 행 3개 + 불만 원본, `promoteCore` astra): 사과·반대 v2·불만 자동 품질(quality_v22) pass, 요청 fail(문항 4 reason 오답 r1과 정답 r3가 같은 조사 「吧」에 초점 → 「주원인 모호」, 수리 후보 재통과 실패). 직접 검수 결과 네 미션 모두 문항 간 대비축(D 또는 R)이 한 번에 하나씩 바뀌고 정답·해설·수정안·DCT 참고안이 단원 초점과 일치해 교수자 검토에 올릴 수 있다고 판정했다. 요청의 AI fail은 설계상 정당한 오개념 보기에 대한 과잉 판정으로 보아 재생성하지 않고 연구자 override 여부에 맡긴다. 유보 사항은 evidence README 표에 적었다. 모두 `generated` 상태이며 승인·공개·편성은 없다.
- 교체 경로 판정: `saveWeekAssignments`의 stale 삭제는 이 한 행에서 실패한다. `learner_mission_logs.assignment_id`는 ON DELETE SET NULL이지만 course-context CHECK와 `trg_validate_learner_mission_log_course_context`가 UPDATE OF assignment_id에서 예외를 던지므로 삭제문 전체가 롤백된다. upsert가 먼저 실행되므로 실패 시 해당 주차는 4행이 되고 학습자 투영은 모드 정원 초과로 그 주차를 비운다. 따라서 교체는 이 함수를 그대로 쓰지 않는다. 선택지와 권고는 인계 문서에 적었다.
- 연구자 결정(같은 날): 요청 미션의 AI fail은 설계 의도대로라 override로 승인 예정. 2주차 편성에 귀속된 로그 2건은 본인 시연 기록이라 삭제 승인 → 백업 후 CLI로 id 지정 삭제, 잔여 0. 교체 게이트는 삭제 경로(D)로 종결됐고 코드·migration 변경은 없다.

## 구 콘텐츠 정리 결정과 보관 상태 구현 · 2026-09-10

- 실측: scenarios 1,760행(관리자 목록 노출 1,726). 편성·학습 기록·미션 이력 어디에도 참조되지 않는 행 1,503(코어 1,469 + legacy 34), 참조되는 행 257(편성 67·로그 11·이력 244의 합집합).
- 연구자 결정(GPT 교차검토 반영): **삭제하지 않고 보관(B)**. 순서 = 전량 덤프 → 보관 상태 적용 → 모든 현행 후보 쿼리에서 보관 제외 → 교과목 교체 후 추가 보관. 삭제 여부는 논문 기준본·개발 증거 확정 뒤 별도 판단. 용어는 「보관 콘텐츠」(실패작으로 부르지 않음). 새 「보관함」 메뉴는 만들지 않고 목록 필터 전체/현재/보관으로 처리.
- 전량 덤프 완료: `Documents/Projects/l2-pragmatic-translator-archive/2026-09-10-scenario-archive-restore-point/`(scenarios 1,760행 13.2MB + 편성 67·이력 414·로그 링크 63, MANIFEST.json에 SHA-256). 저장소 밖, 학습자 응답 payload 미포함.
- 보관 표시 칸 판정: `usage_assignment`는 연구 자료·학습자 노출 축(coursework_published/experiment_locked/archived_only(기본)/excluded)이고 1,723행이 기본값이라 재사용 불가 → 새 컬럼 `scenarios.archived_at timestamptz` + `archive_note text`(migration `20260910120000_scenario_archive_state.sql`, 되돌림 = NULL 갱신). **migration push는 미실행(승인 대기).**
- 불변조건 「archived_at IS NOT NULL ⇒ 현행 제작·검토·편성 후보와 활성 집계에서 제외」를 코드 11곳에 적용: AdminBrowser 목록, AdminAssembly 조립/AI검토/최종승인 목록(직접 링크 scenarioId는 예외), AdminDashboard 집계, AdminFinalApproval 대기·완료 수, AdminCorpus 코퍼스 통계, composer.listCoreScenarios(편성 후보·학습자 투영), missionDb.listRunnableMissions, lockCandidateAudit, missionBatchRun.loadLockMissionBatchCores, coreBatchRun.loadExistingCoreRunItems. 미적용(의도): AdminPromptHarness 사용 프롬프트 이력, AdminFinalCorpusReview(run 단위), id 지정 조회·RPC, 학습자 RLS.
- 검증: typecheck 통과, Vitest 142파일 920 통과(worktree에 `.env`가 없어 CI placeholder 환경변수로 실행). 로컬 커밋만, 푸시·PR·배포·보관 UPDATE 미실행.
- 다음: ①migration push ②`.tmp/scene-grounding/archive-unreferenced.sql`로 1,503행 보관(수정 전 원본 draft 코어 3행 포함, 새 미션 4건은 이력 참조로 유지) ③라이브러리 필터 전체/현재/보관(UI 브리프 승인 후) ④PR·CI·배포.

### 보관 실행 결과 (운영 DB, 2026-09-10)

- migration `20260910120000_scenario_archive_state.sql` 원격 적용 완료(`db push`, 이 한 건만 미적용 상태였음). `archived_at timestamptz`·`archive_note text` 존재 확인.
- 보관 UPDATE 실행: **1,503행** archived_at 설정, archive_note = `unreferenced_before_scene_grounding_replacement_20260910`.
- 실행 후 실측: 현행 257 / 보관 1,503. 현행 257행은 **전부 미션 보유**(reviewed·released 75). 편성된 행 중 보관된 것 **0건**. 새 미션 4건 현행 유지, 수정 전 원본 draft 코어 3행은 미참조라 보관됨.
- ⚠️ 배포 전이라 운영 화면은 아직 `archived_at`을 읽지 않는다. 관리자 목록은 여전히 1,726줄로 보이며, 청소 효과는 PR 병합·배포 후에 나타난다. 학습자 화면은 편성 행이 모두 현행이라 영향 없음.
- 실행 명령 함정: `db push`·`db query`는 **worktree 안에서** 실행해야 한다(세션 기본 폴더 OneDrive에서 실행하면 project ref를 찾지 못한다). PowerShell 사용.

### 라이브러리 상태 필터와 PR (2026-09-10)

- 연구자가 UI 브리프와 PR·배포를 함께 승인. 기존 필터 줄에 「상태: 현재 / 보관 / 전체」 select 하나만 추가했다(기본 현재). 새 메뉴·새 화면 없음.
- 목록 조회는 상태 축에 따라 서버에서 갈린다 — 현재는 `is(archived_at, null)`, 보관은 `not(archived_at, is, null)`, 전체는 조건 없음. 보관 행에는 「보관」 배지와 archive_note를, 보관·전체 보기에서는 「제작·검토·편성 대상이 아니며 삭제된 것도 아니다」 문구를 띄운다.
- 검증: typecheck·Vitest 142파일 920 통과·운영 빌드 통과. 빌드가 갱신한 생성 파일 2개는 **커밋 지문·시각만 달라지고 내용 해시(artifact/prompt/evidence/edge_source/core_surface)는 동일**해 되돌렸다.
- PR: https://github.com/sylim-research/PRAGMA/pull/134
- 남은 것: 필수 CI 통과 → 병합 → Railway 배포 확인 → 관리자 화면에서 목록 257줄·상태 필터 눈확인(관리자 로그인이 필요해 연구자 몫).
- 병합·배포 완료: PR #134 필수 CI 통과(3분 16초) → main `ef56282e` → Railway deployment `6366552770` **success**. 운영 번들이 `index-CsfDT1pA.js`에서 `index-BAuIvB1W.js`로 교체됐고, 배포된 `AdminBrowser-CCTYYQkg.js`에 `archived_at` 조건과 보관 안내 문구가 들어 있음을 원격에서 확인했다. 관리자 로그인이 필요한 화면 눈확인은 연구자 몫이다.

## 교과목 18칸 생성 착수와 사전 검토 결함 2건 · 2026-09-10

run ID `scene_grounding_course_20260910`. 대상 = 기존 편성 20칸 중 이미 만든 w2-0·w9-1을 뺀 18칸.

### 사전 검토가 막은 것 — 판정 기준이 아니라 코드 이름 문제였다

1. **D 코드 이름 불일치(결함)**. 시스템의 JSON 정본은 초면 = `distant`인데(`coreSchema.PdrDistanceJson`, mission schema, `missionCanonicalization`, DB 매핑 `distant`→열 `formal`), `sceneGrounding.ts`의 D 설명과 검증 화이트리스트만 `formal`을 썼다. 호출부는 `PDR_DISTANCE_ENUM_TO_JSON`으로 `distant`를 보내므로, 검토기가 초면을 정확히 판정해도 `formal !== distant`로 불일치 처리돼 **초면 셀이 전부 보류**됐다(w2-1·w10-1). 수정 = 설명·화이트리스트를 `distant`로 정렬. 기준의 뜻(이전 상호작용 없음)은 그대로다.
2. **화행 코드의 뜻을 안 넘김(결함)**. 사전 검토 payload가 영어 코드만 보내 검토기가 `agreement`를 일상 영어의 「동의」로 읽고, 우리 정의(초대)의 시드를 「동의 화행이 아니다」로 보류했다(w5-1 1차). 수정 = 생성 프롬프트와 같은 `speech_act_ko`를 함께 전달하고, 코드를 일상 영어 뜻으로 재해석하지 말라는 한 줄을 프롬프트에 추가.

두 수정 모두 판정 기준·PDR 정의·학습설계를 바꾸지 않는다. 검증 = `prompts:snapshot` 재생성 후 typecheck·Vitest 142파일 920 통과. 이 수정 없이는 착수한 작업이 진행되지 않아 `generate-scenario`를 배포했다(`--use-api`). 배포 후 w2-1·w10-1은 정상 생성됐다.

### 실측 결과

- 코어 **17/18 생성**. 수정 전 프롬프트로 12개(w3-0·w3-1·w4-0·w4-1·w5-0·w6-0·w6-1·w9-0·w10-0·w11-0·w11-1·w12-0), 수정 후 프롬프트로 5개(w2-1·w10-1·w12-1·w13-0·w13-1). **두 프롬프트의 차이는 위 이름 두 곳뿐**이며 각 행의 `prompt_snapshot_hash`에 구분이 남는다. 콘텐츠 후보 ID는 `_03` 그대로 두었다(생성 기준 변경이 아니라 결함 수정이므로).
- w12-1은 1차 생성이 R29(focal head 0개) 규칙검사 실패로 저장되지 않았고, 재생성에서 통과했다. 모델의 1회 출력 결함이다.
- 보류된 원자료는 `.tmp/scene-grounding/held-before-fix/`에 보존했다.

### 🔴 미해결 1칸 — w5-1(초대·통역·5주차), 연구자 판단 필요

수정 배포 후에도 두 번 연속 보류됐고, 두 번째 이유는 코드 이름이 아니라 **사실과 지정 R의 충돌**이다. 시드 = 학생이 지도·평가 교수를 금요일 오후 교내 20분 작품 발표회에 초대. 지정 R=mid인데 검토기는 20분·교내라는 사실에서 mid 근거를 확신하지 못하고 흔들렸다(2차 응답은 이유문에서 feasible=true라고 쓰면서 false를 반환).

이건 게이트가 의도대로 작동한 쪽에 가깝다. 조건에 맞추려고 부담 사실을 지어내는 것은 이번 작업이 금지한 행위다. 선택지:
- **A. 이 셀 R을 low로 내린다** — 사실에 맞음. 15주 PDR 배분에서 mid 한 칸이 줄어든다.
- **B. 시드를 진짜 mid 부담의 초대로 다시 쓴다** — 예: 교수가 출강하지 않는 요일, 참석 후 10분 강평 요청 등. PDR 배분 유지.
- Claude 권고 = **B**. 15주 배분표가 설계 산출물이라 사실 쪽을 보강하는 편이 낫다. 다만 시드 재작성은 연구자 결정이다.

### 미션 생성

코어 17개로 전체 MJT5+DCT1 승격을 시작했다(`run.ts mission`). 결과·직접 검수는 다음 기록에 남긴다.
