# 2026-11-19 · HSK 어휘 대조에 분절 보정(v2) 추가

결정: DEC-20261119-01 (research-trail/02_decision_log.md)

## 문제
- 어휘 대조는 ICU 단어 분절기(Intl.Segmenter)가 나눈 단어를 HSK 표제어와 그대로 맞춰 본다.
- 분절기가 두 단어를 하나로 묶으면(我只, 想把, 不在家) 또는 HSK가 표제어로 따로 싣지 않는 결합형이면(您好, 周五, 送到) 구성 단어가 모두 1~5급인데도 「목록 밖」으로 셌다.
- 예: 이웃 택배 보관 미션(요청·중급·한→중·번역) 98개 중 72개(73.5%). 목록 밖 26개 가운데 16개가 이런 결합형이었다.

## 바꾼 것
- 서버 공용 점검(`supabase/functions/_shared/hskLexicalAudit.ts`, 정책 `hsk3_lexical_reference_v2`)
  - 먼저 HSK 전 등급(1~9급)으로 조회해, 상한 안 단어와 「HSK 어디에도 표제어로 없는 단어」를 가른다.
  - 표제어가 아닌 단어만 HSK 표제어 사전으로 가장 긴 단어부터 다시 나눈다(`repairSegmentation`). 조각이 모두 상한 이하일 때만 목록 안으로 센다.
  - HSK에 어느 등급으로든 실린 단어(예: 保管 6급, 核实 7급)는 쪼개지 않는다.
  - `matched_token_count`·`coverage_ratio`는 보정값이다. 보정 전 값과 나눈 예는 `segmentation_repair`에 함께 남긴다.
- 교수자 화면 HSK 3.0 어휘 대조(`AdminCorpus.tsx`)
  - 승인된 미션의 `mission_content`는 바꿀 수 없으므로(`guard_content_review_scenario`), v1 기록은 저장값을 두고 화면에서 같은 규칙으로 보정한다(`hskAuditRepairOnRead.ts`, 읽기 전용 `hsk3_match_tokens` 조회).
  - 상세 카드에 「분절 보정 반영(화면 계산) · 결합형 N개 … (보정 전 X%)」 한 줄, 대조 방식 설명에 「보정」 한 줄을 더했다.
  - 저장 후보 목록이 40개에서 잘린 기록은 정확히 셀 수 없어 보정하지 않고 「분절 보정 전 기록」으로 둔다.
- 스키마: `HskLexicalAuditSchema`에 선택 필드 `segmentation_repair`.

## 바꾸지 않은 것
- 승인된 미션 내용과 저장된 v1 점검값(DB 쓰기 없음). 승인 불변 규칙.
- 분절기, 상한(입문 4급·중급 5급·고급 6급), 「목록 밖 = 수준 부적합 아님」 안내.
- 콘텐츠 해시: 점검값은 원래 해시에서 빠진다.

전후 자료: `docs/research-trail/evidence/2026-11-19-hsk-audit-segment-repair/README.md` (EVD-20261119-01), ITER-20261119-01.

## 검증
- `npm run typecheck` 통과.
- `hskLexicalAudit.edge.test.ts`(보정 2건 추가), `hskAuditRepairOnRead.test.ts`(2건), `hskAuditSnapshot.test.ts` 통과.
- `src/lib/pragma`·`src/lib/mission`·`src/lib/demo`·`src/pages/admin` 실행에서 9개 파일이 `supabaseUrl is required`로 실패. 변경 전 `origin/main`에서도 같다(환경 변수 없는 worktree).
- 같은 규칙의 브라우저 재계산(2026-11-19, 읽기 전용): 택배 미션 72→88/98(89.8%).
- 운영 화면 확인(2026-11-19, 병합·배포 뒤): 전체 75%→89%, 중급 88%·고급 90%, 상세 카드 보정 줄 표시.
- Edge `generate-scenario`·`content-review` 배포(2026-11-19, main `8cbd43c0`, 연구자 승인). 새 미션의 v2 저장은 다음 생성 때 확인 필요.

## 남은 일
- 새 미션이 v2(`segmentation_repair` 포함)로 저장되는지 다음 생성 때 확인.
- `hsk3_match_tokens`는 migration에서 service_role에만 실행 권한을 주지만, 운영 DB에서는 로그인한 교수자 계정으로도 실행된다(기본 권한으로 보임, 확인 필요). 화면 보정은 이 권한에 기댄다.
