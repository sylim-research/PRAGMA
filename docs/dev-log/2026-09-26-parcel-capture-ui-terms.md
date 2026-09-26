# 택배 주대표 최종 캡처 전 UI 용어 정합성

- 범위: 연구자가 최종 화면 감수에서 지정한 표시 문구 3건과 MJT2 날짜의 기존 기록 확인. 단독 진행 적합. 로컬 커밋 후 대기하며 푸시·PR·배포는 수행하지 않는다.
- 기준 코드: main `03e6330ceed89ec0f92dd749612ad3ccbfa217bd`. 기존 연구 기록 EVD-20260926-02의 승인·편성·종단 완료 상태는 유지한다.
- 현행 논문 정본목록의 경로를 확인했으며, `C:/PRAGMA_THESIS_LOCAL/01_정본/00_용어대장_20260926_최종.md`의 재검토 및 검수된 참조 표현/학습자용 참고 표현 규칙을 적용했다. 목차·논리·철학·설계 변경은 없다.

## 표시 문구

- `CanonicalMissionRun.tsx`의 상단 단계 `다듬기 → 재검토`; 같은 진행바의 현재 단계·활동 안내도 `재검토 / 내 번역 재검토`로 정렬했다. 단계 인덱스·라우팅·상태 분기는 그대로다.
- 완료/돌아보기의 `참고 답안 → 참고 표현`: 제목과 접근성 영역 이름만 변경했다. 전달받은 alternatives 배열과 중국어 문자열은 그대로 출력한다.
- MJT2 reason-choice의 `정답 → 핵심 이유`: 해당 OptionButton 호출의 `acceptedLabel`만 지정했다. 스크린리더 안내도 핵심 이유와 일치/불일치를 설명하도록 정렬했다. `accepted_id`, reasonId, 판정 조건·색상·저장값은 변경하지 않았다. 공용 OptionButton의 기본 배지와 다른 유형의 정답 표시는 바꾸지 않았다.
- 변경 위치는 대표 미션이 사용하는 공용 표시 컴포넌트다. 다른 미션의 콘텐츠·설계·동작을 조사하거나 수정하지 않았다.

## MJT2 날짜 — 기존 승인 기록에 따라 유지

- 기존 의도: 최종 감수 기록 기준 B, **금요일에 필요하다는 필요 시점**. 별도의 제출/완료 마감 규칙으로 확정한 것으로 읽지 않는다.
- 직접 근거: `C:/PRAGMA_THESIS_LOCAL/05_증거/앱통합검증/2026-09-26_택배주대표_최종감수본.md`의 「검토 의견 처리」에 “추천서 날짜는 ‘필요 시점’으로 유지”가 명시돼 있다. MJT2 해설은 “추천서의 용도와 필요한 시점”을 설명하고, 두 참고 표현이 “용도와 날짜를 유지”한다고 기록했다. 표현 메모는 `下周五要用`을 “다음 주 금요일에 필요하다는 시점”으로 설명한다.
- 초기 `제출 마감` 상황문을 `필요 시점`으로 정렬한 이력은 기존 `docs/handoff/2026-09-26_thesis_ch4_parcel_vertical_slice_evidence_handoff.md` §8 사례 1과 원시 `case-1.before.json` / `case-1.patch.json`에 남아 있다. 초기 문구를 최종 의도로 되돌리지 않는다.
- 현재 한국어: `교수님, 안녕하세요. 교환학생 지원에 필요한 추천서를 써주실 수 있을까요? 다음 주 금요일까지 필요합니다.`
- 현재 중국어: `老师您好，交换生申请需要的推荐信就交给您写了，我下周五要用。`
- 판정: **일치 — 기존 승인 기록의 필요 시점 의도 기준**. 한국어 `까지`의 기한 강조와 중국어의 사용·필요 시점 표현이 문맥 밖에서도 엄밀히 완전 동치라고 주장하지 않는다. 현재 기록은 두 표현을 같은 필요 시점으로 취급하고, 의도된 판단 문제를 수락 선취로 명시한다. 사용자의 확인 절차 4에 따라 콘텐츠 수정 없이 유지한다.
- 콘텐츠 수정·새 revision·재승인·재편성·운영 E2E는 필요하지 않으며 수행하지 않았다. 새 AI 감수나 외부 언어 판정을 요청하지 않았다.

## 보존·최소 검증

