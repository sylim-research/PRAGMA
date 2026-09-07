# TTS 생성 속도 0.9 통일 · 2026-09-08

- [단독 진행 적합] 사용자가 기존 감속 음성이 어색하다고 보고하고 한국어·중국어 모든 수준을 0.9로 지정했다.
- `ttsVoicePolicy.ts`의 공통 속도를 0.9로 변경했다. 기존 Voice ID, 모델, 음색 설정, 휴지 지시는 변경하지 않았다. 같은 정책을 사용하는 OpenAI 대체 음성에도 적용된다.
- `npm.cmd test -- src/lib/ttsVoicePolicy.test.ts`: 12 tests 통과. 양 언어의 세 수준별 ElevenLabs 요청, OpenAI 대체 요청과 실패 처리를 확인했다. `git diff --check` 통과.
- 실제 음성 생성·청취는 실행하지 않았으며 자연스러움 개선을 검증한 결과는 아니다.
- 초기 작업 위치: `.worktrees/astra-background-generation-2026-09-07`. 사용자의 후속 배포 요청으로 최신 main `6b5eaa15` 기반 clean worktree `.worktrees/tts-speed-09-2026-09-08`에 이번 변경만 옮겼다. 기존 미커밋 실험 자료는 유지했다.
- 운영 반영 절차: PR 필수 전체 CI·운영 build 통과 후 main 병합, Supabase TTS 배포·운영 소스 확인. 배포 전 TTS v14 ACTIVE를 조회했다. 최종 배포 결과는 PR과 배포 기록에 남긴다.
- 연구 기록: `03_iteration_log.md`의 `ITER-20260908-01`.

[논문 영향 3줄]
1. 수치: 로컬 TTS 속도 0.9 통일, 관련 12 tests 통과, 운영 미반영.
2. 화면: 없음.
3. 프롬프트·계약: 없음. 음성 생성 속도만 변경.
