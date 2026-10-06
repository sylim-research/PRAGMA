import manifest from "../../../public/demo-audio/manifest.json";

// An asset is valid only for the exact source text and language it was generated from.
export function representativeDemoAudio(sourceText: string, language: "ko" | "zh") {
  return manifest.recordings.find(item => item.language === language && item.sourceText === sourceText) ?? null;
}
