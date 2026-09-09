# Fable「R1~R33 독립 설계 감사」 판정

- 일자: 2026-09-09. 판정: **보완**. [단독 진행 적합].
- 대상: 사용자가 전달한 [Fable 감사 원문](C:/Users/cnkr/.codex/attachments/be48735c-3a25-4a88-b0da-72ebb165643a/pasted-text.txt). 이 판정은 감사 주장에 대한 검토이며 구현·정책 변경의 승인이 아니다.
- 대조 작업트리: C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09
- HEAD: admin-absorb-2026-09-09 / 72cb39bf4365da48a78fb71807edf24ade949dc0. missionRules.ts 작업 파일 SHA-256은 선행 Codex 감사와 동일한 73c09ae288dfe648e4485bc1b5a0bed2682435b223572ff9cc5845be8acc665d다.
- Fable이 적은 b4265d17과 위 HEAD의 validator Git blob은 선행 감사에서 동일함을 확인했다. 이번 판정은 원격·운영 서버의 최신성을 주장하지 않는다.
- 수용 = 주장·방향에 동의. 보완 = 유효한 지적에 사실·범위·해법 수정 필요. 기각 = 명시한 특정 주장 또는 해법을 채택하지 않음. 한 항목의 문제 진단과 해법은 서로 다르게 판정할 수 있다.

## 1. 종합 판정

**체계의 핵심을 유지하고 필요한 부분을 고친다는 결론은 수용한다. 그러나 “세 정규식 규칙 외에는 일관되고, 문구를 좁히면 충분하다”는 설명은 보완해야 한다.**

Fable은 R9·R16 서술부·R30의 의미 판단 대리, R33 적용 조건, 규칙의 능력을 과장하는 설명, 카탈로그 이중 관리 위험을 잘 짚었다. 이 지적을 전체 기각할 이유는 없다.

다만 R31의 바깥 실행 조건을 빠뜨렸고, R27의 이미 기록된 강도 차이 근거를 찾지 못했다. R20의 서버 보증 설명과 R4·R10의 강도 설명도 실제 코드와 다르다. R16에는 서술 정규식뿐 아니라 요청과 실제 payload의 구조적 불일치를 놓치는 문제가 있다. **일부 문구 정정만으로 충분하다는 결론을 구현 지침으로 채택해서는 안 된다.**

## 2. Top 10 항목별 판정

