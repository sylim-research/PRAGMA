-- Add only the adopted format. Preserve status, metadata and lineage gates.
BEGIN;
ALTER TABLE public.scenarios DROP CONSTRAINT scenarios_mission_ck;
ALTER TABLE public.scenarios ADD CONSTRAINT scenarios_mission_ck
  CHECK (
    (mission_content IS NULL AND mission_status IS NULL)
    OR
    (mission_content IS NOT NULL
      AND mission_status IN ('generated', 'reviewed', 'released')
      AND mission_content->>'schema_version' IN ('mission_v1','mission_v2','mission_v3','mission_v4','mission_v5','mission_v6')
      AND target_feature IS NOT NULL
      AND target_feature_version IS NOT NULL)
  );
COMMIT;
