# 대표 미션 최종 화면 감수 — 로컬 수정 및 보류 기록

- 분류: [단독 진행 적합]. 사용자 지정 문구·표시 결함·로컬 콘텐츠 후보 준비만 수행. 추가 AI 감수 없음.
- 기준: PR #248 merge `c2e301f20d9ba91ccfad1b21460d0c722acb8ced`; 작업 기준 최신 main `135b97d923e37811f5c44b3d8280abfb21e4ebf3`.
- 작업 브랜치: `codex/parcel-final-review-local`. 기존 작업공간과 분리한 clean worktree에서 시작했다.
- 운영 상태를 새로 완료했다고 주장하지 않는다. 사용자 후속 지시로 실제 저장 오류·AI 원응답 조사는 보류했다. push/PR/merge/deploy 및 운영 DB 쓰기 없음.

## 1. 판정 요약

개별 피드백 번호 묶음 기준: UI-only 16건, 콘텐츠 후보 6건(9개 필드), 표시 구현 결함 2건. 동일 항목을 중복 집계하지 않았다. 보류 3건은 실제 저장 RCA, 실제 AI 응답 RCA, 목표 viewport 육안 확인이다.

- UI 16건: 2-1~2-5, 3-1/3-4, 5-1/5-2/5-3/5-5/5-6, 6-2, 7-2/7-4, 8.
- 콘텐츠 6건: 3-2/3-3/4-1/5-4/6-1/7-3. 운영 적용 없이 후보 JSON만 작성.
- 표시 결함 2건: 5-7 accepted 범위와 reference 동일성을 혼동한 배너, 13 저장 오류/복구 행동의 배치.
- 실제 저장 결함과 모델 응답 품질의 원인은 확정하지 않았다.

## 2. 사용자 피드백 1~16 처리표

| 번호 | 처리 | 실제 위치와 층 |
| --- | --- | --- |
| 1 | 수용 | 실제 UI/runtime/content 필드를 구분; 아래 manifest에 9개 변경 경로 명시 |
| 2 | 수용 | `CanonicalMissionRun.tsx`: 소개 1문장, 5개 활동명, 직접 번역/통역 제목, 동적 재검토 흐름, 미션 시작 CTA (UI) |
| 3 | 수용 | UI `가능한 판단`/`판단 확인하기`; 후보 `mpj_items[0].situation_ko`와 `explanation_ko` (콘텐츠) |
| 4 | 수용 | 후보 `mpj_items[1].explanation_ko` 3문장; reason-choice 해설은 UI bullet 표시. 중국어 예시 2개 보존 |
| 5 | 보완 수용 | 중복 `storedRelationContext` 표시 제거, spectrum만 KO padding/min-height, `v6BandOptions` 라벨, NoteLine grid, 진행/CTA, accepted 범위 배너 (UI/표시 결함). 후보 note 4개만 콘텐츠 변경 |
| 6 | 수용 | prompt는 UI 상수가 아닌 후보 `mpj_items[2].prompt`; `가능한 선택` 배지는 UI |
| 7 | 보완 수용 | Q 유지, 제한문/들여쓰기 UI 수정; 후보 해설 3문장. contrast의 마지막 해설은 UI에서 숨기고 저장 데이터는 보존 |
| 8 | 수용·시각 확인 보류 | 제목 1개, 16px normal/24px 행간, 여백 축소, 새 활동명, 동적 직접 번역/통역 CTA. 1536×960 무스크롤은 실측하지 않음 |
| 9 | 유지 | DCT source/힌트/산출/피드백/재검토/최종 결정 구조 불변 |
| 10 | 보류 | 실제 raw/parser/RuntimeFeedback/display 대조 자료 없음. 사용자 skip 지시. prompt/설명 생성 변경 없음 |
| 11 | 확인 | 기존 all-good secondary action, A/B/C 최대 2회 및 실패 후 C 확정 계약 보존; mock 회귀검사 |
| 12 | 보류 | 읽기 전용 조사 범위의 계정/미션/편성/RLS/serializer 확인. 실제 DB 오류 미확보; 저장 성공 선언 없음 |
| 13 | 수용 | `CompletionActions`: 상단 alert 안 오류+재시도, 하단 secondary navigation. 저장 중 이동 비활성 유지 |
| 14 | 수용 | 로컬 후보·기준 snapshot·manifest 준비. 운영 revision 생성/승인/편성은 미실행 |
| 15 | 수용 | 관련 focused 63개, typecheck, production build. 전체 테스트·유료 AI E2E·캡처 자동화 없음 |
| 16 | 수용 | 논문 구조/RQ/contribution/철학, ID, scoring, DB/schema/API, 저장·feedback 계약 불변 |

