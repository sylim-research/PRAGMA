# Translation and interpreting process memos (2026-10-27)

Goal: learners reflect on their own DCT translation or interpreting, and the instructor reads the draft, AI feedback, final version and the learner's own account together. The memo is free text about the whole short task. It does not ask for one chosen expression or fixed questions.

Change
- Three memo fields with fixed titles and guidance:
  - Translation, after the draft and before the first AI feedback: 「번역 과정 메모」.
  - Interpreting, after recording and transcript confirmation and before the first AI feedback: 「통역 과정 메모」. The field is hidden while recording and until the transcript is confirmed.
  - Final decision, both modes: 「최종 선택 메모」. Available whether the learner revises or keeps the first response.
- Required, no length rule. A blank memo blocks submission; there is no minimum length, sentence count or required term (researcher decision, same day). Each memo box opens at the same row count as the draft/revision box on that screen, sized to the source text. Demo and dev preview do not enforce it because they save nothing.
- Storage, no schema change. `context_judgment.process_memos` (`process_memo_v1`) holds `first` (stage, text, submitted_at) and `final` (text, decision, used_as_dissent_reason, submitted_at) separately; the final memo never overwrites the first. The first memo is also sent in the `first_response_submitted` event payload, which is emitted before the AI feedback request.
- Existing dissent path. When feedback recommends revision and the learner keeps the draft, the final-choice memo is the retain reason, so the learner writes it once. `learner_dissent` is still written with `reason_ko` = memo text, so class dashboards and dissent counts keep working. The old one-line 「이대로 두는 이유」 input is removed. Retaining without a recommendation now also opens the memo panel instead of finishing in one click.
- Record views. `buildLearningRecordDetail` parses the memos for both the admin record view and the learner records page. Draft memo sits under the draft, final memo under the final version. When the final memo is also the dissent reason it is shown once (the admin view labels it). Records made before this feature have no memo field (`memos: null`): the admin view says the record predates the memo field, and the learner page shows nothing. A blank memo reads 「기록 없음」, without any judgment.
- Not changed: AI feedback input and prompts (memos are not sent), scoring, the 60-second feedback flow, `LegacyMissionRun` (`/learner/mission-run/:id`, legacy fallback).

Validation
- `npm run typecheck`: pass.
- `vitest run` full suite: 168 files passed, 3 skipped; 1149 tests passed, 9 skipped. Existing DCT flow tests now type the memos. New checks: row envelope keeps both memos and the dissent reason; record parser dedupes the dissent reason and returns `null` for pre-feature rows; interpreting memo hidden during recording and required after confirmation; first memo event is emitted before the first feedback request and the save carries both memos.
- localhost (demo route, port 8140): translation memo box matches the draft box height; the final-choice memo panel opens from 「최종안으로 정하기」; no console errors.

Not verified: a real signed-in save and reload against Supabase (needs a learner login). Not merged or deployed.
