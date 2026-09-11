# Reason 문항 표적 수리 러너 · 2026-09-11 (준비만, 미실행)

연구자 결정(`docs/dev-log/2026-09-11-reason-item-contract-and-reaudit.md` 7절)에 따른 실행 도구. **PR #135가 main에 병합되고 `generate-scenario`가 main lineage에서 배포된 뒤에만** 돌린다. 이 폴더에 결과 파일이 없다는 것은 아직 실행하지 않았다는 뜻이다.

순서와 명령(worktree 루트, 관리자 process env):

1. `npm run edge:deploy -- generate-scenario` — guard가 main lineage를 확인한다.
2. `npx.cmd vite-node docs/research-trail/evidence/2026-09-11-reason-item-repair/repair.ts audit` — 미션 14건에 새 ⑨로 품질 검사를 다시 돌리고 Reason 문항 finding만 추린다. DB 기록 없음. 결과 `<key>-audit.json`.
3. `… repair.ts repair` — Reason finding이 있는 미션만: `mission_repair`에 그 finding만 넘겨 문항 단위 수정 연산을 받고, Reason 문항 블록 하나만 `reviseMissionDraft(core, …, 'ai')`로 저장한다. 이 경로가 규칙 검사·품질 검사·새 content hash·append-only revision(`save_generated_mission_revision`, stage `ai_repaired`)을 모두 처리한다. **mission_content를 직접 덮어쓰지 않는다.** 결과 `<key>-repair.json`(before/after 포함).
4. `needs_regeneration`으로 남는 미션만 `supersedeMissionForRework → promoteCore`(run.ts mission)로 다시 만든다. 명시적으로 키를 지정해 실행한다.
5. 미승격 5칸(w2-1·w3-0·w4-0·w5-1·w13-0)은 `run.ts mission <key>`로 승격한다(새 계약으로 생성됨).
6. 결과 표를 dev-log에 남기고, 경계 사례(w3-1 r1·w6-0 r3)는 연구자 판정을 받은 뒤 처리한다.

이 러너는 교수자 승인·편성·공개를 하지 않는다.