## 3. 추가 지적 처리표

| 지적 | 결과 |
| --- | --- |
| MJT1 상황문 | 로컬 후보: 파일이 올라오지 않아 메신저로 부탁하는 장면으로 변경 |
| 판단 확인하기 | MJT1 및 spectrum 확인 CTA 적용 |
| spectrum 진행/CTA | `N/4개 표현을 판단했습니다.` / `판단 확인하기` |
| accepted-range wording | 전부/일부 모두 가능한 판단 범위 기준. 내부 acceptedAnswers 판정은 그대로 |
| candidate note | 4개 note만 구체적인 짧은 근거로 변경. 중국어 후보·band·허용값 불변 |
| MJT4 prompt | Q 문장 유지; UI 제한문만 압축 |
| intro flow | AI 피드백 확인 → 내 번역/통역 재검토 → 최종안 결정 |
| recap | 제목·폰트·여백·활동명·동적 CTA 반영. 실제 무스크롤/육안 확인은 미완료 |
| AI feedback raw/parser | 코드 경로 확인까지만. 실제 응답은 미확보, 원인 판정 보류 |
| 저장 실패 | 현재 운영 실패 원인은 미확정, 사용자 확인 후속 대기 |
| 완료 화면 정렬 | 오류+재시도 우선, 이동 버튼은 아래로 분리; DOM 순서/클릭/비활성 검사 통과 |

## 4. 콘텐츠 revision 준비

- 대표 scenario: `3da0c62d-e91f-4f68-9b74-28cd9d42f044`, 한→중/번역/요청.
- 기존 운영: version 3, lineage `980571d6-8852-48c4-9cde-233713360b5f`, reviewed.
- 기존 hash: `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095`.
- 로컬 후보 hash: `965bd395d6f77d9931e11107a5e9edd247ba729d4303a256a2645c8505d915df`.
- 새 DB version ID/번호: 없음. v4 생성 완료로 표현하지 않는다.
- `docs/research-trail/evidence/2026-09-27-parcel-final-review/`의 `approved-v3.snapshot.json`, `local-revision-candidate.json`, `revision-manifest.json`에 저장.
- canonicalJson 재귀 key 정렬 뒤 provenance/quality_check/hsk_lexical_audit/authoring을 제외한 SHA-256으로 기준/후보를 각각 재계산했다. 기준 hash 일치, 후보 schema 통과, 변경 허용 9필드를 되돌리면 semantic payload 전체가 기준과 동일하다.
- 후보는 기존 품질/HSK/authoring 검토 결과와 finalized_at을 승계하지 않는다. generation provenance/item_lineage는 원자료 출처로 남았으며 **그대로 운영 반입할 수 있는 finalized revision이 아니다**. 새 revision/item lineage와 새 해시에 묶인 필요한 감수·교수자 승인·편성 교체는 별도 승인 후 진행해야 한다.
- 현재 course `915fec24-cc38-4b00-a2a0-c3628abcd3f7`, week 2, assignment `9a44e362-8bed-4a40-9d65-f50961e3a026`, position 0은 기존 v3 그대로다.
- 내부 ID 1~5 및 화면 순서 1→2→5→3→4, 모든 중국어 후보/참고 표현, reason-choice, 허용값, lesson_points(핵심 정리 05 포함), DCT production_task는 보존했다.
- UI-only 변경 자체에는 콘텐츠 재승인이 필요하지 않다. 콘텐츠 후보를 실제 적용할 때에는 재승인/편성 교체가 필요하다.

## 5. 저장 실패 RCA — 보류

- 실제 원인: 미확정. 사용자가 지정한 계정과 대표 미션만 좁힌 읽기 전용 조회에서 관련 저장 로그·연구 이벤트가 발견되지 않았다. 계정 추정/수행 시점의 실제 세션까지 확정할 근거는 아니다.
- mission/hash/지정 assignment는 기존 승인 v3와 일치했다. 코드의 일반 학습 로그 INSERT 정책은 auth_user_id=auth.uid()이며, 연구 이벤트의 승인/동의 조건과 다르다. 연구 참여 승인 상태만으로 학습 로그 실패를 설명할 수 없다.
- `saveMissionAttempt`가 반환한 상세 오류는 현재 완료 화면에서 보이지 않는다. 실제 요청 payload/DB 오류가 없으므로 auth/RLS/lineage/네트워크 중 하나로 단정하지 않는다.
- PR #248과의 인과: 확인되지 않음. #248 이후 기준 main까지 해당 learner/save 경로 변화는 없었으나, 이것만으로 #248 책임 유무를 판정할 수 없다.
- 이번 변경: 복구 UI만 보정. serializer/DB/RLS/저장 함수는 수정하지 않았다.
- 재점검: mock 기반 기존 same-ID retry, 중복 충돌 확인, A/C 저장 매핑, course/attempt/hash, 본인 기록 조회 검사 통과. 실제 운영 저장·reload 성공은 확인하지 않았으며 사용자 skip 지시로 중단했다.

