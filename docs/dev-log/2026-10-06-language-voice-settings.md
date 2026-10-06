# Language voice settings · 2026-10-06

- Synchronized the shared TTS policy with the configured Korean and Chinese voices in Railway.
- Korean: `tjTX4kAaf3HNGHJnq6iy`. Chinese: `nUrEpZ0St3GU2UgOHW3h`. Synthesis model, rate, and fallback behavior remain unchanged.
- Deployed the Supabase `tts` function from main commit `fa540df2`. Generation responses confirmed the expected provider and voice IDs with no fallback.
- Review scope: suitable for a single implementation review. No database, authentication, or assessment contract changes.
