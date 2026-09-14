# mission_v6 정상 경로 최소 구현

- 날짜: 2026-09-14
- 작업공간: `C:/Users/cnkr/Documents/Projects/l2-pragmatic-translator/.tmp/request-course-pilot-20260914`
- branch: `codex/request-course-pilot-2026-09-14`; 시작 HEAD: `8dd14fbe8bd9518a11142b8a5db2936c8dadaf5f`.
- 사용자 승인: 기존 blocker map의 최소 diff 구현 및 정상 경로의 교과목별 3건 실검증. 탐색·설계 재개방 없음.
- 분류: [교차검증 필수] — DB CHECK 및 승인 계약 연결. 구현·검증된 변경을 먼저 고정하고, 운영 반영 전 저장소의 독립 검토 절차를 따른다.

## 구현 전 metadata 의미 확인

| 필드 | 기존 의미·근거 | 판정 |
| --- | --- | --- |
| authoring | 저작 단계·수리 횟수·교수자 최종화·귀속 완료 상태(`missionSchema.ts:599`, finalize_mission) | 동일. v5 문항 순서나 교육 규칙이 아니다. |
| quality_check | 이 콘텐츠의 critic verdict/findings·모델·시각·버전·검사 hash(`missionSchema.ts:186`) | 동일. v6에도 실제 critic 결과만 기록한다. |
| hsk_lexical_audit | 중국어 source/target의 HSK 참고 점검, non_blocking=true(`hskReference.ts:9`) | 동일. 학습자 점수나 승인 면제가 아니다. |
| item_lineage | 목표어 문장 위치별 realization rule/risk/evidence의 모델 귀속 claim(`itemLineage.ts:8,36`) | 동일. 교수자 승인이나 검증된 학습효과를 뜻하지 않는다. |

네 필드 모두 기존 schema를 명시적으로 재사용했다. optional은 metadata 없는 기존 v6 checkpoint의 읽기를 보존하며, 정상 최종화·승인 RPC의 필수 요건은 유지한다. 의미가 다른 필드를 채우거나 metadata를 조작하지 않았다.

## 구현

1. v6의 완료 전 peerChoices 파생값 계산을 보류한다. 완료 상태·저장 validator·v5 builder를 유지하며 lifecycle/restore는 수정하지 않는다.
2. 정상 승인용 fetch/parser, prepared artifact parser, 체험 adapter 입구를 v6로 연결한다. legacy 관리자 조회는 기존 parser를 유지하고 정상 승인 호출만 includeV6=true를 넘긴다. 구형 MissionPreview의 v5 전용 경계도 유지한다.
3. v6 strict schema에 위 metadata만 추가한다. 기존 checkMission의 v6 분기에서 채택된 validator와 기존 direction/화행/초점/mode/provenance/core 계승/lineage 검사를 사용한다. v5 순서·분포·Anchor 규칙은 기존 분기에 남긴다.
4. 승인 snapshot criteria를 format별로 분리하고 기존 review bundle을 재생성했다. 기존 hash projection·승인 RPC·교수자 판단과 계보 검증은 수정하지 않았다.
5. composer의 완전 미션 조건은 (v5 OR v6) AND 5문항으로 확장했다. published/reviewed/released 및 편성 조건은 유지한다.
6. `20260914100000_allow_mission_v6.sql`은 transaction 안에서 기존 CHECK에 v6만 추가한다. 새 테이블·상태·RLS·집계 변경 없음.
7. 보고서의 조건부 critic 경로도 3건 준비에 필요하므로 적용했다. 기존 quality_check의 모델·결과 형식·finding 코드는 유지하고 v6 지시와 증거 버전만 분리한다. v5 지시·현재 품질 버전은 유지하며, 서로 다른 format의 critic 결과를 재사용하지 않는다. 생성기 일반화·콘텐츠 전량 확장 없음.

## 로컬 검증

