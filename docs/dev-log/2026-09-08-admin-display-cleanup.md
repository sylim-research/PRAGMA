# 관리자 표시 정리 · 1단계

> 후속 사용자 요청으로 커밋·푸시·배포를 승인받았다. 아래 미배포 표기는 구현 당시 상태다.
> 최신 main 기반 `codex/admin-display-release-2026-09-09`에서 통합하며, 최종 기능 SHA·main·CI·Railway·운영 확인 증거는 이 변경 PR의 배포 확인 절에 기록한다.

- 승인 범위: Fable 인계·보완에 대한 사용자 “오케이, 수정하자.”. 합의한 문구·노출 변경을 UI 브리프로 삼았다. 메뉴 통합·라우트·데이터·승인 조건·모델·프롬프트를 변경하지 않았다.
- 판단: **[단독 진행 적합]**. 경미한 표시 수정이며 추가 교차검토·모델 실험은 하지 않는다.
- 작업공간: `C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08`, branch `codex/freeze-consistency-2026-09-08`.
- 기준: 착수 직전 원격 main `5ec6ba608a6cea590fc8ad1f432b27b42e2b3b8e`. 로컬 HEAD `57f94f1c8442ba46ef78e9e4c5ee3749b295822a`는 선행 배포 기록 커밋이며 main과 앱 코드가 같았다. 루트·논문 저장소 및 보존 worktree의 상태를 읽기 전용 점검하고 기존 변경을 보존했다.
- 이번 결과: **로컬 미커밋 수정**. 커밋·푸시·운영 배포 없음. 논문 원고·연구자 편집 HWPX는 수정하지 않았다.

## 변경과 유지 경계

1. 공통 단계 키에서 규칙 검사 → AI 검토 → (선택) AI 독립 검토 → (선택) AI 재검토 → 교수자 최종 승인을 표시한다. 기존 승인 정책별 단계 노출·진행 순서·승인 조건은 그대로다.
2. 교수자가 살피는 행위는 감수, 사용·공개 자격 결정은 최종 승인으로 구분했다. pass 라벨은 “보고된 문제 항목 없음”이다. 메뉴·제목은 “콘텐츠 승인”, 학습자 메뉴는 기존 페이지 제목 “학습자 관리”에 맞췄다. 우선 링크는 경로로 같은 메뉴 객체를 참조한다.
3. 조립·승인 화면의 “고급 필터 (연구자용)”는 기본 접힘이다. 학습설계 네 축은 그대로 노출한다. 고급 필터가 적용되면 접어도 “필터 적용 중”이 보인다. 접기 동작은 필터 값을 초기화하지 않는다.
4. run은 24자 초과 시 기존 ID 앞 12자·뒤 8자를 표시한다. 축약 결과가 중복되면 해당 ID 전체를 표시한다. 선택값은 원래 ID이고, 기록에 없는 날짜·목적을 만들지 않았다.
5. **UUID 요약 교체는 보류**. 수행 기록은 learner_mission_logs와 profiles를 조회하며 현재 행에 시나리오 요약이 없다. 새 조회·조인·요약 생성을 추가하지 않았다.
6. 저장된 summary_ko·문제 항목 원문·과거 승인·prompt 본문·내부 상태 키는 소급 수정하지 않았다. 새 라벨과 과거 본문 용어는 한 화면에 공존한다. 서비스 상태·결제와 모델 이력의 실제 제공자명은 보존했다.

## 검증

| 실행 | 결과 |
|---|---|
| npm.cmd run typecheck | 통과. tsconfig.app.json 기준 |
| App.production-routes.test.ts | 2 tests 통과 |
| adminNavigation.test.ts | 3 tests 통과. 필수 경로·공통 메뉴 객체 참조 보존 |
| ContentReviewPanel.test.tsx | 6 tests 통과. 선택 절차·승인 차단·과거 의견 원문 보존 |
| contentReview.test.ts | 19 tests 통과. 단계 키·선택 정책·의견 보존 |
| reviewPreparation.test.ts | 9 tests 통과 |
| contentReviewApi.test.ts | 1 test 통과 |
| npm.cmd run review:bundle | 통과. 생성 번들 내용 변경 없음 |
| git diff --check | 통과 |

관련 검사는 **6파일 40 tests**다. 첫 실행에서 새 pass 라벨을 전체 텍스트로 찾는 테스트 선택자 1건이 실패했다. 제목·건수와 함께 표시되는 실제 렌더링에 맞춰 부분 일치로 고치고 해당 파일 6 tests만 다시 실행해 통과했다. 기존 React Router future flag 경고는 오류가 아니다.

