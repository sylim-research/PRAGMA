# mission_v6 MJT2 판단 재검토 허용과 교수자 검토 반영 3건

- 날짜: 2026-09-15
- 작업공간: `.worktrees/v6-reason-revise-2026-09-15`, branch `claude/v6-reason-revise-2026-09-15`, base `7f06ae8a`
- 계기: 대표 v6 E2E candidate의 교수자 체험 검토(case 1 `e2a6d8a4`, case 2 교체본 `1216e715`)에서 반복된 수정 요청. 사용자가 네 변경을 확정했다.
- 결정: DEC-20260915-01 / ITER-20260915-01

## 1. MJT2 — 이유를 본 뒤 판단 수정 허용

| | 이전 | 이후 |
| --- | --- | --- |
| 흐름 | 최초 판단 → 확정·잠금 → 이유 1개 → 피드백 | 최초 판단 → 확정 → 이유 1개 → (원하면) 판단 수정 → 피드백 |
| 화면 | 확정 후 고른 척도만 비활성으로 남음 | 이유를 고르면 네 척도가 다시 열리고 「이유를 살펴본 뒤 생각이 달라졌다면 위에서 판단을 바꿀 수 있습니다.」 안내 |
| 저장 | `scale_code`, `reason_id` | `scale_code`(최초, 덮어쓰지 않음), `reason_id`, `revised_scale_code`(바꾼 경우에만) |

- 수정은 선택이다. 그대로 두거나 다른 척도를 눌렀다가 원래로 돌아오면 `revised_scale_code`를 저장하지 않는다.
- 필요할 때의 최종 판단 해석: `revised_scale_code ?? scale_code`.
- 검증: `revised_scale_code`는 이유 선택지가 있는 v6 MJT2에만, 최초 판단과 다른 기존 척도 코드일 때만 허용한다(동일값·미지 코드·이유 없는 미션은 저장 전에 거부).
- 교수자 학생-화면 미리보기는 같은 `ScaleView`를 쓰므로 같은 흐름이다.
- 하위 호환: 필드는 optional이다. 기존 v5·v6 응답, JSONB 구조, DB·migration은 바꾸지 않았다. 응답 키를 검사하는 DB 함수·CHECK는 없음을 확인했다.
- 해석 경계: 관찰 가능한 것은 최초 판단·이유 선택·판단 유지/변경 패턴이다. 학습효과·성찰 효과·메타화용 능력 향상을 주장하지 않는다.

## 2. 장면 도입 — v6는 특정 장면 대신 흐름 안내

- 문제: 교수자 미리보기의 「장면 도입」이 DCT 상황(상대·관계·전달 방식)을 먼저 보여 줘, 이후 MJT1이 다른 장면일 때 앞 상황이 이어지는지 혼동을 줬다. 안내 문구에도 「학교생활 장면」이 고정돼 비즈니스·실무 교과목과 맞지 않았다.
- 변경: v6(`missionFormat === "mission_v6"`)에서는 도입에 DCT 상황 카드·상대·전달 방식을 표시하지 않고, 「다섯 문항을 마친 뒤 새로운 상황의 원문을 직접 옮기고, 피드백을 보고 내 최종안을 정합니다」로 흐름만 안내한다. 연습 설명의 「학교생활」은 「매번 다른 상황에서」로 바꿨다.
- 참고: v6 학습자 경로는 원래 도입 단계를 건너뛰고 MJT1 머리글의 중립 안내로 시작한다. 이번 변경은 그 흐름과 미리보기를 맞춘 것이다. v5 도입은 그대로다.

## 3. 문항별 핵심 — 실제 표현과 연결 (콘텐츠)

- 대표 candidate 3건의 `lesson_points` 5개 모두에 해당 문항의 실제 표현(「…」)과 짧은 대조를 넣었다. 특정 표현을 유일한 정답으로 두지 않는다.
- 콘텐츠가 바뀌므로 기존 candidate·교수자 검토 기록은 보존하고, 수정본을 새 candidate로 준비한다(교수자 판정 승계 없음). 앱 코드 변경 아님.