| Fable 항목 | 판정 | 채택할 내용과 수정할 내용 |
|---|---|---|
| 1. R30 | **보완 / 명칭만 바꾸고 fail 유지하는 해법은 기각** | 코어 situation만 검사하고, 세 정규식에 오탐·미탐이 있다는 진단은 수용. 하지만 이름을 “정형 평가 단서 차단”으로 바꿔도 정상 내용의 차단은 남는다. 기존 재현에서 “조명의 강도를 조절한다”가 R30 fail이다. 위험 신호와 확정 위반을 분리하고 미션 장면 검사 책임을 명시해야 한다. |
| 2. R9 | **보완 / 장소구 제거만으로 fail 정당화하는 권고 (a)는 기각** | 장소구 오탐과 우회 표현은 타당한 지적. 그러나 “X인은”을 포함한다는 사실은 일반화에 동의했다는 뜻이 아니다. “중국인은 모두 같다는 일반화는 피해야 한다”도 R9 fail로 재현됐다. 인용·부정·비판 맥락을 해결하지 못하므로 두 장소구 삭제는 충분한 해결책이 아니다. warning과 내용 검토 연결이 더 방어 가능한 방향이지만 실제 적용은 별도 변경이다. |
| 3. R16 | **보완** | 구조 위반 fail / 서술 신호 warning 분리는 수용. 새 최상위 R번호보다 기존 evidence.subrule로 구분할 수 있다. 동시에 core.source_modality 대 요청값 비교, 번역 요청 대 interpreting 미션의 비교 누락도 해결 대상이다. 구조부가 이미 완전하다는 전제로 정규식만 조정하면 부족하다. |
| 4. R33 | **보완** | 적용 조건 공개는 수용. 그러나 정확한 조건은 mission_v5이면서 현재 mission prompt 문자열과 같음이다. “최신 생성계약 한정”은 저장된 계약으로 판정한다는 오해를 줄 수 있다. 저장 설계별 적용 정책이 필요하며, 선택지는 현행 문자열 게이트 유지와 모든 과거 버전 일괄 적용의 둘뿐이 아니다. |
| 5. R31 | **보완 / 기존 미션 전부 fail 주장은 기각** | 버전 결합 위험은 존재한다. 그러나 mission_v5·현재 mission prompt·lineage pending 아님이라는 바깥 조건이 먼저 적용된다. mission prompt까지 바뀐 과거 미션은 이 블록을 건너뛸 수 있다. 같은 mission prompt 조건 안에서 attribution prompt만 변경된 경우와 구분해야 한다. 승인 행 불변성만으로 영향이 없다고 단정할 수도 없다. |
| 6. 대역 계열 | **보완 / 화면 전체에서 “적정” 금지는 기각** | 규칙이 라벨·참조·분포의 일관성을 검사하며 후보의 실제 적절성을 입증하지 않는다는 지적은 수용. 규칙 설명은 “표기된 대역·정답의 일관성 검사”로 한정한다. 교수자가 검토한 판단 범주와 학습자 피드백까지 “적정”을 없애거나 within_band_code로 치환하는 것은 별개이며 현행 학습 설계를 불필요하게 바꾼다. |
| 7. R27 | **보완 / “비대칭 근거 없음”은 기각** | 8월 25일 기록에 모델이 바꿀 수 없는 교수자 DCT 상황 때문에 조립이 막혀 DCT 형식을 warning으로 내렸다는 이유가 있다. 8월 30일에도 frozen C를 X/A/Y 재생성으로 고칠 수 없다는 근거로 정렬했다. 그 이력을 현행 설명에 연결하면 된다. 종결부호를 문장으로 세는 취약점은 수용하며 소수점 오탐도 재현됐다. |
| 8. R20 | **보완 / “서버 RPC가 해시 내용 일치·버전 실재를 본다”는 설명은 기각** | R20 자체는 provenance 필수값 존재와 attempt 하한 검사라는 지적을 수용. Edge finalize_mission이 정해진 payload의 해시를 새로 계산하고, SQL은 해시 형식·검수 상태·기존 교수 내용 보존 등을 확인한다. 이를 RPC가 전달 해시를 재계산하고 생성 prompt의 실재성까지 보장한다고 묶을 근거는 없다. |
| 9. R26 | **보완** | 키워드 적중이 산업 내용의 타당성을 보장하지 않는다는 한계와 비용 제한 방향은 수용. miss → AI 산업 축 1회는 coreBatchRun의 경로다. 개별 코어 생성과 미션 조립 전 checkCore에는 같은 후속 AI 연결이 없다. 이를 체계 전체의 공통 흐름으로 기술하지 않는다. 추가 유료 표본 검토는 이번 작업에 포함하지 않는다. |
| 10. R14 | **수용** | 카탈로그 고정 문자열 불일치를 fail로 잡는 목적은 타당하다. 불일치만으로 AI 생성 여부를 알 수 없으므로 “카탈로그 고정 문구와 다름”처럼 중립적으로 설명한다. 이번에는 제안만 판정했다. |

주요 직접 근거:

