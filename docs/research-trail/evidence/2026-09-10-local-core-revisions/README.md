# 소수 코어 로컬 수정 후보 · 2026-09-10

`prepare.ts`는 기존 2차 생성 원본을 복사해 아래 후보만 만들고 실제 `normalizeCore`/`checkCore`를 실행한다. 명령: worktree 루트에서 `npx.cmd vite-node docs/research-trail/evidence/2026-09-10-local-core-revisions/prepare.ts`.

| 후보 | 변경 | 실제 오프라인 결과 |
|---|---|---|
| w9-1-draft.json | 사과 수행절을 head로, 재발 주의를 support로 지정. 원문 유지 | 스키마 통과, 규칙 pass. 유효 50자/40~60자 |
| w2-0-draft.json | 택배 대신 수령·이웃집 현관 보관·18시 회수를 명시하고 focal 동기화 | 스키마 통과, 규칙 pass. 유효 60자/60~85자 |
| pilot-reverse-opposition-draft.json | 질문/통학 시간 지시어를 명료화하고 시드 밖 삭제 이유 제거. focal 동기화 | 스키마 통과, fail 없음. R29 최소 길이 warning: 유효 48자/권장 80~110자 |

`checks.json`은 위 실제 실행 결과다. 반대의 길이 경고를 의미 판정 실패와 혼동하지 않지만, 고급 과제로 채택할지 판단은 남아 있다. 근거 없는 사실이나 반복 문구를 더해 글자 수만 맞추지 않았다.

**모두 local_unapproved_revision이다.** 기존 AI 검토·생성/어휘 검사 메타데이터는 수정안을 인증하지 않으므로 후보 코어에서 제거하고 원본 ID/파일/SHA-256을 바깥 봉투에 보존했다. 길이 실측은 다시 계산했다. 원본 및 DB는 그대로다. 의미 검사·교수자 승인·전체 미션 생성/검수·교과목 교체·배포는 하지 않았다.

반대 코어의 preceding_turn은 현행 core R8 요구 때문에 시드에 있는 삭제 제안만 유지했다. 이후 native MJT/DCT 생성 결과의 preceding_turn=null과 장면 내 계기 계승을 따로 확인해야 한다.

다음 담당자는 JSON 봉투 전체를 DB 코어로 저장하지 말고 `coreContent`와 `plan.cell`을 확인한다. 로컬 편집한 콘텐츠에 대해 기존 진행 조건으로 새 의미 검토를 거친 뒤 승인 가능한 것만 미션으로 승격한다. 이 결과는 수정 의견을 실행 가능한 후보로 만든 근거이며 최종 품질 보증이 아니다.

## FABLE 인수 후 · 반대 v2, 의미 검사, 새 draft 행 (2026-09-10)

- **반대 v2**: v1의 48자는 고급 번역 원문으로 채택하지 않았다. `prepare-opposition-v2.ts`가 v1 봉투를 기반으로 `pilot-reverse-opposition-draft-v2.json`을 만든다. 이견 서두(我的看法有点不一样)·유지 입장·시드 안의 연구 목적 근거·단체 대상 재고 요청(大家再考虑一下，好吗)으로 구성했고 시드 밖 사실은 넣지 않았다. `checks-opposition-v2.json`: 스키마 통과, 규칙 pass, 유효 85자(권장 80~110). head = 입장 절, support = 재고 요청 절(완화 구간). v1 파일은 이력으로 그대로 둔다.
- **의미 검사 실행**: `check-semantic.ts`를 인수 받아 draft 파일명을 argv로 받도록 고쳤다. 실행 = `w9-1-draft.json w2-0-draft.json pilot-reverse-opposition-draft-v2.json`. 결과 `w9-1-semantic.json`·`w2-0-semantic.json`·`pilot-reverse-opposition-v2-semantic.json` = 세 건 모두 verdict pass, 16축 전부 pass이며 각 reason이 사건·관계·부담 근거를 서술함을 직접 읽어 확인했다(gpt-4.1, core_quality_v11_observed_pdr_scene_gate). 결과에 후보 SHA-256을 고정했다. 반대 v1의 의미 검사는 실행하지 않았다.
- **DB 저장**: `save-and-promote.ts save`가 세 후보를 기존 `save_generated_core` RPC로 **새 draft 행**으로 저장했다(`*-saved.json`에 원본/새 scenario ID와 payload 보존). 원본 행 3개는 그대로다. 새 행의 `core_content.generation`은 원본 generation 메타데이터에 이번 `semantic_check`와 `local_revision`(원본 ID·초안 파일·SHA-256·편집 시각)을 더한 것이다.

