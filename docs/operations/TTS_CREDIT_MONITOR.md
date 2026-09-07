# TTS 크레딧 사전 점검

관리자만 조회하는 GET /functions/v1/tts?action=usage가 ElevenLabs의 실제 구독 사용량을 읽는다.
ELEVENLABS_API_KEY는 Supabase secret에 두며 Text to Speech 및 User 읽기 권한을 부여한다.
사용량 조회는 합성 요청을 만들지 않는다. 비밀값이나 청구서·계정 식별자는 반환하지 않는다.

Node 22 이상에서:

```powershell
node scripts/check-tts-credits.mjs --env-file "로컬 환경파일 절대경로" --state-file "비공개 잔량기록 절대경로"
```

환경파일의 VITE_SUPABASE_URL·VITE_SUPABASE_PUBLISHABLE_KEY와
PRAGMA_ADMIN_EMAIL·PRAGMA_ADMIN_PASSWORD(또는 기존 PRAGMA_BATCH_ADMIN_* 값)를 사용한다.
키·로그인 값을 명령줄에 직접 넣거나 출력하지 않는다.

- remaining 50% 이하: 미리 구독/용량 판단. 20% 이하: 긴급 확인.
- 같은 주기의 실제 관측으로 갱신 전 7일 안에 소진 예상: 잔량 50% 이상이어도 사전 경고.
- 최초 표본·6시간 미만 관측·갱신/등급 변경: 사용 속도를 추측하지 않는다.
- monitor_unavailable: 잔량 0으로 간주하지 않는다. 접근·권한 문제를 알린다.
- 전환 필요 여부를 알릴 뿐 결제하지 않는다. Starter 이상 여부도 수업 예정 사용량과 비교한다.

Codex는 이 작업의 로컬 heartbeat로 09:00·21:00 점검한다. 정상·동일 상태는 조용히 유지하고
새 경고 또는 악화·접근 실패만 알린다. 로컬 호스트가 실행 불가능하면 그 동안 점검을 보장하지 못한다.
수업 직전에는 위 명령을 별도로 실행하고 예상 글자 수 × 미션 수 × 인원 × 재생 횟수를 비교한다.
