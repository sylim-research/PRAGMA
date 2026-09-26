# DCT 수정안 AI 재확인 1회

- 출발점: `codex/parcel-capture-ui-terms` / `c6ea1580`. 연구자가 기존 문구 보정과 별도로 요청한 국소 runtime 개선이다. 단독 진행 적합. 관리자 요약 문구 브랜치 `codex/admin-capture-wording`의 `7c49f8d7`은 별도로 보존했으며 통합·배포하지 않았다.
- 문제: 기존 requestFeedback은 최초 산출 A만 받고, 수정안 B는 재확인 없이 revised_response로 확정됐다. A에 대한 피드백이 B에 대한 검토를 입증하지 못했다.
- 변경: 기존 `requestFeedback → generate-scenario/action:feedback → normalizeFeedbackResponse → evaluationFromRuntimeFeedback` 경로를 B에 한 번 재사용한다. 수정 직후 버튼은 `수정안 다시 확인하기`, 다음 화면은 같은 카드·loading·unavailable 처리의 `수정안 AI 피드백`이다. B를 최종 편집란에 유지하고 마지막 C를 직접 확정한다. 2차가 수정 권고이거나 실패해도 AI 성공을 최종 결정 조건으로 삼지 않는다. 추가 편집에는 세 번째 피드백을 실행하지 않는다고 안내한다.
- 유지 branch는 기존 이견/판단 이유 및 최초안 확정을 유지하며 1회만 호출한다. 참고 표현은 기존대로 최종 확정 이후에 표시한다. 중간 B와 최종 C를 같은 텍스트라고 가정하지 않는다.
- 호출 제한: 수행별 두 슬롯(1/2), 같은 슬롯의 Promise 재사용, 동기 ref·loading guard로 StrictMode effect 재실행/중복 클릭/실패 재시도를 막는다. 같은 탭에서 새로고침해도 sessionStorage의 사용 슬롯·결과를 재사용하며 중단된 요청은 재호출하지 않고 unavailable로 진행한다. 새 수행에는 새 attempt ID를 사용한다. 브라우저 저장소가 불가능한 경우 현재 수행의 메모리 제한은 유지하지만 새로고침을 넘는 제한은 보장하지 못한다. 서버 전체의 사용자별 분산 quota를 새로 만든 것은 아니다.
- 서버의 기존 feedback action은 400/404 때 다른 모델로 자동 재호출한다. 초기 커밋 `46e74de6`은 학습자 회차 제한을 공급자 호출 제한으로 넓게 해석해 이 fallback을 제거했으나, 연구자 정정에 따라 기존 동작으로 복원했다(아래 후속 기록). 내부 failover는 같은 학습자 피드백 회차에 포함된다. 주 모델·프롬프트·parser·평가 축/범위·API 입력·응답 schema는 유지한다.

## 저장 및 하위 호환

- 기존 완료 로그 `first_response=A`, `revised_response=C`, `target_feature_observed=1차 feedback_v1`을 그대로 유지한다. 1차 provenance를 2차로 덮어쓰지 않는다. `SaveAttemptInput`, 행 serializer, 조회 함수는 변경하지 않았다.
- 기존 `learner_mission_events`의 `feedback_received` 이벤트와 object형 `event_payload`를 사용한다. 기존 feedback_available/revision_scope에 `feedback_rounds` 배열을 추가하여 각 `{round:1|2, answer:A|B, result:{ok, feedback?, error?}}`를 기록한다. 성공 feedback은 기존 feedback_v1 전체를 담으며 실패도 입력·회차를 보존한다. 기존 RPC는 JSON object를 그대로 저장하므로 새 table/column/migration이 필요 없다(`20260814214000_learner_mission_events.sql`, `20260829183000_scope_lock_attempt_lineage.sql`).
- 이벤트는 기존 정책대로 최종 결정 시 기록하고, 연구 동의·인증·서버 저장 성공 조건을 따른다. 완료 로그와 원자적으로 묶이지 않은 기존 best-effort 이벤트 경로이므로 **이벤트 저장 실패/비동의/데모에서는 2차 피드백의 DB 영속화를 보장하지 않는다**. 일반 학습 기록 조회는 기존 A/C만 표시하며 새 피드백 이력 UI를 만들지 않았다. 실패 시 완료 로그의 A/C 저장을 막지 않는다.
- mission_content·source_text·MJT 후보/해설/lesson_points·reference_alternatives·DB/schema 변경 없음. 승인 hash `bbf072ba4a7a09cf22bd99992d9ba18709d80b09fed9f2701820eb28d3d11095`의 콘텐츠를 수정하지 않았다. mock의 해시 전달 검사는 운영 콘텐츠 재해시 검증이 아니다.

## 검증과 논문 범위

