# Representative demo: one approved mission per direction and mode · 2026-10-06

- The demo now opens a different approved mission for each combination: ko_zh translation `24fb6841` (request, unchanged), ko_zh interpreting `6867d6b6` (compliment, advanced), zh_ko translation `2c7959ad` (opposition, intermediate), zh_ko interpreting `a44d3c46` (request, unchanged). Previously the mode switch reused the same mission and showed feedback recorded in the other mode.
- `6867d6b6` and `2c7959ad` were read from the production DB on 2026-10-06 (`mission_status` reviewed, `legacy_reviewed`) and stored as snapshots (`src/lib/demo/additionalDemoSnapshots.ts`). Neither had learner run records.
- `2c7959ad` is an approved interpreting mission; the demo presents its production task as translation (presentation override only; the snapshot is unchanged).
- One prepared draft per new mission was sent once to the existing feedback action (zh_ko in translation mode); both responses were within band with no revision required. The recorded feedback is replayed only for that draft (`additionalDemoFeedback.ts`); the demo makes no AI calls.
- Validation: `npm run typecheck`, demo-related tests (35), local browser check of all four combinations and the feedback step of the two new ones.
