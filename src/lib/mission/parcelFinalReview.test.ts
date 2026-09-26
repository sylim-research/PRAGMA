import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MissionV6Schema, type MissionV6 } from "@/lib/pragma/missionV6";
import { adaptRunnableMissionToCanonical } from "./canonicalMissionRuntime";

const root = "docs/research-trail/evidence/2026-09-27-parcel-final-review/";
const read = (name: string) => JSON.parse(readFileSync(root + name, "utf8"));
const base = read("approved-v3.snapshot.json"), candidate = read("local-revision-candidate.json");
const manifest = read("revision-manifest.json");
const canonical = (v: unknown): string => v === null || typeof v !== "object" ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
    : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
const payload = (m: typeof base) => {
  const p = structuredClone(m);
  for (const k of ["provenance", "quality_check", "hsk_lexical_audit", "authoring"]) delete p[k];
  return p;
};

describe("representative local content candidate", () => {
  it("validates both contents and binds distinct hashes without claiming approval", () => {
    for (const [m, hash] of [[base, manifest.old_hash], [candidate, manifest.candidate_hash]]) {
      expect(MissionV6Schema.safeParse(m).success).toBe(true);
      expect(createHash("sha256").update(canonical(payload(m))).digest("hex")).toBe(hash);
      expect(m.provenance.mission_content_hash).toBe(hash);
    }
    expect(manifest.candidate_hash).not.toBe(manifest.old_hash);
    expect(manifest.new_version_id).toBeNull();
    expect(candidate.quality_check).toBeUndefined();
    expect(candidate.provenance.finalized_at).toBeUndefined();
  });

  it("changes only the nine authorized fields and preserves content/ID/order contracts", () => {
    const restored = payload(candidate);
    for (const path of manifest.changed_content_fields as string[]) {
      const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
      let source = base, target = restored;
      for (const key of keys.slice(0, -1)) { source = source[key]; target = target[key]; }
      const key = keys.at(-1)!;
      expect(target[key]).not.toEqual(source[key]);
      target[key] = source[key];
    }
    expect(manifest.changed_content_fields).toHaveLength(9);
    expect(restored).toEqual(payload(base));
    const mission = MissionV6Schema.parse(candidate) as MissionV6;
    const view = adaptRunnableMissionToCanonical({ scenario_id: manifest.scenario_id, mission,
      direction: "ko_zh", speech_act: "request", learner_level: "intermediate", mission_status: "reviewed", release_gate_mode: "legacy_reviewed" });
    expect(view.quests.slice(0, 5).map(q => q.id)).toEqual(["A1", "A2", "A5", "A3", "A4"]);
    const spectrum = view.quests.find(q => q.kind === "spectrum")!;
    if (spectrum.kind !== "spectrum") throw new Error("spectrum missing");
    expect(spectrum.options.map(o => o.label)).toEqual(["너무 직접적", "상황에 맞음", "너무 우회적"]);
  });
});
