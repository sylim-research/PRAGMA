-- content_review_v3 approval compatibility (2026-09-12).
-- The app moved CONTENT_REVIEW_VERSION to content_review_v3 (17f68028: changed finalization criteria —
-- uncovered speech acts marked not_covered, reason-item lineage paths follow the schema). The DB approval
-- contract (hash readiness, evidence completeness, professor decisions, critical-issue overrides, status
-- transition) did not change, but four functions still pinned the literal 'content_review_v2', so no v3
-- review could be decided or approved. Only that version literal is replaced; every other condition is kept
-- verbatim from the deployed definitions. Unknown criteria versions stay rejected. No data change.

-- Single source of truth for the criteria versions the approval contract accepts.
-- Higher rank = newer criteria; 0 = unsupported (never approved, never published).
CREATE OR REPLACE FUNCTION public.content_review_criteria_rank(p_version text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_version WHEN 'content_review_v3' THEN 3 WHEN 'content_review_v2' THEN 2 ELSE 0 END;
$$;
REVOKE ALL ON FUNCTION public.content_review_criteria_rank(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_content_review_base_ready(p_review_id uuid, p_content_hash text)
RETURNS public.content_review_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs; v_source jsonb; v_assignment record; v_dependency_hash text;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
  -- Source rows before review rows, matching mission finalization's lock order.
  IF v_review.kind = 'mission' THEN
    PERFORM 1 FROM public.scenarios WHERE scenario_id = v_review.target_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.curriculum_outlines WHERE id = v_review.target_id FOR UPDATE;
    PERFORM 1 FROM public.curriculum_weeks WHERE outline_id = v_review.target_id AND week_no = v_review.week_no FOR UPDATE;
    PERFORM 1 FROM public.curriculum_week_scenarios WHERE outline_id = v_review.target_id AND week_no = v_review.week_no FOR UPDATE;
    PERFORM 1 FROM public.scenarios WHERE scenario_id IN (
      SELECT scenario_id FROM public.curriculum_week_scenarios WHERE outline_id = v_review.target_id AND week_no = v_review.week_no
    ) ORDER BY scenario_id FOR UPDATE;
  END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.content_hash IS DISTINCT FROM p_content_hash
    OR public.content_review_criteria_rank(v_review.criteria_version) = 0 OR COALESCE(v_review.rules->>'verdict','') NOT IN ('pass','warning')
    OR (v_review.approval_policy = 'multimodel_v2' AND (v_review.openai_review IS NULL OR v_review.claude_review IS NULL OR v_review.adjudication IS NULL))
    OR (v_review.approval_policy = 'focused_v1' AND v_review.openai_review IS NULL AND v_review.generation_quality IS NULL)
    OR (v_review.approval_policy = 'focused_v1' AND v_review.independent_review_requested AND
      (v_review.claude_review IS NULL OR (jsonb_array_length(v_review.claude_review#>'{result,findings}') > 0 AND v_review.adjudication IS NULL)))
    OR v_review.running_stage IS NOT NULL THEN RAISE EXCEPTION 'Complete the required quality evidence for the current version'; END IF;

  IF v_review.kind = 'mission' AND v_review.snapshot#>>'{criteria,finalization}' = 'mission_finalization_v1'
    AND (jsonb_typeof(v_review.prepared_finalization) IS DISTINCT FROM 'object'
      OR v_review.prepared_finalization#>>'{authoring,stage}' IS DISTINCT FROM 'professor_finalized'
      OR v_review.prepared_finalization#>>'{authoring,lineage_status}' IS DISTINCT FROM 'complete') THEN
    RAISE EXCEPTION 'Prepare final review evidence before professor decisions and approval';
  END IF;
  PERFORM public.validate_content_review_outputs(v_review);
  v_source := public.get_content_review_source(v_review.kind, v_review.target_id, v_review.week_no);
  IF v_source->>'source_hash' IS DISTINCT FROM v_review.source_hash THEN RAISE EXCEPTION 'Content changed: review the current version'; END IF;
  IF v_review.approval_policy = 'focused_v1' AND v_review.generation_quality IS NOT NULL THEN
    IF v_review.kind <> 'mission'
      OR v_review.generation_quality->'quality_check' IS DISTINCT FROM v_source#>'{source,scenario,mission_content,quality_check}'
      OR v_review.generation_quality->>'mission_content_hash' IS DISTINCT FROM v_source#>>'{source,scenario,mission_content,provenance,mission_content_hash}'
      OR v_review.generation_quality->>'mission_content_hash' IS DISTINCT FROM v_review.generation_quality#>>'{quality_check,mission_content_hash}'
      OR COALESCE(v_review.generation_quality->>'mission_content_hash','') !~ '^[0-9a-f]{64}$'
      OR COALESCE(v_review.generation_quality#>>'{quality_check,verdict}','') NOT IN ('pass','warning','fail')
      OR length(btrim(COALESCE(v_review.generation_quality#>>'{quality_check,model}',''))) = 0
      OR length(btrim(COALESCE(v_review.generation_quality#>>'{quality_check,prompt_version}',''))) = 0
      OR length(btrim(COALESCE(v_review.generation_quality#>>'{quality_check,checked_at}',''))) = 0
      OR jsonb_typeof(v_review.generation_quality#>'{quality_check,findings}') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Generation quality evidence does not match the stored mission';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_review.generation_quality#>'{quality_check,findings}') f
      WHERE COALESCE(f->>'severity','') NOT IN ('warning','fail'))
      OR v_review.generation_quality#>>'{quality_check,verdict}' IS DISTINCT FROM (CASE
        WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_review.generation_quality#>'{quality_check,findings}') f WHERE f->>'severity' = 'fail') THEN 'fail'
        WHEN jsonb_array_length(v_review.generation_quality#>'{quality_check,findings}') > 0 THEN 'warning' ELSE 'pass' END) THEN
      RAISE EXCEPTION 'Inconsistent generation quality evidence';
    END IF;
  END IF;
  IF v_review.kind = 'weekly_material' THEN
    FOR v_assignment IN SELECT scenario_id FROM public.curriculum_week_scenarios
      WHERE outline_id = v_review.target_id AND week_no = v_review.week_no LOOP
      v_dependency_hash := public.get_content_review_source('mission', v_assignment.scenario_id, 0)->>'source_hash';
      -- An approval of the exact current source under any supported criteria version counts.
      IF NOT EXISTS (SELECT 1 FROM public.content_review_runs r WHERE r.kind = 'mission'
        AND r.target_id = v_assignment.scenario_id AND r.source_hash = v_dependency_hash
        AND public.content_review_criteria_rank(r.criteria_version) > 0 AND r.approved_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Approve the current version of each assigned mission first';
      END IF;
    END LOOP;
  END IF;
  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_content_review_ready(p_review_id uuid, p_content_hash text)
RETURNS public.content_review_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs; v_source jsonb; v_ref jsonb; v_hash text;
BEGIN
  v_review := public.assert_content_review_base_ready(p_review_id, p_content_hash);
  IF v_review.kind = 'weekly_material' THEN
    v_source := public.content_review_source_internal(v_review.kind, v_review.target_id, v_review.week_no);
    IF v_source#>'{source,teaching_draft}' IS NOT NULL THEN
      IF v_source#>>'{source,teaching_current}' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Teaching source changed'; END IF;
      FOR v_ref IN SELECT jsonb_array_elements(v_source#>'{source,teaching_references}') LOOP
        v_hash := public.content_review_source_internal('mission', (v_ref->>'scenario_id')::uuid, 0)->>'source_hash';
        IF NOT EXISTS (SELECT 1 FROM public.content_review_runs WHERE kind = 'mission' AND target_id = (v_ref->>'scenario_id')::uuid
          AND source_hash = v_hash AND public.content_review_criteria_rank(criteria_version) > 0 AND approved_at IS NOT NULL)
          THEN RAISE EXCEPTION 'Approve the current version of each teaching source mission first'; END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_review_scenario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.mission_status IN ('reviewed','released') THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Keep approved mission history; do not delete it'; END IF;
    IF public.content_review_scenario_source(to_jsonb(NEW)) IS DISTINCT FROM public.content_review_scenario_source(to_jsonb(OLD))
      OR NEW.mission_status IS DISTINCT FROM OLD.mission_status THEN
      RAISE EXCEPTION 'Approved mission content is immutable; create a new draft';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.mission_status IN ('reviewed','released') THEN
    v_hash := public.content_review_mission_source_hash(to_jsonb(NEW));
    IF NOT EXISTS (SELECT 1 FROM public.content_review_runs r WHERE r.kind = 'mission' AND r.target_id = NEW.scenario_id
      AND r.source_hash = v_hash AND public.content_review_criteria_rank(r.criteria_version) > 0 AND r.approved_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Current content requires five-stage professor approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Public handout = the approved snapshot for the exact current source. When several supported-version
-- approvals exist for the same source, the newest criteria wins, then the latest approval, so a stale v2
-- approval never shadows a current v3 one.
CREATE OR REPLACE FUNCTION public.get_approved_weekly_material(p_outline_id uuid, p_week_no integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_source jsonb; v_review public.content_review_runs;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) AND NOT (
    COALESCE(public.has_completed_learner_profile(), false) AND EXISTS (
      SELECT 1 FROM public.curriculum_outlines WHERE id = p_outline_id AND status = 'published'
    )
  ) THEN RAISE EXCEPTION 'Published course and learner profile required'; END IF;
  v_source := public.content_review_source_internal('weekly_material', p_outline_id, p_week_no);
  SELECT * INTO v_review FROM public.content_review_runs WHERE kind = 'weekly_material'
    AND target_id = p_outline_id AND week_no = p_week_no AND source_hash = v_source->>'source_hash'
    AND public.content_review_criteria_rank(criteria_version) > 0 AND approved_at IS NOT NULL
    ORDER BY public.content_review_criteria_rank(criteria_version) DESC, approved_at DESC, created_at DESC
    LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('reviewId', v_review.id, 'contentHash', v_review.content_hash,
    'material', v_review.snapshot#>'{content,public_material}');
END;
$$;
