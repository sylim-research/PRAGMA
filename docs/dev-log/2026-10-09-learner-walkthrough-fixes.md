# Demo fixes from a learner walkthrough — 2026-10-09

Source: one intermediate learner (no HSK test history, speaking-focused, non-Chinese major, self-reported weak reading and writing) walked through the ko→zh translation demo and reported their impressions to the researcher.

Changes (branch `claude/mjt-band-fix-2026-10-09`, PR #331)
- MJT2 (recommendation letter): accepted scale codes crossed the appropriate/inappropriate line (`somewhat_inappropriate` + `somewhat_appropriate`). Now `somewhat_inappropriate` + `very_inappropriate`. The other three demo missions had no crossing item. A test now keeps every demo scale key on one side.
- Learner screens no longer show MJT/DCT abbreviations: the intro captions are removed, and the demo step bar reads 「판단 1–5」 and 「직접 번역/통역」.
- Step bar padding 49px → 53px.
- Learner-facing 「참고 표현」 → 「추천 표현」. Example badges stay 「예시 1·2」 (the heading gives direction; 「예시」 keeps them from reading as the only answer). Admin and legacy screens unchanged.
- MJT5 notes in the four demo missions: the closing instruction (「고쳐 보세요」, 「되돌리십시오」) is rewritten as an explanation of how the fix restores the source intent. One typo (이유은) fixed.
- Admin prompt harness: contract clauses read top-to-bottom in two columns with a thin divider.

Not changed
- Live DB missions: the matching approved mission still has the old MJT2 band and MJT5 note. A full survey (crossing bands, instruction-style MJT5 notes) is pending the researcher's decision.
- MJT1 scale and MJT3 labels: see DEC-20261009-02.

Validation: `npm run typecheck` passed; `src/pages/learner`, `src/lib/demo`, `src/lib/mission` — 283 tests passed. Checked on localhost: MJT2 result band, intro, step bar, MJT5 notes and recommended expressions. The admin harness change was not viewed (admin login required).