- 대표 mission `3da0c62d-e91f-4f68-9b74-28cd9d42f044`, 승인 v3/hash `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095` 유지. 콘텐츠·DB 쓰기를 하지 않았으며 운영 DB의 새 조회 결과를 주장하지 않는다.
- 제시 순서 MJT1→MJT2→MJT5→MJT3→MJT4→DCT형 통번역 과제, 내부 ID, 응답 매핑·저장 계약, 4점 척도, 중국어 reference_alternatives, DB/schema 변경 없음.
- 기존 테스트 3파일에서 관련 4개만 실행: reasonContrast의 이유 선택 2개, runtime의 v6 최초/최종 응답 저장 1개, connections의 확정 후 참고 표현 표시 1개. 새 테스트 사례는 만들지 않고 기존 기대 문자열·확인 항목만 정렬했다.
- 명령: `npm.cmd test -- src/pages/learner/CanonicalMissionRun.reasonContrast.test.tsx src/pages/learner/CanonicalMissionRun.runtime.test.tsx src/pages/learner/CanonicalMissionRun.connections.test.tsx -t 'locks the judgment|marks a reason|runs a v6 runtime from|withholds reference answers'`
- 첫 시도는 이 작업트리의 Supabase 환경값 누락으로 테스트 수집 전에 중단됐다. CI와 같은 더미 URL·키를 프로세스에 지정한 뒤 동일 범위 재실행: **4 passed / 23 filtered out(skipped)**. 외부 피드백·저장은 mock이며 실제 AI·운영 DB 호출은 없다.
- 확인 범위: 진행바 재검토, 참고 표현 영역·제목과 기존 표현 내용, 핵심 이유 배지·접근성 안내, 기존 1→2→5→3→4 전환과 저장 item_id 1~5·reason_id·최초/최종 응답. 전체 테스트·실제 브라우저 E2E·자동 캡처는 실행하지 않았다.
- 단순 UI 용어 보정이므로 research-trail은 추가 갱신하지 않는다. 기존 승인·종단 증거를 새 검증이나 설계 변경으로 다시 기록하지 않는다.

## 논문 영향

1. 수치: 로컬 관련 테스트 4개 통과. 콘텐츠 v3·운영 배포 상태는 그대로이며 새 배포 없음.
2. 화면: 상단 재검토, 완료 화면 참고 표현, 이유 선택 핵심 이유 표시가 로컬에서 변경됨.
3. 프롬프트·계약: 변경 없음. 콘텐츠 동결본 재발행·교수자 재승인 불필요.

## 후속 화면 batch — learner-facing label 정합화

- 기준 로컬 커밋 `489fd8aab7631a81d74bd2fc1048d499b057ceea`의 이전 P1(재검토·참고 표현·핵심 이유)은 유지했다. 새 설계나 콘텐츠 revision이 아닌 표시 보정이다.
- MJT5 선택지는 target_feature 카탈로그에서 유래한다. `mission_v6`의 `request_mitigation_optionality`·한→중·번역에 한해 표시층에서 `너무 직접적 → 상대의 선택권이 부족함`, `지나치게 우회적 → 우회해 요청이 흐려짐`으로 바꿨다. `상황에 맞음`은 유지했다. 선택권과 요청 명료성이라는 기존 목표 의미를 드러내며, 내부 `too_direct / appropriate / too_indirect` 및 카탈로그·계약은 그대로다.
- 승인콘텐츠 JSON(`C:/PRAGMA_THESIS_LOCAL/05_증거/앱통합검증/2026-09-26_택배주대표_승인콘텐츠.json`)의 MJT5에는 relation_ko `한 학년 위 여자 선배`, learner_context_ko `활동 중 몇 번 이야기한 한 학년 위 여자 선배와의 메신저 대화입니다.`가 이미 있다. 기존 화면은 상황만 표시해 이 관계 조건이 드러나지 않았다. 대표 mission ID의 spectrum 화면에 저장된 learner_context를 표시하고, 없으면 기존 relation을 표시하도록 했다. 콘텐츠 필드와 중국어 学姐는 수정하지 않았다.
- MJT3 수정안 결과 배지 `정답 → 기준 선택` 및 대응 접근성 안내만 변경했다. accepted candidate와 valid 판정은 그대로다. MJT5 결과 배너는 `내 판단 N개 중 M개가 기준 판정과 같아요`로 정렬했다.
- 내부 ID, MJT1→MJT2→MJT5→MJT3→MJT4→DCT 제시 순서, 중국어 후보·해설·reference_alternatives, serializer·응답 매핑·DB/schema 변경 없음. 콘텐츠 파일·DB 쓰기 없이 기존 승인 hash를 유지하므로 재승인 불필요.
- 최소 검증: 기존 테스트 4파일에서 6개만 선택 실행, **6 passed / 59 filtered out(skipped)**. reasonContrast 2개, runtime 1개, connections 1개, missionV6의 표시 매핑·동결 원문 검사 2개. 새 라벨·관계 표시·기존 순서와 저장 매핑·band code·참고 표현 보존을 확인했다. 기존 비요청 fixture의 라벨 보존 단언도 통과했으며 다른 미션 조사·수정은 하지 않았다.
- 명령: `npm.cmd test -- src/pages/learner/CanonicalMissionRun.reasonContrast.test.tsx src/pages/learner/CanonicalMissionRun.runtime.test.tsx src/pages/learner/CanonicalMissionRun.connections.test.tsx src/lib/mission/missionV6.test.ts -t 'locks the judgment|marks a reason|runs a v6 runtime from|withholds reference answers|uses request-specific learner labels|keeps frozen sources'`
- CI용 더미 환경값과 mock만 사용했다. 실제 AI·DB 호출, 전체 테스트·E2E·자동 캡처 없음. 단순 표시 보정이므로 research-trail 추가 갱신 없음. 로컬 커밋 후 대기하며 푸시·배포하지 않는다.