- R9 / R30: [missionRules.ts:492](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:492), [coreSourceRepair.ts:97](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/_shared/coreSourceRepair.ts:97). 실행 반례는 [2026-09-09-quality-rules-codex-evidence.json](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/research-trail/evidence/2026-09-09-quality-rules-codex-evidence.json)의 syntheticProbes에 보존했다.
- R16: [missionRules.ts:435](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:435) 및 [missionRules.ts:872](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:872). 구조적 비교 누락 두 사례는 선행 합성 입력에서 fail 없이 통과했다.
- R31 / R33: [missionRules.ts:924](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:924) 및 [missionRules.ts:974](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:974). 과거 prompt의 missing-lineage / missing-dimensions 사례가 해당 R규칙 없이 통과한 결과와 일치한다.
- R27 도입 이유: [2026-08-25-mission-rule-audit.md:68](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-25-mission-rule-audit.md:68), [2026-08-30-rule-design-diet-audit.md:13](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-30-rule-design-diet-audit.md:13), [2026-08-30-design-diet-p0-targeted5.md:3](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-30-design-diet-p0-targeted5.md:3). 역사 기록은 당시 결정 근거로 사용했고 현재 강도는 [missionRules.ts:1239](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1239)에서 별도로 확인했다. 기록의 존재가 현 정책의 모든 사례에 대한 최적성을 입증하는 것은 아니다.
- R20과 최종화 책임: [missionRules.ts:1023](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1023), [index.ts:4603](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/functions/generate-scenario/index.ts:4603), [20260906100000_focused_content_review.sql:166](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/supabase/migrations/20260906100000_focused_content_review.sql:166). 다른 승인 통제가 존재하므로 이 지적을 곧바로 승인 우회 취약점으로 확대하지 않는다.
- R26 경로: [coreBatchRun.ts:299](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/coreBatchRun.ts:299), [AdminGenerator.tsx:710](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/pages/admin/AdminGenerator.tsx:710), [promoteMission.ts:898](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/promoteMission.ts:898).
- 대역 표시 경계: [PRAGMA_학습자구조_정본.md:42](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/product/PRAGMA_학습자구조_정본.md:42)는 원시 대역 코드의 사전 노출을 금지하며, [PRAGMA_학습자구조_정본.md:250](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/product/PRAGMA_학습자구조_정본.md:250)는 판단 후 적정·조정 필요 범주를 공개한다.

## 3. 전체 규칙표에서 고쳐야 할 사실

명시하지 않은 행은 핵심 유지 방향에 동의한다. 아래 차이는 감사표를 UI 설명의 원본으로 쓰기 전에 수정해야 한다.

| 항목 | 판정과 정확한 보완 |
|---|---|
| R4 “PDR 불일치 warning” | **보완.** legacy reason_conf는 warning이지만 현행 reason의 Anchor PDR 불일치는 fail이다. 서로 다른 계약을 한 문장으로 합치지 않는다. [missionRules.ts:676](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:676) |
| R8 “인접쌍의 preceding 필수” | **보완.** legacy와 코어의 필수 조건 외에 현행 native 미션에서는 문항·DCT preceding_turn을 금지하는 분기가 있다. [missionRules.ts:843](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:843) |
| R10 “후보는 warning” | **기각.** 중국어 후보의 한글 혼입은 fail이다. 숫자·기호만인 후보가 warning이라는 사실도 그 후보의 내용상 타당성을 허용한다는 뜻은 아니다. 참고 산출안 등 검사 필드 누락은 추가 보완 대상이다. [missionRules.ts:210](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:210) |
| R11 중복 없음 | **보완.** 선행 스키마/R1과 중복되는 방어다. reference_alternatives=[] 반례는 R11 도달 전에 R1로 차단된다. 중복 방어가 무조건 불필요하다는 의미는 아니다. |
| R12 “R2를 의도적으로 재확인” | **보완.** 관련 주석은 현행 native에 맞지 않는다. 현행 R2는 하나의 비적정 대역을 요구한다. 분포 검사는 미션 전체 후보를 세며 구조가 다른 R2와 같은 뜻으로 요약할 수 없다. [missionRules.ts:641](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:641), [missionRules.ts:1269](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1269) |
| R19 전면 유지 | **보완.** exact duplicate 검사는 필요할 수 있으나 의도된 Anchor 표현 재사용도 경고한다. 합성 기준 미션에서도 재사용 경고가 발생했다. 단순한 결함 탐지 건수로 해석하지 않는다. |
| R23 “계승 통과 시 R10/R16 자동 충족” | **기각.** 같은 값을 계승했다는 것과 그 값이 올바른 언어·요청 mode라는 것은 다르다. R23은 coreInput이 없거나 정규화 실패하면 생략된다. 방향 enum 일치는 실제 텍스트 언어 검사의 대체가 아니다. [missionRules.ts:889](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:889), [missionRules.ts:1371](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:1371) |
| R29 단순 형식 검사 | **보완.** 길이·focal substring/count 외에 DCT 참고안이 원문 길이의 45% 미만이면 의미 누락 가능성을 경고하는 휴리스틱도 있다. 최소 길이 warning / 최대 길이 fail 및 조건별 범위를 함께 써야 한다. [missionRules.ts:895](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/src/lib/pragma/missionRules.ts:895) |
| R33 형식 검사이므로 논문 정합성 충분 | **보완.** 진단차원 2~6개·코드·근거 위치·설명 존재를 검사한다. 근거 설명을 “확인.”으로 바꿔도 통과한다. 두 위치는 MJT와 DCT가 각각 하나 이상이라는 뜻도 아니다. 형식 통과를 진단차원 내용의 타당성으로 읽지 않는다. |
| R22 “등급형 차단 규칙을 폐기하고 HSK로 이관” | **보완.** retired 유지와 비차단 HSK 참고는 수용. 8월 25일 기록은 R22가 실제 구현 없이 오래된 주석에만 남았다고 명시한다. 실행하던 등급 차단기를 제거했다고 서술하면 역사와 어긋난다. HSK는 어휘 참고의 일부를 맡으며 구 R22의 문장·절·전반 난도 전체를 대체하지 않는다. [2026-08-25-mission-rule-audit.md:15](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-08-25-mission-rule-audit.md:15) |

