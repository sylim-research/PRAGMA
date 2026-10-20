# Teacher mission handout — 2026-10-20

Purpose: give the teacher an offline copy of a week's missions, prepared before class, so a session can still run if the web app is unavailable (for example during a whole-class load test or an outage). It is a fallback for the classroom, not a learner feature and not an assessment tool.

Changes (branch `claude/teacher-mission-handout-2026-10-20`)
- `src/components/admin/MissionHandout.tsx`: renders one mission from the same `CanonicalMissionViewModel` the learner runner uses, so the printed items match what learners see. Two variants: a question sheet (scene, source text, the five judgment items with tick boxes, write-in lines for the translation/interpreting task) and an answer sheet (adds reference judgments, accepted reasons, explanations, reference and alternative expressions, and the lesson summary). Explanations drop the trailing expression-memo block and render backtick-marked target expressions as bold, matching the learner screen. AI feedback and learner responses are never included. For interpreting missions the task is labelled so the teacher reads the source utterance aloud.
- `src/components/admin/MissionHandoutPage.tsx`: question/answer toggle and a print button (browser print, which also saves to PDF); both are hidden in print. Each mission starts on a new page.
- `src/pages/admin/AdminMissionHandout.tsx` at `/admin/handout?ids=…&title=…` (admin only). Missions load through `fetchMissionByScenario`, which only returns content released after final approval; anything it rejects is listed in a notice instead of being printed.
- `AdminComposer` week row: once a week has missions assigned and its slots are full, a "자료" link opens that week's handout in a new tab.
- `src/pages/dev/MissionHandoutDemo.tsx` at `/dev/handout-demo` (dev build only) renders the two bundled public demo missions without login, for visual checks.

Validation: `npm run typecheck` 0 errors; `MissionHandout.test.tsx` 3/3 (question sheet hides keys; answer sheet shows them without backticks or the memo block; empty state) and the existing admin page tests pass. The dev demo was checked in the browser for both variants. The admin entry link itself needs an authenticated admin session and was not exercised locally.
