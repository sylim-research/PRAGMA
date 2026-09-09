# PRAGMA R1~R33 자동 품질 점검 규칙 독립 감사

- 작성일: 2026-09-09
- 성격: 읽기 전용 설계·실행 감사. [단독 진행 적합]. 개선안은 미채택 제안이며 앱 코드·UI·DB·프롬프트·승인 상태를 변경하지 않았다.
- 주 감사 대상: C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09
- branch / HEAD: admin-absorb-2026-09-09 / 72cb39bf4365da48a78fb71807edf24ade949dc0
- 대상 validator: [missionRules.ts](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1) 1,415줄. 작업 파일 SHA-256: 73c09ae288dfe648e4485bc1b5a0bed2682435b223572ff9cc5845be8acc665d.
- 다른 AI의 인벤토리·설계 감사는 독립 증거로 채택하지 않았다. 인벤토리는 대조 대상으로만 사용했다.
- 검증: 기존 13개 테스트 파일 151개 통과, AST 127개 호출 지점 확인, 합성 입력 21건(기준선 2건 포함)과 품질관리 진입점 1건 재현, Edge 검사 번들 원본 일치 확인.
- 한계: 운영 DB·배포 Edge·실제 수업 콘텐츠 전수·AI 판단 정확도를 이번에 재검증하지 않았다. 아래 오탐·누락은 반례의 존재를 입증하며 오류율을 뜻하지 않는다.

## 1) Executive verdict — 보완 수용

현재 R 규칙 체계는 **연구 설계에 연결된 운영 자산이지만, 적용 계약·휴리스틱 강도·호출 경로·설명 기록이 완전히 일관된 통제체계는 아니다.** 문항 구조, 코드 참조, 원문 계승, 교수자 승인 전 기록을 지키는 핵심은 유지할 가치가 있다. 전체 폐기나 전면 재설계는 PRAGMA 완성의 최단 경로가 아니다.

그러나 현재 형태를 “명시적·기계적 조건만 검사하는 일관된 R1~R33 체계”라고 그대로 논문에 기술하면 방어하기 어렵다. R9·R30은 문자열 신호를 의미 위반으로 확정해 차단하며 정상 문장을 막는 사례가 재현됐다. 반대로 R16에는 명백한 데이터 간 수행 방식 불일치가 빠지고, R30은 미션 조립 이후의 상황문을 검사하지 않는다. R31·R33의 적용 여부는 저장된 계약보다 현재 프롬프트 상수에 의존한다.

**논문 기준본·전문가 형성평가 전 지금 반드시 해결할 일**은 다음으로 한정한다.

1. R9·R30의 오탐 차단과 R30의 미션 상황문 검사 공백을 정리한다. 위험 신호와 확정 구조 위반을 분리한다.
2. R16의 요청 맥락↔실제 코어/미션 수행 방식 비교를 보완한다. 참고 산출안 등 R10 대상 필드의 누락도 함께 확인한다.
3. 현재/과거/저작 초안/최종화 단계의 적용 정책을 명시하고, R31·R33의 “현재 prompt와 같을 때만 검사”가 의도한 범위인지 결정한다. 최종화 결과의 검사 책임도 명시한다.
4. 127개 검사 지점, 23 fail-only·4 warning-only·6 혼합 ID, R26 경로, 폐기·주석 불일치를 운영 설명에 반영한다. 현재 인벤토리·주석을 그대로 UI 데이터로 승격하지 않는다.

**완성 전 해결 권장:** R27 문장 경계 오탐, R19의 의도된 Anchor 재사용 경고, R12의 집계 의미, 하위 검사 증거의 저장 손실, 오류 위치·설명의 구체화.

**후속 개선:** 대규모 규칙 엔진, 전면 ID 재번호화, 규칙 편집 UI, 새로운 의미 유사도 모델·유료 전수 재검토. 이번 감사는 이를 선행 조건으로 제안하지 않는다.

## 2) 독립적으로 재확인한 사실

### 감사 대상과 버전의 구분

처음 열린 기본 저장소는 codex/mission-v4-workspace-checkpoint-2026-08-22 / dffa51025b7d0b1f98d88b21268c9ab5ead72161이며, 미커밋 변경이 많고 docs/CANONICAL.md도 없었다. 그 루트의 R27은 lineage, R29는 선택지 길이 단서 등으로 주 감사 대상과 의미가 다르며 R31~R33도 없다. 이를 현행 R1~R33로 보고했다면 감사 대상부터 틀렸을 것이다.

git worktree 목록에서 사용자가 지정한 인벤토리가 실제 존재하는 admin-declutter 작업트리를 찾았고, 그곳의 [정본 목록](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/CANONICAL.md:1)이 지정한 생성계약·학습자구조·관리자구조를 읽었다. 논문 [정본 목록의 앱 경로](C:/PRAGMA_THESIS_LOCAL/01_정본/00_정본목록.md:85)와도 일치한다. 기본 루트는 비교 대상으로만 남겼다.

인벤토리가 기준으로 적은 b4265d17, 감사 HEAD, 당시 로컬 캐시 origin/main(6ec00b07e5a689349b3240e302d4f245a85ab4c8)의 validator Git blob을 각각 AST로 확인했다. 모두 127곳이며 LF blob SHA-256도 16ddee8c62d57ec57a056bd09073bb41ca03d0a6c16ef41990e12535e09589c0으로 같다. 작업 파일의 다른 해시는 CRLF 차이다. 원격 ref를 새로 받거나 운영 배포 일치를 확인한 결과는 아니다.

### 번호·검사 지점·강도

| 축 | 확인값 | 해석 |
|---|---|---|
| 번호 범위 | R1~R33 | 33개 정수 번호 |
| retired | R22 | 실행 add 없음, RETIRED_MISSION_RULE_IDS에 보존 |
| 별도 하위 ID | R1c | R1과 다른 violation.id; 코어 스키마·카탈로그 |
| 현행 ID | 33개 | 정수 번호 32개 + R1c |
| 기록 대상 ID | 34개 | 현행 33개 + retired R22 |
| add() 정적 지점 | 127곳 | 반복문·스키마 선행 종료가 있으므로 한 번의 검사 수·독립 규칙 수가 아님 |
| 강도별 정적 지점 | fail 107 / warning 20 | 현재 모든 add의 ID·level은 문자열 literal |
| ID별 강도 | fail만 23 / warning만 4 / 혼합 6 | 혼합: R4·R5·R7·R10·R27·R29 |
| warning만 | R12·R19·R26·R32 | 함수 결과에서는 비차단; R26 후속 배치는 별도 |
| 코어만 | 5개 | R1c·R17·R25·R26·R30 |
| 코어+미션 | 5개 | R8·R9·R10·R16·R29 |
| 미션만 | 23개 | 위 10개를 제외한 현행 ID |

127곳은 TypeScript AST에서 이름이 add인 호출의 두 번째·세 번째 인자를 수집하고, 함수 호출 관계를 함께 읽어 재확인했다. **정수 ID만 집계하면 122곳, R1c는 5곳**이다. 인벤토리가 기록한 122와 정확히 일치하지만, 최초 추출 스크립트가 없어 그 AI가 실제 어떤 정규식을 사용했는지까지는 단정하지 않는다.

RuleFindingEvidence.subrule은 별도 축이다. R1c와 같은 top-level violation ID가 아니다. 현재 9종이 있다.

- R29: sentence_count, minimum_length, maximum_length, focal_head, support_count, substring, duplicate_segment
- R26: industry_lexical_evidence
- R27: dct_scene_shape

모든 검사에 subrule이 있는 것은 아니다. 127곳에 대한 완전한 기계 판독 식별자 목록으로 쓰기에는 부족하다.

### 실행·후속 처리·저장 경로