R5 길이 휴리스틱을 warning으로 둔 방향도 수용한다. 다만 극단 길이 경고의 v1.4 이력과 후보 길이 완전 분리 fail을 8월 25일 warning으로 바꾼 이력은 구분해야 한다. “나머지는 모두 형식 검사”라는 결론은 R26·R29의 비차단 휴리스틱을 포함하도록 좁힌다.

## 4. 분류·주체 경계 판정

| 제안 | 판정 |
|---|---|
| taxonomy는 기능별 설명 분류이며 새 연구 구인이 아님 | **수용.** 분류표를 실행 알고리즘이나 타당성 증거로 제시하지 않는다. |
| R23을 원문·상황 성립에서 이동 | **수용.** 상류 데이터 계승에 가깝다. 요청 조건 보존 또는 생성 기록·계승 계열 모두 설명상 가능하므로 하나의 정답으로 강제하지 않는다. |
| R16만 분리하면 MECE 문제 해소 | **기각.** R1/R1c의 스키마·카탈로그, R4/R5의 구조·PDR·길이처럼 다른 ID도 여러 기능을 담는다. ID의 대표 범주와 하위 검사 속성을 구분해야 한다. |
| “생성 조건·카탈로그 정합”을 “요청 조건 보존”으로 축소 | **보완.** R1c의 스키마·조합, R13의 존재·버전, R17의 조건부 허용값은 모두 요청값 그대로 복사인지 검사하는 규칙이 아니다. 카탈로그 정합이라는 표현을 남기는 편이 정확하다. |
| 제안한 7범주의 합계 | **보완.** R16 구조부를 요청 조건에 추가한다고 쓰면서 그 범주의 7개는 기존 6개+R23만 반영했다. ID와 R16-scene 하위 검사를 섞어 세면 33 ID의 일대일 분류가 되지 않는다. 구성원 목록과 집계 단위를 먼저 고정한다. |
| 출처·계보 4개 묶음 유지 | **보완.** R33은 provenance보다 진단차원·근거 선언에 가깝다. 이를 문항 구성·판정 데이터로 옮기거나 범주명을 넓혀야 한다. “기록 형식”이라는 접미사만으로 성격 차이가 없어지지 않는다. |
| “자동 점검이므로 거버넌스가 아님” | **기각.** 자동은 실행 방식이고 거버넌스는 통제 목적이다. R31/R32는 자동 검사이면서 교수자 검수·귀속 기록 통제를 지원한다. SQL의 최종 승인 권한과 구별하면 된다. |
| 자동 규칙 → AI 의견 → 교수자 감수·승인 | **수용, 범위 보완.** AI 검토는 내용 판단을 보조하고 최종 권한은 교수자에게 있다. 다만 검토 프롬프트를 읽지 않았다고 밝힌 Fable의 §5는 실제 AI 검사 중복·누락의 감사 완료 근거로 쓸 수 없다. |

