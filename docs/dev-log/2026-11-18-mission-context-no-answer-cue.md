# 2026-11-18 · 미션 생성 프롬프트: 학습자 안내문에 정답 방향을 쓰지 않는다

결정: DEC-20261118-02 (research-trail/02_decision_log.md)

## 바꾼 것 (`supabase/functions/_shared/missionV6Generation.ts`)
- 기존 규칙 「학습자가 읽는 상황문·관계문에 판정 기준어를 쓰지 않는다」의 대상에 안내문(`learner_context_ko`)을 더했다.
- `learner_context_ko` 정의를 새로 넣었다: 판단·번역 전에 읽는 장면 보충 한두 문장. 누가 누구에게 어떤 계기로, 관계, 아직 정해지지 않은 사실만 쓴다. 알맞은 표현·살릴 점·말하거나 옮길 방식은 쓰지 않는다(학습자가 판단할 답). 「~해 보세요」「~하는 것이 중요합니다」「~이 자연스럽습니다」로 끝내지 않는다.
- 3번 선택교정·5번 네 표현 비교: 적절한 후보만 의문형이거나 적절한 후보만 특정 표지를 갖지 않게 한다(문장 형식만으로 정답을 고를 수 있으면 판단 문항이 아니다).
- 프롬프트 버전 `mission_v6_generate_v4_under_band_fixchoice_20260921` → `mission_v6_generate_v5_context_no_answer_cue_20261118`.
- 생성 파일 재생성: `promptSnapshot.generated.ts`, `packReleaseManifest.generated.ts`(`npm run prompts:snapshot`).

## 발견 경위
2026-11-18 현행 파이프라인 재실행에서 생성한 미션 2개(층간소음 `a71cb636…`, 화보 미팅 연기 `ea5e30a5…`) 모두 GPT-6 Astra 품질 심사가 **안내문 6곳 전부**(MJT 1~5 + DCT)를 answer_cue로 지적했다. 예: 「명령조로 말하기보다는 의문형을 사용하여 정중하게 행동을 요청하는 것이 일반적입니다.」(층간소음 3번), 「…수정 가능 여부를 묻는 원문의 의도를 살려 번역해 보세요.」(화보 2번). 층간소음 3번은 적절 후보만 의문형이어서 안내문을 지워도 형식 단서가 남았다 — 2026-09-26 대표 미션 검토에서 사람이 고친 것과 같은 유형이다. 기존 프롬프트는 출력 형식에 `learner_context_ko` 칸만 두고 무엇을 쓰는 칸인지 정의하지 않았다.

## 바꾸지 않은 것
문항 구조·대역 규칙·화행별 제작 요령·출력 형식·스키마·검사 코드·DB. 이미 생성된 미션.

## 검증
- `npm run typecheck` 통과. `npm run prompts:verify` 통과.
- `src/lib/pragma` 테스트: 64 파일 통과, 7 파일은 작업 폴더에 Supabase 환경 변수가 없어 모듈 로드 단계에서 실패(`supabaseUrl is required`, 변경과 무관). CI에서 확인.
- Edge 배포 뒤 같은 시나리오(화보)로 미션을 다시 생성해 answer_cue 지적 수를 비교한다(결과 추가 예정).
