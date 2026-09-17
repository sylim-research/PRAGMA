// 자동 생성 파일 — 직접 수정하지 마세요.
// 생성: npm run prompts:snapshot (build 시 자동 실행)
// 정본: src/lib/pragma/realizationPack.ts + supabase/functions/generate-scenario/index.ts
export type PackReleaseManifestDraft = {
  schema_version: "pragma_pack_release_manifest_draft_v1";
  canonicalization_version: "pragma_canonical_json_v1";
  pack_id: string;
  pack_version: string;
  scope_speech_acts: string[];
  artifact_hash: string;
  prompt_snapshot_hash: string;
  evidence_snapshot_hash: string;
  source_commit_ref: string;
  git_dirty: boolean;
  source_paths: string[];
};
export const PACK_RELEASE_MANIFEST_DRAFT: PackReleaseManifestDraft = {
  "schema_version": "pragma_pack_release_manifest_draft_v1",
  "canonicalization_version": "pragma_canonical_json_v1",
  "pack_id": "pragma_ko_zh_request_refusal_thanks_v1",
  "pack_version": "1.2.0",
  "scope_speech_acts": [
    "request",
    "refusal",
    "thanks"
  ],
  "artifact_hash": "18cce236df6fcf9acc417e826302ace3cb7177bc804d6099f9a589b9e587ac00",
  "prompt_snapshot_hash": "97c5385fdb39ac070a4f376affc50bed8b0331f9cd3fd85792d002335c3af53a",
  "evidence_snapshot_hash": "f21bacee1e0a89e2a305d225547b8ab41c8bc988dc073ef051827e16b3400c18",
  "source_commit_ref": "b83b4ce65e702713e312c792e827c77475978cae",
  "git_dirty": false,
  "source_paths": [
    "src/lib/pragma/realizationPack.ts",
    "supabase/functions/generate-scenario/index.ts",
    "scripts/snapshot-prompts.mjs",
    "src/lib/pragma/packReleaseManifest.ts"
  ]
} as const;
