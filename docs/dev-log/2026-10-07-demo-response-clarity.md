# Demo response clarity — 2026-10-07

Visitor review exposed silent replacement of a selected judgment by prepared demo responses.

- Remove example insertion from selection-based MJT tasks; retain explicit example translation, transcript, and revision insertion for text entry.
- Confirm replacement of edited text. Transcript insertion always requests confirmation.
- Explain the demo feedback limitation before entry and rename judgment/reason submission buttons.
- Remove the proposed top notice after local user review; retain the concise notice at the input step.
- Preserve assessment criteria, accepted ranges, prepared responses, prompts, and persistence contracts.

Validation: 43 tests in five affected suites and TypeScript passed during local review. Regression coverage includes judgment preservation, cancellation of draft replacement, and demo production completion. Local browser verified judgment and draft screens. Required release CI remains authoritative for the final commit.

Research trail unchanged: usability correction without new research claims. User approved deployment after reviewing the local preview and removing the top notice.
