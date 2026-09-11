# Reason 문항 표적 수리 러너 · 2026-09-11

**실행 결과(2026-09-11 오후, generate-scenario v123)** — 상세 표는 `docs/dev-log/2026-09-11-reason-item-contract-and-reaudit.md` 8절.
- `*-audit.json` 14건: 자동 재감사(새 ⑨). `human-findings.json`: 연구자가 수용한 사람 재감사 finding(우선 병합).
- `attempt1-glossed/` 12건: 1차 `mission_repair` 결과 — 오답이 그대로거나 의미 해설로 변질. 중단.
- `human-replacements.json` + `repair.ts apply` → `*-apply.json` 14건: 사람이 쓴 교체 오답을 `reviseMissionDraft(core, itemBlocks, 'ai')`로 저장(append-only revision, 새 content hash). 결과 pass 2(w9-1·w10-1) · fail 12. fail 중 8건은 2차 critic이 「사실이고 부차적인 오답」을 결함으로 본 것 — 원인은 `_shared/missionConsistency.ts`의 `REASON_DISCRIMINATION_RULE`이 옛 정의(오답=반박되는 오진)를 담고 있었기 때문. 정렬본은 브랜치에 커밋, 배포는 연구자 승인 대기. w4-1 r1 교체안은 파일에만 있고 미적용.

아래는 준비 당시의 절차 메모다.

연구자 결정(`docs/dev-log/2026-09-11-reason-item-contract-and-reaudit.md` 7절)에 따른 실행 도구. **PR #135가 main에 병합되고 `generate-scenario`가 main lineage에서 배포된 뒤에만** 돌린다. 이 폴더에 결과 파일이 없다는 것은 아직 실행하지 않았다는 뜻이다.

순서와 명령(worktree 루트, 관리자 process env):

1. `npm run edge:deploy -- generate-scenario` — guard가 main lineage를 확인한다.
2. `npx.cmd vite-node docs/research-trail/evidence/2026-09-11-reason-item-repair/repair.ts audit` — 미션 14건에 새 ⑨로 품질 검사를 다시 돌리고 Reason 문항 finding만 추린다. DB 기록 없음. 결과 `<key>-audit.json`.
3. `… repair.ts repair` — Reason finding이 있는 미션만: `mission_repair`에 그 finding만 넘겨 문항 단위 수정 연산을 받고, Reason 문항 블록 하나만 `reviseMissionDraft(core, …, 'ai')`로 저장한다. 이 경로가 규칙 검사·품질 검사·새 content hash·append-only revision(`save_generated_mission_revision`, stage `ai_repaired`)을 모두 처리한다. **mission_content를 직접 덮어쓰지 않는다.** 결과 `<key>-repair.json`(before/after 포함).
4. `needs_regeneration`으로 남는 미션만 `supersedeMissionForRework → promoteCore`(run.ts mission)로 다시 만든다. 명시적으로 키를 지정해 실행한다.
5. 미승격 5칸(w2-1·w3-0·w4-0·w5-1·w13-0)은 `run.ts mission <key>`로 승격한다(새 계약으로 생성됨).
6. 결과 표를 dev-log에 남기고, 경계 사례(w3-1 r1·w6-0 r3)는 연구자 판정을 받은 뒤 처리한다.

이 러너는 교수자 승인·편성·공개를 하지 않는다.
