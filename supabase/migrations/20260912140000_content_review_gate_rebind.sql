-- Gate provenance rebind (2026-09-12).
-- On 2026-09-11 the generation gate was re-run at quality_v24 on 20 unchanged missions. The re-run replaced
-- only `mission_content.quality_check`; the instructional content, its `provenance.mission_content_hash`, the
-- review source hash and the review content hash are all unchanged. The official reviews therefore still carry
-- the quality_v22 gate in `generation_quality` and inside the immutable `prepared_finalization`, and approval
-- correctly refuses them ('Generation quality evidence does not match the stored mission' /
-- 'Finalization cannot replace the current critic result'). Both conditions are real safety checks and are NOT
-- relaxed here.
--
-- This migration adds the missing operation instead: bind an existing review's semantic evidence to the gate the
-- mission actually carries now, as a NEW review row. The prior row keeps every byte of its evidence and is marked
-- superseded, so the v22 record survives as history. No model is called, no content changes, and nothing that
-- could grant an approval is loosened — a superseded row is additionally refused for decisions and approval.
--
-- Only `quality_check` is gate-derived inside a prepared artifact: generate-scenario's finalize_mission copies the
-- mission's quality_check verbatim and explicitly excludes it (with provenance, hsk_lexical_audit, authoring) from
-- `mission_content_hash`, so item lineage, the HSK audit and the finalized hash cannot move when only the gate does.

-- 1. Provenance columns. superseded_by is deferred so one transaction can mark the old row and insert its
--    replacement while the active-identity index below still sees exactly one active row per statement.
ALTER TABLE public.content_review_runs
  ADD COLUMN superseded_by uuid REFERENCES public.content_review_runs(id) DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN rebound_from uuid REFERENCES public.content_review_runs(id),
  ADD COLUMN rebound_at timestamptz,
  ADD COLUMN rebound_by uuid REFERENCES auth.users(id),
  ADD CONSTRAINT content_review_runs_supersede_not_self CHECK (superseded_by IS DISTINCT FROM id),
  ADD CONSTRAINT content_review_runs_rebind_not_self CHECK (rebound_from IS DISTINCT FROM id),
  -- An approved review is a published record: it is never superseded, so every approval lookup in this schema
  -- (weekly dependencies, the scenario publication guard, the public handout) keeps selecting live evidence only.
  ADD CONSTRAINT content_review_runs_superseded_unapproved CHECK (superseded_by IS NULL OR approved_at IS NULL),
  ADD CONSTRAINT content_review_runs_rebind_provenance CHECK (
    (rebound_from IS NULL) = (rebound_at IS NULL) AND (rebound_from IS NULL) = (rebound_by IS NULL));

-- 2. One ACTIVE row per review identity; superseded rows stay readable for history and audit.
DO $migration$
DECLARE v_name text;
BEGIN
  SELECT c.conname INTO v_name FROM pg_constraint c
  WHERE c.conrelid = 'public.content_review_runs'::regclass AND c.contype = 'u'
    AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(c.conkey) k
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
        = ARRAY['content_hash','criteria_version','kind','source_hash','target_id','week_no'];
  IF v_name IS NULL THEN RAISE EXCEPTION 'Unexpected review identity constraint'; END IF;
  EXECUTE format('ALTER TABLE public.content_review_runs DROP CONSTRAINT %I', v_name);
END;
$migration$;
CREATE UNIQUE INDEX content_review_runs_active_identity_idx ON public.content_review_runs
  (kind, target_id, week_no, source_hash, content_hash, criteria_version) WHERE superseded_by IS NULL;

-- 3. A superseded row is frozen exactly like an approved one: it is the historical record of the earlier gate.
CREATE OR REPLACE FUNCTION public.guard_prepared_content_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.superseded_by IS NOT NULL THEN RAISE EXCEPTION 'Superseded review evidence is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.superseded_by IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Superseded review evidence is immutable';
  END IF;
  IF OLD.prepared_finalization IS NOT NULL AND (
    NEW.prepared_finalization IS DISTINCT FROM OLD.prepared_finalization
    OR NEW.rules IS DISTINCT FROM OLD.rules OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.source_hash IS DISTINCT FROM OLD.source_hash OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.target_id IS DISTINCT FROM OLD.target_id
  ) THEN RAISE EXCEPTION 'Prepared review evidence is immutable; create a new review version'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER guard_prepared_content_review_trg ON public.content_review_runs;
CREATE TRIGGER guard_prepared_content_review_trg BEFORE UPDATE OR DELETE ON public.content_review_runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_prepared_content_review();

-- 4. Readiness gains one rejection and loses none: a replaced review version can never carry a decision or an
--    approval. Applied to the deployed definition so every existing condition is preserved verbatim.
DO $migration$
DECLARE v_definition text; v_anchor text;
BEGIN
  SELECT pg_get_functiondef('public.assert_content_review_base_ready(uuid,text)'::regprocedure) INTO v_definition;
  v_anchor := '  PERFORM public.validate_content_review_outputs(v_review);';
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected review readiness definition'; END IF;
  EXECUTE replace(v_definition, v_anchor, $guard$
  IF v_review.superseded_by IS NOT NULL THEN
    RAISE EXCEPTION 'This review version was replaced; use the current review of this content';
  END IF;
  PERFORM public.validate_content_review_outputs(v_review);$guard$);
END;
$migration$;