| 경로 | 실제 검사·조건 | 후속 처리와 저장 |
|---|---|---|
| [코어 배치](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/coreBatchRun.ts:299) | checkCore, require_context_spec=true | fail이면 저장 중단. R26 warning 때만 industry AI 1회. AI fail/인프라 오류면 중단하나 R26 자체는 warning으로 보존 |
| [개별/개요 기반 코어 생성](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/pages/admin/AdminGenerator.tsx:710) | checkCore, require_context_spec=true | fail이면 중단. 이 코드 경로에는 배치의 R26 후속 AI 조정이 없음 |
| [미션 조립 전](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:898) | checkCore, 계획 feature·direction 사용, require_context_spec 미지정 | 코어 fail이면 유료 조립 전 중단. R26 warning만으로 후속 industry 조정하지 않음 |
| [미션 조립 후](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:1087) | checkMission(raw, ctx, core) | 허용된 구조 오류는 국소 수리 후 재검사. 미해결 fail은 저장 중단. AI 품질검사는 별도 |
| [구조 수리](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:686) / [후보 재생성](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:793) / [교수자 수정본](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:1593) | 현재 수정본 전체에 checkMission | 수정 결과와 AI 품질점검을 연결. 교수자 수정본의 validation_result에 result·ID·level·message 저장 |
| [현재 콘텐츠 품질관리](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/contentReviewDomain.ts:29) | checkMission만 실행; coreInput은 R23 비교용 | Edge 번들로 같은 로직 실행. content_review_runs.rules와 snapshot/hash에 연결. checkCore를 다시 실행하지 않음 |
| [후보 잠금 감사](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/lockCandidateAudit.ts:104) | checkMission; 계획 feature와 direction을 미션 자체에서 파생 | R24·요청 방향 비교는 원 요청과의 독립 대조가 아님. 잠금 후보 구조 검사 목적 |
| [교수자 최종 승인 준비](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:1642) | finalize_mission → normalizeMission → finalize_reviewed_mission RPC | 이 함수는 최종화 결과에 checkMission을 다시 호출하지 않음. Edge 귀속 검증·SQL 승인 조건은 별도로 존재 |

결정론 validator 자체는 외부 API 0회이고 fail이 없으면 ok=true, 경고가 있으면 result=warning이다. **API 0회라는 성질을 전체 생성·품질관리 파이프라인으로 확대하면 안 된다.** R26뿐 아니라 서버의 source/선행발화/평가 단서 수리와 조립 뒤 허용된 R27 수리도 AI 호출로 이어질 수 있다.

저장 계층도 구분해야 한다. 코어 배치는 payload에 auto_check_result만 넣고 개별 ruleFindings는 반환값에 둔다. 미션 저장은 violations를 id/level/message로 다시 매핑하며 일부 evidence를 버린다. 품질관리 어댑터는 원 R ID를 issue_ko 문자열에 넣고 finding ID를 rule-1 등으로 재발급하며 where는 빈 문자열, quote는 null, needs_professor는 false로 둔다. 따라서 “모든 subrule·실측값·임계값이 승인 버전까지 구조화 추적된다”는 설명은 현재 사실이 아니다.

### 기존 잠정 분석과의 차이

- R22 retired, R1c 별도 ID, R19 source/후보 중복 warning, R24 계획 초점, R21 실제 fail, 머리 주석의 코어 subset 오류는 확인됐다.
- add 122곳은 **127곳으로 정정**해야 한다. 세 기준 Git blob도 동일해 코드 업데이트 때문이 아니다.
- 강도 집계는 **23/4/6**이다. 인벤토리의 fail-only 22 표기는 합계도 맞지 않는다.
- R3은 현행 3안·권장안 1개와 과거 valid 2개가 선택적으로 적용된다. 한 미션에 둘 다 강제하지 않는다.
- R26의 AI 후속은 모든 코어 생성 경로의 공통 정책이 아니다. 배치에서만 확인됐다.
- R31·R33은 단순 “미션 규칙”이 아니라 현재 prompt·저작 상태 조건이 있는 규칙이다.
- R33은 출처·계보가 아니라 진단차원 선언과 근거 위치의 구조다.
- R22 대체 근거는 주석만이 아니다. 8월 9일 구현 기록, 8월 25일 감사 기록, 현재 생성계약 §8.1, 실행 함수·테스트가 존재한다.
- 주석 외에 R26 계약표 강도, 원격 lineage 테스트의 R27 참조, evidence 전달 손실도 확인했다.

## 3) 위험도가 높은 규칙/규칙군 Top 10

위험 순서는 **실제 운영 차단·논문 설명 오류·정상 콘텐츠의 누락 가능성**을 함께 고려했다. 아래는 수정 제안이며 현행 동작과 구분한다.

| Rule | 문제 | 위험 | 현재 강도 | 권고 |
|---|---|---|---|---|
| R30 | 다의어 정규식 오탐 + 미션 상황문 검사 없음 | 정상 코어 차단, 조립/수정 뒤 평가 방향 노출 누락 | fail·코어만 | 지금 반드시 해결: 일반 자연어 신호는 warning/AI·교수자 확인, 적용 필드·시점 보완 |
| R9 | 부정/인용/지리 설명을 일반화로 취급, 우회 표현·필드 누락 | 연구 원리를 오히려 설명하는 문장 차단; 문화 본질주의 탐지 과장 | fail | 지금 반드시 해결: 위험 신호로 강도 조정, 의미 판단은 AI/교수자 |
| R16 | ctx끼리만 맞춰도 실제 core modality 불일치 통과; 미션 모드 비교 비대칭 | 명백한 구조 검사를 놓치면서 자연어에는 과도한 차단 | fail | 지금 반드시 해결: 구조 비교 보강, 정규식 서술 검사 분리 |
| R31·R32·R33 | 현재 prompt 상수/authoring 상태에 적용 종속; 최종화 후 전체 R 재검사 없음 | 저장된 계약의 감사 범위가 prompt 갱신으로 달라짐 | fail / warning / fail | 지금 반드시 범위 결정: 저장 계약 기반 적용, 초안·최종화 단계 명시; 20%는 연구자 판단 |
| R10 | 참고 산출안·recommended_example·어휘 힌트의 직접 언어 검사 부족 | 잘못된 목표어 참고 표현이 R 검사에 걸리지 않음 | 혼합 | 필드 범위 조정, 방향 코드 fail 유지, 문자 혼입 예외는 정책화 |
| R27 | 문장 수 대신 종결부호 개수를 계산; MJT fail/DCT warning | 소수점·복합 문장부호로 정상 장면 차단 | 혼합 | 완성 전 해결 권장: topology 유지, 형식 검사 보정 및 강도 근거 정리 |
| R26 | 경로마다 AI 후속 차이; keyword hit는 산업 의미 검토 생략; 계약표는 fail | 동일 코어의 저장 결과·비용 차이, 운영 설명 불일치 | warning; batch 후속 중단 가능 | warning 유지, 경로·후속 상태 통일 또는 명시 |
| R19·R12 | 의도된 공유 target도 경고; 후보와 문항 accepted를 함께 집계 | 정상 콘텐츠 경고 상시화, ‘정답 예측 가능’ 과장 | warning | 범위·문구 조정 권장; 통합/폐기는 후속 |
| R20·R23·R24 | 존재/계승/계획 비교의 조건을 ‘추적 가능성 완결’로 오해 | 가짜 hash 내용, 잘못된 coreInput, 자기 자신을 계획으로 준 검사 과대해석 | fail | 기본 유지; 무결성·요청 provenance 책임 명시, invalid coreInput 구분 |
| 공통 결과 모델 | 하위 검사키·실측 evidence·field path 전달이 불완전 | 교수자가 원인을 찾기 어렵고 카탈로그가 두 번째 정본이 됨 | 해당 없음 | 지금 설명 범위 한정; 후속 최소 메타데이터 보존 |

### 특별 감사 A — R9의 실제 범위와 강도

NATIONALIZE는 한국어 정규식 하나다. “중국인(들)은 / 중국에서는 / 중국 문화에서는 / 중국어 화자는 / 일반적으로 중국”과 한국 대응 표현을 검사한다. 문장 의미 분석·부정 처리·인용 문맥·양화 범위 판정은 없다.

코어에서는 situation_ko와 relation_ko를 검사한다. 미션에서는 explanation_ko, fix_choice.corrections.note_ko, reason.reasons.text_ko, multi_judge.candidates.note_ko만 모은다. 미션 자체 situation_ko·relation_ko, legacy reason_conf 이유 문구, DCT 참고안의 비고, unit 문구 등을 모두 검사하는 구조가 아니다. 원문 자체도 이 규칙의 포괄 대상이 아니다.

재현 결과:

