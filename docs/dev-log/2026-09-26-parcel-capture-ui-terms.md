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