Codex 선행 보고서의 7범주도 설명용 제안일 뿐 확정된 정본이 아니다. 두 분류 중 하나를 선택하기 위해 전면 재번호화하거나 새 연구 구인을 만들 필요는 없다.

## 5. 카탈로그와 UI 제안 판정

1. **수용:** validator가 실행 사실의 정본이고 catalog는 설명층이라는 원칙. RuleId를 add() 인자에 연결하고 Record<RuleId, ...>로 설명의 ID 누락을 컴파일 시 확인하는 최소 구조.
2. **보완:** 타입 유니온도 정의된 ID와 설명의 정합성만 보장한다. 사용하지 않는 ID, 빠진 검사 의미, 호출되지 않는 경로, 적용 조건·강도 변경까지 자동 보증하지 않는다. R1c와 retired R22도 서로 다른 상태로 다룬다.
3. **기각 — 전체 카탈로그의 강도를 violations에서만 얻는 방식:** 런타임 결과는 “이번 입력에서 왜 걸렸나”에는 적합하다. 한 번도 걸리지 않은 규칙, 입력에 따라 fail과 warning이 나뉘는 규칙, 생략된 규칙의 전체 성질을 열거하지 못한다. 전체 규칙 설명이 필요하면 validator가 함께 사용하는 최소 정의/기술자와 대조 검증을 두고, 실제 finding은 원본 강도·메시지를 표시한다. 큰 규칙 엔진은 필요하지 않다.
4. **보완:** 호출 관계의 정적 추론만으로 모든 적용 조건을 보증할 수 없다는 한계는 수용. 그러나 적용 단계는 날짜 붙인 문서로만 관리할 수 있다는 결론은 과도하다. 코어/미션 진입점과 계약 조건을 명시하고 대표 경로 검증을 연결할 수 있다.
5. **수용:** R33의 조건, R30의 실제 범위, 자동 검사 한계를 관리자 설명에 드러내고 “적절성·본질주의·진위가 보장됐다”는 표현을 피한다.
6. **보완:** “ID·강도·메시지면 지금 그대로 공개 가능”도 무조건 맞지 않는다. R14의 “AI 생성 의심”, R30의 평가 기준 단정처럼 원문 메시지에도 과장이 있다. 감사 증거로 원문을 보존하는 일과 사용자용 설명으로 승인하는 일을 구별한다.
7. **기각 — 규칙 수·add 수를 절대 표시하면 안 된다는 주장:** 수를 품질 성과로 쓰면 안 된다는 원칙은 수용한다. 그러나 정확한 inventory 수를 감사·버전 관리에 표시하는 것까지 금지할 이유는 없다. 33 active ID / retired 1 / 127 정적 호출 지점은 서로 다른 수다. 이를 메인 UI에 강조할 필요는 없다.
8. **보완:** “사람이 읽을 요약 33줄 전부 연구자 사전 승인”은 모든 코드 설명을 새 연구 결정으로 만들 위험이 있다. 실제 의미가 달라지는 정책은 판단이 필요하지만, 확인된 실행 조건·중립 문구·오래된 주석의 사실 정정은 구현 범위가 승인되면 통상 유지보수로 처리할 수 있다.
9. **수용, 범위 제한:** 새 공개 명칭을 MJT로 통일하되 내부 mpj_* 식별자와 역사 기록까지 일괄 치환하지 않는다. 이는 [PRAGMA_학습자구조_정본.md:5](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/product/PRAGMA_학습자구조_정본.md:5)가 명시한 호환 원칙이다.