- “중국인은 모두 같다는 일반화는 피해야 한다.”가 R9 fail이었다. 일반화 반대 문장을 위반으로 확정한다.
- 미션 해설 “한국 사람은 누구나 무조건 간접 표현만 선호한다.”는 R9를 통과했다.
- 미션 상황문 “중국인들은 항상 간접 표현을 좋아한다.”도 R9를 통과했다.

따라서 문화 본질주의 방지 원리는 유지하되, 이 패턴은 **의심 표현 탐지**로 설명해야 한다. 일률 fail은 권고하지 않는다. 소수의 명시적 금칙 문자열을 연구자가 정말 절대 금지로 정한다면 그 부분만 별도 하위 규칙으로 두고, 의미 일반화 여부는 AI 검토·교수자 감수로 넘기는 편이 타당하다. 단순히 표현 사전을 늘리는 것으로 원리 전체를 구현할 수 없다.

### 특별 감사 B — R30의 실제 범위·학습 지원 정보

[LEARNER_SCENE_EVALUATION_CUES](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/_shared/coreSourceRepair.ts:106) 세 정규식은 부담을 주지 않음+정중/공손, 정중/공손하게+화행 동사, 완화/직접성/선택권/화용/대역/적절성/강도/명료성+조절·유지·표현 등을 찾는다. coreLearnerSceneIssue는 최초 코어 서버 수리와 checkCore에서 사용된다. R30은 checkMission에서 실행되지 않는다.

- “담당자는 촬영 현장에서 조명의 강도를 조절한다.” → R30 fail. 물리적 강도를 화용 평가 기준으로 오인한다.
- “동료에게 정중히 요청해야 한다.” → core pass. ‘정중하게’와 다른 형태는 놓친다.
- 미션 상황문 “동료에게 정중하게 요청한다.” → R30 없음. 이 미션을 품질관리 buildContentReviewDomain에 넣어도 R30이 없고, 일치하는 코어를 제공한 재현에서는 전체 fail도 없었다.

이 규칙은 **학습 전 정답·평가 기준 노출 방지 전체**를 담당하지 않는다. 답안 확인 전 강조·정답·해설 숨김은 [러너의 answered 조건](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/pages/learner/CanonicalMissionRun.tsx:652) 등 별도 UI 통제다. 학습자용 P/D/R 칩과 화행 명칭·명시적 학습 지원은 [학습자 정보 노출 정본](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/product/PRAGMA_학습자구조_정본.md:38)에서 허용한다. 이를 R30 이름 때문에 전부 금지해서는 안 된다.

권고는 모든 학습 지원을 숨기는 것이 아니라, **어떤 필드가 언제 공개되고 어떤 평가 방향을 미리 주면 안 되는지**를 지정하는 것이다. 내부 정답 코드의 실제 공개처럼 기계적으로 확인되는 위반은 fail, 자연어의 평가 방향 추정은 warning과 검토 대상으로 나누는 것이 타당하다.

### 특별 감사 C — R20·R31·R32·R33과 계보

| Rule | 실제 강제 | 강제하지 않는 것 | 적절한 위치 |
|---|---|---|---|
| R20 | provenance 객체·model/prompt_version/content_hash/generated_at 값·generation_attempt | hash 재계산, provider/실제 호출 원본 검증, 승인 | 생성 기록 거버넌스 |
| R31 | 대상 path 누락/중복·scope ID·pack/version·근거 ID 합집합·건수·귀속 호출 metadata·미귀속 상한 | 문헌이 정말 해당 표현을 지지하는지, 모델이 그 문헌을 실제 사용했는지 | 모델 귀속 기록의 구조·거버넌스 |
| R32 | 20% 이하의 미귀속 건수 경고 | 품질/정확도 점수, 자동 승인 | 교수자 검토 우선순위 신호 |
| R33 | 진단차원 2~6개·고유 코드·허용 ref·빈칸 아닌 설명·서로 다른 ref 2곳 | 차원의 실제 구현, 문헌 출처, 효과 측정·숙달도 | 미션 진단 metadata·설계 계약 |

R31의 claim_status=model_attribution_pending_review는 교수자 최종 승인과 같은 상태가 아니다. authoring.lineage_status=pending은 저작 중 귀속 산출을 유예하는 또 다른 상태다. 이름만 같다고 하나의 ‘미승인’ 값으로 합치면 안 된다.

R20에 64자리의 임의 hash를 넣어도 통과했고, R33의 설명을 전부 “확인.”으로 바꾸어도 통과했다. 이는 존재·구조 검사라는 한계에 부합한다. 보고 문구가 “실제 근거 확인 완료”라면 잘못이다. R33은 서로 다른 두 MJT ref만으로도 충족할 수 있어 “MJT와 DCT에 각각 근거가 있다”는 보장도 없다.

R31 구조 fail은 유지할 근거가 충분하다. 다만 **미귀속 20% 초과를 사용 불가로 차단하는 정책**은 구조적 모순과 다르다. 현재 구현·정책 상수는 확인했지만 20%라는 수치의 경험적·연구적 정당화는 이번 근거에서 확인하지 못했다. 억지 귀속을 유도하지 않는지 연구자가 결정해야 한다. R32를 임의로 fail로 올릴 이유는 없다.

최종 승인과의 연결은 R 규칙 밖에도 있다. [승인 준비 SQL](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/migrations/20260906100000_focused_content_review.sql:67)은 관리자 권한, 현재 source/content hash, 규칙 pass/warning, 필요한 AI 증거와 교수자 결정을 확인한다. [최종화 SQL](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/migrations/20260906100000_focused_content_review.sql:166)은 학습 내용·AI 결과 불변, 교수자 근거, covered lineage 객체, version/parent/reviewer를 저장한다. 이 때문에 R20/31이 불완전하다는 사실을 곧바로 “교수자 승인 우회 가능”으로 결론내리지 않는다. 다만 최종화에서 새로 생성된 lineage에 전체 R31/R32 결과를 다시 연결하는 경로는 보강할 가치가 있다.

### 특별 감사 D — R22 retired와 lexical audit

폐기·대체의 근거는 [retired 상수](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:91), [8월 9일 HSK 운영 결정](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-09-hsk3-reference-system.md:8), [8월 25일 R 감사](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-25-mission-rule-audit.md:8), [현행 계약 §8.1](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/contracts/PRAGMA_생성계약_정본.md:672)에서 서로 확인된다. 8월 25일 기록은 R22가 실제 구현 없이 낡은 주석에 남았던 상태였다고 설명한다. 8월 9일은 어휘 감사 대체 체계의 도입일, 8월 25일은 retired 명시 정리의 증거로 구분하는 것이 정확하다.

[실행 함수](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/_shared/hskLexicalAudit.ts:1)는 방향별 중국어 필드를 모아 고유 어휘 토큰을 최대 160개 추출하고, HSK 참고 상한 조회·일치율·범위 밖 후보 최대 40개·policy/source ID를 기록한다. 조회 실패는 unavailable이며 non_blocking=true다. 한→중 코어에는 아직 중국어 목표 산출이 없으므로 미션 단계에서 감사하고, 중→한은 중국어 원문을 감사한다.

기존 R22 설명에 있던 문장 길이·절 수·HSK 초과 비율 전체를 일대일로 구현한 대체는 아니다. **어휘 참고 부분만 별도 비차단 감사로 대체**, 길이·담화 형태 일부는 R29가 담당한다. 숙달도·자연성·화용 적절성이나 ‘수준에 맞는 문장’을 확정하지 않는다. 별도 어휘 감사를 복원된 R22로 재번호화할 필요도 없다.

현행 실행 add에는 R22가 없다. 역사 계약·기록의 R22 표기는 이력이며 삭제 대상이 아니다. 다만 “lexical audit가 R22의 모든 목적을 똑같이 대신한다”는 설명은 보정해야 한다.

## 4) 전체 규칙 감사표

아래의 기능 범주는 강도·실행 단계·상태와 별개다. **R22만 retired이며 나머지 33개 ID는 현행 실행 코드에 존재한다.** 여기서 현행은 모든 신규 미션에 항상 실행된다는 뜻이 아니다. 조건이 맞아야 실행되며 R1/R1c 스키마 실패로 일찍 종료할 수 있다. ID 아래 괄호는 AST에서 센 정적 add 지점 수다.

