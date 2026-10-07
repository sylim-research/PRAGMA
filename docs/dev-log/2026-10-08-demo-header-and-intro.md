# Demo header toggles, phase blocks and landing entry links — 2026-10-08

Decision (researcher): after comparing earlier local and deployed versions side by side, keep the deployed landing layout and bring back the earlier demo briefing design, adjusted to the brand colours.

Changes
- Landing (public demo mode): role-card entries ("학습자 로그인", "제작·승인하기") keep the text-link form and gain a persistent underline so they read as links. The demo button sits 34px below the cards so the visual gap matches the subtitle-to-card gap (the card shadow made the equal 22px look tighter).
- Demo mission selector moves into the dark header as two direction pills (한→중 / 중→한, each with 번역·통역). The selected item is white-filled; no blue.
- Mission briefing: the two phases are again solid bands (navy for 적절성 판단, yellow for 직접 번역) with 판단형/산출형 markers and tinted step rows. Current step wording and the "DCT · 통번역 과제" caption are kept. Start button is light yellow.
- Step bar: the "DCT 번역" stage drops its boxed style and uses the same bar-and-label form as every other stage; it still jumps to the task. The step bar is shown on the briefing screen again.

Validation: `npm run typecheck` passed; 12 test files / 71 tests passed (demo header placement and briefing step bar assertions updated to the new layout); `npm run build` passed. Checked locally at 1366×800.
