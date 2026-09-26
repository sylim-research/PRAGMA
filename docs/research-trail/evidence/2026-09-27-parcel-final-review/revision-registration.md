# 택배 대표 미션 — FINAL LOCK 후보 최종 승인·편성 완료

최종 읽기 확인: 2026-09-27 01:13:25 KST. UI 코드 push/PR/merge/deploy 및 운영 learner E2E는 하지 않았다.

## A. old v3 → 새 revision

| 단계 | scenario | version ID | 실제 version_no / stage |
| --- | --- | --- | --- |
| 기존 승인 v3 | 3da0c62d-e91f-4f68-9b74-28cd9d42f044 | 980571d6-8852-48c4-9cde-233713360b5f | 3 / reviewed |
| FINAL LOCK 후보 v4 | 위 기존 scenario의 append-only 이력 | dbb99548-a93c-4d85-9659-c5e880f39c87 | 4 / generated |
| 별도 실행용 초안 | 051532cc-c3a2-4440-9a5e-efc54e9ac481 | 497c1652-a979-4671-86d8-e47a373072e2 | 1 / generated |
| 최종 승인 실행본 | 051532cc-c3a2-4440-9a5e-efc54e9ac481 | 6610c6c6-1a25-4cc6-a584-5d372c8224e4 | 2 / reviewed |

parent_version_id는 표 순서대로 연결된다. 새 scenario의 supersedes_scenario_id는 기존 scenario다. **v4 후보에서 이어진 최종 승인본의 실제 DB 번호는 새 scenario 안의 2**다. 번호는 scenario별로 계산되며 기존 v4 이력을 UPDATE하지 않았다.

## B. hash

- old v3: `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095`
- **pre-finalization candidate**: `6254e9f9b2c5841e5d1304fb52628f1bbaadc7702adb22b1e25799e716cb34af`
- **v4 후보에서 이어진 최종 승인 콘텐츠**: `3b213fbc547ad2e53834f5557ce53ebe7359a39de3e1781d297e2b37abd3e764`

최종화 전후 학습 콘텐츠 전체의 semantic diff=0. 변경된 최상위 항목은 provenance, item_lineage, authoring, hsk_lexical_audit뿐이다. item_lineage의 귀속 주장·근거 연결·시각이 정상 재산출됐으며 이 항목은 콘텐츠 hash에 포함된다. 시각만 바뀌었다고 축약하지 않는다. 기존 hash 함수와 finalize 절차는 수정하지 않았다.

## C. 승인

- 새 review run: `f8f60e0e-0b20-4648-82e1-7342bb8c20f9`
- 새 규칙 검사 PASS / 기본 OpenAI 검토 PASS, 양쪽 findings=0. 독립 Claude 검토 없음.
- 정상 content-review:finalization → finalize_mission으로 귀속·HSK·최종 hash 산출.
- 새 초안에는 professor_revised / pending / repair_attempts=0을 새로 초기화했다. 기존 finalized/품질/승인 결과 자동 승계 없음.
- 연구자 FINAL LOCK 및 승인 실행 위임을 근거로 정적 JSON 대조 8항을 기록했다. active_seconds=0이며 실제 화면 체험·운영 E2E로 기록하지 않았다.
- 정상 RPC save_instructor_experience → save_content_review_decisions → finalize_reviewed_mission으로 최종 승인.
- 승인 시각: 2026-09-26T16:13:09.365669Z (2026-09-27 01:13:09 KST). 실제 관리자 세션의 위임 실행이며 연구자 직접 UI 클릭으로 서술하지 않는다.
- 별도 review hash는 `98a050c0ee0a76765e14bc82414c854dd11bd6f92910f302b883ab95552c03fc`이며 콘텐츠 hash와 구별한다.

## D. 지정 편성 전/후

course `915fec24-cc38-4b00-a2a0-c3628abcd3f7` / week 2 / position 0 / assignment `9a44e362-8bed-4a40-9d65-f50961e3a026`.

- 전: scenario `3da0c62d-e91f-4f68-9b74-28cd9d42f044`의 승인 v3.
- 후: scenario `051532cc-c3a2-4440-9a5e-efc54e9ac481`의 새 승인 실행본.
- 승인 확인 뒤 기존 scenario_id를 조건으로 지정 행 한 건만 UPDATE. 변경 열은 scenario_id와 자동 updated_at뿐이다.
- 기존 scenario 행 전체 및 기존 v3 lineage 행 전체가 작업 전과 완전히 동일함을 재조회했다.

## E. learner 읽기 경로

운영 DB에서 listWeekAssignments와 같은 편성 테이블 및 fetchMissionByScenario와 같은 조회 열을 사용해 지정 편성 → 새 scenario → reviewed → 최종 hash를 확인했다. course는 published, 호환 release ID는 pragma_zhko_bidirectional_candidate_20260904_02다.

관리자 세션의 읽기 확인이다. 실제 learner 계정 로그인·화면 수행·저장·reload E2E는 하지 않았다. 내부 ID 1~5와 모든 문항 내용, 제시 순서 1→2→5→3→4의 코드는 불변이다.

## F. 예상 밖 사항·처리 이력

1. 최초에는 고정 hash와 정상 최종화의 item_lineage 재산출이 충돌했다. 연구자는 이후 6254…를 후보 hash로 보존하고 정상 최종화의 새 hash를 허용했다.
2. 첫 초안 `369bad46-6972-49c5-8841-c1c1baadaa28`에 Codex가 authoring.repair_attempts 초기화를 누락했다. 실제 승인 gate가 schema 오류로 차단했다. 해당 review `be8ad67a-f0e1-4c9c-9020-d9a12bb60f5c`와 초안은 미승인·미편성으로 보존했다.
3. 로컬 validator로 누락 필수값 한 곳을 확정한 뒤 fresh pending authoring을 갖춘 새 초안에서 정상 절차를 완료했다. 학습 콘텐츠를 고치거나 실패 자료/승인 gate를 우회하지 않았다.
4. 기본 OpenAI 검토 총 2회, 최종화 총 2회(첫 실패 자료 + 최종 성공 자료). 두 번째 실행은 연구자의 명시적 재시도 승인 후 수행했다. 자동 승인 심사가 차단한 호출은 실행되지 않았고 우회하지 않았다.
5. 승인 9필드 및 나머지 학습 콘텐츠의 예상 밖 변경은 0. 중국어 후보·reference_alternatives·reason-choice·accepted 값·lesson_points·production_task 불변.
6. schema/API/제품 코드·저장 계약 변경, 과거 저장 RCA 추가 조사, 다른 미션 조사, learner E2E, UI 배포 없음.

## 직접 근거

- [최종 승인·편성·읽기 결과](revision-release-result.json)
- [교수자 승인/lineage](professor-approval-result.json), [최종 승인 콘텐츠](approved-final-content.json)
- [최종화 diff](finalization-diff.json), [새 검토 증거](fresh-review-state.json)
- [당시 pending v4 등록](revision-registration-result.json), [원래 9필드 전문 diff](final-9-field-diff.md)
- 실패 보존: failed-first-execution-state.json, failed-first-review-state.json, failed-first-finalization-diff.json, failed-first-finalized-content.json.
- 구현: generate-scenario/index.ts의 attributeMissionItemLineage/finalize_mission, contentReviewFinalization.ts, missionSchema.ts의 MissionAuthoringSchema, missionDb.ts의 fetchMissionByScenario.
