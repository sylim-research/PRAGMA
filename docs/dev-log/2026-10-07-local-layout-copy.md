# Mission navigation, landing layout, and administrative copy — 2026-10-07

## Final scope

- Present four equal demo mission choices above the content. Keep PRAGMA and DEMO in the compact header, omit the demo account menu, and show stage navigation after starting. Name the start action for its selected direction and mode.
- Apply approved MJT2 grounds labels across the app and distinguish choosing a supplied revision candidate (MJT4) from directly revising the text (MJT5). Preserve assessment rules, stored field names, and approved mission content.
- Refine landing copy, center the content cluster with a 5px downward offset, use a 650px role-card group with 15px vertical padding, and retain the separate footer divider. Update the copyright to PRAGMA.
- Use the selected cobalt blue (#315F9C) for the landing demo entry, with white text and icon. Remove development-only color-comparison code before release.
- Restore the mission library under class operations as “학습 미션 관리”; keep ready, pending, and all-mission views, remove the pre-mission scenario tab and theme filter, equalize the three level columns, and increase explicit content font sizes by 0.5px. Empty cells display a dash with accurate accessible counts.
- Remove learner management from the sidebar while preserving its protected route and dashboard access. Rename the dashboard quality section and HSK vocabulary comparison label.
- Standardize current UI wording around draft, revision, and final versions. Historical records and approved demo content were not bulk edited; the four-demo wording audit remains deferred.

## Validation and release

Local focused validation included 52 tests across seven suites, subsequent library/MJT checks, and 20 runtime tests covering demo start, judgment preservation, production, and restart. TypeScript passed after layout changes. Full release validation follows the final approved batch; no research-trail update is needed for these presentation and navigation changes.

The researcher authorized one combined PR, merge, and production deployment after local review.
`nFinal release validation: typecheck and production build passed. The full run passed 1121 tests with two stale UI expectations; both were updated and the affected 22 tests passed on rerun. The final landing secondary buttons use 228px desktop width and 10px vertical padding. GitHub CI will rerun the complete suite on the release commit.
