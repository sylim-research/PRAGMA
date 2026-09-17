# 2026-09-17 · mission_v6를 9화행으로 여는 스키마·런타임 확장

## 배경
- request 대표 3건의 E2E가 3/3으로 닫혔다(로그 `d595bc5f`·`404318c6`·`16b4593e`). 그 전에는 확장 코드에 손대지 않기로 한 조건이 해제됐다.
- 이번 변경은 **형식과 배선만**이다. 새 콘텐츠 생성, 계약 문서 개정, DB migration, 편성은 포함하지 않는다.

## 재고 실측 (읽기 전용, 운영 DB)
`mission_status`가 있는 scenario 371행 기준, 화행별 `reviewed` v5 저장본:

| 화행 | reviewed | 화행 | reviewed |
|---|---|---|---|
| agreement | 8 | proposal | 8 |
| apology | 8 | refusal | 7 |
| complaint | 8 | thanks | 8 |
| compliment | 8 | opposition | 7 |

request는 v5 reviewed 16 + v6 reviewed 6이다. 재고가 없는 화행이 0이므로 v5 저장본 변환 경로만으로
화행당 편성 목표 6건을 채울 수 있고, v6 생성 프롬프트 신설은 이번 범위에서 필요하지 않다.
이 수치는 저장본 수이며 변환 결과의 내용 타당성을 뜻하지 않는다.

## 확장 전 기준점
reviewed v6 6건의 구조를 먼저 읽어 고정했다. 6건 모두 `request` · feature
`request_mitigation_optionality@1.1` · 대역 코드 `appropriate`(카탈로그의 `within_band` 자리) ·
문항 id 1~5 · 문항에 `preceding_turn` 없음 · DCT `preceding_turn` null · 힌트 2개로 동일하다.

## 변경

| 파일 | 변경 |
|---|---|
| `src/lib/pragma/missionV6.ts` | `speech_act`를 `literal("request")`에서 9화행 enum으로. 대역 코드는 고정 3값 enum 대신 미션의 feature 기준으로 검증. feature는 카탈로그가 그 화행에 준 것만 허용. 장면에 `preceding_turn` optional 추가. |
| `src/lib/mission/canonicalMissionRuntime.ts` | v6 MJT5 선택지가 요청 대역(`too_direct`·`appropriate`·`too_indirect`)으로 하드코딩돼 있던 것을 카탈로그 `band_schema`에서 읽도록 교체. |
| `src/lib/mission/missionV6Responses.ts` | 학습자 판단 대역을 그 미션 feature의 대역으로 검증. |

- **요청의 `appropriate`는 명시적 동결 예외로 남긴다.** 승인된 request 행이 그 코드를 저장하고 있어
  계속 파싱돼야 한다. 나머지 8화행은 카탈로그 코드를 그대로 쓴다. 두 체계를 통합하지 않았다.
- **응답류 `preceding_turn` 의무는 refusal·opposition만** 유지했다. agreement·compliment 대응으로
  넓히지 않았다.
- 화면 문구는 요청에서 바뀌지 않는다. 카탈로그에서 읽은 뒤에도 요청 선택지는
  `너무 직접적 / 상황에 맞음 / 지나치게 우회적`로 동일하며, 테스트가 이를 고정한다.

## 검증
- `npm run typecheck` 통과.
- 전체 vitest 1003 passed · 9 skipped · 실패 0. 기존 v6 테스트 34건은 수정 없이 통과한다.
- 추가한 테스트 4건: 감사 화행 미션이 자기 대역으로 통과 · 요청 예외가 다른 화행에 새지 않음 ·
  다른 화행 대역/그 화행이 갖지 않은 feature/9화행 밖 화행 거부 · refusal은 선행 발화가 있어야 통과 ·
  MJT5 선택지가 카탈로그에서 나오되 요청 화면은 그대로 · 학습자 판단이 미션 대역으로 검증됨.
- 운영 DB·콘텐츠·편성은 읽기만 했고 쓰지 않았다.

## 남은 것 (이 커밋 범위 밖)
- v5 저장본 → v6 변환의 실제 수행. 대표 3건은 자동 변환기가 아니라 사람이 검토한 개별 작업이었다.
- 생성계약 v6 절과 규칙 카탈로그·결정 기록 갱신은 승인 사항이라 하지 않았다.
- 화행별 변환본의 내용 판정, 교수자 승인, 편성.
