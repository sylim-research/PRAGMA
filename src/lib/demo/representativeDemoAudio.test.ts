import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../../public/demo-audio/manifest.json";
import { representativeDemoAudio } from "./representativeDemoAudio";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "./representativeMissionSnapshot";
import { REVERSE_REPRESENTATIVE_SNAPSHOT } from "./reverseRepresentativeSnapshot";

describe("representative demo recordings", () => {
  it.each([
    ["ko", REPRESENTATIVE_MISSION_SNAPSHOT, "tjTX4kAaf3HNGHJnq6iy"],
    ["zh", REVERSE_REPRESENTATIVE_SNAPSHOT, "nUrEpZ0St3GU2UgOHW3h"],
  ] as const)("matches the approved %s source and preserves the generated audio bytes", (language, snapshot, voiceId) => {
    const source = snapshot.mission_content.production_task.source_text;
    const entry = representativeDemoAudio(source, language)!;
    expect(entry).toBeDefined();
    expect(entry.voiceId).toBe(voiceId);
    expect(entry.provider).toBe("elevenlabs");
    expect(createHash("sha256").update(source).digest("hex")).toBe(entry.sourceTextSha256);
    const audio = readFileSync(resolve(process.cwd(), `public${entry.src}`));
    expect(audio.length).toBe(entry.bytes);
    expect(createHash("sha256").update(audio).digest("hex")).toBe(entry.audioSha256);
    expect(representativeDemoAudio(source, language === "ko" ? "zh" : "ko")).toBeNull();
  });
  it("contains exactly one recording per source language", () => {
    expect(manifest.recordings.map(item => item.language).sort()).toEqual(["ko", "zh"]);
  });
});