## DCT·AI 피드백 UI-only 보정

- 핵심 정리 05와 독립적인 UI-only 항목은 진행하라는 연구자 후속 지시에 따라 처리했다. DCT 안내를 `제출하면 AI 피드백을 확인하고 다시 검토합니다.`로, 로딩을 `번역안을 세 기준으로 살펴보고 있습니다`로, 준비·결과의 기준명을 `화용적 적절성`으로 정렬했다. 결과 하단 고지도 `AI 피드백입니다.`로 맞췄다.
- `문법 정확성` 유지 근거: `supabase/functions/generate-scenario/index.ts`의 실제 피드백 프롬프트는 ② 이해 가능성(문법)에서 이해를 방해하는 오류만 보고 사소한 부자연스러움·문체 취향을 제외한다. `src/lib/pragma/feedbackSchema.ts`는 lexical_choice/collocation도 오류 유형으로 허용하지만 판정은 clean/impeding_errors이며, 담화 자연성은 별도 discourse_ko다. runtime의 language는 grammatical_accuracy와 blocks.grammar를 표시한다. 포괄적 자연성 평가가 아니므로 라벨을 자연성으로 확대하지 않았다. UI 보조 질문만 `표현에 이해를 방해하는 오류가 있나요?`로 정렬했다. 프롬프트·schema·내부 key·판정 로직은 미수정.
- DctDraftCard의 기존 목표 언어 지시문 아래 공통 UI copy를 `원문의 내용과 의도를 유지하면서, 관계와 상황에 맞게 작성해 보세요.`로 변경했다. production_task 및 source_text와 무관한 표시 문구다.
- 보류: 핵심 정리 05는 승인 mission_content.lesson_points의 item_id=4 text를 그대로 표시한 것이다. 인용 조각만으로 이유까지 보존한다고 읽히는 설명 문제는 확인했지만, 이 필드 수정은 콘텐츠 해시 변경을 수반하므로 미수정. 핵심 정리 01~05 전체·중국어 후보·해설·단어 힌트·reference_alternatives·학습자 산출을 보존했다.
- 변경 diff는 화면 코드·기존 테스트·이 기록뿐이다. 콘텐츠 데이터·DB/schema·feedback/저장 serializer 변경 없음. 기존 승인 hash `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095` 유지(운영 DB 재조회나 새 hash 검증을 실행했다는 뜻은 아님).
- focused test: runtime의 `runs a v6 runtime from` 1개, connections의 `shows the priority feedback`·`withholds reference answers` 2개만 실행하여 **3 passed / 22 filtered out(skipped)**. DCT 안내·기준 헤더·기존 수행/저장 매핑·최종 참고 표현 노출 확인. 로딩 문구는 코드 diff로 확인했다. 더미 환경값·mock 사용, 실제 AI/DB 호출·전체 테스트·운영 E2E 없음.
- 논문 영향: 로컬 화면 문구만 보정, 콘텐츠 버전·배포 상태·프롬프트·계약 변경 없음. 단순 UI copy이므로 research-trail 추가 갱신 없음. 로컬 커밋 후 대기.

## 학습자 최종 결정·관리자 제작 화면 용어 보정

