-- Scenario archive state (researcher decision 2026-09-10, option B: keep rows, hide from current work).
--
-- `usage_assignment` cannot carry this: it is the research-data/learner-visibility axis
-- (coursework_published / experiment_locked / archived_only(default) / excluded) and 1,723 of
-- 1,760 rows sit on the default value. Archiving is an orthogonal, reversible admin state:
--   archived_at IS NOT NULL  =>  excluded from every current production/review/assignment
--                                candidate list and from active-content counts.
-- Rows are never deleted by this state; learner RLS, lineage, logs and RPC-by-id paths are
-- untouched. Reversal = UPDATE ... SET archived_at = NULL, archive_note = NULL.

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_note text;

COMMENT ON COLUMN public.scenarios.archived_at IS
  '보관 시각. NULL이면 현행 콘텐츠. 값이 있으면 제작·검토·편성 후보와 활성 집계에서 제외한다(삭제 아님, 되돌릴 수 있음).';
COMMENT ON COLUMN public.scenarios.archive_note IS
  '보관 사유 메모(예: unreferenced_before_scene_grounding_replacement_20260910).';

CREATE INDEX IF NOT EXISTS scenarios_current_content_idx
  ON public.scenarios (content_format, created_at DESC)
  WHERE archived_at IS NULL;
