-- Cross-check: Chinese expression review (DeepSeek), 2026-10-20.
-- An optional stage after the independent (Claude) review, inside the same opt-in cross-check. Three states are
-- stored and shown separately: NULL = not run, status 'failed' = attempted and failed (key, balance, provider
-- error), status 'completed' = finished (zero findings included). Not-run and failed never block approval.
-- Opinions from a completed run join the same approval contract as Claude's: adjudication must decide every
-- one of them, and those that need a human appear in the professor's required findings.
-- Existing reviews, approvals and evidence are untouched; nothing is backfilled.

-- SQL NULL = not run. An object must carry a known status: a CHECK that evaluates to NULL passes, so a missing
-- or null status is coalesced to '' and rejected rather than slipping through as an unknown state.
ALTER TABLE public.content_review_runs
  ADD COLUMN deepseek_review jsonb CHECK (
    deepseek_review IS NULL OR (jsonb_typeof(deepseek_review) = 'object'
      AND COALESCE(deepseek_review->>'status', '') IN ('completed', 'failed')));

ALTER TABLE public.content_review_runs DROP CONSTRAINT content_review_runs_running_stage_check;
ALTER TABLE public.content_review_runs ADD CONSTRAINT content_review_runs_running_stage_check
  CHECK (running_stage IN ('openai', 'claude', 'deepseek', 'adjudication', 'finalization'));

-- Findings of a completed Chinese expression review; empty for not-run or failed.
CREATE FUNCTION public.content_review_deepseek_findings(p_review public.content_review_runs)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_review.deepseek_review->>'status' = 'completed'
    THEN COALESCE(p_review.deepseek_review#>'{result,findings}', '[]'::jsonb) ELSE '[]'::jsonb END;
$$;
REVOKE ALL ON FUNCTION public.content_review_deepseek_findings(public.content_review_runs) FROM PUBLIC, anon, authenticated;

-- Same definition as 20260909230000 with the completed Chinese expression findings added after Claude's, and the
-- focused-policy rule the admin UI already applies (professorReviewFindings, 2026-09-19): a finding the
-- adjudication accepted or refined goes to the professor whatever its severity. Without it the UI asked for a
-- decision the DB then refused to save (count mismatch); the gap predates this stage and would carry into it.
CREATE OR REPLACE FUNCTION public.content_review_required_findings(p_review public.content_review_runs)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_findings jsonb; v_generation jsonb; v_rules jsonb; v_cross jsonb;
BEGIN
  v_cross := COALESCE(p_review.claude_review#>'{result,findings}','[]'::jsonb) || public.content_review_deepseek_findings(p_review);
  SELECT COALESCE(jsonb_agg(f ORDER BY i), '[]'::jsonb) INTO v_rules
    FROM jsonb_array_elements(COALESCE(p_review.rules->'findings','[]'::jsonb)) WITH ORDINALITY x(f,i)
    WHERE f->>'needs_professor' = 'true';
  IF p_review.approval_policy <> 'focused_v1' THEN
    RETURN v_rules || v_cross;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id','generation-' || i,'severity',f->>'severity','needs_professor',f->>'severity' = 'fail') ORDER BY i),'[]'::jsonb)
    INTO v_generation FROM jsonb_array_elements(COALESCE(p_review.generation_quality#>'{quality_check,findings}','[]'::jsonb)) WITH ORDINALITY x(f,i);
  v_findings := v_rules || COALESCE(p_review.openai_review#>'{result,findings}','[]'::jsonb) || v_generation || v_cross;
  RETURN (SELECT COALESCE(jsonb_agg(f ORDER BY i),'[]'::jsonb) FROM jsonb_array_elements(v_findings) WITH ORDINALITY x(f,i)
    WHERE f->>'severity' = 'fail' OR f->>'needs_professor' = 'true'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_review.professor_decisions) d WHERE d->>'finding_id' = f->>'id')
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_review.adjudication#>'{result,decisions}','[]'::jsonb)) d
        WHERE d->>'finding_id' = f->>'id' AND d->>'decision' IN ('accept','refine')));
END;
$$;

-- Same definition as 20260906100000, plus: a completed Chinese expression review is validated like any model
-- output, a failed one must say why, and adjudication must decide Claude's and DeepSeek's findings exactly once.
CREATE OR REPLACE FUNCTION public.validate_content_review_outputs(p_review public.content_review_runs)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_output jsonb; v_findings jsonb; v_decisions jsonb; v_stage text; v_light boolean := p_review.approval_policy = 'focused_v1';
BEGIN
  IF v_light AND p_review.openai_review IS NULL AND p_review.generation_quality IS NULL THEN RAISE EXCEPTION 'Primary quality evidence required'; END IF;
  IF v_light AND p_review.adjudication IS NOT NULL AND p_review.claude_review IS NULL THEN RAISE EXCEPTION 'Claude review required for adjudication'; END IF;
  IF p_review.deepseek_review IS NOT NULL AND (NOT v_light OR p_review.claude_review IS NULL) THEN
    RAISE EXCEPTION 'Chinese expression review belongs to the cross-check after Claude';
  END IF;
  IF p_review.deepseek_review->>'status' = 'failed' AND (
    length(btrim(COALESCE(p_review.deepseek_review->>'error_ko', ''))) = 0
    OR length(btrim(COALESCE(p_review.deepseek_review->>'requested_model', ''))) = 0) THEN
    RAISE EXCEPTION 'A failed Chinese expression review must record its cause';
  END IF;
  FOREACH v_stage IN ARRAY ARRAY['openai','claude','deepseek','adjudication'] LOOP
    v_output := CASE v_stage WHEN 'openai' THEN p_review.openai_review WHEN 'claude' THEN p_review.claude_review
      WHEN 'deepseek' THEN CASE WHEN p_review.deepseek_review->>'status' = 'completed' THEN p_review.deepseek_review END
      ELSE p_review.adjudication END;
    IF v_stage = 'deepseek' AND v_output IS NULL THEN CONTINUE; END IF;
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
  v_findings := p_review.claude_review#>'{result,findings}' || public.content_review_deepseek_findings(p_review);
  v_decisions := p_review.adjudication#>'{result,decisions}';
  IF jsonb_typeof(v_decisions) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid adjudication'; END IF;
  IF jsonb_array_length(v_decisions) <> jsonb_array_length(v_findings)
    OR (SELECT count(DISTINCT d->>'finding_id') FROM jsonb_array_elements(v_decisions) d) <> jsonb_array_length(v_decisions)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_decisions) d WHERE
      NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_findings) f WHERE f->>'id' = d->>'finding_id')
      OR COALESCE(d->>'decision','') NOT IN ('accept','refine','reject')
      OR length(btrim(COALESCE(d->>'rationale_ko',''))) = 0) THEN
    RAISE EXCEPTION 'Adjudicate every Claude and DeepSeek finding exactly once';
  END IF;