## 6. 화용적 적절성 카드 RCA — 보류

- 실제 raw output 및 해당 invocation의 parser/normalized 결과를 확보하지 못했다. 저장된 대상 계정 수행 결과도 조회되지 않았다.
- 코드 경로: `normalizeFeedbackResponse` → RuntimeFeedback → `evaluationFromRuntimeFeedback`의 `blocks.feature_ko` → 기준 카드. 이는 코드 연결 근거일 뿐 실제 응답이 어디서 짧아졌는지의 증거가 아니다.
- raw부터 중국어 한 문장뿐이었는지, 중간 처리/표시 손실인지 확정 불가. prompt/schema/모델/실제 피드백 설명을 임의 변경하거나 보충하지 않았다.
- 사용 중인 Brave 탭은 도구가 현재 URL을 확실히 확인하지 못해 Computer Use가 중단됐다. 다른 접근으로 해당 브라우저 제어를 우회하지 않았다. 이후 사용자가 확인을 skip하도록 지시했다.
- 최초 진단의 범위가 넓은 invocation 조회는 자동 승인 검토에서 거절됐다. 해당 쿼리를 제거하고 지정 계정+미션만의 읽기 전용 조회로 좁혀 승인·실행했다. 원응답 조사의 우회 근거로 쓰지 않았다.

## 7. 최소 검증

최종 파일별 결과를 합산한 서로 다른 focused **10파일/63개 통과**다. 전체 suite 63개라는 뜻이 아니며, 실패 수정 후 필요한 파일만 재실행했다.

| 파일 | 통과 수 |
| --- | ---: |
| CanonicalMissionRun.runtime.test.tsx | 18 |
| CanonicalMissionRun.recheck.test.tsx | 5 |
| CanonicalMissionRun.reasonContrast.test.tsx | 2 |
| CanonicalMissionRun.connections.test.tsx | 8 |
| CanonicalMissionRun.pilot.test.tsx | 1 |
| canonicalMissionRuntime.test.ts | 7 |
| parcelFinalReview.test.ts | 2 |
| missionLog.save.test.ts | 4 |
| missionLogFilter.test.ts | 12 |
| dctFeedbackSession.test.ts | 4 |

- typecheck 통과. npm prebuild 단계 통과 및 최종 Vite production build 성공. Browserslist, CSS minifier, chunk 크기 경고는 있었으나 build 오류는 없었다. prebuild가 만든 Git metadata 갱신은 이번 변경에서 제외했다.
- 테스트 초기 실패: source padding 변경이 DCT 표시 부분에도 적용된 범위 오류, 문자열 기대값, 새 all-good 테스트 간 미사용 mock 결과 잔류. 범위를 바로잡고 mock을 격리한 뒤 관련 파일만 재실행했다.
- all-good A 유지 1회 및 자발적 B 수정 2회, B 입력, C 무호출, 2차 실패 후 C 저장, 참고 표현 지연 공개, 1차 provenance/이벤트, provider fallback=동일 learner round를 mock으로 확인했다.
- 실제 AI 호출/운영 저장/전체 E2E/스크린샷 캡처/1536×960 화면 실측 없음. 핵심 정리 레이아웃은 CSS 수정 완료와 육안 확인 완료를 구별한다.

## 8. 논문 영향 3줄

1. 화면/콘텐츠: 로컬 learner copy와 복구 화면 변경, 콘텐츠 9필드 후보 준비; 현재 운영 콘텐츠/배포는 그대로다.
2. 구현/검증: focused 63개·typecheck·build 통과. 운영 저장 오류·실제 화용 피드백 원인·캡처 육안 확인은 미완료다.
3. 논문 구조/RQ/contribution/목차/용어대장/철학/Narrative Gold는 변경하지 않았다. 콘텐츠 후보의 검토·재승인 전에는 새 운영 증거로 인용하지 않는다.