Edge 도메인 번들의 재생성 전후 SHA-256은 모두
`300a3cc857c208d3f2125a0f9485d0a03aecaa4715c4d7ba837ec531e168cc18`이다.
contentReviewDomain 및 Edge 진입점에서 사용하는 함수는 표시 상수/effectiveReviewSteps를 사용하지 않는다.
이번 라벨 수정에 따른 Edge 실행 로직·규칙·프롬프트 변화가 없어 Edge 재배포는 필요하지 않다.
브라우저 전수 순회·운영 데이터 쓰기·유료 호출·전체 테스트 반복은 하지 않았다.

## 논문 재캡처 대상

기존 캡처가 아래 화면을 담고 있으면 변경 반영 뒤 재캡처한다. **사이드바가 포함된 관리자 캡처는 본문 변경이 없어도 공통 메뉴명 변경 대상**이다. 그림 25–33과의 개별 매핑은 원고를 편집하지 않아 확정하지 않았다.

| 화면/경로 | 달라지는 표시 |
|---|---|
| 공통 관리자 사이드바·모바일 메뉴·우선 링크 | 콘텐츠 승인, 학습자 관리 |
| 운영 대시보드 /admin/dashboard | 단계명·선택 설명·서비스 역할 |
| 학습 미션 조립 /admin/assembly | 고급 필터·run 구분·감수 대기·진행 문구 |
| 콘텐츠 승인 /admin/review | 제목·선택 단계 머리말·고급 필터·감수 대기열·상세 승인 패널·체험 감수 |
| HSK 코퍼스 /admin/corpus | 교수자 감수 후보·현재 승인 화면 링크 |
| 개별 생성 /admin/generator | 감수 대기·생성 조건 설명·저장 안내 |
| 배치 생성 /admin/batch | 탈락·감수 대기 안내 |
| 생성 계약·프롬프트 /admin/prompt-harness | 역할 설명·카드 제목·링크. 프롬프트 본문 불변 |
| 주차별 수업 운영 /admin/package | 자료 승인 상태·상세 승인 패널·공개 안내 |
| 수업 데이터 백업 /admin/data-backup | “백업 범위 자세히 보기”의 상태·담당자 설명 |
| 과거 정식 생성 기록 /admin/research-qa/final-review | 현행 승인 화면 링크·과거 기록 범위 설명. 저장된 과거 기록 불변 |
| 기존 개발용 승인·파일럿 미리보기 | AdminFinalApproval·AdminGoldCalibration의 현행 화면 링크·설명. 운영 메뉴 추가 없음 |

수행 기록 /admin/decision-traces 본문의 UUID 표시는 보류했다. 변경 문구는 적용 후 연구자 화면 확인 대상이며, 이번 기록은 사용성 향상이나 콘텐츠 타당성을 검증했다는 뜻이 아니다.

## 기록

관리자 정본의 현재 메뉴명·표시 규칙을 동기화했다. 연구 기록은 사용자 혼란에 따른 표시 개선과 증거 보존 경계를 ITER-20260908-04 및 EVD-20260908-04에만 남겼다. 학습설계·연구문제·생성계약은 바뀌지 않아 설계 추적표와 결정 대장은 추가 갱신하지 않았다. 추가 사용자 판정이 필요한 항목은 없으며 UUID 교체·메뉴 통합은 후속 범위다.

## 검수 재계수와 유지 사유

분모: Git 추적 src 파일에서 *.test.* 및 *generated*를 제외하고 주석을 포함했다. HEAD 57f94f1c의 121행·127회에서 수정본 44행·44회로 줄었다. 이는 소스 문자열 수이며 화면 노출 수가 아니다. Fable의 93곳과 분모가 같다고 가정하지 않는다.