END;
$$;

-- Readiness: when the completed Chinese expression review has findings, adjudication is required even if Claude
-- had none. Applied to the deployed definition so every other condition is preserved verbatim.
DO $migration$
DECLARE v_definition text; v_anchor text;
BEGIN
  SELECT pg_get_functiondef('public.assert_content_review_base_ready(uuid,text)'::regprocedure) INTO v_definition;
  v_anchor := $a$(jsonb_array_length(v_review.claude_review#>'{result,findings}') > 0 AND v_review.adjudication IS NULL)$a$;
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected review readiness definition'; END IF;
  EXECUTE replace(v_definition, v_anchor,
    $r$(jsonb_array_length(v_review.claude_review#>'{result,findings}') + jsonb_array_length(public.content_review_deepseek_findings(v_review)) > 0 AND v_review.adjudication IS NULL)$r$);

  -- Gate rebind carries the Chinese expression review forward with the rest of the semantic evidence.
  SELECT pg_get_functiondef('public.rebind_content_review_gate(uuid,text)'::regprocedure) INTO v_definition;
  v_anchor := '    snapshot, rules, openai_review, claude_review, adjudication,';
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected gate rebind column list'; END IF;
  v_definition := replace(v_definition, v_anchor, '    snapshot, rules, openai_review, claude_review, deepseek_review, adjudication,');
  v_anchor := '    v_review.openai_review, v_review.claude_review, v_review.adjudication,';
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected gate rebind values'; END IF;
  EXECUTE replace(v_definition, v_anchor, '    v_review.openai_review, v_review.claude_review, v_review.deepseek_review, v_review.adjudication,');
END;
$migration$;
