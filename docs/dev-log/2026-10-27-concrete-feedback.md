# Concrete learner feedback, no generic advice (2026-10-27)

Trigger: the researcher found the feedback guidance too abstract to help a learner write a revision (for example 「…을 검토할 필요가 있습니다」). Decision (option 1 of three): every explanation of a problem quotes the learner's own expression and names one action the learner can take; generic advice is banned; no new target-language wording is shown. Option 2 (short Chinese devices taken from approved mission material) and option 3 (show the model's minimal-contrast sentence) were not chosen.

Change
- T4 feedback prompt (`generate-scenario`, `buildFeedbackSystemPrompt`): new 「구체성」 block. A problem is explained by quoting the learner's expression verbatim (or the missing source wording), why it is a problem, and one concrete action. New target-language sentences, words or model expressions are not allowed in `meaning_ko`/`feature_ko`/`discourse_ko`. A list of generic phrases is banned. The direction-specific example is in Chinese for ko→zh and in Korean for zh→ko. Pragmatic judgments stay non-assertive (「~하게 들릴 수 있습니다」).
- Deterministic check (`_shared/feedbackConcreteness.ts`): flags banned generic phrases and any Han text in those blocks that is not in the learner answer or the source. On a hit, if less than 25 s have passed, the writer model is called once more with a correction note. Axes that still fail are held, so their explanation is not shown, the same path as a failed review. The grammar block (`suggested_correction`) is unchanged and not checked.
- Reviewer (Astra) prompt `feedback_review_v2_concrete`: a third check per axis. A problem explanation must quote and give one action; generic advice or new target wording fails the axis.
- `applyFeedbackReview` merges the concreteness holds and records `review.concreteness` (held axes, retried, issues). The client reads only `held_axes`, so no client change was needed.
- Feedback prompt versions bumped to `feedback_v1_minidiscourse_v7_concrete` / `feedback_v1_feature_general_v4_concrete`. The content release ID is unchanged. Prompt snapshot and the content-review generated domain were regenerated; the pack artifact hash is unchanged.
- Local preview fixture (`learnerUxPilot.ts`, AI not called): fixed guidance rewritten to quote the source and name actions.

Validation
- `npm run typecheck`: pass. `vitest run`: 169 files passed, 3 skipped; 1150 tests passed, 9 skipped. New tests cover a valid quoted explanation, generic phrase plus new Chinese detection, source quoting in zh→ko, and holding an axis that still fails even when the reviewer passed it.

Not verified: real model output against the new prompt (needs the deployed Edge function and API keys); actual latency of the extra retry. Not merged or deployed. Deploy needs `generate-scenario` (and `content-review` for the regenerated release module) after merge, with approval.