| 유지 위치 | 사유 |
|---|---|
| [src/App.tsx:97](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/App.tsx:97>) | 화면에 보이지 않는 주석 |
| [src/components/mission/ChatScene.tsx:49](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/mission/ChatScene.tsx:49>) | 화면에 보이지 않는 주석 |
| [src/lib/admin/adminDashboardMetrics.ts:25](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminDashboardMetrics.ts:25>) | 화면에 보이지 않는 주석 |
| [src/lib/admin/adminDashboardMetrics.ts:27](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminDashboardMetrics.ts:27>) | 화면에 보이지 않는 주석 |
| [src/lib/admin/adminDashboardMetrics.ts:77](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminDashboardMetrics.ts:77>) | 화면에 보이지 않는 주석 |
| [src/lib/admin/adminDashboardMetrics.ts:118](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminDashboardMetrics.ts:118>) | 화면에 보이지 않는 주석 |
| [src/lib/admin/adminDashboardMetrics.ts:122](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminDashboardMetrics.ts:122>) | 화면에 보이지 않는 주석 |
| [src/lib/auth/learnerAccess.ts:7](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/auth/learnerAccess.ts:7>) | 화면에 보이지 않는 주석 |
| [src/lib/backup/courseBackup.ts:14](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/backup/courseBackup.ts:14>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/composer.ts:56](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/composer.ts:56>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/composerEligibility.ts:4](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/composerEligibility.ts:4>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/learnerCourse.ts:8](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/learnerCourse.ts:8>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/learnerProgress.ts:10](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/learnerProgress.ts:10>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/refusalTeachingCase.ts:7](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/refusalTeachingCase.ts:7>) | 공통 수업자료·승인 해시의 원본 문자열 |
| [src/lib/curriculum/weekGuidance.ts:10](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/weekGuidance.ts:10>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/weeklyInstructorContent.ts:12](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/weeklyInstructorContent.ts:12>) | 화면에 보이지 않는 주석 |
| [src/lib/curriculum/weeklyOpeningContext.ts:3](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/curriculum/weeklyOpeningContext.ts:3>) | 화면에 보이지 않는 주석 |
| [src/lib/mission/missionDb.ts:4](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/missionDb.ts:4>) | 화면에 보이지 않는 주석 |
| [src/lib/mission/missionDb.ts:61](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/missionDb.ts:61>) | 학습자 접근 오류 표시, 이번 범위 밖 |
| [src/lib/mission/missionDb.ts:83](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/missionDb.ts:83>) | 화면에 보이지 않는 주석 |
| [src/lib/mission/missionRelease.ts:35](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/missionRelease.ts:35>) | 학습자 공통 상태 표시, 관리자 전용 범위 밖 |
| [src/lib/mission/missionRelease.ts:37](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/missionRelease.ts:37>) | 학습자 공통 상태 표시, 관리자 전용 범위 밖 |
| [src/lib/mission/mockIntroArc.ts:21](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/mockIntroArc.ts:21>) | 화면에 보이지 않는 주석 |
| [src/lib/mission/mockIntroArc.ts:32](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/mockIntroArc.ts:32>) | 화면에 보이지 않는 주석 |
| [src/lib/mission/mockIntroArc.ts:104](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/mission/mockIntroArc.ts:104>) | 화면에 보이지 않는 주석 |
| [src/lib/pragma/contentReviewDomain.ts:55](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/contentReviewDomain.ts:55>) | Edge 규칙 결과 또는 승인 스냅샷 원문 |
| [src/lib/pragma/contentReviewDomain.ts:64](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/contentReviewDomain.ts:64>) | Edge 규칙 결과 또는 승인 스냅샷 원문 |
| [src/lib/pragma/coreBatchRun.ts:67](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/coreBatchRun.ts:67>) | 화면에 보이지 않는 주석 |
| [src/lib/pragma/missionRules.ts:6](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/missionRules.ts:6>) | 화면에 보이지 않는 주석 |
| [src/lib/pragma/missionRules.ts:156](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/missionRules.ts:156>) | 화면에 보이지 않는 주석 |
| [src/lib/pragma/missionRules.ts:923](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/missionRules.ts:923>) | 화면에 보이지 않는 주석 |
| [src/lib/pragma/missionRules.ts:942](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/missionRules.ts:942>) | R31 검사 결과·스냅샷에 포함되는 원문 |
| [src/lib/pragma/missionRules.ts:1103](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/missionRules.ts:1103>) | 화면에 보이지 않는 주석 |
| [src/lib/pragma/promoteMission.ts:609](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/promoteMission.ts:609>) | 저장될 수 있는 품질 결과 summary 원문 |
| [src/pages/Architecture.tsx:225](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/Architecture.tsx:225>) | 학습자·공개 화면, 이번 범위 밖 |
| [src/pages/Landing.tsx:115](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/Landing.tsx:115>) | 학습자·공개 화면, 이번 범위 밖 |
| [src/pages/Privacy.tsx:110](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/Privacy.tsx:110>) | 학습자·공개 화면, 이번 범위 밖 |
| [src/pages/admin/AdminAssembly.tsx:6](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminAssembly.tsx:6>) | 화면에 보이지 않는 주석 |
| [src/pages/admin/AdminDashboard.tsx:169](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminDashboard.tsx:169>) | 화면에 보이지 않는 주석 |
| [src/pages/admin/AdminDashboard.tsx:550](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminDashboard.tsx:550>) | 화면에 보이지 않는 주석 |
| [src/pages/admin/AdminTeachingMaterials.tsx:265](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminTeachingMaterials.tsx:265>) | 화면에 보이지 않는 주석 |
| [src/pages/learner/IntroArc.tsx:271](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/learner/IntroArc.tsx:271>) | 학습자·공개 화면, 이번 범위 밖 |
| [src/pages/learner/LegacyMissionRun.tsx:1103](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/learner/LegacyMissionRun.tsx:1103>) | 화면에 보이지 않는 주석 |
| [src/pages/learner/WeeklyLearningNote.tsx:35](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/learner/WeeklyLearningNote.tsx:35>) | 학습자·공개 화면, 이번 범위 밖 |

