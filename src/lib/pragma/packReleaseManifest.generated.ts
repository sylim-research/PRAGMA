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
  "prompt_snapshot_hash": "44e213b5912ad52a7e98dd3c6e58c624aade5ab14ccf6f402c79708f7eefca7a",
  "evidence_snapshot_hash": "f21bacee1e0a89e2a305d225547b8ab41c8bc988dc073ef051827e16b3400c18",
  "source_commit_ref": "624781e4750375d93937794b7ad45c9c07742d07",
  "git_dirty": true,
  "source_paths": [
    "src/lib/pragma/realizationPack.ts",
    "supabase/functions/generate-scenario/index.ts",
    "scripts/snapshot-prompts.mjs",
    "src/lib/pragma/packReleaseManifest.ts"
  ]
} as const;
