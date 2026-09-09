-- Preserve existing approvals; new review snapshots explicitly require a prepared
-- final artifact. Neither a model result nor a warning grants professor approval.
ALTER TABLE public.content_review_runs
  ADD COLUMN prepared_finalization jsonb CHECK (
    prepared_finalization IS NULL OR jsonb_typeof(prepared_finalization) = 'object'
  );
ALTER TABLE public.content_review_runs DROP CONSTRAINT content_review_runs_running_stage_check;
ALTER TABLE public.content_review_runs ADD CONSTRAINT content_review_runs_running_stage_check
  CHECK (running_stage IN ('openai', 'claude', 'adjudication', 'finalization'));

CREATE OR REPLACE FUNCTION public.content_review_required_findings(p_review public.content_review_runs)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_findings jsonb; v_generation jsonb; v_rules jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(f ORDER BY i), '[]'::jsonb) INTO v_rules
    FROM jsonb_array_elements(COALESCE(p_review.rules->'findings','[]'::jsonb)) WITH ORDINALITY x(f,i)
    WHERE f->>'needs_professor' = 'true';
  IF p_review.approval_policy <> 'focused_v1' THEN
    RETURN v_rules || COALESCE(p_review.claude_review#>'{result,findings}','[]'::jsonb);
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id','generation-' || i,'severity',f->>'severity','needs_professor',f->>'severity' = 'fail') ORDER BY i),'[]'::jsonb)
    INTO v_generation FROM jsonb_array_elements(COALESCE(p_review.generation_quality#>'{quality_check,findings}','[]'::jsonb)) WITH ORDINALITY x(f,i);
  v_findings := v_rules || COALESCE(p_review.openai_review#>'{result,findings}','[]'::jsonb) || v_generation || COALESCE(p_review.claude_review#>'{result,findings}','[]'::jsonb);
  RETURN (SELECT COALESCE(jsonb_agg(f ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(v_findings) WITH ORDINALITY x(f,i)
    WHERE f->>'severity' = 'fail' OR f->>'needs_professor' = 'true'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_review.professor_decisions) d WHERE d->>'finding_id' = f->>'id'));
END;
$$;

CREATE FUNCTION public.guard_prepared_content_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.prepared_finalization IS NOT NULL AND (
    NEW.prepared_finalization IS DISTINCT FROM OLD.prepared_finalization
    OR NEW.rules IS DISTINCT FROM OLD.rules OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.source_hash IS DISTINCT FROM OLD.source_hash OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.target_id IS DISTINCT FROM OLD.target_id
  ) THEN RAISE EXCEPTION 'Prepared review evidence is immutable; create a new review version'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_prepared_content_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_prepared_content_review_trg BEFORE UPDATE ON public.content_review_runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_prepared_content_review();

-- Keep the existing source locks, model evidence and professor checks intact.
DO $migration$
DECLARE v_definition text; v_anchor text;
BEGIN
  SELECT pg_get_functiondef('public.assert_content_review_base_ready(uuid,text)'::regprocedure) INTO v_definition;
  v_anchor := '  PERFORM public.validate_content_review_outputs(v_review);';
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected review readiness definition'; END IF;
  EXECUTE replace(v_definition, v_anchor, $guard$
  IF v_review.kind = 'mission' AND v_review.snapshot#>>'{criteria,finalization}' = 'mission_finalization_v1'
    AND (jsonb_typeof(v_review.prepared_finalization) IS DISTINCT FROM 'object'
      OR v_review.prepared_finalization#>>'{authoring,stage}' IS DISTINCT FROM 'professor_finalized'
      OR v_review.prepared_finalization#>>'{authoring,lineage_status}' IS DISTINCT FROM 'complete') THEN
    RAISE EXCEPTION 'Prepare final review evidence before professor decisions and approval';
  END IF;
  PERFORM public.validate_content_review_outputs(v_review);$guard$);

  SELECT pg_get_functiondef('public.finalize_reviewed_mission(uuid,jsonb)'::regprocedure) INTO v_definition;
  v_anchor := '  IF public.pragma_review_instructional_mission(v_final) IS DISTINCT FROM public.pragma_review_instructional_mission(v_row.mission_content) THEN';
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected finalization definition'; END IF;
  EXECUTE replace(v_definition, v_anchor, $guard$
  IF v_review.snapshot#>>'{criteria,finalization}' = 'mission_finalization_v1'
    AND (v_review.prepared_finalization IS NULL OR v_final IS DISTINCT FROM v_review.prepared_finalization) THEN
    RAISE EXCEPTION 'Finalization must use the exact professor-reviewed artifact';
  END IF;
  IF public.pragma_review_instructional_mission(v_final) IS DISTINCT FROM public.pragma_review_instructional_mission(v_row.mission_content) THEN$guard$);
END;
$migration$;
