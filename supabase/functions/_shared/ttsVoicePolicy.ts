export type TtsLang = 'ko' | 'zh';
export type TtsLevel = 'beginner' | 'intermediate' | 'advanced';

// Instructor-designed voices. Older browser defaults cannot override the language mapping.
export const TTS_VOICE_BY_LANG: Record<TtsLang, string> = {
  ko: 'HO5dktW48cbvRzT0It88',
  zh: 'NM6TmNGKSoReFxHSsuGZ',
};
// Use the same mild slowdown for every language and learner level.
export const ttsSpeed = (_lang: TtsLang, _level: TtsLevel = 'intermediate') => 0.9;
export const OPENAI_TTS_INSTRUCTIONS: Record<TtsLang, string> = {
  ko: 'Speak standard Seoul Korean in a neutral, everyday conversational tone, like a coworker speaking in person. Natural unhurried pace, calm and even, no exaggerated emotion, not a news anchor.',
  zh: 'Speak standard Mandarin in a neutral, everyday conversational tone. Speak slowly and deliberately, as if speaking through a consecutive interpreter: fully pronounce every syllable and pause briefly after each clause. Calm and even, no exaggerated emotion, not a broadcaster.',
};
