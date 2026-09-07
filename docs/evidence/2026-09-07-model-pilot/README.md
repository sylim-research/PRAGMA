# 3미션 모델 파일럿 증거

- 읽을 결과: `comparison.html`, `summary.json`.
- 해석·방법·한계: `../../dev-log/2026-09-07-three-mission-model-pilot.md`.
- 고정 조건: `manifest.json`. 실제 계정 모델 조회: `availability.json`.
- 입력 일치·모델·검수 비용: `evidence-checks.json`.
- 원시 API 응답·사용량: 각 case-route 폴더의 `call-*-request.json`, `call-*-response.json`.
  요청 파일에는 프롬프트·모델 매개변수만 있고 인증 헤더는 기록하지 않았다.
- `call-*-uncertain.json`: 시간 초과로 사용량·과금이 미확정인 호출. 동일 호출을 재실행하지 않았다.
- `local-rpc-*.json`, `telemetry.jsonl`: 실제 DB 쓰기 대신 로컬에 보존한 이벤트다.
  임의 UUID는 실험의 로컬 식별자이며 운영 scenario_id가 아니다.
- `calls.jsonl`의 정수 call 번호는 작업 프로세스별 번호여서 중복될 수 있다.
  `case + route + requestFile` 또는 제공자 responseId로 구분한다.
- 장부의 requestFile은 실행 당시 tmp 절대 경로다. 이 보관본에서는 case-route 이하 같은 파일명으로 찾는다.
- 최초 요청 Fable 검수는 메타데이터 제거 전 실행이라 최종 비교에서 제외했다.
  `result.json.fableInitialUnblinded`와 최초 호출 파일에 보존되며, 최종 것은 `blind-review/`에 있다.
- `prepare.mjs`, `run.mjs`, `report.mjs`는 실험 재현용 어댑터 소스다. 자동 재실행하지 않는다.
  제공자 프롬프트·규칙은 기록된 저장소 소스에서 번들했다. 새 실행은 별도 실행 ID·승인 범위를 사용한다.
- 임시 Edge 함수는 삭제했다. 접근 토큰·실제 API 키·배포용 함수의 비밀 접근 hash는 이 보관본에 없다.

이 자료는 개발 과정의 파일럿 근거다. 교수자 승인·전체 화행 타당화·학습효과의 증거가 아니다.
