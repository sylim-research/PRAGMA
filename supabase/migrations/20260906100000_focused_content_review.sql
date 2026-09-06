-- User-approved focused review: reuse current generation quality; optional independent review.
-- Preserve all existing evidence and human approval. No content or approval backfill.
ALTER TABLE public.content_review_runs
  ADD COLUMN approval_policy text NOT NULL DEFAULT 'multimodel_v2' CHECK (approval_policy IN ('multimodel_v2','focused_v1')),
  ADD COLUMN generation_quality jsonb,
  ADD COLUMN independent_review_requested boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.content_review_required_findings(p_review public.content_review_runs)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_findings jsonb; v_generation jsonb;
BEGIN
  IF p_review.approval_policy <> 'focused_v1' THEN RETURN p_review.claude_review#>'{result,findings}'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id','generation-' || i,'severity',f->>'severity','needs_professor',f->>'severity' = 'fail') ORDER BY i),'[]'::jsonb)
    INTO v_generation FROM jsonb_array_elements(COALESCE(p_review.generation_quality#>'{quality_check,findings}','[]'::jsonb)) WITH ORDINALITY x(f,i);
  v_findings := COALESCE(p_review.openai_review#>'{result,findings}','[]'::jsonb) || v_generation || COALESCE(p_review.claude_review#>'{result,findings}','[]'::jsonb);
  RETURN (SELECT COALESCE(jsonb_agg(f ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(v_findings) WITH ORDINALITY x(f,i)
    WHERE f->>'severity' = 'fail' OR f->>'needs_professor' = 'true'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_review.professor_decisions) d WHERE d->>'finding_id' = f->>'id'));
END;
$$;
REVOKE ALL ON FUNCTION public.content_review_required_findings(public.content_review_runs) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_content_review_outputs(p_review public.content_review_runs)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_output jsonb; v_findings jsonb; v_decisions jsonb; v_stage text; v_light boolean := p_review.approval_policy = 'focused_v1';
BEGIN
  IF v_light AND p_review.openai_review IS NULL AND p_review.generation_quality IS NULL THEN RAISE EXCEPTION 'Primary quality evidence required'; END IF;
  IF v_light AND p_review.adjudication IS NOT NULL AND p_review.claude_review IS NULL THEN RAISE EXCEPTION 'Claude review required for adjudication'; END IF;
  FOREACH v_stage IN ARRAY ARRAY['openai','claude','adjudication'] LOOP
    v_output := CASE v_stage WHEN 'openai' THEN p_review.openai_review WHEN 'claude' THEN p_review.claude_review ELSE p_review.adjudication END;
    IF v_light AND v_output IS NULL THEN CONTINUE; END IF;
    IF jsonb_typeof(v_output->'result') IS DISTINCT FROM 'object'
      OR v_output->>'prompt_version' IS DISTINCT FROM p_review.criteria_version || ':' || v_stage
      OR length(btrim(COALESCE(v_output->>'model', ''))) = 0
      OR length(btrim(COALESCE(v_output->>'response_id', ''))) = 0
      OR COALESCE(v_output->>'input_hash', '') !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'Incomplete model review output';
    END IF;
    IF v_stage <> 'adjudication' THEN
      v_findings := v_output#>'{result,findings}';
      IF jsonb_typeof(v_findings) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid model findings'; END IF;
      IF (SELECT count(DISTINCT f->>'id') FROM jsonb_array_elements(v_findings) f) <> jsonb_array_length(v_findings)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE COALESCE(f->>'id','') = ''
          OR COALESCE(f->>'severity','') NOT IN ('warning','fail'))
        OR v_output#>>'{result,verdict}' IS DISTINCT FROM (CASE
          WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE f->>'severity' = 'fail') THEN 'fail'
          WHEN jsonb_array_length(v_findings) > 0 THEN 'warning' ELSE 'pass' END) THEN
        RAISE EXCEPTION 'Inconsistent model findings';
      END IF;
    END IF;
  END LOOP;
  IF v_light AND p_review.adjudication IS NULL THEN RETURN; END IF;
  v_findings := p_review.claude_review#>'{result,findings}';
  v_decisions := p_review.adjudication#>'{result,decisions}';
  IF jsonb_typeof(v_decisions) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid adjudication'; END IF;
  IF jsonb_array_length(v_decisions) <> jsonb_array_length(v_findings)
    OR (SELECT count(DISTINCT d->>'finding_id') FROM jsonb_array_elements(v_decisions) d) <> jsonb_array_length(v_decisions)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_decisions) d WHERE
      NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE f->>'id' = d->>'finding_id')
      OR COALESCE(d->>'decision','') NOT IN ('accept','refine','reject')
      OR length(btrim(COALESCE(d->>'rationale_ko',''))) = 0) THEN
    RAISE EXCEPTION 'Adjudicate every Claude finding exactly once';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_content_review_ready(p_review_id uuid, p_content_hash text)
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
    OR v_review.criteria_version <> 'content_review_v2' OR COALESCE(v_review.rules->>'verdict','') NOT IN ('pass','warning')
    OR (v_review.approval_policy = 'multimodel_v2' AND (v_review.openai_review IS NULL OR v_review.claude_review IS NULL OR v_review.adjudication IS NULL))
    OR (v_review.approval_policy = 'focused_v1' AND v_review.openai_review IS NULL AND v_review.generation_quality IS NULL)
    OR (v_review.approval_policy = 'focused_v1' AND v_review.independent_review_requested AND
      (v_review.claude_review IS NULL OR (jsonb_array_length(v_review.claude_review#>'{result,findings}') > 0 AND v_review.adjudication IS NULL)))
    OR v_review.running_stage IS NOT NULL THEN RAISE EXCEPTION 'Complete the required quality evidence for the current version'; END IF;
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
      IF NOT EXISTS (SELECT 1 FROM public.content_review_runs r WHERE r.kind = 'mission'
        AND r.target_id = v_assignment.scenario_id AND r.source_hash = v_dependency_hash
        AND r.criteria_version = 'content_review_v2' AND r.approved_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Approve the current version of each assigned mission first';
      END IF;
    END LOOP;
  END IF;
  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_content_review_decisions(p_review_id uuid, p_content_hash text, p_decisions jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs;
BEGIN
  v_review := public.assert_content_review_ready(p_review_id, p_content_hash);
  IF v_review.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Final professor decisions are immutable'; END IF;
  PERFORM public.validate_content_review_decisions(public.content_review_required_findings(v_review), p_decisions);
  UPDATE public.content_review_runs SET professor_decisions = p_decisions,
    professor_decisions_by = auth.uid(), professor_decisions_at = now() WHERE id = p_review_id;
  RETURN p_review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_content_review(p_review_id uuid, p_content_hash text, p_note text, p_openai_fail_override text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.content_review_runs;
BEGIN
  v_review := public.assert_content_review_ready(p_review_id, p_content_hash);
  PERFORM public.validate_content_review_decisions(public.content_review_required_findings(v_review), v_review.professor_decisions, true);
  IF length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'Record a professor approval rationale (10+ characters)'; END IF;
  IF v_review.approval_policy = 'multimodel_v2' AND v_review.openai_review#>>'{result,verdict}' = 'fail' AND length(btrim(COALESCE(p_openai_fail_override,''))) < 10 THEN
    RAISE EXCEPTION 'Record an explicit rationale for OpenAI critical findings';
  END IF;
  IF v_review.kind = 'mission' AND NOT EXISTS (SELECT 1 FROM public.scenarios WHERE scenario_id = v_review.target_id AND mission_status IN ('reviewed','released')) THEN
    RAISE EXCEPTION 'Use mission finalization to approve a generated mission';
  END IF;
  IF v_review.approved_at IS NULL THEN
    UPDATE public.content_review_runs SET approved_by = auth.uid(), approved_at = now(), professor_note = btrim(p_note),
      openai_fail_override = CASE WHEN v_review.openai_review#>>'{result,verdict}' = 'fail' THEN btrim(p_openai_fail_override) END WHERE id = p_review_id;
  END IF;
  RETURN p_review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_reviewed_mission(p_scenario_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.scenarios%ROWTYPE;
  v_final jsonb := p_payload->'mission_content';
  v_overrides jsonb := COALESCE(p_payload->'issue_overrides', '[]'::jsonb);
  v_parent public.mission_lineage_versions%ROWTYPE;
  v_version integer;
  v_review public.content_review_runs;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Only admins can review missions'; END IF;
  IF jsonb_typeof(v_final) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_overrides) IS DISTINCT FROM 'array'
     OR v_final->'authoring'->>'stage' IS DISTINCT FROM 'professor_finalized'
     OR v_final->'authoring'->>'lineage_status' IS DISTINCT FROM 'complete'
     OR COALESCE(v_final->'provenance'->>'mission_content_hash', '') !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(v_final->'hsk_lexical_audit') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Finalized mission content is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_scenario_id::text, 0));
  SELECT * INTO v_row FROM public.scenarios
  WHERE scenario_id = p_scenario_id AND mission_status = 'generated' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission not found or not generated: %', p_scenario_id; END IF;
  v_review := public.assert_content_review_ready((p_payload->>'review_id')::uuid, p_payload->>'review_content_hash');
  PERFORM public.validate_content_review_decisions(public.content_review_required_findings(v_review), v_review.professor_decisions, true);
  IF v_review.kind <> 'mission' OR v_review.target_id <> p_scenario_id THEN RAISE EXCEPTION 'Review target mismatch'; END IF;
  IF length(btrim(COALESCE(p_payload->>'professor_note', ''))) < 10 THEN RAISE EXCEPTION 'Professor rationale required'; END IF;
  IF v_review.approval_policy = 'multimodel_v2' AND v_review.openai_review#>>'{result,verdict}' = 'fail' AND length(btrim(COALESCE(p_payload->>'openai_fail_override',''))) < 10 THEN
    RAISE EXCEPTION 'Record an explicit rationale for OpenAI critical findings';
  END IF;
  IF public.pragma_review_instructional_mission(v_final) IS DISTINCT FROM public.pragma_review_instructional_mission(v_row.mission_content) THEN
    RAISE EXCEPTION 'Finalization cannot change reviewed instructional content';
  END IF;
  IF v_final->'quality_check' IS DISTINCT FROM v_row.mission_content->'quality_check' THEN
    RAISE EXCEPTION 'Finalization cannot replace the current critic result';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_final->'quality_check'->'findings', '[]'::jsonb))
      WITH ORDINALITY finding(value, ordinality)
    WHERE finding.value->>'severity' = 'fail'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_overrides) override
        WHERE (override->>'issue_index')::integer = finding.ordinality - 1
          AND override->>'code' IS NOT DISTINCT FROM finding.value->>'code'
          AND COALESCE(override->>'where', '') IS NOT DISTINCT FROM COALESCE(finding.value->>'where', '')
          AND length(btrim(COALESCE(override->>'rationale_ko', ''))) >= 10
      )
  ) THEN
    RAISE EXCEPTION 'Every unresolved critical AI issue requires a professor override rationale';
  END IF;

  SELECT * INTO v_parent FROM public.mission_lineage_versions
  WHERE scenario_id = p_scenario_id ORDER BY version_no DESC LIMIT 1;
  IF v_parent.coverage_status = 'covered' AND jsonb_typeof(v_final->'item_lineage') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Covered mission requires finalized item lineage';
  END IF;

  v_final := jsonb_set(v_final, '{authoring,professor_issue_overrides}', v_overrides, true);
  -- The scenario trigger checks this approved record against NEW. All following
  -- writes roll back together if finalization or lineage insertion fails.
  UPDATE public.content_review_runs SET approved_by = auth.uid(), approved_at = now(),
    professor_note = btrim(p_payload->>'professor_note'),
    openai_fail_override = CASE WHEN v_review.openai_review#>>'{result,verdict}' = 'fail' THEN btrim(p_payload->>'openai_fail_override') END
    WHERE id = v_review.id AND approved_at IS NULL;
  UPDATE public.scenarios
  SET mission_content = v_final,
      mission_status = 'reviewed',
      mission_reviewed_by = auth.uid(),
      mission_reviewed_at = now(),
      updated_at = now()
  WHERE scenario_id = p_scenario_id;

  v_version := COALESCE(v_parent.version_no, 0) + 1;
  INSERT INTO public.mission_lineage_versions (
    scenario_id, version_no, parent_version_id, stage,
    mission_content, item_lineage, mission_content_hash,
    realization_pack_id, realization_pack_version, coverage_status,
    rule_scope_ids, risk_scope_ids, evidence_scope_ids,
    generation_provider, generation_model, prompt_version, prompt_snapshot_hash, prompt_instance_hash,
    generation_attempt, validation_result, ai_quality_result,
    actor_id, reviewed_by, reviewed_at, content_review_run_id
  ) VALUES (
    p_scenario_id, v_version, v_parent.id, 'reviewed',
    v_final, v_final->'item_lineage', v_final->'provenance'->>'mission_content_hash',
    v_parent.realization_pack_id, v_parent.realization_pack_version, v_parent.coverage_status,
    v_parent.rule_scope_ids, v_parent.risk_scope_ids, v_parent.evidence_scope_ids,
    v_parent.generation_provider, v_parent.generation_model, v_parent.prompt_version,
    v_parent.prompt_snapshot_hash, v_parent.prompt_instance_hash, v_parent.generation_attempt,
    v_parent.validation_result, v_final->'quality_check',
    auth.uid(), auth.uid(), now(), v_review.id
  );
  RETURN p_scenario_id;
END;
$$;
