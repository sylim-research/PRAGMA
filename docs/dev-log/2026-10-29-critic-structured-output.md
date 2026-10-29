# 2026-10-29 — Ask the v6 mission critic for a quote, and enforce the format

## Finding (from `isolated_findings_raw`, #380)
- Second production mission reviewed by GPT-6 Astra (scenario `65cbff48`): 7 findings, all quarantined.
- Every finding had exactly `code, severity, where, note_ko`. That is the output example of the **mission_v6** critic prompt (since `b3e319b5`, 2026-09-14), which never asked for `evidence_excerpt`. Grounding requires it, so every v6 main-critic finding has been quarantined since v6 went live, regardless of model.
- Some `where` values also listed several paths or used `[*]`.
- The quarantined notes were substantive. Example checked against the mission: MJT3 source `批准追加50万元` vs. situation/target/corrections `50만 원` (currency changed).
- Before 2026-10-26 the Claude cross-review stage still showed its own opinions to the teacher, which masked this gap. #374 removed that stage.

## Change
- v6 critic output example now includes `evidence_excerpt` and says: one path per finding, zero-based, no `*` or comma lists.
- Main critic call now uses a strict `json_schema` response format with the same fields as the prompt (`MISSION_QUALITY_RESPONSE_FORMAT`).
- `MISSION_V6_QUALITY_PROMPT_VERSION` → `quality_mission_v6_act_general_v4_grounded_excerpt`; v3 stays in the reusable list.
- Grounding rules and verdict derivation are unchanged.

## Verification
- `npm run typecheck` pass · full tests 1156 passed / 9 skipped · `npm run build` with CI placeholder env pass.