Fable이 “R\\d+ 패턴으로 R1c를 빠뜨렸다”고 밝힌 부분은 선행 AST 재계수와 부합한다. 정수 ID 122곳 + R1c 5곳 = 127곳이다. 최초 추출 스크립트 자체를 확보한 것은 아니므로 원인에 관한 Fable의 진술과 독립 재계수의 증거 수준은 구분한다.

## 6. 이후 작업에 반영할 우선순위

- **지금 반드시 해결:** 이번 감사 문서의 R31·R20·R4·R10·R23·R27 사실 오류를 정정하고, R9/R30의 정상 내용 차단과 R16의 실제 데이터 비교 누락을 구현 계획에 포함한다. R31/R33의 저장 계약별 적용 원칙과 미션 상황문 검사 책임을 명시한다.
- **완성 전 해결 권장:** R14 등 메시지 중립화, R27 문장부호 오탐, R19 의도된 반복 경고, 호출 경로별 R26 설명과 finding evidence 보존을 정리한다. 타입 기반 카탈로그는 필요한 표시 범위에 맞춰 최소 구현한다.
- **후속 개선:** 대규모 규칙 엔진, 전면 ID 재번호화, 새로운 의미 모델, 추가 유료 전수·표본 검토. 이번 판정 때문에 자동으로 범위를 확대하지 않는다.

연구자의 실제 선택은 위험 신호의 강도·검토 책임, 저장 계약별 재검사 정책, 공개 정보의 경계처럼 설계가 달라지는 부분에 집중한다. R14 문구나 타입 유니온, 숫자 정정까지 각각 별도의 연구자 정책 결정으로 올릴 필요는 없다. **이번 요청은 판정이므로 위 코드 수정은 실행하지 않았다.**

## 7. 검증·기록

- 이번 실행: Fable 원문 전체, 관련 validator·Edge·최신 정의의 SQL migration, 현재 학습자 정본, 8월 25일/30일 R27 변경 기록과 git blame을 대조했다. validator 해시가 선행 감사와 동일함을 확인했다.
- 재사용 근거: 선행 감사에서 실행한 13개 파일 151개 테스트 통과, 합성 입력 21건과 품질관리 진입점 1건. 이번에 새로 실행한 테스트 수로 중복 보고하지 않는다. 보고서만 바뀌어 전체 테스트·빌드를 반복하지 않았다.
- 한계: 합성 반례는 오탐·누락의 존재를 보이며 실제 corpus 오류율은 아니다. 운영 서버·DB·승인 우회·AI 품질·학습효과는 이번에 실측하지 않았다.
- dev-log: 이 문서. 선행 [2026-09-09-quality-rules-codex-independent-audit.md](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/dev-log/2026-09-09-quality-rules-codex-independent-audit.md)에 R27 역사 근거와 Fable의 집계 원인 진술을 후속 보강했다.
- research-trail: [04_evidence_index.md](C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/admin-declutter-2026-09-09/docs/research-trail/04_evidence_index.md)의 EVD-20260909-02에 판정 근거를 연결한다. 설계 변경을 채택·구현하지 않았으므로 design_traceability / decision_log / iteration_log는 갱신하지 않는다.
- 확인 필요: 구현 전에 선택할 정책은 위 §6과 선행 보고서 §10에 한정한다. 이번 문서 판정을 완료하는 데 추가 사용자 승인은 필요하지 않다.

[논문 영향 3줄]

1. 수치: 선행 127개 정적 지점·151개 테스트 결과 유지. 새 실증 성과나 운영 통과율을 추가하지 않음.
2. 화면: 변경 없음.
3. 프롬프트·계약: 변경 없음. 감사 권고의 수용과 연구 설계 변경의 확정을 구별함.
