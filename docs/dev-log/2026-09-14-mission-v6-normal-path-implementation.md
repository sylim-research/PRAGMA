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

