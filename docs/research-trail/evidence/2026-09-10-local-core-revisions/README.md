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
