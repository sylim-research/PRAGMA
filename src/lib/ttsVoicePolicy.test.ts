import { describe, expect, it } from 'vitest';
import { selectTtsVoice } from '../../supabase/functions/_shared/ttsVoicePolicy';

describe('instructor-selected TTS voice', () => {
  it('pins the chosen voice even when an older browser sends a hardcoded voice', () => {
    expect(selectTtsVoice(' chosen-voice ', 'old-browser-voice', 'default')).toEqual({ voiceId: 'chosen-voice', pinned: true });
  });
  it('keeps existing playback working until the instructor connects a voice', () => {
    expect(selectTtsVoice(undefined, 'existing-voice', 'default')).toEqual({ voiceId: 'existing-voice', pinned: false });
    expect(selectTtsVoice(' ', undefined, 'default')).toEqual({ voiceId: 'default', pinned: false });
  });
});
