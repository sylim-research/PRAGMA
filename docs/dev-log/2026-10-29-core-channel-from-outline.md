# 2026-10-29 — Scenario channel follows the chosen outline

## What happened
- Individual generation, request · ko→zh · translation · school · P speaker_lower / D acquaintance / R high, outline 「전공 기말 보고서 제출 기한 연장 요청」 (an email scene).
- Three runs in a row were held by the pre-save semantic review (GPT-6 Astra). All three cited 「situation says email, channel is messenger」; two also cited high-imposition events in the situation that the source text did not carry.

## Cause
- For translation, the client always sent and saved `channel: "messenger"` (`legacyChannelOf` in `AdminGenerator.tsx` and `coreBatchRun.ts`). Any email outline therefore failed the channel consistency check, regardless of the generated content.

## Change
- `src/lib/pragma/coreChannel.ts`: translation uses `email` when the outline (scene seed) mentions email, otherwise `messenger`; interpreting stays `facetoface`. Used by both individual and batch generation. The save RPC already maps `email` → `business_email`.
- No prompt, model, rule or DB change. The scene-source mismatch finding is a real content issue and is left to the reviewer.

## Verification
- `npm run typecheck` pass · `coreChannel.test.ts` + `coreBatchRun.test.ts` 9/9 pass.