| key | 원본 scenario | 새 scenario(draft) |
|---|---|---|
| w9-1 | 48854f5c-678f-4b46-a127-0aea54536b54 | 170e4b66-a802-4d8c-8696-2fd25e0b4a2b |
| w2-0 | 9e5e1bd9-cf65-4cb4-ae87-8df47c8e0b30 | 4eac0623-82b9-4c92-818d-23c2ba8876fc |
| pilot-reverse-opposition-v2 | 6ff643a6-a3a5-4034-95c5-e55b3bb8ddc2 | d9f1deb3-337d-4e6e-93f4-ac86b7939760 |

- **미션 승격**: `save-and-promote.ts mission`이 위 새 행 3개와 불만 원본(e4f36052-88a8-45cd-a33b-1a96f9d2ed5c)을 기존 `promoteCore`(astra job)로 전체 MJT5+DCT1 미션으로 승격한다. 결과는 `*-mission.json`·`*-job.json`. 승격 결과와 직접 검수 판정은 아래 절에 적는다. 교수자 승인·공개·교과목 편성은 하지 않는다.

## 전체 미션 승격 결과와 직접 검수 (FABLE, 2026-09-10)

미션 구조(mission_v5): MJT 5문항은 같은 목표 자질(target_feature)을 다른 소규모 장면으로 대비하는 문항이고, DCT(production_task)만 코어 원문을 그대로 쓴다. 문항 2~4가 같은 원문을 공유하는 것과 R19 중복 warning은 설계상 예상되는 결과다.

| key | 새 scenario | 자동 품질(quality_v22) | 직접 검수 판정 |
|---|---|---|---|
| w9-1 사과·통역 | 170e4b66 | **pass**(1회) | **교수자 검토 올릴 수 있음.** 문항 1 친구·컵(close/low, 축소 표현 허용) → 문항 2~4 독서모임 지인·책 모서리(acquaintance, 같은 표현이 under_acknowledged) → 문항 5 동호회 회원·카메라 150만 원(high, within 2/under 1/over 1). 거리·부담 축이 한 번에 하나씩 바뀌고 정답·해설·수정안이 같은 기준(행위 한정 책임 인정, 축소·인격 확대 금지)을 따른다. DCT 참고안 2개는 원문의 이유·십 분·사과·재발 약속을 모두 옮기고 새 보상을 덧붙이지 않았다. 유보: 문항 4 오답 r1(「주의 약속이 즉각 용서 요구로 작용」)은 약한 오개념 보기이나 정답 식별을 흐리지 않는다. |
| w2-0 요청·번역 | 4eac0623 | **fail**(수리 후보도 재통과 실패, revision 미저장) | **내용은 채택 가능하다고 판단, 최종은 연구자 결정.** 실패 사유 = 문항 4(reason)의 오답 r1(「吧가 요청을 가벼운 제안으로 만들어 뜻이 안 전해진다」)이 정답 r3(「你就把…가 미수락 동료의 행동을 정한다」)와 같은 조사에 초점을 둬 「주원인 모호」라는 판정. 내 판정: r1은 문제를 과소 단정(불명확)으로 오진하는 전형적 화용 오개념 보기이고 r3는 과잉 직접성이 원인이므로 방향이 반대다 → 설계상 정당한 오답. 부수 지적(too_direct 후보가 명령형이라 소거 쉬움)은 문항 5의 「你今天内帮我审阅完。」에 해당하나 한→중 번역에서 의문 조동사를 빠뜨리는 실제 학습자 오류형이다. 문항 1(친한 친구·보드게임 「你就把…吧」 허용) → 문항 2~4(동료·링크 재전송, 같은 구조가 too_direct) → 문항 5(동료·40분 검토, mid) 대비는 깨끗하다. DCT 참고안 2개는 수령·현관 안 보관·여섯 시 회수를 모두 옮겼다. |