-- 5. The rebind itself. One transaction, no model call, no content write, no approval.
--    Returns the id of the current active review for this content.
CREATE FUNCTION public.rebind_content_review_gate(p_review_id uuid, p_content_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_review public.content_review_runs;
  v_mission jsonb; v_quality jsonb; v_gate jsonb; v_prepared jsonb; v_source jsonb;
  v_requires_finalization boolean; v_new_id uuid; v_hops integer := 0;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
  IF v_review.kind <> 'mission' THEN RAISE EXCEPTION 'Gate evidence exists only for mission reviews'; END IF;

  -- Source row before review rows, matching the approval lock order; this also serialises concurrent rebinds.
  PERFORM 1 FROM public.scenarios WHERE scenario_id = v_review.target_id FOR UPDATE;
  -- A repeated call on an already-rebound id resolves to the current row instead of creating a second one.
  LOOP
    SELECT * INTO v_review FROM public.content_review_runs WHERE id = p_review_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
    EXIT WHEN v_review.superseded_by IS NULL;
    p_review_id := v_review.superseded_by;
    v_hops := v_hops + 1;
    IF v_hops > 10 THEN RAISE EXCEPTION 'Review supersede chain is too long'; END IF;
  END LOOP;

  IF v_review.content_hash IS DISTINCT FROM p_content_hash THEN RAISE EXCEPTION 'Review content version mismatch'; END IF;
  IF public.content_review_criteria_rank(v_review.criteria_version) = 0 THEN RAISE EXCEPTION 'Unsupported review criteria version'; END IF;
  IF v_review.approval_policy <> 'focused_v1' OR v_review.generation_quality IS NULL THEN
    RAISE EXCEPTION 'No reused generation quality evidence to rebind';
  END IF;
  IF v_review.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Approved review evidence is immutable'; END IF;
  IF jsonb_array_length(v_review.professor_decisions) > 0 OR v_review.professor_decisions_at IS NOT NULL
    OR v_review.professor_note IS NOT NULL OR v_review.openai_fail_override IS NOT NULL
    OR v_review.instructor_experience IS NOT NULL THEN
    RAISE EXCEPTION 'Professor work is already recorded on this review; rebind it manually';
  END IF;
  IF v_review.running_stage IS NOT NULL OR v_review.lease_token IS NOT NULL THEN
    RAISE EXCEPTION 'A review stage is still running';
  END IF;

  SELECT mission_content INTO v_mission FROM public.scenarios WHERE scenario_id = v_review.target_id;
  IF jsonb_typeof(v_mission) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Saved mission not found'; END IF;
  v_source := public.get_content_review_source('mission', v_review.target_id, 0);
  IF v_source->>'source_hash' IS DISTINCT FROM v_review.source_hash THEN
    RAISE EXCEPTION 'Content changed: review the current version';
  END IF;
  v_quality := v_mission->'quality_check';
  -- Same shape the Edge builds from the stored mission (reusableGenerationQuality); readiness re-checks it below.
  v_gate := jsonb_build_object('mission_content_hash', v_mission#>'{provenance,mission_content_hash}',
    'quality_check', v_quality);

  v_requires_finalization := v_review.snapshot#>>'{criteria,finalization}' = 'mission_finalization_v1';
  v_prepared := v_review.prepared_finalization;
  IF v_requires_finalization THEN
    IF jsonb_typeof(v_prepared) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Prepare final review evidence before rebinding the gate';
    END IF;
    IF public.pragma_review_instructional_mission(v_prepared)
       IS DISTINCT FROM public.pragma_review_instructional_mission(v_mission) THEN
      RAISE EXCEPTION 'Prepared artifact no longer matches the stored mission; prepare a new review version';
    END IF;
    -- quality_check is the only gate-derived field; every other part of the artifact is carried unchanged.
    v_prepared := jsonb_set(v_prepared, '{quality_check}', COALESCE(v_quality, 'null'::jsonb), true);
  END IF;

  IF v_review.generation_quality IS NOT DISTINCT FROM v_gate
    AND (NOT v_requires_finalization OR v_prepared IS NOT DISTINCT FROM v_review.prepared_finalization) THEN
    RETURN v_review.id;  -- already bound to the current gate
  END IF;

  v_new_id := gen_random_uuid();
  UPDATE public.content_review_runs SET superseded_by = v_new_id WHERE id = v_review.id;
  INSERT INTO public.content_review_runs (
    id, kind, target_id, week_no, source_hash, content_hash, criteria_version,
    snapshot, rules, openai_review, claude_review, adjudication,
    approval_policy, generation_quality, independent_review_requested, prepared_finalization,
    professor_decisions, created_by, rebound_from, rebound_at, rebound_by
  ) VALUES (
    v_new_id, v_review.kind, v_review.target_id, v_review.week_no, v_review.source_hash, v_review.content_hash,
    v_review.criteria_version, v_review.snapshot, v_review.rules,
    -- The semantic evidence is carried over as it was produced, with its own model, response id and timestamp.
    v_review.openai_review, v_review.claude_review, v_review.adjudication,
    v_review.approval_policy, v_gate, v_review.independent_review_requested, v_prepared,
    '[]'::jsonb, auth.uid(), v_review.id, now(), auth.uid()
  );
  -- The replacement must clear the unchanged approval contract on its own, or nothing here is committed.
  PERFORM public.assert_content_review_base_ready(v_new_id, v_review.content_hash);
  RETURN v_new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rebind_content_review_gate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebind_content_review_gate(uuid, text) TO authenticated;
