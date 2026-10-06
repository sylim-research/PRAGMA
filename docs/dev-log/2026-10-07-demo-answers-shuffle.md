# Demo answers and stable option order · 2026-10-07

- Option lists that are shuffled per learner (MJT reasons, comparison candidates, correction choices) now keep one order per loaded mission. Previously a remount (e.g. demo autofill) reshuffled them on every click.
- Demo autofill: ko_zh interpreting MJT3 marks the under-calibrated candidate (`A5-1`) as fitting (a deliberate wrong answer); zh_ko translation MJT2 picks `very_inappropriate` (accepted).
- zh_ko translation DCT demo draft replaced with a workplace-register sentence that gives a different reason than the source. Its feedback was recorded once on 2026-10-07: meaning `distorted`, grammar `clean`, band `too_obscured`. The demo replays this record without AI calls.
- Validation: `npm run typecheck`, demo tests, local browser check that MJT4 order stays fixed across repeated autofill.