| Rule / 지점 | 기능 | 필요성 | 자동검사 적합성 | 현재 강도 | 직접 적용 범위 | 중복 | 논문 정합성 | 판정 |
|---|---|---|---|---|---|---|---|---|
| [R1](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:511) (7) | 미션 스키마·문항 순서·슬롯/초점/대역 참조 | 필수 | 적합. 스키마 선행 실패 시 나머지 미실행 | fail | 미션·계약별 | R11 등 스키마 방어와 겹침 | MJT5 유지. legacy 읽기와 신규 생성 분리 | 유지; 하위 검사키·선행 차단 표시 |
| [R1c](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:367) (5) | 코어 스키마·theme/topic/domain 카탈로그 | 필수 | 적합. 자연어의 실제 주제 적합성은 미판정 | fail | 코어 | R1과 스키마 목적 공유, 대상 다름 | 코어 단계의 자료 계약 | 유지; 카탈로그 범주 단독 분류는 불완전 |
| [R2](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:641) (3) | native Judge3 비적정 1개·앵커 PDR; legacy within 포함 | 현행 문항 설계상 필요 | 라벨/조건의 기계적 정합만 적합 | fail | 미션·native/legacy 상반 조건 | R27의 맥락 계획과 보완 | PDR로 정답을 계산하지 않음 | 유지; 버전 조건을 반드시 설명 |
| [R3](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:656) (3) | native 수정안 3·유효 1; legacy 유효 2; 앵커 PDR | 필수 | 적합. 수정안의 실제 적절성은 AI/교수자 | fail | 미션·singleRepairContract 분기 | 스키마 수량 제한과 일부 겹침 | 현행·과거 계약 혼합 설명 금지 | 유지; 잠정 요약의 ‘유효 2개’ 보정 |
| [R4](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:676) (7) | 이유 ID·역할·주원인·문자 중복·PDR | 필수 | ID/표식 적합. 단일 주원인의 의미 유일성은 미확인 | 혼합 | 미션; warning은 legacy reason_conf | R1 구조·R18 비적정과 보완 | 이유 판단과 산출 조건 연결 | 유지; ‘주원인이 타당하다’로 확대 금지 |
| [R5](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:721) (13) | 후보 수·대역 분포·중복·PDR 한 축·길이 단서 | 필수, 길이는 보조 | 구조 적합; 길이는 휴리스틱 | 혼합 | 미션·저장 계약별 | R19와 후보 중복 일부 겹침 | 길이로 화용적 적절성을 확정하지 않음 | 구조 fail·길이 warning 유지 |
| [R6](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1077) (1) | highlights가 target의 부분문자열 | 필수 | 적합. 강조 구간의 교육적 타당성은 미판정 | fail | 미션·target 문항 | 스키마와 보완 | 강조는 실제 문자열과 연결; 노출 시점은 UI | 유지 |
| [R7](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:612) (4) | 척도 연속 구간·동일 극성 2개·참고 판정 포함 | 필수; 반례 우선은 설계 권고 | 형식 적합; 반례 내용 자체는 미판정 | 혼합 | 미션·v4/v5 추가 조건 | R1 enum과 보완 | 직접적이면 항상 나쁨이라는 소박한 규칙 방지 | 유지; 반례 warning을 보편 정답식으로 쓰지 않음 |
| [R8](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:843) (5) | 코어 응답형 선행발화; 현행 native 미션 null; legacy 필수 | 단계별 필요 | 구조 적합. 선행 사건의 충분성은 의미 검토 | fail | 코어+미션·계약별 | 생성 서버의 선행발화 수리와 방어층 | 코어 재료와 학습자 self-contained 장면의 차이 | 유지; 한 줄 ‘선행발화 필수’ 금지 |
| [R9](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:125) (2) | 국가 일반화로 의심되는 한국어 문자열 | 연구 원리상 필수, 현재 탐지 방식은 부족 | 의미 확정에 부적합; 위험 신호에는 적합 | fail | 코어 상황/관계; 미션 일부 해설/비고 | AI 문화·일반화 검토와 역할 분리 필요 | 부정·인용도 차단하고 우회 표현·필드 누락 | 강도·범위 조정, 의미 확인은 AI/교수자 |
| [R10](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:194) (8) | 요청 방향 일치·한글/한자 존재·혼입 | 필수 | 방향 enum 적합; 문자 범위는 언어 추정 | 혼합 | 코어+미션·필드별 | 정규화·서버 언어 검사와 방어층 | 양방향 지원; 참고 산출안·권장안·힌트 범위 부족 | 방향 fail 유지; 필드 보완·언어 허용 정책 정리 |
| [R11](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:798) (2) | DCT 참고안 1~2·문항 권장안 존재 | 필수 조건 | 적합하나 일부는 R1이 먼저 거부 | fail | 미션 | 현행 Zod와 높은 중복 | 참고 표현 준비 조건; 제시 시점은 별도 | 유지 또는 R1 하위 설명으로 묶기; 독립 실행 수 과장 금지 |
| [R12](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1269) (2) | accepted의 과소/적정/과잉 쏠림 | 보조; 현행 변별력은 제한적 | 집계는 가능하나 편향/예측 가능성은 미입증 | warning | 미션 | R5 적정 2개 계약이 일부 목적 보장 | Scale4 제외·후보까지 합산하므로 문항 정답 분포와 다름 | 범위·문구 조정 권장; 폐기/흡수는 후속 |
| [R13](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:578) (3) | feature 존재·현행 카탈로그 버전 일치 | 필수 | 적합 | fail | 미션·unit 및 item_focus | R1 대역·R14 복사값과 보완 | 과거 버전 읽기는 허용, 재검사에선 최신 카탈로그 강제 | 유지; 읽기/재승인/신규의 정책 명시 |
| [R14](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:818) (2) | learner_label·closing_ko 정확 복사 | 현재 중앙 카탈로그 설계상 필요 | 문자 일치에는 적합; AI 생성 여부는 판정 불가 | fail | 미션 | R13 버전과 연관, 동일 검사는 아님 | 교수자 편집 자유보다 중앙 문구 일관성을 우선한 계약 | 유지; ‘AI 생성 의심’ 문구 보정 권장 |
| [R15](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:538) (3) | 요청 화행·unit/item focus·learning_goal 정합 | 필수 | 적합. 실제 화행 구현은 미판정 | fail | 미션만 | R1c 요청 셀·R24 계획 초점과 구분 | 현재 여러 item_focus를 한 화행 목표 아래 묶음 | 유지; 코어 적용으로 표시하지 않음 |
| [R16](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:434) (6) | 모드·양식과 명시적 수행 장면 | 필수 | 구조 적합; 자연어 정규식은 불완전 | fail | 코어+미션, 검사 필드 비대칭 | R28 채널 매핑과 일부 목적 공유 | ctx↔실제 core 양식 및 translation↔mission mode 대조 누락 | 구조 범위 보완; 서술 추정 강도 분리 |
| [R17](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:461) (1) | industry는 work에서만 | 현재 도메인 모델상 필요 | 적합. ctx만 검사 | fail | 코어만 | R1c와 요청 셀 구성 목적 공유 | 업무 분야의 실제 구현은 R26/AI | 유지 |
| [R18](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:665) (3) | 교정·이유의 문제 문장에 within 금지 | 현행 문제 역할상 필요 | 저장 라벨 검사는 적합; 의미 적절성 미판정 | fail | 미션·fix/reason 유형 | R2 비적정 목적과 유사하나 대상 다름 | 판단 대상이 조정 필요 표현이라는 설계 | 유지; ‘실제로 부적절함 검증’이라고 쓰지 않음 |
| [R19](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1305) (1) | MJT source/target/교정/비교 후보 NFKC·trim 중복 | 보조 | 문자 중복에는 적합; 의도된 재사용 구분 불가 | warning | 미션 | R5 후보 내부 중복과 일부 겹침 | 공유 Anchor A의 target 재사용도 기본 샘플에서 경고 | 범위 조정 권장; 의도된 공유를 설명 |
| [R20](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1023) (3) | 생성 provenance 객체·필수 값 | 필수 거버넌스 | 존재 검사는 적합; hash 진위·시각 유효성 미검증 | fail | 미션 | R1 provenance 스키마와 중복; R31과 대상 다름 | 추적 가능성의 최소 기록, 승인/무결성 인증 아님 | 유지; 버전·hash 대조 책임은 별도 명시 |
| [R21](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1353) (2) | 권장안이 invalid 교정/부적정 target과 정확히 동일 | 필수 | 명시 라벨 간 모순 검사에 적합 | fail | 미션·fix_choice만 | R18·R3과 보완 | 의미 최종 판단의 침범이 아님 | fail 유지; warning 주석 수정 |
| [R22](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:91) (0) | 옛 수준/HSK 휴리스틱 | 현재 R 체계에서 불필요 | 현행 검사 없음 | 없음 | retired | 어휘 참고는 lexical audit; 길이는 R29 | 숙달도·HSK 등치 방지 | retired 유지·번호 재사용 금지 |
| [R23](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1371) (5) | 코어 source/PDR/양식/방향/usable_facts 계승 | 필수 | 정확 비교에 적합 | fail | 미션; 유효 coreInput 제공 시만 | 계보·서버 조립과 방어층 | DCT 상황문은 새 사건이므로 같음 강제하지 않음 | 유지; 잘못된 coreInput의 조용한 생략 보완 |
| [R24](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1010) (1) | 계획 target_feature와 생성 unit 일치 | 필수, 계획이 있는 경로 | 적합 | fail | 미션; ctx에 계획 있을 때 | R13/15는 존재·화행, R24는 선택된 초점 | 학습목표 계획 보존 | 유지; 호출자가 준 계획의 출처 표시 |
| [R25](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:376) (2) | 신규 context_spec·통역 A/B/C·PDR 관계 값 | 필수 provenance/역할 계약 | 상수·필드 검사는 적합; 내용 개연성 미판정 | fail | 코어; require_context_spec=true | 서버 주입 스키마와 보완 | 학생 장면에 C 소개 강제와 다른 내부 계약 | 유지; 신규/legacy 적용 조건 표시 |
| [R26](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:465) (1) | 산업 코드별 제한된 어휘 증거 | 최소 신호로 유용 | 어휘 신호만 적합; 산업 적합성 판정 불가 | warning | 코어; batch는 후속 AI로 중단 가능 | core quality industry 축과 보완 | 정본 fail 표기와 실행 다름; 경로별 후속 불일치 | warning 유지·경로와 문서 조정 |
| [R27](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1187) (11) | X-A-A-A-Y-C·PDR 한 축·장면 형식 | 현행 맥락 계획상 필요 | 복사/코드 정합 적합; 문장 수는 부호 개수 근사 | 혼합 | 미션 v4/v5, persisted contrast_plan별 | R2~5 PDR·서버 topology와 보완 | 새 사건의 의미 독립성·충분성은 미확인 | topology 유지; 문장 수 오탐·강도 정리 |
| [R28](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1247) (1) | 번역 email/messenger·통역 facetoface/phone | 현재 수행 매체 계약상 필요 | enum 매핑 적합 | fail | 미션 v4/v5 | R16 양식과 보완 | 채널이 공손성·격식을 자동 결정하는 규칙은 아님 | 유지; schema의 ‘channel 폐기’ 주석과 정렬 |
| [R29](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:250) (9) | 원문 유효 글자·문장 권고·focal 구조·참고안 45% | 형식·부하 상한 필요; 비율은 보조 | 글자/부분문자열 적합; 충실성 추정은 경고만 | 혼합 | 코어 focal_segments 존재 시; 미션 v5 | R1 focal 스키마·서버 길이 수리와 방어층 | 범위는 파일럿 정책이지 수준 적합성/기억 용량의 검증값 아님 | 구조 유지; 원문 길이·참고안 진단 의미 분리 |
| [R30](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:456) (1) | 학생용 상황문에 평가 방향 어휘 조합 | 노출 통제 원리상 필수 | 다의어·부정·표현 변형 때문에 의미 확정 부적합 | fail | 코어 situation_ko만; 서버 생성 수리에서도 helper 사용 | UI 답안 공개 시점 통제와 별개 | 정상 ‘조명 강도’ 차단·미션 상황문 누락 | 강도·범위 조정, 교수 지원 정보 허용 유지 |
| [R31](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:921) (5) | 모델 귀속 구조·scope·근거 합집합·provenance·20% | 기록 무결성 필요; 20%는 정책 판단 | 구조 적합. 실제 문헌 지지·모델 사용 증명 불가 | fail | 미션 v5·현재 prompt만·authoring pending 제외 | R20은 생성 기록, R31은 문항 귀속 | pending은 확정 근거 아님; 최신 prompt 의존·최종화 후 R 검사 경로 공백 | 구조 유지; 계약 기준 적용·20% 근거 재검토 |
| [R32](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:944) (1) | 허용 상한 이내 미귀속 claim 수 | 교수자 주의 신호 필요 | 집계 적합 | warning | R31과 같은 조건; covered·0<미귀속≤20% | R31과 상호 보완, >20%는 R31 fail | 미귀속 비율은 콘텐츠 정확도·품질 점수 아님 | 유지; 상태별 표시·필요한 교수자 판단 연결 |
| [R33](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:972) (4) | 진단차원 2~6·코드/근거 ref·설명·2곳 이상 | 현재 생성계약상 필요; 구성개념 최소 수는 연구자 정책 | 선언 구조 적합. 차원이 실제 구현됐는지 미판정 | fail | 미션 v5·현재 prompt만 | 문항 데이터/진단 metadata; 출처 계보와 다름 | 2곳은 MJT 두 곳이어도 충족, MJT와 DCT 각각 보장 아님 | 유지하되 분류·범위 보정; 2개 최소는 근거 확인 |

