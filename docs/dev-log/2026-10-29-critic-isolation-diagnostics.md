# 2026-10-29 — Keep the raw shape of quarantined critic findings

## What happened
- First production mission review by GPT-6 Astra (scenario `d261d847`): the critic returned 9 findings and all 9 were quarantined with 「현재 표현 인용이 없습니다」 (path resolved, quote empty).
- Quarantined findings keep only the reason string; `note_ko` and the original fields are dropped, so the teacher sees no opinion text and the cause cannot be checked.

## Change
- `generate-scenario` `quality_check`: when a finding fails grounding, also record its keys, code, where, evidence_excerpt and note_ko (clipped) in `quality_check.isolated_findings_raw`.
- `QualityCheckSchema` accepts the optional field so the client keeps it when saving.
- Diagnostic only: verdict derivation, grounding rules and screens are unchanged.

## Verification
- `npm run typecheck` pass · missionSchema / promoteMission / ContentReviewPanel tests 58/58 pass.