- 관련 Vitest 13개 파일 152개 통과 후, v6 critic 증거 버전 검사 1개 추가. 변경 관련 3개 파일 30개 재실행 통과(중복을 제외한 관련 검사 총 153개).
- PostgreSQL(PGlite) CHECK 1개 + 기존 승인 DB 검사 32개 + Edge 회귀 2개 = 35개 통과. 이는 운영 DB E2E 결과가 아니다.
- 새 CHECK의 v1~v5 기존 행 보존, v6 generated/reviewed/released 허용, 잘못된 format/status/feature 거부를 실제 메모리 PostgreSQL에서 확인했다.
- 실제 runtime prop을 받는 v6 러너의 빈 응답 진입·첫 문항 이후 이동을 DOM 테스트로 확인했다. 빈 응답의 저장 serializer는 계속 거부한다.
- 타입 검사 통과. `npm.cmd run build`의 prebuild(운영 소스 확인·프롬프트 snapshot·review bundle 일치 검사)와 production Vite build 통과.
- 최초 실행이 샌드박스 상위 경로 읽기 제한으로 차단된 Vitest/Edge 검사는 해당 명령만 좁게 승인해 재실행했다. 기존 환경 차단 기록을 소급 변경하지 않았다.
- 최초 P0 테스트는 v5 도입 버튼을 찾는 잘못된 기대 때문에 실패했다. v6 실제 첫 문항 진입을 검사하도록 테스트만 수정했다.
- 빌드의 Browserslist·기존 CSS minify·큰 chunk 경고는 기록하고 범위를 확대하지 않았다.

## 운영 실검증 준비 상태

- 기존 설정의 PRAGMA 관리자 계정 로그인 및 is_admin=true를 확인했다. 자격증명·토큰은 출력하거나 새 파일에 저장하지 않았다.
- 공개 교과목 3개는 정상 조회됐다. candidate 생성·승인·편성 변경·학습 로그 INSERT는 아직 하지 않았다.
- Supabase CLI에서 PRAGMA 프로젝트 연결 권한을 확인했다. 실제 CHECK 정의 확인 및 최소 migration 적용은 후속 실행 단계다.
- 상태: **v6 설계/계약 채택 완료, 로컬 최소 호환성 구현·검증 완료, 운영 E2E 0/3 및 운영 runtime/DB 호환성 검증 미완료**.
- P0 round-trip 대상: MJT2 scale_code+reason_id, MJT4 제출된 revised_text, MJT5 후보 순서의 candidate_band_codes. 중도 이어하기 UI·일반 집계·60개 확장 제외.

## 운영 반영 전 확인과 실행 보류

- 구현 커밋: `b3e319b5`. 채택 정본에 맞춘 기존 문서 테스트 후속 수정: `788f35e9`. 최초 전체 검사에서 v5를 최신 채택본으로 단정한 기대값이 실패했으며, 확정된 v6/v5 적용 범위를 검사하도록 수정했다. 제품 동작 변경 없음.
- 운영 CHECK를 Management API의 SELECT로 직접 조회했다. 실제 정의도 v1~v5이며, 상태·target_feature·target_feature_version 조건까지 로컬 migration 기준과 같았다. 운영 migration은 아직 적용하지 않았다.
- 최신 main `36a11af7`에서 별도 clean worktree `../v6-normal-path-integration-20260914`를 만들고 로컬 병합했다. 병합 커밋 `2d26d7b8`, 테스트 수정 포함 `cde595cc`. 기존 localhost worktree·서버는 유지했다. 통합 worktree에는 자체 의존성을 설치했다.
- 통합본 최종 검증: 전체 Vitest **141개 파일 943개 통과, 3개 파일 9개 기존 skip**, 타입 검사·production build 통과. 로그는 통합 worktree의 `.tmp/validation/tests-final.log`, `typecheck.log`, `build.log`에 있다. 앞선 동시 실행 수 6 검사에서는 기존 AdminBrowser의 본문 대기가 한 번 만료됐고 단독 4개 검사 통과 후 동시 실행 수 4의 전체 재실행도 통과했다. 관련 제품 코드나 테스트 timeout은 바꾸지 않았다.
- 아래 첫 요청 슬롯 3건의 코어/DCT 원본만 읽어 `.tmp/v6-e2e/selected-source-records.json`에 준비했다. 본문 전수 검토·새 candidate 생성·공개 원본 덮어쓰기·편성 변경·응답 INSERT는 하지 않았다.