| pilot-reverse-opposition-v2 반대·중→한 번역·고급 | d9f1deb3 | **pass**(1회) | **교수자 검토 올릴 수 있음.** 문항 1 동료·제목 색상(low, 겹친 완화가 허용) → 문항 2~4 동료·실습 20분 유지(mid, 같은 완화 중첩이 too_obscured; 수정안 = 명료 입장 유지/「분명히 잘못된 방향」 대립/「참고 정도」 흐림) → 문항 5 친한 친구·가격표(close·mid, 반말 후보 within 2/대립 1/흐림 1). R 축과 D 축이 한 번에 하나씩 바뀌고, 「완화는 이견을 숨기는 장치가 아니다」라는 단원 결론과 정답·해설이 일치한다. DCT 참고안 2개는 이견 서두·유지 입장·연구 목적·삭제의 영향·단체 재고 요청을 모두 옮겼고 「大家」를 「다 같이/여러분도」로 처리했다. 유보: 문항 1 정답 후보의 「조금 다른 생각이 없는 건 아닙니다」는 이중 부정이라 한국어로 어색한 편이며, 학습자가 어색함 때문에 「다소 부적절」로 답할 여지가 있다. 교수자가 문장을 다듬을 후보 1순위. |
| pilot-reverse-complaint 불만·중→한 통역·초중급 | e4f36052(원본 그대로) | **pass**(1회) | **교수자 검토 올릴 수 있음.** 문항 1 친한 친구·영화표 5분(close/low, 「덕분에 고생했네」 반어를 가벼운 타박으로 허용) → 문항 2~4 동료·음료 2분(acquaintance, 같은 반어가 over_attributed; 수정안 = 사실+「좀 불편했어요」/「그렇게 두고」 부족/「떠넘기신 거죠」 과함) → 문항 5 동료·재고 3시간(mid, within 2/under 1/over 1). 사실·영향·책임 범위라는 단원 초점과 정답·해설이 일치하고 초중급에 맞는 짧은 문장이다. DCT 참고안 2개는 약속·실제 지연·10분·불편을 모두 옮겼다. 유보: 문항 1이 반어를 「적절」로 허용하는 판단은 교수자가 동의할지 확인할 지점이고, 문항 2~4 원문의 「您」은 동급 동료에게 다소 격식적이나 직장 대화로 가능하다. |

**4건 모두 mission_status = generated.** 교수자 승인·공개·교과목 편성·배포는 하지 않았다. 원본 draft 코어 3행(48854f5c·9e5e1bd9·6ff643a6)은 관리자 대기열에 그대로 남아 있다.

w2-0 처리 선택지: ① 교수자 최종 승인 화면의 AI fail override로 승인(내 권고), ② `supersedeMissionForRework` → `promoteCore` 재생성(유료 1회, 결과 보장 없음). 이번 세션에서는 재생성하지 않았다.

**연구자 판정(2026-09-10):** w2-0의 문항 4 오답 구성은 문제가 없고 오히려 의도한 설계라고 확인했다 → 재생성하지 않고 교수자 최종 승인 화면에서 override로 처리한다. 2주차 편성 1행에 붙어 있던 학습 로그 2건(2026-09-08·09-10, 서로 다른 계정)은 연구자 본인의 시연 기록이라 삭제를 승인했다 → 로컬 미추적 백업(`.tmp/scene-grounding/deleted-own-logs-backup.json`) 후 Supabase CLI `db query`로 id 지정 삭제, 재확인 결과 해당 편성의 logs 0·events 0. RLS는 authenticated에 DELETE 권한이 없어 admin 세션의 `.delete()`는 0건이었다(오류 없이 무시됨). 이제 기존 편성 20행 중 학습 기록이 참조하는 행은 없으며 `saveWeekAssignments`의 통상 경로로 교체할 수 있다.

## 의미 검사 실행 준비와 차단 (인수 전 기록)

`check-semantic.ts`는 세 후보를 기존 `checkCoreSemanticFit`으로 검사하고 후보 SHA-256과 결과를 별도 JSON에 보존하도록 준비했다. 시나리오 저장/승인/승격 코드는 없다. 기존 파일이 있으면 덮어쓰지 않는다.

2026-09-10 실행 시도는 프로세스 시작 전에 자동 승인 검토가 거절했다. 이유는 수정 코어를 Supabase 외부 의미 검사 서비스로 전송할 목적지/구체적 payload 승인이 없다는 것이었다. **스크립트는 실행되지 않았고 의미 검사 결과 파일·신규 판정은 없다.** 우회 호출하지 않았다. 재개 전 세 로컬 후보의 상황·관계·원문·PDR 등 코어 필드를 기존 Supabase/OpenAI 검사에 보내는 범위의 승인이 필요하다. 비밀값·학생 응답·앱 소스는 검사 payload에 포함하지 않는다.
