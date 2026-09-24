# docs — 문서 안내

이 폴더에는 PRAGMA의 현행 규범 문서와 개발 과정의 기록이 함께 있습니다.
**현행 규범은 아래 「현행 정본」 세 파일뿐**이며, 나머지는 설계·개발 과정을 추적하기 위한 기록입니다.
기록 문서는 작성 당시의 판단을 그대로 보존하므로, 이후 결정으로 대체된 내용이 들어 있을 수 있습니다.

## 현행 정본

| 문서 | 내용 |
|---|---|
| [`CANONICAL.md`](CANONICAL.md) | 정본 경로와 대외·내부 용어 규칙 |
| [`contracts/PRAGMA_생성계약_정본.md`](contracts/PRAGMA_생성계약_정본.md) | 콘텐츠 생성·평가·저장 계약 |
| [`product/PRAGMA_학습자구조_정본.md`](product/PRAGMA_학습자구조_정본.md) | 학습자 워크플로우 구조 |
| [`product/PRAGMA_관리자구조_정본.md`](product/PRAGMA_관리자구조_정본.md) | 교수자(관리자) 운영 구조 |

## 설계·개발 기록

| 폴더 | 내용 | 지위 |
|---|---|---|
| [`research-trail/`](research-trail/) | 설계 추적(01)·결정 기록(02)·반복 개발 기록(03)·증거 색인(04)과 그 증거 파일 | 설계 연구의 주 기록 |
| [`dev-log/`](dev-log/) | 작업 단위별 개발 일지(날짜순) | 사실 기록 |
| [`evidence/`](evidence/) | 모델 실행 점검 결과 원자료(2026-09) | 증거 |
| [`research/`](research/) | 제품·연구 정체성, 화용 설계 원리, 화행 구인 지도(2026-07) | 설계 근거 문서 |
| [`handoff/`](handoff/) | 개발 도구 간 인계·점검 문서(2026-07~09) | 역사 자료 |
| [`prototypes/`](prototypes/) | 초기 화면 시안(정적 HTML) | 역사 자료 |
| [`contracts/history/`](contracts/history/) · [`product/history/`](product/history/) | 정본의 이전 판본 | 역사 자료 |

## 운영·참고

| 문서 | 내용 |
|---|---|
| [`ENUMS.md`](ENUMS.md) | 열거형 내부 키 정본 목록 |
| [`DEPLOY.md`](DEPLOY.md) | 초기 배포 준비 기록(2026-07, 역사 자료) |
| [`MIGRATION_AUDIT.md`](MIGRATION_AUDIT.md) | DB 마이그레이션 감사(2026-07 시점, 역사 자료) |
| [`operations/`](operations/) | AI 교차 검토 절차, 콘텐츠 갱신 절차, 음성 합성 사용량 점검, 중→한 파일럿 평가 계획 |
| [`brand/`](brand/) · [`screenshots/`](screenshots/) | README용 배너와 화면 |

「역사 자료」는 현재 구현의 근거로 쓰지 않습니다. 현재 구현과 다를 때는 현행 정본과 코드·테스트를 기준으로 합니다.