R1·R11 중복은 실제로 재현됐다. reference_alternatives=[]를 넣으면 R11이 아니라 R1만 반환된다. 스키마에서 이미 거부한 조건이 후속 add에 남아 있는 사실을 “두 번 실행된 검사”로 세면 안 된다. 이번 127은 실행문 위치의 수일 뿐, 127개의 독립 제약·모든 도달 가능 조건·품질 보장 수가 아니다.

P·D·R 관련 R2/3/4/5/23/25/27은 **저장한 조건·역할·대비 계획을 비교**한다. 특정 PDR을 입력하면 정답 band를 산출하는 공식은 이 코드에서 확인되지 않았다. accepted/primary/is_valid 라벨의 의미 타당성이 입증됐다는 뜻도 아니다. 한 축 차이라는 코드 조건이 자연어에서 실제 한 변수만 바뀌었다는 통제 실험을 보장하지 않는다.

## 5) 7범주 taxonomy 감사

**7개 설명 그룹은 보완하여 사용 가능하다. 원래부터 존재한 공식 설계 taxonomy라는 주장은 수용하지 않는다.** 현행 코드는 단일 Rule ID 안에 스키마·카탈로그·PDR·휴리스틱을 섞어 두었으므로 ID 단위의 의미적 MECE는 성립하지 않는다. “각 ID를 주분류 하나에 한 번만 배치했다”는 관리상 완전성과 개념적으로 상호 배타적인 분류는 다르다.

가장 분명한 이동은 R33과 R23이다. R33은 진단차원·근거 위치 선언으로 출처·계보가 아니다. R23은 원문 등의 정확한 계승으로 거버넌스 성격이 크다. R16·R28은 수행 방식·역할·채널 묶음으로 이동하면 “원문·상황 성립”의 범위가 좁아진다.

| 설명용 주분류 제안 | Rule ID | 수 |
|---|---|---:|
| 문항 구성·판정 데이터 | R1 R2 R3 R4 R5 R6 R7 R11 R12 R18 R19 R21 R33 | 13 |
| 요청 조건·카탈로그 정합 | R1c R13 R14 R15 R17 R24 | 6 |
| 언어 방향·문자 형식 | R10 | 1 |
| 수행 방식·역할·채널 | R8 R16 R25 R28 | 4 |
| 장면·원문 구성 | R26 R27 R29 | 3 |
| 일반화·사전 정보 노출 위험 | R9 R30 | 2 |
| 생성 기록·계승·근거 귀속 | R20 R23 R31 R32 | 4 |
| 합계 | 현행 ID를 각각 한 번 배치 | 33 |

