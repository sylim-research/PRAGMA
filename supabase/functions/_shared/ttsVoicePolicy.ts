/** One instructor-selected voice across languages and existing browser clients. */
export function selectTtsVoice(configured: string | undefined, requested: unknown, defaultVoice: string) {
  const selected = configured?.trim();
  return {
    voiceId: selected || (typeof requested === 'string' && requested.trim() ? requested.trim() : defaultVoice),
    pinned: Boolean(selected),
  };
}
