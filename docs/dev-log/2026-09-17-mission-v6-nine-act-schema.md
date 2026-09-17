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

## 정정 — 응답류의 preceding_turn

처음에 refusal·opposition은 `production_task.preceding_turn`이 있어야 통과하도록 썼다가 되돌렸다.
`missionRules.ts`의 R8은 반대로 **native MJT5가 preceding_turn을 쓰면 fail**이고
(`문항 N: native MJT5는 preceding_turn을 생성하지 않음`, `production_task: native MJT5는
preceding_turn을 사용하지 않음`), `missionConsistency.ts`도 「native 미션은 preceding_turn=null이
정식 설계다. 앞선 사건은 situation_ko 안에서 확인한다」로 적고 있다. 실측도 같다 — reviewed
refusal 저장본 6건 전부 `preceding_turn`이 null이다. 응답류의 의무는 코어(R8 코어 절)에 있고
미션에 있지 않다. 스키마는 이제 v6가 preceding_turn을 **들고 있으면** 거부한다.

## v5 → v6 변환 (`missionV5ToV6.ts`)

refusal 1건으로 변환 경로를 확인했다. 결과: **기계적 변환만으로는 끝나지 않는다.**

옮겨지는 것 — 판정·교정안·후보·대역·해설·장면·관계·PDR·채널·`unit`·DCT 전체.
v5의 `reason` 선택지는 v6 2번 문항의 이유 선택으로 그대로 옮겨 붙는다.
v6가 쓰지 않는 필드(`axis_feature`·`highlights`·`item_focus`·`recommended_example`·
`preceding_turn`·`contrast_plan`·`diagnostic_dimensions`)는 떨군다.

사람이 써야 하는 것 — **미션 1건당 29자리**:

| 자리 | 수 | 이유 |
|---|---|---|
| 문항 5개 × `short_label`·`title`·`prompt` | 15 | v6 화면 문구, v5에 대응 필드 없음 |
| 2번 `accepted_scale_codes`·`reference_scale_code`·`reason_choice.prompt` | 3 | judge3의 3대역과 4점 척도는 자가 다르다 |
| 4번 자유 교정 문항 전체(장면·관계·원문·대상·참고안·해설) | 6 | v5에 자유 교정 문항이 없다 |
| 문항별 핵심 5줄 | 5 | v5에 없다 |

즉 대표 3건이 자동 변환기가 아니라 개별 작업이었던 이유가 확인된다. 변환기는 옮길 수 있는
것을 옮기고 남은 자리를 경로와 이유로 보고하며, **내용을 지어내지 않는다.** 변환 결과가
스키마를 통과한다는 것은 형식이 맞다는 뜻일 뿐 학습 자료로 타당하다는 뜻이 아니다.

변환기를 쓰면서 저장본 실측으로 잡은 두 가지: v5 후보·교정안에 v6가 쓰지 않는 필드가 섞여
있을 수 있어 세 필드만 골라 옮긴다. `learning_goal`이 없는 옛 저장본은 화행을 따로 받는다.

## 29자리 → 17자리 (승인본 실측으로 규칙이 된 것)

reviewed v6 여섯 건을 대조하니 다음이 전부 같았다. 변환기가 규칙으로 채운다.
- 문항 짧은이름 5개(첫인상 판단·맥락 판단·선택교정·직접 고쳐 보기·네 표현 비교)와 지시문 5개,
  이유 질문 「가장 큰 이유는 무엇인가요?」.
- **2번 문항 척도**: 여섯 건 모두 기준 `somewhat_inappropriate` · 허용 +`very_inappropriate`.
  v5 native의 topology X→A→A→A→Y에서 2번(judge3)은 항상 within 밖 대역이라 결과가 같다.
  judge3가 within이면 1번과 같은 척도를 쓴다(현재 재고에는 없음).