## 4. DCT 단어 힌트 — 모든 수준에 표시

- 이전: `supportLevel === "advanced"`이면 core에 힌트가 있어도 숨김.
- 이후: 수준과 무관하게 core의 기존 힌트를 최대 2개 표시(초급은 펼침, 중·고급은 「단어 힌트 보기」 접힘). 힌트가 없으면 표시하지 않으며 새로 만들지 않는다. 학습자 화면·교수자 미리보기가 같은 컴포넌트다.

## 5. 교수자 미리보기 DCT — 제출 후 멈춤 해소

- 증상: 교수자 최종 승인 화면의 학생 화면 미리보기에서 DCT를 제출하면 피드백으로 넘어가지 않았다.
- 경로 조사:
  - 학습자 경로(정상): `DctDraftView` 제출 → `finishQuest`가 `first`·`revised`를 응답에 보관하고 다음 문항으로 → `dct_feedback`의 `DctFeedbackView`가 `requestFeedback(runtime.mission, first)` 호출 → 다듬기 → 확정 시 `firstResponse`·`revisedResponse`·피드백으로 저장.
  - 교수자 미리보기(멈춤): `CanonicalReviewStage`의 dct 섹션은 초안만 보관하고 정적 「DCT 참고 표현·해설」만 표시했다. `dct_feedback` 단계를 렌더하지 않아 이후 흐름이 없었다. AI 호출·저장을 막으려는 의도였으나 흐름이 끊겼다.
- 수정: 미리보기에서 초안 제출 뒤 같은 `DctFeedbackView`를 기존 로컬 체험 모드(`LocalPilotContext`, AI 미실행·미리 작성한 확인 기준)로 렌더한다. 다듬기 → 확정까지 이어지고, 확정하면 첫 산출·확정 산출을 보여 주며 저장하지 않는다고 안내한다. 「실제 학습자 화면에서는 이 단계에서 AI 참고 피드백을 받습니다」 안내를 붙였다. 참고 표현·해설은 그대로 둔다.
- 새 evaluator·유료 호출·저장·상태 없음. 학습자 경로 동작과 DCT 저장 의미는 바꾸지 않았다.
- 회귀 테스트: 학습자 v6 실제 runtime에서 DCT 제출 → 피드백(실제 요청 호출) → 다듬기 → 최종 확정 → `firstResponse`·`revisedResponse`·MJT2 `revised_scale_code` 저장, 미리보기에서 DCT 제출 → 피드백 → 다듬기 → 최종 확정(AI 호출·저장·이벤트 없음). 두 경로의 단계 순서가 같다.

## 불변

MJT 5개, MJT3 선택지 3개, MJT5 후보 4개, REASON=MJT2, CONTRAST=MJT4, DCT 구조, `candidate_band_codes`·MJT4 `revised_text`·DCT first/revised 의미, 승인 semantics, DB·schema·migration·Edge, v5 응답.

## 검증

- 신규·수정 테스트: MJT2 최초 판단 유지·수정 저장·미수정 시 필드 없음·동일값/미지 코드/이유 없는 미션 거부·JSON round-trip, 학습자 흐름(수정·미수정), 교수자 미리보기 MJT2 수정, v6 도입에 DCT 상황 미노출, 중·고급 힌트 표시.
- `npm run typecheck` 통과. 전체 143 파일 통과·3 skip, 961 tests pass·9 skip. 변경 파일 ESLint 오류 0(`missionV6.test.ts`의 기존 `any` 12건은 main에 이미 있음). production build 성공(생성 파일은 되돌림).
- 로컬 브라우저(개발 전용 대표 v6 체험 경로): MJT2에서 매우 적절 → 확정 → 이유 선택 → 다소 부적절로 수정 → 「내 선택」이 다소 부적절에 표시, 저장 응답 `{ pick: very_appropriate, reasonId: request-and-deadline, revisedPick: somewhat_inappropriate }`, 콘솔 오류 0.
- 교수자 미리보기의 브라우저 확인(관리자 로그인 필요)과 고급 case 2의 项目·活动 힌트 표시는 배포 후 운영 관리자 화면에서 확인한다.
