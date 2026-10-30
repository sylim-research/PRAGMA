# 2026-10-30 — Restore the mission editor on the approval screen

## Why
Applying GPT-6 Astra's findings needs a way to save teacher revisions. The editor in `ProfessorMissionWorkbench` only rendered when `approvalHref` was passed, and nothing passes it, so no screen showed it. `reviseMissionDraft` also validated with `normalizeMission`, which rejects `mission_v6`.

## Change
- Approval screen: collapsed 「원본 수정하기」 below the review flow, as the existing comment intended.
- Editor also covers MJT lesson points and the DCT guidance text (v6).
- `reviseMissionDraft` validates with `normalizeLearnerMission` and reports the failing field.
- Learner screens, review rules and verdicts are unchanged.

## Verification
- typecheck, full tests and `npm run build` with the CI placeholder env pass.