R22는 범주 합계 밖에 retired로 표시한다. 위 분류 역시 **연구자 검토 전 설명 제안**이다. UI 편의를 위한 주분류이며 한 규칙에 부가 태그를 붙일 수 있다. R1c에는 코어 스키마, R1에는 카탈로그, R4/5에는 PDR 맥락 설계, R26에는 산업 어휘 위험, R29에는 부하·참고안 점검 같은 부가 설명이 필요하다.

특히 R1c·R13·R14·R15·R17·R24를 묶은 “생성 조건·카탈로그 정합”은 상위 관리 목적에서는 타당하지만 하나의 논리 검사 축은 아니다.

- R1c: 코어 형식과 요청 셀의 허용 조합.
- R13: 통제된 feature와 버전 존재.
- R14: 사람이 정한 공통 문구의 정확 복사.
- R15: 화행 목표와 문항별 초점의 카탈로그 관계.
- R17: domain에 따른 industry 필드 허용.
- R24: 이번에 선택한 계획 초점을 생성물이 유지했는가.

“요청 조건·카탈로그 정합”이 조금 더 정확하다. 이 이름에 수준 적합성·실제 산업 구현·자연어 화행 적합성까지 포함시키면 안 된다. 논리적 MECE가 정말 필요하면 ID를 재분류하는 작업보다 **하위 검사 지점**을 기준으로 분류해야 한다. 이번 완성 단계에서 전면 분해할 필요는 없다.

R20/23/31/32는 넓은 운영 품질 관리에는 포함할 수 있다. 다만 콘텐츠 의미 품질과 다른 **거버넌스 통제**임을 태그나 설명으로 표시해야 한다. 네 축에 더해 “구조 계약 / 휴리스틱 위험 / 거버넌스”는 관리상 유용한 보조 태그다.

## 6) 역할 경계 감사

[관리자 정본의 집중 검수](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/product/PRAGMA_관리자구조_정본.md:312)와 논문 용어대장은 자동 품질 점검→AI 검토→교수자 감수→교수자 최종 승인을 구분한다. 소스의 큰 흐름은 이 경계와 대체로 맞는다. 예외를 정리해야 한다.

| 층 | 확인된 구현과 정합성 | 필요한 보완 |
|---|---|---|
| 자동 품질 점검 | schema·참조·enum·문자 포함·동일성·수량을 순수 함수로 검사. 구조 fail은 운영 게이트 역할 | R9·R30·R16 서술부가 의미 추정까지 fail로 확정. 신호와 위반을 구분해야 함 |
| AI 검토 | 조립/수리 뒤 품질검토, R26 일부 경로 후속, 현재 hash와 일치하는 저장 품질결과 재사용. 추가 독립 검토는 선택 가능 | R26의 경로별 차이, “규칙은 API 0회”와 후속 AI 호출의 구분 필요 |
| 교수자 감수 | 전체 현재 콘텐츠 확인·편집, 중대/needs_professor 쟁점에 수정·유지·보류와 근거 저장 | 현재 규칙 finding을 전부 needs_professor=false로 변환하므로 새 휴리스틱 경고의 판단 경로를 설계해야 함 |
| 교수자 최종 승인 | 명시 승인 입력·권한·hash·교수자 근거와 결정 확인. approved_by/at 및 미션 version 연결 | 자동 통과가 승인이라는 표기 금지. 새 lineage 산출 후 검사 책임/증거 연결 명확화 |

자동 규칙이 의미 판단을 침범하는 대표는 R9, R30, R16의 자연어 서술 정규식이다. R26 어휘 신호, R5 길이, R27 짧은 legacy 장면, R29 짧은 참고안은 warning이므로 현재 강도는 상대적으로 적절하다. 그러나 “담화 전체를 옮기지 않은 것으로 보임” 같은 문구가 **의미 누락 확인**처럼 읽히지 않도록 “원문 대비 길이 비율 낮음, 내용 확인 필요”로 표현할 수 있다.

R2/3/4/18/21은 자동화가 의미 영역을 침범한 것으로 일괄 분류하면 안 된다. “유효하다고 표시된 후보 개수”, “주원인 ID와 정답 ID 일치”, “invalid로 표시한 동일 문장을 다시 추천했는가”는 기계적 계약 검사다. 해당 후보가 진짜 적절한지, 이유가 실제로 타당한지와 분리되어 있다.

반대로 R16의 실제 payload 비교와 R10의 참고 표현 필드처럼 명시 가능한 검사는 AI에게 전적으로 맡길 이유가 없다. 과거 저장형·양방향·수행 모드 차이를 반영해 직접 검사해야 한다.

AI fail이 자동 재시도나 저장 중단의 원인이 된다는 사실과 AI가 최종 승인 권한을 가진다는 주장은 다르다. 현재 소스에 AI의 단독 최종 승인 경로는 확인되지 않았다. 다만 정상 콘텐츠를 R9/R30 hard fail로 막으면 교수자가 감수·유지 판단을 하기 전에 절차가 중단되므로, 자동 검사 강도의 설계가 교수자 판단 범위에 실질적인 영향을 준다.

정보 공개는 정적 콘텐츠 검사와 러너 동작을 함께 보아야 한다. R6은 강조 문자열 존재, R11은 참고안 존재일 뿐 공개 시점을 통제하지 않는다. 답안 확인 전/후, MJT 뒤 recap, DCT 뒤 피드백의 실제 공개는 별도 렌더링·상태 조건이다. 이번에는 그 일부 소스 조건을 대조했으며, 학습자 브라우저 E2E 전체를 재실행했다고 주장하지 않는다.

## 7) 주석·문서·테스트·실행 코드 불일치

아래는 이번 범위에서 확인한 불일치다. 저장소 모든 주석·문서를 전수 검증한 결과는 아니다.

| 근거 위치 | 불일치 | 판정·영향 |
|---|---|---|
| missionRules.ts:8 | 코어 subset에 R15/R19 포함, 실제 R29/R30 누락 | 주석을 적용 범위 정본으로 사용 금지 |
| missionRules.ts:417 | checkCoreCommon을 “코어·미션 production_task 공통”으로 설명 | 실제 checkMission은 호출하지 않음. R30 공백을 가림 |
| missionRules.ts:120 | 중국어 내 한글 고유명사에 관대하다는 설명 | looksChinese는 한글 한 글자만 있어도 false |
| missionRules.ts:208 | checkTargetLangSoft 설명은 warning | 실제 한글 혼입은 fail, 무한자/한국어 없음 등은 warning |
| missionRules.ts:883 | R21 섹션 제목은 warning | 실제 두 add 모두 fail, 계약표와 8월 25일 변경 기록은 fail |
| missionRules.ts:1283 | R2 judge3가 within 정답을 보장한다고 설명 | 현행 native R2는 비적정 1개를 강제. legacy 설명이 남음 |
| missionRules.ts:1406 | assertCatalogIntegrity “부팅 시 1회” | 검색한 src/scripts/shared에서 호출처 없음. 이 함수를 상시 통제로 주장 불가 |
| missionSchema.ts:214 / promoteMission.ts:4 | 결정론 범위를 R2~R23 / R1~R24로 설명 | 실제 R33까지 존재 |
| coreSchema.ts:63 전후 | channel이 판정축이 아니며 legacy로만 남는다는 포괄 주석 | 미션 R28은 channel↔mode enum 매핑을 hard 검사. 매체→격식 판정 폐지와 구조 매핑을 구분해야 함 |
| 생성계약 정본:611 | R26 강도 fail | 현재 validator warning, batch 후속 AI만 별도 중단 가능 |
| 생성계약 정본:354 | core quality v5·15축 | contentRelease 현재 core_quality_v9_scene_plausibility. 현재 이름과 역사 기준선 구분 필요 |
| 생성계약 정본:493 | 새 DCT 사건을 “근접 전이”로 표현 | 코드가 새 사건·조건을 보장하는 범위를 넘어 전이 성과로 읽히지 않도록 정리. 효과 입증은 아님 |
| 인벤토리:3·19·138 | add 122, fail-only 22; R3 요약에 현행/legacy 중첩 | AST 127, fail-only 23, R3는 선택 분기. 현재 UI 정본으로 사용 불가 |
| [원격 lineage smoke](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/itemLineage.remote.test.ts:90) | mission_v4_separate_item_lineage 응답 기대·R27을 lineage 성공 확인으로 사용 | 현재 R27은 장면 계약. 과거 테스트를 현행 R31/R32 검증으로 셀 수 없음; RUN_LINEAGE_SMOKE 기본 비실행, 이번 호출하지 않음 |
| [로컬 lineage 테스트 일부](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/itemLineage.test.ts:159) | R27 없음으로 lineage 통과를 확인하는 오래된 assertion | 같은 파일 뒤의 R31/R32 직접 테스트는 유효. ‘파일 전체가 잘못됨’으로 확대하지 않음 |
| R31/R33 현재 prompt 비교 | 인벤토리의 “미션” 범위보다 실제 조건이 좁음 | authoring pending/current/historical을 분리해야 정확 |
| 코어 vs 미션 R16 | 코어는 ctx mode↔ctx source_modality, 미션은 interpreting 방향 위주 | 실제 payload 불일치 재현. 강도 설명만으로 검사 완전성을 알 수 없음 |
| 품질관리 어댑터:40~42 | 모든 R 결과를 구조·형식/needs_professor=false·빈 위치로 변환 | 휴리스틱·거버넌스 분류와 실제 교수자 조치 필요가 소실 |
| 기본 루트 vs 감사 작업트리 | 같은 R27/R29/R30 ID의 의미가 다름 | ID만으로 역사 결과를 합산 금지. repository/commit/rules_version과 함께 읽어야 함 |