- judge3의 `recommended_example`(target과 다를 때)은 2번의 `revision_examples`로, reason의
  해설은 judge3 해설 뒤에 이어 붙인다 — v6 2번은 판단과 이유를 한 화면에서 확인한다.

남는 집필 = **문항 제목 5 + 4번 자유 교정 문항 7(장면·관계·PDR·원문·대상·참고안·해설) + 핵심 5줄 = 17자리**
(+ 선택인 `learner_context_ko` 6). 대표 3건의 문항이 v5에서 온 것이 아니라 09-14 로컬 파일럿
(`learnerUxPilot.ts`)의 손으로 쓴 문항이었음을 확인했다 — 그쪽 「A」는 코어·DCT만 승계했고,
이번 변환기는 승인된 v5 문항 4/5까지 승계한다. 둘 다 새 생성 프롬프트 없이 가는 경로다.

## 파일럿 1 — 거절 · 중→한 · 중급 · 번역 (`ea0976f1`, c2 6주차 번역 슬롯)

- 입력 `tmp/v6-conversion/ea0976f1.v5.json`(저장본 그대로) + `ea0976f1.authored.json`(17자리 집필).
- `scripts/v6-assemble-candidate.mts`: 변환 → 집필분 덮기 → `authoring{ai_draft, lineage pending}` →
  승격 경로와 같은 방식의 `mission_content_hash` → MissionV6Schema → `checkMission`(v6 경로).
  결과 **스키마 pass · 규칙검사 pass · warning 0 · hash `5dca40d0…`**. 후보 `ea0976f1.v6.candidate.json`.
- 4번 문항은 새 장면(같은 과 선배 · 토요일 독서 모임 · 아르바이트 사정)이며 2번과 같은 축
  (too_blunt)을 다른 P에서 되짚는다. 판정·교정안·후보·대역·DCT는 v5 승인본 그대로다.
- **DB에는 쓰지 않았다.** 등록은 `scripts/register-v6-candidate.mjs`(관리자 계정 필요)가
  ① 원본 코어 행을 새 id로 복제(원본·편성 불변) ② edge `quality_check` ③ `save_generated_mission`
  순으로 하고, 규칙검사·최종검수·승인·편성은 관리자 화면의 기존 절차를 따른다.
- 집필분·후보 사본은 `Documents/pragma-v6-conversion/`에도 두었다(tmp/는 git 밖).

## 파일럿 2 — 거절 · 중→한 · 중급 · 통역 (`509589aa`, c2 6주차 통역 슬롯)

편성된 60슬롯을 실측하니 **통역 30/30이 옛 통역사 서술**(「학습자 통역사 C인 당신은 … 통역을
맡았습니다.」 + 인물 A·B)이고 번역은 0/30이다. 이 서술은 DEC-20260907-02로 폐지됐고 v5는 화면에서
`naturalLearnerScene`이 지운다. v6 새 행은 저장 내용이 검수 대상이므로 저장본을 깨끗하게 만든다.
- 변환기: 여는 문장이 정확히 그 형태일 때만 떼어 낸다(조사 손대지 않음). A·B가 남은 장면은
  「1인칭·역할명으로 다시 쓴다」 gap으로 보고한다. 판단 문항 지시문은 통역이면 「이 통역안은…」.
- 집필: 장면 6쌍(문항 5 + DCT)을 역할명 방식(통역사 없음)으로 다시 썼다 + 17자리.
  통역 1건의 집필은 번역보다 장면 6쌍만큼 더 든다.
- 결과 스키마 pass · 규칙검사 pass · warning 0 · hash `7e9e0838…`. `replay_limit` 2, 힌트 없음(통역 계약).
- 손대지 않은 것: MJT1의 target 「오늘은 안 되겠어요.」가 두 문장 원발화에 대해 very_appropriate로
  승인돼 있다. 변환은 판정을 옮기지 않으므로 품질 점검·교수자 검수에서 판단한다(`_note_for_review`).

## 발견 — 배포된 v6 품질 심사 프롬프트가 요청 화행으로 굳어 있다