저장된 모델 생성 본문 및 generated 프롬프트 스냅샷은 위 소스 재계수와 별개로 보존한다. 관리자 페이지·컴포넌트에 남은 검수 표기는 모두 주석이다. 라이브러리의 R31 등 공유 원본 문자열을 지우기 위해 승인 해시나 검증 버전을 바꾸지 않았다.

## 수정 파일 전체 경로

- [docs/dev-log/2026-09-08-admin-display-cleanup.md](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/docs/dev-log/2026-09-08-admin-display-cleanup.md>)
- [docs/product/PRAGMA_관리자구조_정본.md](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/docs/product/PRAGMA_관리자구조_정본.md>)
- [docs/research-trail/03_iteration_log.md](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/docs/research-trail/03_iteration_log.md>)
- [docs/research-trail/04_evidence_index.md](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/docs/research-trail/04_evidence_index.md>)
- [src/components/admin/ContentReviewPanel.test.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/ContentReviewPanel.test.tsx>)
- [src/components/admin/ContentReviewPanel.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/ContentReviewPanel.tsx>)
- [src/components/admin/InstructorReviewExperience.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/InstructorReviewExperience.tsx>)
- [src/components/admin/ServiceHealthPanel.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/ServiceHealthPanel.tsx>)
- [src/components/research/ResearchWorkflowGuide.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/research/ResearchWorkflowGuide.tsx>)
- [src/lib/admin/adminNavigation.test.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminNavigation.test.ts>)
- [src/lib/admin/adminNavigation.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminNavigation.ts>)
- [src/lib/backup/courseBackup.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/backup/courseBackup.ts>)
- [src/lib/pragma/contentReview.test.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/contentReview.test.ts>)
- [src/lib/pragma/contentReviewApi.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/contentReviewApi.ts>)
- [src/lib/pragma/promoteMission.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/promoteMission.ts>)
- [src/lib/pragma/reviewPreparation.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/reviewPreparation.ts>)
- [src/pages/admin/AdminAssembly.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminAssembly.tsx>)
- [src/pages/admin/AdminBatch.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminBatch.tsx>)
- [src/pages/admin/AdminCorpus.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminCorpus.tsx>)
- [src/pages/admin/AdminDashboard.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminDashboard.tsx>)
- [src/pages/admin/AdminFinalApproval.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminFinalApproval.tsx>)
- [src/pages/admin/AdminFinalCorpusReview.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminFinalCorpusReview.tsx>)
- [src/pages/admin/AdminGenerator.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminGenerator.tsx>)
- [src/pages/admin/AdminGoldCalibration.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminGoldCalibration.tsx>)
- [src/pages/admin/AdminPromptHarness.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminPromptHarness.tsx>)
- [src/pages/admin/AdminTeachingMaterials.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminTeachingMaterials.tsx>)
- [supabase/functions/_shared/contentReview.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/supabase/functions/_shared/contentReview.ts>)

## 문구·노출 전후 대조표

같은 파일에서 반복되는 동일 문구는 한 행에 묶었다. 문자열 주변의 JSX·속성 표기는 변경 대상을 식별하기 위한 코드 조각이다. 세 테스트 파일은 새 라벨 단언·기존 데이터 보존 단언을 갱신했고 관리자 정본과 두 연구 기록은 위 범위에 맞춰 동기화했다.

### [src/components/admin/ContentReviewPanel.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/ContentReviewPanel.tsx>)

