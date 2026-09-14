# mission_v6 · 대표 요청 후보의 REASON / CONTRAST

## 범위와 기준

- 사용자 승인: MJT2 이유 선택 1회, MJT4 피드백 contrast 최대 1회. 일반 저작 원칙은 DEC-20260914-03, 실제 콘텐츠 적용은 대표 요청 1건이다.
- 작업 위치: `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.tmp\request-course-pilot-20260914`.
- branch/HEAD: `codex/request-course-pilot-2026-09-14` / `8dd14fbe8bd9518a11142b8a5db2936c8dadaf5f`. 선행 v6 구현을 보존한 미커밋 변경이다.
- 동결 fixture `LEARNER_UX_PILOT`, 기존 `SAMPLE_MISSION_V6`, 공개 미션의 ID·내용을 덮어쓰지 않았다. 새 로컬 상수 `SAMPLE_MISSION_V6_REASON_CONTRAST`에만 추가했다.

## 이번 변경

| 파일 | 이번 추가 |
|---|---|
| `src/lib/pragma/missionV6.ts` | MJT2의 선택적 reason_choice, MJT4의 선택적 contrast. reason은 비어 있지 않은 후보 최소 2개·고유 ID, 대표 콘텐츠는 3개. 정답·taxonomy·band 제약 추가 없음 |
| `src/lib/mission/missionV6Sample.ts` | 추천서 요청의 이유 3개와 친한 조원에게 같은 일정 변경을 묻는 contrast 1개를 별도 후보로 작성 |
| `src/lib/mission/canonicalMissionPreview.ts`, `canonicalMissionRuntime.ts` | 기존 scale/free-correction 화면 모델에 선택적 필드 연결. v6 분기만 새 필드를 매핑 |
| `src/lib/mission/missionV6Responses.ts`, `missionAttemptRow.ts` | MJT2 reason_id 재사용. 콘텐츠에 이유가 있으면 실제 후보 ID 하나를 요구하고 미선택·외부 ID를 거부. 기존 v6는 이유 없이 저장 가능 |
| `src/pages/learner/CanonicalMissionRun.tsx` | 판단 확정→inline 이유→해설, 제출 후 contrast. 새 후보 프리뷰와 탭 임시 진행 키 분리. 로컬 AI 미실행 판정을 명시적 preview context로 전달 |
| `missionV6.test.ts`, `CanonicalMissionRun.reasonContrast.test.tsx`, `CanonicalMissionRun.runtime.test.tsx` | 새 계약·화면 검증과 선행 includeV6 조회 옵션에 대한 spy 기대값 동기화 |

DB/SQL·승인 parser·generator·집계·교수자 화면·새 evaluator·새 table/state 변경은 없다.
정상 runtime으로 이 후보를 승인·저장한 것으로 표시하지 않는다. 프리뷰에는 DB runtime을 전달하지 않는다.

## 저장 의미와 예

기존 러너의 reasonTrace는 `response.reasonId`를 `reason_id`에 그대로 기록한다.
즉 필드의 의미는 **학습자가 고른 이유 후보 ID**이며 정답 ID나 오류유형 코드가 아니다.
v6 MJT2도 같은 의미로 사용한다. mission version·item ID/type·해당 콘텐츠와 함께 해석한다.
기존 v4/v5의 reason_kind 매핑은 유지하고 v6에는 추가하지 않는다.

```json
{
  "item_id": 2,
  "item_type": "scale4",
  "completed_at": "2026-09-14T12:00:00.000Z",
  "scale_code": "very_appropriate",
  "reason_id": "request-and-deadline"
}
```

- 권장 척도와 다른 최초 판단, 중심 쟁점과 다른 이유도 선택한 그대로 보존한다. 4개 척도×3개 이유의 모든 조합을 검사했다.
- 응답은 기존 `mpj_response_v2 / mission_schema_version: mission_v6` envelope를 유지한다. MJT4 revised_text·MJT5 candidate_band_codes는 같은 매핑을 쓴다.
- attempt row를 JSON serialize/parse한 뒤 MJT2 값·MJT4 문자열·MJT5 후보 순서 배열이 같은지 확인했다. **DB 저장·재조회 검증은 아니다.**
- Contrast는 미션 콘텐츠에만 있다. 수행 응답·점수·추가 이벤트·저장 필드는 없다.
- 기존 v5 validation/rendering/response mapping 분기는 변경하지 않았다. 기존 v6와 새 후보를 서로 다른 콘텐츠로 취급하며 과거 응답에 reason을 백필하지 않는다.
- 기존 MJT4 UI는 `draft.trim()`을 제출값으로 넘긴다. 이 동작은 이번에 변경하지 않았다. serializer는 받은 문자열의 공백도 보존하지만 입력창의 앞뒤 공백까지 UI에서 보존한다고 주장하지 않는다.
- DB 응답→러너 화면 restore와 작성 중 draft 복구는 구현하지 않았다. 완료 단계의 기존 sessionStorage 복구만 후보별 키로 분리했다. 중도 이어하기를 운영 E2E의 선행 조건으로 추가하지 않는다.