`buildQualitySystemPrompt(..., isV6)`의 v6 머리글이 「mission_v6 **요청** 미션」이고 버전 id도
`quality_mission_v6_request_reason_contrast_v1`이다. 판정 축 자체는 요청 본문에 실어 보내는
feature 블록(대역 정본·조작적 정의)에서 오므로 거절 미션도 거절 대역으로 심사되지만, 머리글이
화행을 잘못 부른다. 수정(`speechActKo` 사용 + `quality_mission_v6_act_general_v2`)은 별도 커밋으로
작업 트리에만 두었다. **Edge 배포는 승인 사항이라 하지 않았다.** 승인된 6건의 v1 품질 증거는
재사용 검사에서 계속 인정하도록 두 버전을 허용했다.

## 배포와 등록 (연구자 승인 후 실행)

PR [#184](https://github.com/sylim-research/PRAGMA/pull/184) 머지 → main `b18a4b64`. 머지 전 CI가 두 번 막았고 둘 다 정합성 가드였다.
- **프롬프트 스냅숏 무결성** — edge 소스를 고쳤는데 스냅숏을 다시 뜨지 않았다. `npm run prompts:snapshot`.
  바뀐 것은 `edge_source_sha256`과 수집 메타데이터뿐이다(v6 심사 머리글은 스냅숏 대상이 아니다).
  덤으로 09-14에 dirty 트리에서 뜬 기록이 깨끗한 커밋으로 고정됐다.
- **검수 도메인 번들 staleness** — 번들은 앱 규칙에서 생성되는데 v6 스키마가 바뀌었다. `node scripts/build-content-review-domain.mjs`.
- 교훈: **edge 소스나 규칙을 고치면 전체 테스트와 `npm run build`를 다시 돌린다.** 문항 테스트만으로는 두 가드를 못 본다.

`npm run edge:deploy generate-scenario` → `b18a4b64` (main 계보). 배포 가드는 dirty 트리·미머지 커밋을 거부한다.
worktree에 Supabase 연결 상태가 없어 루트의 `supabase/.temp`를 복사했다(루트 자체는 미커밋 작업이 있어 건드리지 않았다).

등록 결과 — `node scripts/register-v6-candidate.mjs`:

| 새 행 | 원본 | 화행·모드 | 해시 | 품질 점검 |
|---|---|---|---|---|
| `40c7aa46` | `ea0976f1` | 거절·번역 | `5dca40d0` | warning 1 — `critic_grounding_failure @mpj_items[4].candidates[3]` |
| `cdff1b28` | `509589aa` | 거절·통역 | `7e9e0838` | warning 1 — `critic_grounding_failure @mpj_items[2].corrections[1]` |

- 두 warning 모두 **AI 지적이 인용 근거를 찾지 못해 격리된 것**이고 내용 결함 판정이 아니다(09-16 `630e6459`와 같은 패턴).
- 심사 프롬프트 버전이 `quality_mission_v6_act_general_v2`로 기록됐다 — 배포된 수정본이 실제로 쓰였다.
- readback: 새 행 `generated` · 편성 없음 · `supersedes`로 원본 연결. **원본 2건은 `reviewed` 그대로이고 c2 6주차 편성도 그대로**라
  학습자에게는 계속 v5가 보인다.

## 남은 것
- 관리자 화면에서 새 행 2건의 규칙검사·최종검수·**교수자 5단계 승인**(DB 트리거가 승인 기록 없이는 `reviewed` 전환을 막는다).
- 승인 뒤 c2 6주차 편성을 새 행으로 교체 → 학습자 E2E(통역 v6 첫 실행) → readback.
- 나머지 55슬롯(3교과목 × 9주차 × 번역·통역, 2주차 번역 3건 제외)의 집필과 판정.
- 생성계약 v6 절과 규칙 카탈로그·결정 기록 갱신은 승인 사항이라 하지 않았다.
