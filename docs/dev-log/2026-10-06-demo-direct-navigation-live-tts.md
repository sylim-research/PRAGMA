# Representative demo: direct step navigation and live TTS · 2026-10-06

## Step navigation

- The demo progress bar shows MJT 1–5 buttons and a DCT button from the briefing screen onward. Buttons only open a step; they do not submit answers or mark stages as done. Stage bars are marked done only when the corresponding responses exist.
- MJT numbers follow the presentation order: MJT1 = A1, MJT2 = A2, MJT3 = A5, MJT4 = A3, MJT5 = A4. Stored quest IDs are unchanged (`src/lib/demo/demoStepNavigation.ts`).
- `/demo/mission?...&step=mjt1`–`mjt5` or `step=dct` opens that step directly. The current step is written back to the URL and kept when switching direction or translation/interpreting mode.
- Learner missions ignore `step` and keep the sequential flow; no jump controls are rendered outside demo mode.

## Source audio

- Demo interpreting playback now requests audio through the existing `tts` Edge Function on the first play, using the configured ElevenLabs voices (ko `tjTX4kAaf3HNGHJnq6iy`, zh `nUrEpZ0St3GU2UgOHW3h`). The generated audio is reused for the replay on the same screen.
- The demo plays audio only when the response reports provider `elevenlabs`, no fallback, and the configured voice ID. A failed request or a fallback-provider response shows a notice, does not consume a play, and can be retried. This client check remains in place for a deployed function that does not yet support the demo profile below.
- Demo playback is set per voice: Korean volume 0.6, rate 1, 1.0 s sentence pause; Chinese volume 0.5, rate 0.9 (pitch preserved), 1.5 s sentence pause. Earlier in this branch both used volume 0.85 and rate 1.
- Sentence pauses are `<break time="…s" />` tags inserted into the demo request text (after `.?!` followed by a space, or after `。？！`). Requests with 0.6 s break tags in both languages returned ElevenLabs audio without fallback. The playback rate applies to the whole clip, so Chinese pauses play about 10% longer than the tag value. Perceived pause length and pace were not assessed. Microphone/STT restrictions and the sample transcript in demo mode are unchanged.
- Removed the static recording path: `src/lib/demo/representativeDemoAudio.ts` and its test, `scripts/prepare-demo-audio.mjs`, and `public/demo-audio/`. The earlier record (`2026-10-06-representative-demo-audio.md`) describes the previous state and is left as is.
- Demo requests send `profile: "voice_default"`. The `tts` function then calls `eleven_multilingual_v2` without `voice_settings`, so ElevenLabs applies each voice's saved settings (the defaults used by its web preview, which shows Multilingual v2 for these voices), and it does not fall back to OpenAI. Requests without the profile keep the learner settings unchanged: stability 0.5, similarity_boost 0.75, style 0.1, speaker boost on, speed 0.9 (ko) / 0.8 (zh).

## Validation

- `npm run typecheck` passed. Related tests passed (demo navigation, interpreting console, mission runner, demo libraries, TTS shared modules).
- Local browser check: direct entry at `step=dct` and `step=mjt3`, step kept across a direction switch, and one live request per language returned `audio/mpeg` with the configured voice ID and `fallbackUsed: false`; no static audio requests. Perceived audio quality was not assessed.
- The `tts` Edge Function was deployed from this branch on 2026-10-06. After deployment, one demo request per language returned provider `elevenlabs`, model `eleven_multilingual_v2`, the configured voice ID, and no fallback, with `profile: "voice_default"` in the request. Requests without the profile follow the unchanged learner settings. No database or learner-flow change.
- The production web app still serves the static demo audio until this branch is merged.

Thesis impact: demo-only controls on the progress bar; no change to the learner workflow, prompts, or generation contract.