## 화면 리듬

- 기존 localhost 경로를 이용한다: `/learner/practice?preview=v5&pilot=free-correction&variant=reason-contrast`. preview=v5는 기존 DEV 진입 토큰이며 실제 후보 format은 v6다. 정상 승인/auth 검증을 바꾸지 않았다.
- MJT2의 최초 판단 확정 전에는 이유·해설·수정 예시가 없다. 확정 후에는 선택한 척도 하나만 잠긴 상태로 남겨 이유 선택 공간을 확보한다.
- 이유 3개 중 하나를 선택·확인하면 그 선택만 한 줄로 남기고 기존 해설을 보여 준다. 별도 문항·화면 이동은 없으며 MJT 2/5를 유지한다.
- 비용은 **이유 선택 1회 + 확인 클릭 1회**다. 읽기 부담이 전혀 늘지 않는다는 뜻은 아니다.
- MJT4 contrast는 제출 후 기존 참고 표현 아래 한 블록이다. 친밀도만 달리하고 내일·수업 종료·7시→7시 반·변경 동의 요청을 유지했다. 추가 버튼은 없다.
- 실제 인앱 브라우저의 좁은 기본 화면에서 두 노출 시점과 배치를 확인했다. contrast까지 자연스럽게 스크롤할 수 있었고 문항 수는 유지됐다. 학습자 소요시간·흥미·효과 실측은 아니다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| missionV6.test.ts | 28 passed |
| missionAttemptRow.test.ts | 9 passed |
| canonicalMissionRuntime.test.ts | 7 passed |
| CanonicalMissionRun.runtime.test.tsx | 15 passed |
| CanonicalMissionRun.pilot.test.tsx | 1 passed |
| CanonicalMissionRun.reasonContrast.test.tsx | 1 passed |
| 합계 | **6 files, 61 passed** |
| npm run typecheck | passed |
| npm --ignore-scripts run build | 운영 모드 Vite bundle passed. 생성 스냅샷을 갱신하는 prebuild는 미실행 |
| localhost HTTP / 브라우저 | 127.0.0.1:8099 HTTP 200, MJT2와 MJT4 실제 UI 확인 |

- 테스트·프리뷰는 로컬 dummy Supabase URL/key를 사용했고 실제 운영 자격 증명을 사용하지 않았다. UI 통합 테스트에서 fetch/save/event/AI 함수 미호출을 확인했다.
- 처음 esbuild 설정 읽기가 Windows sandbox에 차단되어 해당 로컬 명령만 승인 재실행했다. 보안 설정·Vite fs allowlist는 수정하지 않았다.
- 최초 UI 검사 실패 2개는 분리 렌더된 해설의 text matcher와 선행 includeV6 옵션에 대한 옛 spy 기대값이었다. 테스트 기대값 수정 후 통과했다.
- 선행 보고서에서 Supabase 환경값 부재로 시작하지 못한 2개 UI 파일의 기록은 **environment-blocked / not executed** 그대로다. 이번 placeholder 환경의 별도 실행을 과거 결과로 소급하지 않는다.
- 빌드는 Browserslist 데이터 경과, CSS minifier 문법 경고, 큰 청크 경고를 출력했다. 종료 코드는 0이며 이번 범위에서 관련 설정·생성 결과를 수정하지 않았다.

## 남은 경계와 인수인계

**v6 설계/계약 채택 완료, 운영 E2E 0/3 및 runtime/DB 호환성 검증 미완료.**
이전 read-only blocker map의 정상 승인→released/reviewed→편성→load→저장 연결 문제는 그대로다.
운영 DB 재조회 시 MJT4·MJT5 원응답 보존은 아직 검증하지 않았다. 이번 결과로 60개 교체를 시작하지 않는다.

- `[독립 검토 필수]`: 핵심 response/content contract 변경이므로 운영 반영 전 이번 선택적 필드·reason_id 의미·v5 회귀 증거만 범위를 한정해 검토할 대상이다. 근거는 `docs/operations/AI_CROSS_REVIEW_PROTOCOL.md`. 로컬 구현·검증은 사용자 지시대로 완료했고 운영 반영은 하지 않았다.
- 정본 생성계약·학습자구조·CANONICAL 및 decision/evidence를 동기화했다. 논문 정본 목록의 세 앱 문서 경로도 일치했다.
- generator 프롬프트·동결 history를 재발행하지 않았다. 향후 정상 운영 연결·검토를 완료할 때 해당 이정표 발행을 판단한다.