- 초기 `46e74de6`의 신규 focused 6개 통과: 유지+이견+1회 호출+기존 저장, 수정 B 성공/실패 각각의 2회 호출·B payload·최종 C·참고 표현 지연 공개·1차 provenance/이벤트 보존, 중복/3차 방지·동일 탭 복구, 전송 예외/중단 재호출 방지, Edge action의 단일 공급자 호출 정적 검사. 마지막 정적 검사는 회차와 내부 호출을 혼동한 요구여서 아래 후속 검사로 교체했다.
- 기존 영향 검사 4개 통과: v6 수행·최종 저장, 기존 demo fixture의 두 mode 분기(추가 콘텐츠 조사/수정 없음), 저장 재시도 동일 PK. 총 **10개 서로 다른 focused 사례 통과**, 앱 typecheck 통과. 출력 필터로 미선택된 missionLogFilter 검사는 실행 수에 포함하지 않는다.
- 개발 중 새 테스트 준비에 provenance 누락 및 v6와 맞지 않는 개발 점프 응답이 있어 실패했다. 테스트 fixture를 초기화하고 정상 runner 경로로 전환한 뒤 통과했다. 이를 제품·콘텐츠 결함으로 판정하거나 개발 점프를 수정하지 않았다.
- 실제 유료 AI·DB 쓰기·운영 E2E·전체 테스트·push/deploy 없음. 기존 최초산출→피드백→재검토→최종결정의 상위 철학은 유지하며 재검토 내부에 수정안 대상 1회 재확인을 추가했다. 4.3.4에는 A/B/C의 구분과 2회 제한, 실패 시 직접 결정, 2차 이후 편집 미평가를 설명할 수 있다. 이 구현·mock 근거를 학습효과 또는 새 운영 종단 완료 증거로 확대하지 않는다.

## 후속 정정 — 내부 fallback과 학습자 회차 분리

- `46e74de6` 이전의 공용 `action === 'feedback'`을 그대로 복원했다. 주 모델의 HTTP 400/404 오류에만 기존 대체 모델 호출·fallback telemetry를 적용하며, 성공 결과의 model provenance와 최종 실패 응답도 기존 처리를 따른다. 서버 파일은 해당 커밋 부모와 차이가 없다. 새 failover 정책을 추가하지 않았다.
- 유지 branch는 학습자 피드백 최대 1회, 수정 branch는 A/B 최대 2회다. 클라이언트 슬롯은 `requestFeedback` 요청·결과를 회차별로 보관하고, 서버 내부 primary/fallback은 하나의 응답으로 돌아온다. 내부 `invocationAttempt: 2`는 학습자 round 2를 뜻하지 않는다. C의 3차 피드백 금지·추가 편집 안내·실패 후 직접 확정·최종 확정 후 참고 표현 공개·1차 provenance·기존 이벤트 기록은 그대로다.
- focused **7개 통과**: `dctFeedbackSession.test.ts` 4개(기존 2개와 HTTP 400/404 fallback 2개), `CanonicalMissionRun.recheck.test.tsx` 3개(유지, 수정 성공, 수정 실패). 실제 서버 action의 호출 구간을 mock 공급자로 실행해 내부 4호출/A·B 2회차, B 입력 유지, 중복·3차 방지를 확인했다. UI 검사는 1회/2회 분기, 실패 후 최종 C 저장, 참고 표현 공개 시점 및 기존 저장·이벤트 매핑을 확인했다. `npm run typecheck` 통과.
- 첫 테스트 시작은 샌드박스의 경로 접근 제한으로 차단됐다. 권한 확장 후 세션 검사 4개가 통과했고, UI 검사는 테스트용 Supabase 환경변수 누락으로 시작하지 못했다. 가짜 URL/key를 설정해 UI 파일만 실행하여 3개 통과했다. 실제 AI·DB 호출·전체 E2E·push/deploy는 실행하지 않았다.
- mission_content·승인 hash·DB/schema/API 계약 변경 없음. 콘텐츠 재해시나 운영 검증을 새로 수행한 것은 아니다. 연구 기록은 DEC-20260926-03과 EVD-20260926-03의 회차 의미 및 검증 근거만 보완했다.

## 배포 승인 후 통합

- 연구자가 로컬 확인 후 배포를 승인했다. 단독 진행 적합: 기존 검증된 국소 변경의 통합이며, 추가 AI 검토·유료 호출·콘텐츠 수정은 하지 않는다.
- 최신 `origin/main` `011874cb1481156469b5dd82421a94fb53b82102`에서 별도 clean worktree/`codex/parcel-recheck-release-20260926`을 만들고 로컬 브랜치를 merge했다. 포함 대상: `489fd8aa`, `376be3a3`, `075a3e4d`, `0c4f9553`, `c6ea1580`, `46e74de6`, `22f877fb`.
- `AdminAssembly.tsx`의 문구 충돌 두 곳은 main의 `초안 생성 중`·`자동 품질 점검 중`과 로컬의 `AI 검토 의견 저장`·품질 점검 단계 확인 안내를 함께 보존했다. 실제 이동 없는 이동 완료 안내를 되살리지 않았다. 관리자 구조·API·데이터 변경 없음.
- 공용 feedback 서버는 main과 차이가 없어 Edge 재배포 대상이 아니다. 프런트엔드 변경만 GitHub PR의 필수 CI(typecheck·전체 테스트·production build 등)를 통과한 뒤 main 트리거로 배포한다. 기존 focused test를 별도로 반복하지 않는다. PR/CI/배포 SHA 및 운영 반영 결과는 후속 완료 기록으로 구분한다.
- PR #248 최초 CI `36241679792`: typecheck 통과, 테스트 1,057 passed / 4 failed / 9 skipped. 실패 네 건은 공유 화면의 옛 `정답입니다`·`정답`·`수정안 확정하기`와 main에서 바뀐 `미션 자동 생성` 버튼을 반영하지 못한 테스트 기대값이었다. 세 테스트 파일의 문자열만 현행 UI에 정렬하고 제품 코드는 추가 수정하지 않았다. 해당 네 건만 로컬 재실행하여 4 passed / 21 filtered out을 확인했다.
