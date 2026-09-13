# 대표 1건 자유교정 learner UX 체험

- 범위: 사용자가 승인한 localhost 대표 1건. production-ready 기능·생성기 전면 수정으로 확대하지 않는다. [단독 진행 적합].
- 기준: 원격 main으로 확인했던 `54a868d10ca9fb6cf967c875f4aa3bcddccd2961`. 기존 D checkout `4b1add30`와 미커밋 문서는 수정하지 않았다.
- 작업공간: `C:/Users/cnkr/.codex/worktrees/a980/l2-pragmatic-translator/.tmp/learner-ux`, branch `codex/learner-free-correction-pilot-2026-09-14`.
- 정본 탐색: 앱 `docs/CANONICAL.md`와 논문 `01_정본/00_정본목록.md`의 세 정본 경로가 일치한다. 정본의 기존 reason/공통 장면 계약을 이번 실험안으로 변경하지 않았다.

## 구현

- 기존 실제 learner route `/learner/practice`와 `CanonicalMissionRunner`를 사용한다. 기존 DEV preview 진입에 `?preview=v5&pilot=free-correction`을 붙인 경우에만 수동 fixture를 선택한다. 실제 scenarioId가 있거나 production build이면 이 선택을 적용하지 않는다. Auth/RLS를 수정하지 않았다.
- `학교 × 요청`, 한국어→중국어, 중급 대표 1건. MJT1 팀플 파일 상기 → MJT2 교수 추천서 → MJT3 출석 확인 선택교정 → MJT4 리허설 시간 변경 자유교정 → MJT5 동아리 포스터 후보별 판단 → 요약 → DCT 세미나실 이용 가능 여부 문의.
- 여섯 활동의 사건·원문은 각각 독립이다. 첫 두 문항을 병렬 제시하거나 relation pair를 복원하지 않는다. 문항 번호별 오류 방향이나 후보의 대역 비율을 생성 규칙으로 만들지 않았다.
- 자유교정: 상황/원문/번역 → 초기 판단 → 출발 번역이 채워진 입력란에서 부분 수정 → 제출 → 서로 다른 참고 표현 2개와 해설 → 다음 문항. 비어 있지 않은 입력만 요구하며, 모범답안 일치·맞음/틀림 자동 판정·AI 호출은 없다. 초기 판단도 정오 판정하지 않는다.
- MJT5: 후보 4개를 각각 3대역에 독립 배치한다. 같은 대역 선택과 복수 적절을 허용하며, 제출 뒤 참고 위치·해설을 보여준다.
- DCT는 별도 새 원문에서 빈 입력란으로 시작한다. 이번 fixture에서는 작성된 참고 표현을 확인하고 최종안을 확정한다. 기존 preview의 합성 평가와 실제 모델 평가를 모두 호출하지 않으며, AI를 사용하지 않는 체험임을 표시한다.
- 의미 변경 비권장안을 사용한 경우 원문의 확인/가능 여부와 후보의 변경 요구/수락 전제를 해설에서 구분한다. 이를 실증된 한국어권 학습자 빈번 오류로 주장하지 않는다. 콘텐츠는 교육적으로 구성한 UX 초안이며 최종 품질 승인/동결본이 아니다.
- 최소 저장: 다음 단계로 넘긴 응답·단계와 DCT 최초안/최종안을 전용 `sessionStorage` 키에 보관한다. 새로고침 시 완료 단계만 이어가며, 입력 중 초안·다른 탭/기기·서버 저장·교수자 검토 lifecycle은 구현하지 않았다. 완료 화면에서 자유교정 원문 응답을 펼쳐 볼 수 있다.
- `free_correction`/`spectrum`은 화면 view model의 fixture 지원이다. `mission_v5` Zod 계약, DB migration/validation, 기존 reason 응답 필드, 생성기·critic·evaluator, 승인 콘텐츠·provenance는 변경하지 않았다.

## 변경 파일