| 전 | 후 |
|---|---|
| pass: "지적 없음" | pass: "보고된 문제 항목 없음" |
| "검수 처리 실패" | "콘텐츠 승인 처리 실패" |
| aria-label="콘텐츠 검수" | aria-label="콘텐츠 승인" |
| &gt;현재 버전 검수&lt; | &gt;현재 버전 콘텐츠 확인&lt; |
| 수정하면 새 버전을 검수합니다. | 수정하면 새 버전의 콘텐츠를 확인합니다. |
| 저장된 콘텐츠와 검수 이력을 확인하는 중… | 저장된 콘텐츠와 승인 이력을 확인하는 중… |
| 이 버전의 검수 연결 기록은 아직 없습니다. | 이 버전의 점검·승인 연결 기록은 아직 없습니다. |
| 이 버전은 아직 검수하지 않았습니다. 규칙 검사부터 시작하세요. | 이 버전의 점검 기록이 없습니다. 규칙 검사부터 시작하세요. |
| "AI 품질 점검" | "AI 검토" |
| "생성 품질점검 재사용 · 추가 호출 없음" | "저장된 AI 검토 재사용 · 추가 호출 없음" |
| title="기존 생성 품질점검" | title="기존 생성 AI 검토" |
| title="저장된 Claude 검토" | title="저장된 AI 독립 검토" |
| 교수자 판단이 필요한 지적 ( | 교수자 판단이 필요한 문제 항목 ( |
| 중대 지적과 맥락 판단이 필요한 항목을 확인하세요. | 중대 문제 항목과 맥락 판단이 필요한 항목을 확인하세요. |
| finding.id.startsWith("claude-") ? "Claude" : finding.id.startsWith("generation-") ? "생성 품질점검" : "OpenAI" | finding.id.startsWith("claude-") ? "AI 독립 검토" : finding.id.startsWith("generation-") ? "생성 AI 검토" : "AI 검토" |
| &lt;strong&gt;OpenAI · | &lt;strong&gt;AI 재검토 · |
| 추가 모델 판정 없음 · 교수자가 직접 판단할 수 있습니다. | 추가 AI 재검토 없음 · 교수자가 직접 판단할 수 있습니다. |
| "OpenAI 지적별 판정 전" | "AI 재검토 전" |
| 이 지적에 대한 결정과 이유를 10자 이상 기록하세요. | 이 문제 항목에 대한 결정과 이유를 10자 이상 기록하세요. |
| OpenAI 지적별 판정 후 교수자 결정을 기록합니다. | AI 재검토 후 교수자 결정을 기록합니다. |
| 기각된 Claude 지적도 보존합니다. OpenAI 지적별 판정에는 1차 점검 결과를 제공하지 않습니다. | 기각된 독립 AI 검토 의견도 보존합니다. AI 재검토에는 1차 검토 결과를 제공하지 않습니다. |
| 모든 지적의 결정과 근거를 입력한 뒤 저장하세요. | 모든 문제 항목의 결정과 근거를 입력한 뒤 저장하세요. |
| 최종 확정할 수 없습니다. | 최종 승인할 수 없습니다. |
| 주차 자료 승인 전 연결 미션의 현재 버전 검수도 완료해야 합니다. | 주차 자료 승인 전 연결 미션의 현재 버전 승인도 완료해야 합니다. |
| 미션 {index + 1} 검수 | 미션 {index + 1} 승인 확인 |
| "검수 필요" | "승인 필요" |
| 규칙 오류를 수정·저장해야 AI 검수를 진행할 수 있습니다. | 규칙 오류를 수정·저장해야 AI 검토를 진행할 수 있습니다. |
| {run?.running_stage} 실행 중입니다. | {steps.find(step =&gt; step.key === run?.running_stage)?.label ?? "AI 검토"} 실행 중입니다. |
| &gt;교수자 최종 확정&lt; | &gt;교수자 최종 승인&lt; |
| 중대 지적·판단이 필요한 쟁점의 결정을 저장하고 | 중대 문제 항목·판단이 필요한 쟁점의 결정을 저장하고 |
| 지적별 교수자 판단을 저장하고 | 문제 항목별 교수자 판단을 저장하고 |
| OpenAI 1차 점검에 중대 지적이 있습니다. | AI 검토에서 중대 문제 항목이 확인됐습니다. |
| Claude의 지적 유무와 별개입니다. 수정이 필요하면 원본을 수정하고 다시 검수하세요. | 독립 AI 검토의 문제 항목 유무와 별개입니다. 수정이 필요하면 원본을 수정하고 다시 점검하세요. |
| OpenAI 중대 지적 사용 근거 | AI 검토의 중대 문제 항목 사용 근거 |
| 중대 지적을 검토하고도 현재 내용을 사용할 수 있는 근거를 | 중대 문제 항목을 검토하고도 현재 내용을 사용할 수 있는 근거를 |
| OpenAI 중대 지적을 검토했으며 | AI 검토의 중대 문제 항목을 확인했으며 |
| 수업 사용 적합성과 남은 지적에 대한 교수자 판단을 | 수업 사용 적합성과 남은 문제 항목에 대한 교수자 판단을 |
| "교수자 승인·확정" | "교수자 최종 승인" |
| Claude 검토 모델이 설정되지 않았습니다. 운영 환경의 CLAUDE_AUDIT_MODEL을 먼저 설정해야 합니다. | 독립 AI 검토 모델이 설정되지 않았습니다. 운영 설정을 먼저 확인해 주세요. |
| 검수 대상 원본·이력 | 콘텐츠 원본·승인 이력 |
| 현재 정적 콘텐츠 원본을 검수합니다. | 현재 정적 콘텐츠 원본을 확인합니다. |
| "검수 이력" | "점검·승인 이력" |
| &gt;자동 품질점검 준비&lt; | &gt;기본 점검 준비&lt; |
| 체험 감수의 장면·문항·참고 표현을 확인하고 수정 요청·보류·미저장 기록을 해결해야 최종 확정할 수 있습니다. | 체험 감수의 장면·문항·참고 표현을 확인하고 수정 요청·보류·미저장 기록을 해결해야 최종 승인할 수 있습니다. |

### [src/components/admin/InstructorReviewExperience.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/InstructorReviewExperience.tsx>)

| 전 | 후 |
|---|---|
| 이 부분의 AI·규칙 지적 | 이 부분의 AI·규칙 문제 항목 |
| 현재 저장된 지적이 없습니다. | 현재 저장된 문제 항목이 없습니다. |
| finding.provider 그대로 표시: OpenAI / Claude / 규칙 | 화면에서만 AI 검토 / AI 독립 검토 / 규칙 검사로 표시 |

### [src/pages/admin/AdminAssembly.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminAssembly.tsx>)

| 전 | 후 |
|---|---|
| "미션 생성됨 (검수 대기)" | "미션 생성됨 (감수 대기)" |
| "미션 조립 완료 — 검수 대기(generated)" | "미션 조립 완료 — 교수자 감수 대기" |
| "콘텐츠 검수·확정" | "콘텐츠 승인" |
| 수업에 사용할 콘텐츠의 현재 버전을 검수하고 교수자가 최종 승인합니다. | 교수자가 수업에 사용할 현재 콘텐츠를 감수한 뒤 최종 승인합니다. |
| 검수 가능한 학습 미션으로 저장합니다. | 감수할 수 있는 학습 미션으로 저장합니다. |
| 검수 화면에서 확인해 주세요. | 콘텐츠 승인 화면에서 확인해 주세요. |
| 미션은 편성 전에, 주차 수업자료는 미션 편성 후에 검수합니다. | 교수자는 미션을 편성 전에 감수하고 승인하며, 주차 수업자료는 미션 편성 후에 확인하고 승인합니다. |
| 편성 후 주차 자료 검수 → | 편성 후 주차 자료 승인 → |
| 표시된 검수 대기 미션 선택 | 표시된 감수 대기 미션 선택 |
| "미션 검수 대기열" | "미션 감수 대기열" |
| 모든 단계를 동일하게 연결한 머리말 | claude·adjudication 단계 라벨 앞에 (선택) 표시 |
| 항상 펼친 생성 기준 | 기본 접힘: 고급 필터 (연구자용), 적용 조건이 있으면 필터 적용 중 |
| 생성 run: ID 앞 18자와 … | 24자 초과 ID는 앞 12자…뒤 8자, 축약 중복 시 전체 ID |
| AI 품질 점검 | AI 검토 |
| Astra 생성 완료 · 품질 점검 시작 | Astra 생성 완료 · AI 검토 시작 |
| Astra는 수 분 걸릴 수 있습니다. 완료 후 기존 품질 점검을 진행합니다. | Astra는 수 분 걸릴 수 있습니다. 완료 후 AI 검토를 진행합니다. |

### [src/pages/admin/AdminDashboard.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminDashboard.tsx>)

| 전 | 후 |
|---|---|
| "OpenAI 1차 검토 대기" | "AI 검토 대기" |
| "Claude 독립 검토 대기" | "AI 독립 검토 대기" |
| "OpenAI 2차 검토 대기" | "AI 재검토 대기" |
| "선택 시에만 · Claude 의견 재검토" | "선택 시에만 · 독립 검토 의견 재검토" |
| ("검수 이력", (from, to) | ("점검·승인 이력", (from, to) |

### [src/pages/admin/AdminCorpus.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminCorpus.tsx>)

| 전 | 후 |
|---|---|
| 확인이 필요한 단어를 교수자 검수로 연결합니다. | 확인이 필요한 단어를 교수자 감수로 연결합니다. |
| 콘텐츠 검수·확정에서 원본과 검수 상태를 확인할 수 있습니다. | 콘텐츠 승인에서 원본과 승인 상태를 확인할 수 있습니다. |
| "콘텐츠 검수·확정 열기" | "콘텐츠 승인 열기" |
| 교수자 검수 후보 | 교수자 감수 후보 |
| 문맥과 학습 목적을 함께 검수합니다. | 문맥과 학습 목적을 함께 살펴봅니다. |
| 실제 콘텐츠·검수 연동 | 실제 콘텐츠·감수 연결 |
| 콘텐츠 검수·확정 &lt;ArrowRight | 콘텐츠 승인 &lt;ArrowRight |

### [src/pages/admin/AdminBatch.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminBatch.tsx>)

| 전 | 후 |
|---|---|
| 검수 탈락 셀을 교체할 때만 | 점검에서 탈락한 셀을 교체할 때만 |
| &lt;b&gt;검수 대기&lt;/b&gt; | &lt;b&gt;교수자 감수 대기&lt;/b&gt; |

### [src/pages/admin/AdminGenerator.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminGenerator.tsx>)

| 전 | 후 |
|---|---|
| 이미 존재하는 원문을 분류·검수하는 태그로 사용됩니다. | 이미 존재하는 원문을 분류·점검하는 태그로 사용됩니다. |
| 참고용 파생 지표 · 검수 보조 · 이론적 정답 아님 | 참고용 파생 지표 · 교수자 감수 참고 · 이론적 정답 아님 |
| 검수 대기(draft)로 저장돼 | 교수자 감수 대기(draft)로 저장돼 |
| 시나리오가 검수 대기 상태로 저장되었습니다. | 시나리오가 교수자 감수 대기 상태로 저장되었습니다. |
| &amp;nbsp;/&amp;nbsp; 검수: needs_review | &amp;nbsp;/&amp;nbsp; 승인 상태: needs_review |
| (검수 상태: needs_review) | (승인 상태: needs_review) |

### [src/pages/admin/AdminFinalApproval.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminFinalApproval.tsx>)

| 전 | 후 |
|---|---|
| title="교수자 최종 검수·공개" | title="교수자 최종 승인" |
| 교수자 검수 대기열 | 교수자 감수 대기열 |
| 검수 대기 미션을 열어 내용과 자동 점검 결과를 확인하세요. 교수자 검토 완료 상태로 승인된 미션만 | 감수 대기 미션을 열어 내용과 자동 점검 결과를 확인하세요. 교수자가 최종 승인한 미션만 |
| &gt;검수 대기&lt; | &gt;감수 대기&lt; |
| 미션 검수·승인 열기 | 학습 미션 조립 열기 |

### [src/pages/admin/AdminFinalCorpusReview.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminFinalCorpusReview.tsx>)

| 전 | 후 |
|---|---|
| 현재 콘텐츠의 콘텐츠 검수·승인은 콘텐츠 검수·확정에서 진행합니다. | 현재 콘텐츠의 감수와 최종 승인은 콘텐츠 승인 화면에서 진행합니다. |
| 콘텐츠 검수·확정으로 이동 → | 콘텐츠 승인으로 이동 → |
| 현재 콘텐츠 검수 완료율이 아닙니다. | 현재 콘텐츠 승인 완료율이 아닙니다. |

### [src/pages/admin/AdminGoldCalibration.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminGoldCalibration.tsx>)

| 전 | 후 |
|---|---|
| 수업 콘텐츠 검수·확정으로 이동 | 콘텐츠 승인으로 이동 |
| 현재 수업 콘텐츠의 콘텐츠 검수·승인과 별개인 연구용 파일럿입니다. | 수업 콘텐츠를 감수하고 최종 승인하는 절차와 별개인 연구용 파일럿입니다. |
| 미검수 수업 콘텐츠 수가 아닙니다. | 미승인 수업 콘텐츠 수가 아닙니다. |
| 현재 수업 콘텐츠의 검수 완료나 학습자 공개 승인으로 사용하지 않습니다. | 현재 수업 콘텐츠의 감수 완료나 학습자 공개 승인으로 사용하지 않습니다. |

### [src/pages/admin/AdminPromptHarness.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminPromptHarness.tsx>)

| 전 | 후 |
|---|---|
| review: "② 품질 검수" | review: "② AI 검토" |
| "생성·검수의 기준이 되는 모범 사례와 이론적 설계 근거" | "생성·점검의 기준이 되는 모범 사례와 이론적 설계 근거" |
| title: "검수 점검표" | title: "콘텐츠 점검표" |
| 콘텐츠 공개 여부는 교수자가 검수·승인합니다. | 교수자가 콘텐츠를 감수한 뒤 수업 사용·공개 자격을 최종 승인합니다. |
| &gt;교수자 검수·승인&lt; | &gt;교수자 최종 승인&lt; |
| 통합 검수·승인 &lt;ArrowRight | 콘텐츠 승인 &lt;ArrowRight |
| 자동 점검 규칙, 교수자 검수·승인의 관계를 확인합니다. | 자동 점검 규칙, 교수자 감수와 최종 승인의 관계를 확인합니다. |
| &lt;b&gt;생성·검수 파이프라인은 이 테이블을 | &lt;b&gt;생성·점검 파이프라인은 이 테이블을 |

### [src/pages/admin/AdminTeachingMaterials.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/pages/admin/AdminTeachingMaterials.tsx>)

| 전 | 후 |
|---|---|
| "수업자료 검수 대기" | "수업자료 승인 대기" |
| "자료 검수 대기" | "자료 승인 대기" |
| 이 주차 수업자료 검수·확정 | 이 주차 수업자료 승인 |
| 이 주차 검수·확정 후 공개되며, 내용이나 편성이 바뀌면 재검수가 필요합니다. | 이 주차 자료의 최종 승인 후 공개되며, 내용이나 편성이 바뀌면 다시 확인하고 승인해야 합니다. |

### [src/components/admin/ServiceHealthPanel.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/admin/ServiceHealthPanel.tsx>)

| 전 | 후 |
|---|---|
| role: "생성·검수·STT" | role: "생성·AI 검토·STT" |

### [src/lib/pragma/reviewPreparation.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/reviewPreparation.ts>)

| 전 | 후 |
|---|---|
| Claude 검토 모델 설정이 필요합니다. 유료 호출을 시작하지 않았습니다. | 독립 AI 검토 모델 설정이 필요합니다. 유료 호출을 시작하지 않았습니다. |

### [src/lib/pragma/contentReviewApi.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/contentReviewApi.ts>)

| 전 | 후 |
|---|---|
| 검수 서비스를 사용할 수 없습니다. 관리자 로그인과 content-review Edge·DB 배포 상태를 확인하세요. | 콘텐츠 승인 서비스를 사용할 수 없습니다. 관리자 로그인과 서비스 연결 상태를 확인해 주세요. |
| 검수 응답이 올바르지 않습니다. | 콘텐츠 승인 서비스의 응답이 올바르지 않습니다. |

### [src/components/research/ResearchWorkflowGuide.tsx](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/components/research/ResearchWorkflowGuide.tsx>)

| 전 | 후 |
|---|---|
| 교수자 최종 검수·공개 | 교수자 최종 승인 |
| 교수자 최종 검수와 학습자 공개 | 교수자 최종 승인과 학습자 공개 |
| 자동 품질 점검으로 오류 후보를 찾고, 교수자가 최종 검수한 학습 콘텐츠만 수업에 사용합니다. | 자동 품질 점검으로 오류 후보를 찾고, 교수자가 감수한 뒤 최종 승인한 학습 콘텐츠만 수업에 사용합니다. |

### [supabase/functions/_shared/contentReview.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/supabase/functions/_shared/contentReview.ts>)

| 전 | 후 |
|---|---|
| OpenAI 품질 점검 / Claude 독립 검토 / OpenAI 지적별 판정 / 교수자 최종 확정 | AI 검토 / AI 독립 검토 / AI 재검토 / 교수자 최종 승인 |
| effectiveReviewSteps의 openai 라벨 덮어쓰기: 품질 점검 | 공통 단계 키의 AI 검토 라벨 사용 |

### [src/lib/admin/adminNavigation.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/admin/adminNavigation.ts>)

| 전 | 후 |
|---|---|
| 콘텐츠 검수·확정 / 학습자 승인·관리 | 콘텐츠 승인 / 학습자 관리 |
| PRIORITY_LABELS에 중복 라벨을 정의하고 label로 조회 | PRIORITY_PATHS의 기존 경로로 공통 메뉴 객체 참조 |

### [src/lib/pragma/promoteMission.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/pragma/promoteMission.ts>)

| 전 | 후 |
|---|---|
| 검수 대기 미션을 찾지 못했습니다. | 감수 대기 미션을 찾지 못했습니다. |
| 현재 버전의 콘텐츠 검수에서 교수자 승인을 진행하세요. | 콘텐츠 승인 화면에서 현재 버전을 교수자가 최종 승인해 주세요. |

### [src/lib/backup/courseBackup.ts](<C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.worktrees/learner-e2e-2026-09-08/src/lib/backup/courseBackup.ts>)

| 전 | 후 |
|---|---|
| 배정된 시나리오 본문과 검수·승인 상태 | 배정된 시나리오 본문과 점검·승인 상태 |
| 검수자 개인 식별자 | 감수·승인 담당자 개인 식별자 |

## 논문 영향 3줄

1. 수치: 관련 40 tests·typecheck 통과, 버전·운영 배포 변경 없음.
2. 화면: 관리자 공통 메뉴와 위 재캡처 목록의 문구·고급 필터 표시. 논문 원고·HWPX 미수정.
3. 프롬프트·계약: 변경 없음. 동결본 재발행 불필요.