| 교과목 | 2주 position | 원본 scenario_id | 방향·수준·수행 |
| --- | --- | --- | --- |
| AI 한중 화용 통번역 | 0 | f8de3f59-cd86-4636-b516-a8ead78ac0ac | ko_zh·중급·번역 |
| AI 한중 비즈니스 통번역 | 0 | 6b674da6-f545-43cb-8cda-ad5f27711450 | ko_zh·고급·번역 |
| AI 중한 실전 통번역 | 0 | 7e2e8765-bffb-4ccf-a240-54a67378642f | zh_ko·중급·번역 |

- 저장소 `AGENTS.md` 및 `docs/operations/AI_CROSS_REVIEW_PROTOCOL.md`의 DB migration/핵심 schema 독립 검토 절차를 따라 Claude 읽기 전용 검토를 요청했으나 **자동 승인 검토가 실행을 거절**했다. 이유는 비공개 저장소 소스의 구체적인 payload와 외부 Claude 전달 대상에 대한 사용자 승인 부족이다.
- 거절된 외부 실행을 우회하지 않았다. `b3e319b5`의 승인·저장 관련 13개 파일 diff 60,784 bytes를 `.tmp/v6-e2e/review.diff`로 로컬에 준비하고 해당 전송만 사용자에게 비동기로 승인 요청했다. 자격증명·DB 원본 자료는 이 diff에 포함하지 않았다. Claude 검토 결과는 없으며, 운영 DB·Edge 적용과 실제 3건 E2E는 보류 상태다.

[논문 영향 3줄]
1. 수치·버전·배포: 로컬 통합본 943 pass/9 skip, PostgreSQL·Edge 35 pass. 운영 E2E 0/3, 원격 push·운영 반영 없음.
2. 화면: 완료 전 v6 runtime 예외만 해소. 동결한 대표 콘텐츠·Reason/Contrast·기존 v5 화면 유지.
3. 프롬프트·계약: metadata 네 필드의 기존 계약 재사용 및 format별 검수 지시 연결. v5 계약·과거 응답 보존, 운영 동결본 재발행은 아직 없음.

## 제한된 Claude 독립 검토 완료 · 2026-09-14 21:42 KST

- 위 자동 승인 거절 이후, 사용자가 사전 점검 결과를 확인하고 **13개 파일 diff 단독 전송**을 명시적으로 승인했다. 원본 `review.diff` 60,784 bytes, BOM/CRLF만 정규화한 stdin 59,877 bytes. 전송 본문 SHA-256: `568885c20e58d3d8db55438df86d3e1ad43993288bd88a5acf8c249d8de40a6a`.
- 저장소 밖 빈 임시 디렉터리에서 Claude Code 2.1.110을 실행했다. 도구 0개, MCP·자동 문서·메모리·hooks 비활성화, 사용자/프로젝트 설정 제외. 외부 전송 전 로컬 HTTP capture에서 diff·검토 지시·CLI 기본 날짜/버전 정보만 포함함을 확인했다. 내부 문서·환경값·실제 DB 원본·사용자 응답은 보내지 않았다.
- `claude-opus-4-6[1m]` 1턴, 정상 종료. 추가 자료 요청/제공 없음. 원문은 `.tmp/v6-e2e/independent-review-result.md` 및 `.json`, 실행 근거는 `restricted-review-execution.json`이다.
- Claude 최종 결론: **diff에서 차단급 결함은 입증되지 않음**. 미완성 응답이 DCT 저장 시 strict serializer에 도달하는지는 포함되지 않은 흐름에 달린 조건부 우려로 남겼다. 이 검토에서 해당 실행 경로를 추가 조사하거나 재현하지 않았다.
- 원문은 일부 항목을 「검증된 결함」/Medium/High로 시작했지만, 같은 항목 안에서 null optional chaining·reason 필수 선택·correction index 검증을 정상으로 정정한다. 따라서 이를 확정 결함으로 집계하지 않는다. 명칭 `is_native_mpj5`와 CHECK 교체 잠금은 비차단 관찰 사항이다.
- 사용자 지시에 따라 결과 보고 후 보류한다. 앱 코드 수정·추가 검토 전송·운영 DB 변경·배포·3건 E2E 없음. **운영 E2E 0/3, DB 재조회 보존 미검증**은 그대로이며 diff 검토를 통합 성공으로 해석하지 않는다.

