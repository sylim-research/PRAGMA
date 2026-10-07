# Demo first-visit fixes — 2026-10-07

Source: independent first-visit review of the landing and demo pages (Claude), cross-checked by Codex. The three fixes both reviews agreed on were implemented locally. No deployment, no stored-data or assessment-logic change.

1. Feedback unavailable is no longer drawn as a verdict. When `evaluation.available === false` (outside the local pilot), the three criterion tiles and the "수정 권장" badges are not rendered. A neutral line explains the state instead. In the demo the header reads "이 답안에는 AI 피드백 기록이 없습니다." and the "실제 AI 피드백 기록" footnote is hidden. The evaluation object and what is saved are unchanged.
2. Demo example provenance. Text inserted by the demo "예시 … 넣기" buttons is marked "예시 사용" wherever it appears: under the input, on the answer card in the feedback views, on the draft/final rows of the completion card, in the demo record (direct correction), and on the interpreting transcript heading. Unchanged example text is tagged "예시 사용". A field that started from an example and was then edited is tagged "예시 수정", and the submitted text keeps that tag downstream; clearing the field ends the link. A follow-up Codex check found that the first version dropped the tag after a one-character edit; this was fixed. Overwrite confirmation stays as is: the example button asks only when unsaved visitor edits would be lost (the revision box prefill is a copy of the already-submitted draft). Demo-only; the real learner flow has an empty example set.
3. Interpreting demo confirm button renamed from "예시 전사문 확인" to "전사문 확정" (it confirms whatever is in the box, including the visitor's own text). Heading "③ 예시 전사문 확인" → "③ 전사문 확인".

Validation: `npm run typecheck` passed. 69 tests in `CanonicalMissionRun*` and `InterpretingConsole` passed (run with placeholder Supabase env vars). Verified on the local demo at 127.0.0.1:8099 for ko→zh translation and zh→ko interpreting, own-text and example paths.

Not changed (agreed optional): input-path split choice, interpreting status cards, revision-screen criterion summary, keep-draft button weight, word-hint styling.