- `src/lib/mission/canonicalMissionPreview.ts`: 로컬 화면 타입 2개와 선택적 다음 버튼 문구.
- `src/lib/mission/learnerUxPilot.ts`: 대표 1건의 수동 콘텐츠.
- `src/pages/learner/CanonicalMissionRun.tsx`: 기존 러너에 로컬 흐름·정적 DCT 참고 화면·탭 내 보관 연결.
- `src/pages/learner/CanonicalMissionRun.pilot.test.tsx`: 실제 페이지 컴포넌트의 순차 진행과 외부 호출 부재 검증.
- `scripts/serve-learner-ux-pilot.mjs`: `127.0.0.1:8081` 전용 실행. 클라이언트 초기화에 가짜 로컬 값을 쓰며 실제 `.env`/자격증명을 읽지 않는다.
- 이 dev-log.

## 검증

- `npm run typecheck` 통과.
- 관련 4파일 30 tests 통과: pilot 1, runtime 15, connections 7, canonicalMissionRuntime 7. 기존 live demo의 번역/통역·저장/피드백 흐름 회귀 포함. 실제 외부 호출은 모의 처리한다.
- 새 통합 테스트: 여섯 독립 장면/원문, 빈 자유교정 제출 차단, 참고 표현과 다른 수정안 보존, 초기 판단과 무관한 진행, 제출 전 참고 표현 비노출, 후보별 네 응답, 최소 재진입, 새 DCT 최초안/최종안 분리, 재시작 초기화. fixture 수행에서 mission fetch/AI feedback/DB save/events 호출 0을 확인했다.
- 초기 테스트는 샌드박스의 esbuild 경로 접근 제한으로 시작되지 않았다. 승인된 로컬 실행 후에는 클라이언트 초기화용 URL 미지정으로 3 suite가 수집 단계에서 실패했다. 실제 자격증명을 찾지 않고 가짜 로컬 환경값을 지정해 최종 30/30 통과했다. 앱 동작 결함을 테스트 완화로 숨긴 것이 아니다.
- 브라우저: localhost 실제 learner route에서 안내→MJT1→2→3→4→5→요약→독립 DCT→참고 표현/최종안→완료를 직접 수행했다. 자유교정에 참고 표현과 다른 `明天我下课比较晚，大家方便把彩排从七点推迟到七点半吗？`를 입력하고, 제출 후 그대로 유지되는 것을 확인했다.
- 브라우저 완료 화면 새로고침 뒤 자유교정 답안·DCT 최초안/최종안 유지 확인. 새 탭 브라우저 console error 0. 자유교정 제출 후 화면을 스크린샷으로 시각 확인했다. 전체 운영 E2E, 모바일 전수 검사, 실모델 평가, DB round-trip은 수행하지 않았다.
- `git diff --check` 통과. 기존 D 작업공간의 dirty 목록은 작업 전후 동일하다. 생성계약·research-trail은 사용자 체험/후속 결정 전 반영하지 않는다.

## 실행과 한계

- 실행: 이 작업공간에서 `node scripts/serve-learner-ux-pilot.mjs`.
- URL: `http://127.0.0.1:8081/learner/practice?preview=v5&pilot=free-correction`.
- 이 환경에서는 Vite가 의존성 경로를 읽도록 sandbox 밖 로컬 실행이 필요했다. 서버는 loopback에만 바인딩한다. 실제 Supabase 구성 복구나 Edge 배포는 하지 않았다.
- localhost 체험 범위의 남은 blocker 없음. 교수자 검토, 전체 복원, 생성·승인·편성 연결은 이번 완료 기준이 아니며 자동 후속 작업으로 만들지 않는다. UX 개선 효과·학습효과를 검증한 결과도 아니다.
- 로컬 커밋까지만 진행. push·PR·main 병합·Railway/Edge 배포 없음.

[논문 영향 3줄]
1. 수치: 관련 테스트 30/30 통과. 운영 버전·배포 상태 변화 없음.
2. 화면: localhost 대표 1건의 자유교정·후보별 판단·정적 참고 표현 체험 화면 추가.
3. 프롬프트·계약: 변경 없음. 정본 동기화·동결본 재발행 없음.