## 추가 호출경로 독립 검토 완료 · 2026-09-14

- 사용자가 같은 독립 검토의 직접 관련 코드·테스트 최소 발췌와 검사 후 추가 맥락 전송을 승인했다. 이전 13개 파일 diff는 재전송하지 않았다. 작업 HEAD `8b964679ca88d0dee84210df2fc851fa52d06c7e`, 통합 HEAD `6d9f16c841d33958d9a5254aaa8e4d7655ce3a61`을 확인했다.
- 준비 자료의 PowerShell 단일 range 배열 평탄화 때문에 serializer와 pilot 테스트 본문이 빠져 있었음을 전송 전에 발견했다. 이미 명시했던 같은 6개 파일 범위에서 누락 발췌를 복원했다. 실제 전송은 `.tmp/v6-e2e/supplemental-dct-reachability-v2.txt` 53,564 bytes, SHA-256 `a4194431ed91f44abdd4792b48b92872b198e7a199a187535ae927e50eaf0ab8`이다. 원래 승인 대상 자료와 manifest는 그대로 보존했다.
- 별도 `supplemental-review.cjs`에서 허용 파일·고정 hash·secret/token/credential/이메일/전화번호/내부 문서 패턴을 검사했고 검출 0건이었다. 로컬 설정 값 5개와의 대조도 일치 0건이다. 실제 사용자 응답·DB 자료·내부 문서를 전송하지 않았다. `.env` 유사 패턴은 `import.meta.env.DEV` 소스 표현이다.
- 저장소 밖 빈 임시 디렉터리, 도구 0개, MCP·자동 문서·메모리·hooks 비활성 상태를 로컬 HTTP 요청 capture로 다시 확인한 후 실행했다. 제한 샌드박스 실행은 요청 capture 없이 끝났으므로 격리 확인에 성공한 것으로 취급하지 않았고, 해당 명령만 좁게 승인해 재실행했다. 외부 검토는 1턴, 정상 종료, 추가 자료 요청 없음. 원문은 `.tmp/v6-e2e/supplemental-review-result.md`/`.json`, 실행·격리·검사 근거는 같은 디렉터리의 `supplemental-review-execution.json`, `supplemental-review-preflight.json`, `supplemental-review-audit.json`이다.
- Claude 최종 판정은 **PASS**. 문항별 필수 입력 게이트, 순차 진행, 응답 누적, 마지막 DCT feedback의 저장 호출을 근거로 정상 UI에서 미완성 MJT가 저장 serializer에 도달하는 경로는 입증되지 않았다고 판단했다. Codex는 이 제한된 정적 호출경로 결론을 수용했다. 실제 blocker/severity는 없음이며 완전한 runtime 저장 E2E를 수행했다는 뜻은 아니다.
- **기각한 설명 1건:** Claude는 serializer의 ZodError가 `persistPendingAttempt`의 catch에 잡힌다고 썼지만, 실제 `buildRuntimeMpjTraces` 호출은 `finishQuest`의 `saveInput` 생성 중(line 2346), `persistPendingAttempt` 호출(line 2361)보다 먼저 발생한다. 따라서 해당 catch 설명과 이를 포함한 ‘3중 방어’ 표현은 채택하지 않는다. 이것만으로 정상 UI 도달 경로가 증명되지는 않으므로 앱 코드를 변경하거나 validator를 완화하지 않았다.
- 제품 코드·테스트 추가 변경 없음. 기존 관련 Vitest 153개, PostgreSQL/Edge 35개, 최신 main 기반 통합본 943 pass/9 skip 및 타입 검사·production build 통과 결과를 재사용했다. 근거 없는 검사 반복 없음.
- 로컬 독립 검토 게이트는 완료했다. 다음 권고는 사용자 운영 게이트 승인 후 정식 main/CI/배포 계보 절차에 따라 최소 migration·필요 Edge/웹 반영과 승인된 3건 정상 E2E를 수행하는 것이다. 운영 CHECK는 여전히 v1~v5이며 운영 적용·candidate 승인·편성 변경·실제 attempt 저장은 하지 않았다. **운영 E2E 0/3, MJT2 scale_code+reason_id / MJT4 revised_text / MJT5 candidate_band_codes DB 재조회 미검증**을 유지한다.