추가로 기존 테스트 대부분은 특정 R ID만 필터링하는 유효한 회귀 테스트다. 그 테스트가 통과했다고 모든 R의 의미 경계와 적용 범위가 검증된 것은 아니다. 이번 151개 통과와 별개로, 일반화 부정문·물리적 강도·정중히 표현·미션 상황문·역방향 mode·소수점 문장 수 반례를 재현했다.

결론적으로 **코드 주석을 UI 데이터 원본으로 쓰는 것은 부적합**하다. 주석은 의도·역사를 설명하는 참고자료다. 실행 상수/함수·저장 계약·호출자 정책과 대조한 뒤 사람용 문구를 작성해야 한다.

## 8) 품질 규칙 카탈로그 구현 구조 권고 — 아직 구현하지 않음

현재 구조에서도 사람용 qualityRuleCatalog.ts를 얇게 둘 수 있다. 다만 ID·강도·적용 범위를 사람이 중복 입력하면 두 번째 실행 정본이 된다. 향후 구현을 한다면 다음 정도가 최소 안전 범위다.

### 실행 정본과 설명층

- 실행 사실 정본: validator + normalizeCore/normalizeMission 스키마 + 적용 계약을 결정하는 함수/상수 + 호출 경로의 후속 처리. missionRules.ts 한 파일만으로 모든 운영 효과가 정의되는 것은 아니다.
- 설명층: 주분류, 한 줄 요약, 연구 설계상 목적, 읽을 코드·문서 위치. 설명 검토 상태를 명시한다.
- 실행 메타데이터: Rule ID, 가능한 severity 집합, subrule, 대상 단계, 계약 조건, retired 여부는 실행 정의에서 가져온다.
- 실제 위반 메시지: 실행 결과를 그대로 표시한다. 정적 카탈로그는 매개변수를 포함한 대표 템플릿임을 구분한다.
- 현재 적용 여부: “미션” 같은 고정 라벨만 쓰지 말고 저장된 schema/contrast_plan/prompt/authoring 상태와 ctx를 적용해 계산한다. 검사하지 않은 항목을 pass로 표시하지 않는다.
- 운영 후속: R26 warning→AI 재확인→중단 가능 같은 경로 정책을 severity와 다른 필드로 표현한다.

### 추천하는 최소 구조

1. 기존 R 번호를 보존한다. 중복되는 add 지점에는 필요한 범위부터 안정적인 하위 검사키를 붙인다. 예: R16의 mode/modality 일치와 scene regex, R29의 maximum_length를 구분한다. R1c는 온전한 ID로 다룬다.
2. 실행용 descriptor에는 ID·허용 severity·단계/계약 조건을 선언하고, validator가 그 descriptor를 사용해 finding을 만든다. helper를 우회한 임의 ID/강도 출력을 타입과 검사로 잡는다.
3. 카탈로그는 descriptor의 ID를 key로 하여 설명만 작성한다. Retired R22는 별도 lifecycle metadata로 노출하되 실행 가능 목록에서 제외한다.
4. 저장/전달에서는 ruleId, subrule/checkKey, ruleSetVersion, fieldPath, actual/threshold 등 필요한 최소 evidence를 보존한다. 교수자용 problem_type과 needs_professor는 원 finding 성격에 맞게 결정한다.
5. 모든 R을 당장 복잡한 규칙 엔진으로 옮길 필요는 없다. 현재 33개 ID·127곳을 기준으로 타입·메타데이터·테스트를 점진적으로 연결하면 된다.

### 자동 동기화·대조

단순 regex만으로 항상 일치를 보증할 수 없다. 이번 122/127 차이만 해도 숫자 ID만 포함하는 추출로 R1c 5곳을 빠뜨릴 수 있음을 보여 준다. 다중 행 호출, helper, 동적 ID/강도, import된 상수, 스키마 선행 종료, 버전 분기, 후속 AI 게이트는 정규식으로 완전하게 해석할 수 없다.

현재 감사의 AST도 만능 증명은 아니다. literal add 수와 지역 호출 관계는 정확히 수집할 수 있지만 조건의 의미·모든 실행 도달 가능성·외부 호출자 정책을 자동 보증하지 않는다. 그러므로 AST는 **누락 탐지 안전망**, 타입화된 실행 정의와 경로/계약 테스트는 **운영 사실 대조**로 사용한다. 미래 동적 인자를 만나면 누락시키지 말고 미해석 항목으로 실패시켜야 한다.

이미 [Edge domain 번들 대조](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/scripts/build-content-review-domain.mjs:1)가 source와 배포용 산출물의 일치를 검사한다. 이번 --check는 통과했다. 이 대조를 유지하고 카탈로그 일치 검사도 빌드/CI에서 자동화하되, 사람이 설명의 타당성을 검토하는 절차를 대체하지 않는다.

### 필요한 테스트 전략

- 현행 core v3/native mission v5, 과거 v1/v2/v3/v4·legacy v5·저장된 v8/v15/v16 계약별 기대 결과.
- R1c와 retired R22를 포함한 실행 ID/설명 key 양방향 누락 검사.
- ID별로 혼합 강도의 서로 다른 하위 경로 검사. “R4에는 fail이 있다”만으로 warning까지 검증했다고 보지 않음.
- 신규 코어/개별 생성/배치/조립 전/조립 후/수리 후/교수자 수정/최종화/품질관리의 ctx 및 후속 결과 비교.
- R9·R30의 긍정/부정/인용/다의어/표현 변형, R16의 양방향 mode 매핑, R27 소수점·문장부호, R10 참고 표현 필드.
- R1/R1c 선행 종료로 가려진 검사를 표시하는 테스트. R11이 반드시 자기 ID로 발화해야 한다고 강제하지 않음.
- JSON 저장·Edge adapter를 거쳐 checkKey/evidence/ruleSetVersion이 보존되는지 확인.
- 최종 승인 통과/실패는 별도 SQL·인증 통합 테스트로 검증. 이번 pure 함수 반례만으로 승인 취약점이나 운영 장애율을 단정하지 않음.

## 9) UI 가시화 판정

**읽기 전용 운영 화면으로 가시화할 가치는 충분하다. 다만 현재 인벤토리를 그대로 제품 사실로 표시하는 것은 보류한다.** 카탈로그 완성이나 편집 기능이 핵심 학습 흐름 완성보다 우선할 이유는 없다.

