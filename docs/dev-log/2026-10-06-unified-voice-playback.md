# Unified demo and learner voice playback

- Set Korean and Chinese source playback volume to 100% in both canonical learner and demo interpreting consoles.
- Korean uses synthesis speed 1.0 and explicit 0.5-second sentence break tags. Chinese uses synthesis speed 0.9 and 1.5-second break tags, using the prior demo target as the shared pace.
- Both consoles now use the same learner synthesis profile. Playback remains 1.0 for both languages, avoiding duplicate speed reduction. Existing designed voice IDs remain unchanged.
- Demo still rejects non-designated/fallback audio at playback. The shared learner request can attempt the existing provider fallback; the legacy voice_default API profile remains available but is no longer requested by this console.
- Validation: 23 focused tests passed across InterpretingConsole and ttsVoicePolicy, including both modes and both languages, sentence tags, replay reuse, and synthesis request speeds. Used an isolated test configuration with existing dependencies because disk space prevents a fresh install. No paid synthesis requests or listening validation performed.
- Local commit only. Production requires frontend deployment and deployment of the shared policy through the Supabase tts function. Existing in-memory audio must be regenerated after deployment.
- No research-trail update: playback configuration only; learning structure and generation/evaluation contracts unchanged.