- 연구자의 다음 batch 지시에 따라 `AI 판정과 생각이 다르다면 → AI 피드백과 생각이 다르다면`(버튼·패널 제목), 수정 branch의 `피드백을 반영해 → 피드백을 참고해`, `수정안 확정하기 → 최종안 확정하기`를 표시층에서 변경했다. 해당 버튼의 onDone은 기존 최종 산출 확인·저장으로 연결되며 유지 branch·이견 reason·serializer·활성화 조건은 그대로다.
- **이전 판정과 후속 지시 구분:** 이번 명시적 지시에 따라 준비·결과 카드의 제목 `문법 정확성 → 언어 자연성`을 변경했다. 이는 평가 범위 확대가 아니다. 실제 prompt/schema/runtime는 여전히 이해를 방해하는 오류 중심이고 사소한 부자연스러움은 제외한다. 이전에 정렬한 보조 질문(이해를 방해하는 오류 여부)도 유지했다. 이 UI 제목만으로 포괄적인 자연성 평가를 구현했다고 논문에 주장하지 않는다. 내부 meaning/language/pragmatics, grammatical_accuracy 및 schema 미수정.
- 기존 `AI 피드백입니다. 상황에 따라 다른 판단도 가능합니다.`, `화용적 적절성`, 로딩의 `번역안을 세 기준으로 살펴보고 있습니다`는 반영된 상태여서 다시 수정하지 않았다. 누적 P1(재검토·참고 표현·기준 선택·핵심 이유·MJT5 라벨/관계·DCT 안내)도 보존했다. 이 보정들은 로컬 브랜치 상태이며 운영 배포 완료로 주장하지 않는다.
- 동적 문구: 실제 feedback prompt(`generate-scenario/index.ts`)와 요청 target_feature의 정의·지침에서 `선택권을 완화`라는 고정 문구나 부담 완화와 선택권을 혼동하도록 명시한 지침은 확인되지 않았다. 사용자 관찰 출력은 생성 변동의 사례로 기록하고, 제품의 키워드 치환·프롬프트 수정·추가 AI 호출은 하지 않았다. 대표 캡처 재실행 대상으로만 남긴다.
- 관리자: V6 quality 단계의 표시를 `AI 검토 중`으로 변경했다. promoteCoreV6는 AI 결과(실패 시 unavailable 표시 포함)를 초안과 함께 저장한 뒤 성공을 반환하므로 정상 toast는 `초안 저장 · 규칙 기반 검사 통과 · AI 검토 의견 저장 — 품질 점검 단계에서 확인해 주세요`로 바꿨다. warning/fail은 각각 주의/확인 필요를 표시하며 AI 검토 성공·교수자 승인을 허위로 뜻하지 않는다. `품질 점검`은 현행 제작 경로의 실제 단계명이다. 자동 route 이동 코드는 없으므로 이동했다고 알리지 않고 해당 단계의 확인을 안내한다. workflow/status enum·제작 경로 노드·저장 함수 미수정.
- focused test 3파일·5개 실행: connections의 기준/수정 안내·이견 제출·유지 branch 3개, runtime의 v6 수행·수정 확정·최종 저장 1개, AdminAssembly의 기존 생성 작업대 검사에 mock quality 상태·완료 toast 확인을 추가한 1개. **5 passed / 29 filtered out(skipped)**. 더미 환경값·mock만 사용했고 실제 생성·AI 검토·DB 쓰기·운영 E2E는 실행하지 않았다. 다른 기존 테스트의 제목/버튼 기대 문자열도 새 표시와 정렬했다.
- mission_content·lesson_points(핵심 정리 05 보류 포함)·DCT 원문·후보·해설·참고 표현·content hash·DB/schema·API/저장 계약·학습자 최초/최종 산출 변경 없음. 기존 승인 hash `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095` 유지. 별도 DB 조회/재해시 검증은 하지 않았다.
- 재캡처 목록: 연구자가 새 learner attempt를 수행한 뒤 AI 피드백·재검토/최종 결정·완료 화면, 관리자 생성 상태·완료 알림을 수정 배포 후 다시 채취한다. 구버전 다듬기/참고 답안/AI 판정/문법 정확성/화용 적절성/반영해/수정안 확정하기/AI 점검 중/규칙 pass/AI 검토 통과가 나온 캡처는 최종 논문용에서 제외한다. 기존 attempt는 수정하지 않는다.
- 단순 UI·운영 용어 보정이므로 research-trail 추가 갱신 없음. 로컬 커밋 후 대기, 푸시·배포 없음. 논문 영향은 표시 문구와 향후 캡처 교체에 한하며 콘텐츠 버전·평가 기능·계약은 그대로다.