| 구분 | 정보 |
|---|---|
| 지금 사실대로 보여도 됨 | Rule ID/R1c/R22 retired, 실제 violation 메시지·강도, 검사 시각·규칙 버전·대상 콘텐츠 버전, 조건이 명시된 직접 적용 단계, 실제 수행한 검사/미실행 구분, validator로 연결되는 코드 위치 |
| 연구자 검토 후 표시 | 7분류 명칭·주분류, 한 줄 설명과 설계 목적, fail↔warning 변경안, R9/R30 위험 신호의 해석, R26 AI 후속 정책, R31 20%·R33 2~6개 정책의 의미, legacy/신규/최종화 범위 |
| 현재 보여주면 안 됨 | 122개 검사라는 수치, R3에 현행·과거 조건을 동시에 강제하는 설명, ‘R 규칙은 원래 7범주로 설계’, ‘127개 품질 보장’, ‘문화 일반화 전수 검사’, ‘R30이 사전 단서 노출을 모두 차단’, ‘R33 문헌 근거 검증’, ‘규칙 통과=승인/수업 사용 가능’, AST/regex가 영구 동기화를 보증한다는 문구 |

‘지금 보여도 됨’은 해당 화면을 구현하라는 뜻이 아니다. 현행 사실을 조건과 함께 표시할 수 있다는 판정이다. 특히 정적 R9/R30 설명에는 “현행 fail, 설계 감사에서 오탐·범위 보완 필요”를 감추지 않는 편이 연구자에게 유용하다.

## 10) 연구자가 최종 결정해야 할 항목 — 8개

1. **R9 일반화 신호 강도:** 일반 패턴을 warning으로 내려 AI·교수자 감수로 넘길지, 절대 금지 문자열만 좁게 fail로 남길지.
2. **R30 자연어 평가 단서 강도와 허용 경계:** 일반 신호는 warning으로 처리하고, 학습자용 PDR 칩·정상 업무 설명·명시적 학습 지원은 허용한다는 경계를 확정할지.
3. **R16 서술 추정의 차단 범위:** 구조 불일치는 fail로 유지하고, 구두/서면 정규식 추정은 warning 또는 검토 의견으로 분리할지.
4. **R31·R32의 미귀속 20% 정책:** 비율을 사용 차단 근거로 계속 둘지, 교수자 보완/근거 있는 예외 판단으로 바꿀지. 수치 근거는 확인 필요.
5. **R33의 필수 선언 범위:** 진단차원 최소 2개·근거 ref 최소 2곳을 현행 생성계약으로 유지할지, 어떤 과거/최종화 콘텐츠에도 적용할지. 이 선언을 효과·실제 근거 검증으로 표현하지 않는다는 전제.
6. **과거 콘텐츠 재검사 정책:** 최신 카탈로그/현재 prompt 기준 재승인과 저장 당시 계약 검사를 어디서 구분할지. 기존 승인 콘텐츠의 일괄 재생성을 자동 후속으로 삼지 않음.
7. **R26 후속 검토 정책:** 같은 lexical warning에 배치만 AI 검토를 붙이는 차이를 유지할지, 개별 생성/재검사 경로까지 동일하게 할지. 호출 비용과 중단 가능성을 함께 결정.
8. **설명용 taxonomy 이름:** 제안한 7분류를 운영 설명으로 채택할지. R33의 문항·진단 metadata 분류와 R23의 계승 분류 이동에 동의할지.

R22는 이미 retired로 확정된 코드·정본·기록이 있어 이번에 폐기를 다시 승인받을 사안이 아니다. 유지 권고이며 복원을 제안하지 않는다. 127 재계수, R21/R26 주석·문서 정정, invalid payload의 명백한 비교 누락은 연구자가 숫자나 코드를 선택해야 하는 정책 문제가 아니다. 다만 이번 지시는 보고서 작성에 한정되므로 실제 수정은 실행하지 않았다.

## 검증 근거와 기록 범위

- 기존 테스트 13개 파일 / 151 tests pass / 0 fail / 0 skip. Vitest JSON의 suite 40은 describe 단위를 포함한 수치이며 파일 수가 아니다.
- 실행 파일: missionRules.audit, missionRules.mode, missionRules.industry, missionSchema, bidirectional, miniDiscourse, itemLineage, coreBatchRun, contentReview, contentReviewApi, hskLexicalAudit.edge, coreSourceRepair, missionUsableFacts의 .test.ts.
- 합성 입력: 기준선 2건 + 변이 19건 = 21건. 별도로 품질관리 진입점 1건. baseline 코어 pass, baseline 미션은 R5 2개·R19 2개 warning이며 fail 없음.
- 확인된 대표 결과: R9 부정문 fail·일반화 우회/미션 상황문 미탐지, R30 물리적 강도 fail·정중히 미탐지·미션 상황문 미탐지, R16 payload 불일치 미탐지, R10 참고안 언어 누락, R20 임의 hash 존재만 통과, 현재/과거 R31/R33 차이, R11의 R1 선행 차단, invalid coreInput의 R23 생략, R27 소수점 오탐.
- 검사 번들: node scripts/build-content-review-domain.mjs --check → 300,876 chars, 일치. 첫 실행의 샌드박스 상위 경로 읽기 차단은 같은 읽기 전용 명령의 좁은 승인 실행으로 해결했다. 보안 설정을 완화하지 않았다.
- 실제 운영 생성·외부 AI 호출·DB 쓰기·승인·배포·UI 구현·앱 코드 변경 없음. 문서 감사이므로 production build·브라우저 E2E 전체는 수행하지 않았다.
- 이 문서 자체가 이번 dev-log를 겸한다. 연구 증거 색인에만 감사 결과를 연결하며, design_traceability/decision_log/iteration_log는 설계 변경을 채택하거나 구현한 작업이 아니므로 갱신하지 않는다.
- 연구자 확인 필요는 §10에 한정한다. 실제 콘텐츠에서의 발생률, 배포 서버 버전, 기존 승인 corpus에 대한 영향 크기는 별도 실측 전까지 확인 불가다.

증거 파일: [감사 계수·기존 테스트·반례 결과](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/research-trail/evidence/2026-09-09-quality-rules-codex-evidence.json), [로컬 합성 입력 재현 스크립트](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/research-trail/evidence/2026-09-09-quality-rules-codex-probes.mjs). 재현 스크립트는 감사 대상 정식 루트에서 node로 실행하며 네트워크·DB 호출을 하지 않는다. 검증 실행 환경은 Node v24.18.0이다.

[논문 영향 3줄]

1. 바뀐 수치: 감사상 검사 지점 122→127 정정, 현행 ID 33개·retired 1개. 새 검증 151 tests 및 합성 반례. 앱 버전·배포 상태 변경 없음.
2. 바뀐 화면: 없음.
3. 바뀐 프롬프트·계약: 없음. 이번 보고서만으로 정본을 개정하거나 동결본을 재발행하지 않는다.

## 후속 보강 — Fable 감사 판정

독립 감사 완료 뒤 사용자가 전달한 Fable 감사에 대해 [별도 판정서](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-09-09-quality-rules-fable-adjudication.md)를 작성했다. 종합 판정은 보완이며, 이를 최초 독립 감사의 근거로 소급하지 않는다.

- R27의 MJT fail / DCT warning 차이에는 이미 기록된 운영 이유가 있다. [8월 25일 로그](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-25-mission-rule-audit.md:68)는 모델이 바꿀 수 없는 기존 교수자 DCT 상황의 형식 때문에 조립이 막힌 문제를 기록한다. [8월 30일 감사](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-30-rule-design-diet-audit.md:13)도 frozen C를 X/A/Y 재생성으로 고칠 수 없다는 이유로 DCT 형식 warning과 정렬했다. 따라서 권고는 근거를 새로 만들어 강도를 통일하는 일이 아니라, 기존 결정 이유를 현행 설명에 연결하고 문장부호 오탐을 별도로 해결하는 것이다.
- Fable은 최초 집계에서 정수 R ID 정규식이 R1c를 놓쳤다고 명시했다. 이는 §2의 독립 재계수(122+5=127)와 부합한다. 최초 추출 스크립트를 직접 확인한 것은 아니므로 원인에 관한 작성자의 진술과 AST 계수 증거는 구별한다.
- 이번 교차 대조에서 validator 해시는 동일했다. 선행 151 tests와 합성 입력 결과를 재사용했으며 새 테스트 실적으로 중복 집계하지 않았다. 앱·정본 설계·운영 상태는 변경하지 않았다.
