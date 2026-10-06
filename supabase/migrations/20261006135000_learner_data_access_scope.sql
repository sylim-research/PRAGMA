-- Account-scoped learner data access, including explicitly shared examples.
-- No account, identity, or learning record is modified or deleted.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_view_shared_learner_profile(p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
 SELECT auth.uid() = 'ec113ef0-38b7-47bb-982a-5beb76e8ca04'::uuid
   AND public.is_admin() AND p_profile_id IN ('f4b03f7d-9607-4ba8-afa5-5bf32dc1c757'::uuid, '3848347c-3fff-4cc3-9bfe-3f1eb9bda469'::uuid);
$function$;
REVOKE ALL ON FUNCTION public.can_view_shared_learner_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_shared_learner_profile(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_manage_learner_data()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
 SELECT auth.uid() IN ('d322fda7-e91c-4cb9-88c5-a675727e6119'::uuid, '1df45acd-9506-4cb2-87ce-576c7c5f819d'::uuid) AND public.is_admin();
$function$;
REVOKE ALL ON FUNCTION public.can_manage_learner_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_learner_data() TO authenticated;
DROP POLICY IF EXISTS owner_learner_data_read ON public.profiles;
CREATE POLICY owner_learner_data_read ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
 USING (public.can_manage_learner_data() OR user_id = auth.uid() OR public.can_view_shared_learner_profile(id));
DROP POLICY IF EXISTS owner_learner_data_read ON public.learner_mission_logs;
CREATE POLICY owner_learner_data_read ON public.learner_mission_logs AS RESTRICTIVE FOR SELECT TO authenticated
 USING (public.can_manage_learner_data() OR auth_user_id = auth.uid() OR public.can_view_shared_learner_profile(profile_id));
DROP POLICY IF EXISTS owner_learner_data_read ON public.learner_mission_events;
CREATE POLICY owner_learner_data_read ON public.learner_mission_events AS RESTRICTIVE FOR SELECT TO authenticated
 USING (public.can_manage_learner_data() OR auth_user_id = auth.uid() OR public.can_view_shared_learner_profile(profile_id));
DROP POLICY IF EXISTS owner_learner_data_read ON public.decision_traces;
CREATE POLICY owner_learner_data_read ON public.decision_traces AS RESTRICTIVE FOR SELECT TO authenticated
 USING (public.can_manage_learner_data() OR auth_user_id = auth.uid() OR public.can_view_shared_learner_profile(profile_id));
DROP POLICY IF EXISTS owner_learner_data_read ON public.class_response_releases;
CREATE POLICY owner_learner_data_read ON public.class_response_releases AS RESTRICTIVE FOR SELECT TO authenticated
 USING (public.can_manage_learner_data() OR false);
DROP POLICY IF EXISTS owner_learner_profile_update ON public.profiles;
CREATE POLICY owner_learner_profile_update ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (public.can_manage_learner_data() OR user_id = auth.uid())
 WITH CHECK (public.can_manage_learner_data() OR user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.learner_get_peer_responses(p_course_id uuid, p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row public.class_response_releases;
BEGIN
  IF public.is_admin() AND NOT COALESCE(public.can_manage_learner_data(), false) THEN
    RAISE EXCEPTION 'Learner data owner access required' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('state', 'unavailable');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.curriculum_week_scenarios assignment
    JOIN public.curriculum_outlines outline ON outline.id = assignment.outline_id
    WHERE assignment.outline_id = p_course_id
      AND assignment.scenario_id = p_mission_id
      AND outline.status = 'published'
  ) THEN
    RETURN jsonb_build_object('state', 'unavailable');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.learner_mission_logs
    WHERE auth_user_id = auth.uid()
      AND mission_id = p_mission_id::text
      AND mission_completed = true
  ) THEN
    RETURN jsonb_build_object('state', 'completion_required');
  END IF;

  SELECT * INTO v_row FROM public.class_response_releases
  WHERE course_id = p_course_id AND mission_id = p_mission_id;
  IF v_row.course_id IS NULL OR v_row.status = 'collecting' THEN
    RETURN jsonb_build_object('state', 'awaiting_release');
  END IF;
  IF v_row.snapshot_learner_count < 5 THEN
    RETURN jsonb_build_object(
      'state', 'minimum_not_met',
      'learnerCount', v_row.snapshot_learner_count
    );
  END IF;
  IF v_row.status <> 'released' THEN
    RETURN jsonb_build_object('state', 'awaiting_release');
  END IF;
  RETURN jsonb_build_object(
    'state', 'released',
    'learnerCount', v_row.snapshot_learner_count,
    'releasedAt', v_row.released_at,
    'pattern', v_row.snapshot_pattern
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.export_learner_mission_events(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_count integer;
BEGIN
  IF NOT COALESCE(public.can_manage_learner_data(), false) THEN
    RAISE EXCEPTION 'Learner data owner access required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can export research data';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'export_schema_version', 'mission_event_export_v1',
          'participant_key', p.anonymous_participant_id,
          'attempt_id', e.attempt_id,
          'event_seq', e.event_seq,
          'scenario_id', e.scenario_id,
          'lineage_version_id', e.lineage_version_id,
          'mission_id', e.mission_id,
          'event_type', e.event_type,
          'event_payload', e.event_payload,
          'feature_id', e.feature_id,
          'speech_act', e.speech_act,
          'direction', e.direction,
          'task_mode', e.task_mode,
          'content_version', e.content_version,
          'content_hash', e.content_hash,
          'policy_version', e.policy_version,
          'consent_version', e.consent_version,
          'occurred_at', e.occurred_at,
          'recorded_at', e.recorded_at
        )
        ORDER BY e.attempt_id, e.event_seq
      ),
      '[]'::jsonb
    ),
    count(*)
  INTO v_result, v_count
  FROM public.learner_mission_events e
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE (p_from IS NULL OR e.occurred_at >= p_from)
    AND (p_to IS NULL OR e.occurred_at <= p_to)
    AND p.consent_data_use = true
    AND p.consent_anonymous_analysis = true
    AND p.research_consent_version = e.consent_version
    AND p.anonymous_participant_id IS NOT NULL;

  INSERT INTO public.research_data_exports (
    export_schema_version, dataset_type, filter_spec, row_count, requested_by
  ) VALUES (
    'mission_event_export_v1',
    'learner_mission_events',
    jsonb_build_object('from', p_from, 'to', p_to),
    v_count,
    auth.uid()
  );

  RETURN v_result;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.materialize_pragma_improvement_candidates(p_window_start timestamp with time zone DEFAULT (now() - '180 days'::interval), p_window_end timestamp with time zone DEFAULT now(), p_min_distinct_attempts integer DEFAULT 3, p_min_distinct_participants integer DEFAULT 3)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_group record;
  v_candidate_id uuid;
  v_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_learner_count integer := 0;
  v_expert_count integer := 0;
  v_gold_count integer := 0;
  v_fingerprint text;
  v_candidate_keys text[];
  v_claim_keys text[];
  v_refs jsonb;
  v_mismatch_fields text[];
  v_refresh_id uuid;
BEGIN
  IF NOT COALESCE(public.can_manage_learner_data(), false) THEN
    RAISE EXCEPTION 'Learner data owner access required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can materialize improvement candidates';
  END IF;
  IF p_window_start >= p_window_end OR p_min_distinct_attempts < 3
     OR p_min_distinct_participants < 3 THEN
    RAISE EXCEPTION 'A valid window and minimum 3 distinct attempts/participants are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-improvement-materializer-v1', 0));

  -- Learner evidence is eligible only while consent is still current, and only when
  -- the event matches the exact released lineage, server-owned feature, speech act,
  -- direction, content hash, and a structured dissent payload.
  FOR v_group IN
    WITH eligible AS (
      SELECT event.id, event.attempt_id, event.profile_id, event.recorded_at,
             lineage.id AS lineage_version_id,
             lineage.mission_content->'unit'->>'target_feature' AS target_feature,
             lineage.mission_content_hash AS content_hash,
             lineage.realization_pack_id, lineage.realization_pack_version
      FROM public.learner_mission_events event
      JOIN public.profiles profile ON profile.id = event.profile_id
      JOIN public.mission_lineage_versions lineage
        ON lineage.id = event.lineage_version_id
       AND lineage.stage = 'released'
       AND lineage.coverage_status = 'covered'
       AND lineage.mission_content_hash = event.content_hash
       AND lineage.mission_content->'unit'->>'target_feature' = event.feature_id
       AND COALESCE(lineage.mission_content->>'direction', 'ko_zh') = event.direction
      JOIN public.scenarios scenario ON scenario.scenario_id = lineage.scenario_id
       AND scenario.speech_act::text = event.speech_act
      WHERE event.event_type = 'learner_dissent_submitted'
        AND event.recorded_at >= p_window_start AND event.recorded_at < p_window_end
        AND profile.consent_data_use = true
        AND profile.consent_anonymous_analysis = true
        AND profile.research_consent_version = event.consent_version
        AND jsonb_typeof(event.event_payload->'dissent') = 'object'
        AND event.event_payload->'dissent'->>'kind' = 'learner_dissent'
        AND length(btrim(COALESCE(event.event_payload->'dissent'->>'reason_ko', ''))) > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.pragma_improvement_candidate_sources source
          WHERE source.source_type = 'learner_mission_event' AND source.source_id = event.id
        )
    )
    SELECT lineage_version_id, target_feature, content_hash,
           realization_pack_id, realization_pack_version,
           array_agg(id ORDER BY id) AS source_ids,
           count(DISTINCT attempt_id)::integer AS distinct_attempts,
           count(DISTINCT profile_id)::integer AS distinct_participants,
           min(recorded_at) AS window_start, max(recorded_at) AS window_end
    FROM eligible
    GROUP BY lineage_version_id, target_feature, content_hash,
             realization_pack_id, realization_pack_version
    HAVING count(DISTINCT attempt_id) >= p_min_distinct_attempts
       AND count(DISTINCT profile_id) >= p_min_distinct_participants
  LOOP
    v_fingerprint := encode(
      extensions.digest(convert_to(array_to_string(v_group.source_ids, ','), 'UTF8'), 'sha256'::text),
      'hex'
    );
    v_refs := (SELECT jsonb_agg('learner-event:' || source_id::text ORDER BY source_id)
               FROM unnest(v_group.source_ids) source_id);
    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'learner:' || v_fingerprint,
      'learner_dissent_cluster', v_group.target_feature, v_group.content_hash,
      v_group.realization_pack_id, v_group.realization_pack_version, v_refs,
      jsonb_build_object(
        'lineage_version_id', v_group.lineage_version_id,
        'distinct_attempt_count', v_group.distinct_attempts,
        'distinct_participant_count', v_group.distinct_participants,
        'dissent_event_count', cardinality(v_group.source_ids),
        'minimum_distinct_attempts', p_min_distinct_attempts,
        'minimum_distinct_participants', p_min_distinct_participants
      ),
      'review_content_and_rule_scope', auth.uid(), 'pragma_improvement_signal_v2',
      v_fingerprint, v_group.window_start, v_group.window_end
    ) ON CONFLICT (candidate_key) DO NOTHING RETURNING id INTO v_candidate_id;
    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_snapshot
      )
      SELECT v_candidate_id, 'learner_mission_event', event.id,
             jsonb_build_object(
               'event_type', event.event_type,
               'lineage_version_id', event.lineage_version_id,
               'feature_id', v_group.target_feature,
               'content_hash', event.content_hash,
               'recorded_at', event.recorded_at
             )
      FROM public.learner_mission_events event
      WHERE event.id = ANY(v_group.source_ids);
      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_learner_count := v_learner_count + 1;
    END IF;
  END LOOP;

  -- Expert evidence is materialized only after every blind assignment in one round has
  -- submitted. Candidate-band and lineage-claim disagreement are both retained.
  FOR v_group IN
    SELECT review.lineage_version_id, review.review_round,
           lineage.mission_content->'unit'->>'target_feature' AS target_feature,
           lineage.mission_content_hash AS content_hash,
           lineage.realization_pack_id, lineage.realization_pack_version,
           array_agg(review.id ORDER BY review.id) AS source_ids,
           count(DISTINCT review.reviewer_user_id)::integer AS reviewer_count,
           count(DISTINCT review.overall_verdict)::integer AS overall_variant_count,
           count(DISTINCT review.candidate_band_assessments::text)::integer AS candidate_variant_count,
           count(DISTINCT review.lineage_claim_assessments::text)::integer AS claim_variant_count,
           min(review.submitted_at) AS window_start, max(review.submitted_at) AS window_end
    FROM public.mission_expert_reviews review
    JOIN public.mission_expert_review_assignments assignment
      ON assignment.id = review.assignment_id
     AND assignment.blind_review = true
     AND assignment.review_round = review.review_round
    JOIN public.mission_lineage_versions lineage
      ON lineage.id = review.lineage_version_id
     AND lineage.coverage_status = 'covered'
     AND lineage.realization_pack_id IS NOT NULL
    WHERE review.schema_version = 'mission_expert_review_v2'
      AND review.submitted_at >= p_window_start AND review.submitted_at < p_window_end
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_improvement_candidate_sources source
        WHERE source.source_type = 'mission_expert_review' AND source.source_id = review.id
      )
    GROUP BY review.lineage_version_id, review.review_round,
             lineage.mission_content, lineage.mission_content_hash,
             lineage.realization_pack_id, lineage.realization_pack_version
    HAVING count(DISTINCT review.reviewer_user_id) >= 2
       AND count(*) = (
         SELECT count(*) FROM public.mission_expert_review_assignments expected
         WHERE expected.lineage_version_id = review.lineage_version_id
           AND expected.review_round = review.review_round
           AND expected.blind_review = true
       )
       AND (
         count(DISTINCT review.overall_verdict) > 1
         OR count(DISTINCT review.candidate_band_assessments::text) > 1
         OR count(DISTINCT review.lineage_claim_assessments::text) > 1
       )
  LOOP
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO v_candidate_keys
    FROM (
      SELECT key
      FROM public.mission_expert_reviews review,
           LATERAL jsonb_object_keys(review.candidate_band_assessments) key
      WHERE review.id = ANY(v_group.source_ids)
      GROUP BY key
      HAVING count(DISTINCT (review.candidate_band_assessments->key)::text) > 1
    ) disagreement;
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO v_claim_keys
    FROM (
      SELECT key
      FROM public.mission_expert_reviews review,
           LATERAL jsonb_object_keys(review.lineage_claim_assessments) key
      WHERE review.id = ANY(v_group.source_ids)
      GROUP BY key
      HAVING count(DISTINCT (review.lineage_claim_assessments->key)::text) > 1
    ) disagreement;

    v_fingerprint := encode(extensions.digest(convert_to(
      v_group.lineage_version_id::text || ':' || v_group.review_round::text || ':' ||
      array_to_string(v_group.source_ids, ','), 'UTF8'), 'sha256'::text), 'hex');
    SELECT COALESCE(jsonb_agg(ref ORDER BY ref), '[]'::jsonb) INTO v_refs
    FROM (
      SELECT 'expert-review:' || source_id::text AS ref FROM unnest(v_group.source_ids) source_id
      UNION ALL
      SELECT 'candidate:' || key FROM unnest(v_candidate_keys) key
      UNION ALL
      SELECT 'claim:' || key FROM unnest(v_claim_keys) key
    ) refs;
    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'expert:' || v_fingerprint,
      'expert_disagreement', v_group.target_feature, v_group.content_hash,
      v_group.realization_pack_id, v_group.realization_pack_version, v_refs,
      jsonb_build_object(
        'lineage_version_id', v_group.lineage_version_id,
        'review_round', v_group.review_round,
        'reviewer_count', v_group.reviewer_count,
        'overall_variant_count', v_group.overall_variant_count,
        'candidate_disagreement_keys', to_jsonb(v_candidate_keys),
        'lineage_claim_disagreement_keys', to_jsonb(v_claim_keys)
      ),
      'resolve_expert_boundary_case', auth.uid(), 'pragma_improvement_signal_v2',
      v_fingerprint, v_group.window_start, v_group.window_end
    ) ON CONFLICT (candidate_key) DO NOTHING RETURNING id INTO v_candidate_id;
    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'mission_expert_review', review.id,
             'round:' || v_group.review_round::text,
             jsonb_build_object(
               'lineage_version_id', review.lineage_version_id,
               'review_round', review.review_round,
               'overall_verdict', review.overall_verdict,
               'submitted_at', review.submitted_at
             )
      FROM public.mission_expert_reviews review WHERE review.id = ANY(v_group.source_ids);
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'mission_candidate_disagreement', v_group.lineage_version_id,
             'round:' || v_group.review_round::text || ':candidate:' || key,
             jsonb_build_object('review_ids', to_jsonb(v_group.source_ids))
      FROM unnest(v_candidate_keys) key;
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'mission_claim_disagreement', v_group.lineage_version_id,
             'round:' || v_group.review_round::text || ':claim:' || key,
             jsonb_build_object('review_ids', to_jsonb(v_group.source_ids))
      FROM unnest(v_claim_keys) key;
      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_expert_count := v_expert_count + 1;
    END IF;
  END LOOP;

  -- Gold drift comes only from an immutable persisted server-computed run. Every concrete
  -- band/semantic mismatch is retained, with the run itself as the authoritative source.
  FOR v_group IN
    SELECT run.*
    FROM public.pragma_gold_regression_runs run
    WHERE run.gate_status = 'fail'
      AND run.created_at >= p_window_start AND run.created_at < p_window_end
      AND NOT EXISTS (
        SELECT 1 FROM public.pragma_improvement_candidate_sources source
        WHERE source.source_type = 'gold_regression_run' AND source.source_id = run.id
      )
  LOOP
    WITH expected AS (
      SELECT snapshot->>'case_id' AS case_id,
             candidate->>'candidate_id' AS candidate_id,
             candidate->>'expected_band_code' AS expected_band,
             candidate->>'semantic_fidelity' AS expected_semantic
      FROM jsonb_array_elements(v_group.gold_case_snapshots) snapshot,
           LATERAL jsonb_array_elements(snapshot->'candidates') candidate
    ), observed AS (
      SELECT observation->>'case_id' AS case_id,
             observation->>'candidate_id' AS candidate_id,
             observation->>'predicted_band_code' AS predicted_band,
             observation->>'predicted_semantic_fidelity' AS predicted_semantic
      FROM jsonb_array_elements(v_group.observations) observation
    ), mismatch AS (
      SELECT expected.case_id || '::' || expected.candidate_id || '::band' AS field
      FROM expected LEFT JOIN observed USING (case_id, candidate_id)
      WHERE observed.case_id IS NULL OR expected.expected_band IS DISTINCT FROM observed.predicted_band
      UNION
      SELECT expected.case_id || '::' || expected.candidate_id || '::semantic' AS field
      FROM expected LEFT JOIN observed USING (case_id, candidate_id)
      WHERE observed.case_id IS NULL OR expected.expected_semantic IS DISTINCT FROM observed.predicted_semantic
      UNION
      SELECT observed.case_id || '::' || observed.candidate_id || '::unknown' AS field
      FROM observed LEFT JOIN expected USING (case_id, candidate_id) WHERE expected.case_id IS NULL
      UNION
      SELECT observed.case_id || '::' || observed.candidate_id || '::duplicate' AS field
      FROM observed GROUP BY observed.case_id, observed.candidate_id HAVING count(*) > 1
    )
    SELECT COALESCE(array_agg(field ORDER BY field), '{}') INTO v_mismatch_fields FROM mismatch;

    v_fingerprint := encode(
      extensions.digest(convert_to(v_group.id::text, 'UTF8'), 'sha256'::text),
      'hex'
    );
    SELECT jsonb_agg(ref ORDER BY ref) INTO v_refs
    FROM (
      SELECT 'gold-run:' || v_group.id::text AS ref
      UNION ALL
      SELECT 'gold-mismatch:' || field FROM unnest(v_mismatch_fields) field
    ) refs;
    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'gold:' || v_group.id::text,
      'gold_regression_drift', NULL, NULL,
      v_group.realization_pack_id, v_group.realization_pack_version, v_refs,
      v_group.report || jsonb_build_object(
        'gold_regression_run_id', v_group.id,
        'mismatch_fields', to_jsonb(v_mismatch_fields),
        'impacted_gold_case_ids', COALESCE((
          SELECT jsonb_agg(DISTINCT split_part(field, '::', 1))
          FROM unnest(v_mismatch_fields) field
        ), '[]'::jsonb)
      ),
      'review_gold_label_or_evaluator', auth.uid(), 'pragma_improvement_signal_v2',
      v_fingerprint, v_group.created_at, v_group.created_at
    ) ON CONFLICT (candidate_key) DO NOTHING RETURNING id INTO v_candidate_id;
    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_snapshot
      ) VALUES (
        v_candidate_id, 'gold_regression_run', v_group.id,
        jsonb_build_object(
          'gate_status', v_group.gate_status,
          'evaluator_version', v_group.evaluator_version,
          'prompt_snapshot_hash', v_group.prompt_snapshot_hash,
          'created_at', v_group.created_at
        )
      );
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_field, source_snapshot
      )
      SELECT v_candidate_id, 'gold_regression_mismatch', v_group.id, field,
             jsonb_build_object('field', field)
      FROM unnest(v_mismatch_fields) field;
      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_gold_count := v_gold_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.pragma_improvement_refresh_runs (
    contract_version, window_start, window_end, thresholds,
    created_candidate_ids, created_counts, created_by
  ) VALUES (
    'pragma_improvement_materializer_v1', p_window_start, p_window_end,
    jsonb_build_object(
      'minimum_distinct_attempts', p_min_distinct_attempts,
      'minimum_distinct_participants', p_min_distinct_participants,
      'current_consent_required', true,
      'exact_released_lineage_required', true
    ),
    v_candidate_ids,
    jsonb_build_object(
      'learner_dissent_cluster', v_learner_count,
      'expert_disagreement', v_expert_count,
      'gold_regression_drift', v_gold_count,
      'total', cardinality(v_candidate_ids)
    ),
    auth.uid()
  ) RETURNING id INTO v_refresh_id;
  RETURN v_refresh_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.materialize_pragma_learner_improvement_candidates(p_window_start timestamp with time zone DEFAULT (now() - '180 days'::interval), p_window_end timestamp with time zone DEFAULT now(), p_min_distinct_attempts integer DEFAULT 3, p_min_distinct_participants integer DEFAULT 3)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_group record;
  v_candidate_id uuid;
  v_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_learner_count integer := 0;
  v_fingerprint text;
  v_refs jsonb;
  v_refresh_id uuid;
BEGIN
  IF NOT COALESCE(public.can_manage_learner_data(), false) THEN
    RAISE EXCEPTION 'Learner data owner access required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can materialize learner improvement candidates';
  END IF;
  IF p_window_start >= p_window_end
     OR p_min_distinct_attempts < 3
     OR p_min_distinct_participants < 3 THEN
    RAISE EXCEPTION 'A valid window and minimum 3 distinct attempts/participants are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('pragma-learner-improvement-materializer-v2', 0));

  FOR v_group IN
    WITH eligible AS (
      SELECT event.id, event.attempt_id, event.profile_id, event.recorded_at,
             lineage.id AS lineage_version_id,
             lineage.mission_content->'unit'->>'target_feature' AS target_feature,
             lineage.mission_content_hash AS content_hash,
             lineage.realization_pack_id, lineage.realization_pack_version
      FROM public.learner_mission_events event
      JOIN public.profiles profile ON profile.id = event.profile_id
      JOIN public.mission_lineage_versions lineage
        ON lineage.id = event.lineage_version_id
       AND lineage.coverage_status = 'covered'
       AND (
         lineage.stage = 'released'
         OR (
           lineage.stage = 'reviewed'
           AND lineage.mission_content->'authoring'->>'stage' = 'professor_finalized'
         )
       )
       AND lineage.mission_content_hash = event.content_hash
       AND lineage.mission_content->'unit'->>'target_feature' = event.feature_id
       AND COALESCE(lineage.mission_content->>'direction', 'ko_zh') = event.direction
      JOIN public.scenarios scenario
        ON scenario.scenario_id = lineage.scenario_id
       AND scenario.speech_act::text = event.speech_act
       AND scenario.mission_content = lineage.mission_content
       AND scenario.mission_status IN ('reviewed', 'released')
      WHERE event.event_type = 'learner_dissent_submitted'
        AND event.recorded_at >= p_window_start
        AND event.recorded_at < p_window_end
        AND profile.consent_data_use = true
        AND profile.consent_anonymous_analysis = true
        AND profile.research_consent_version = event.consent_version
        AND jsonb_typeof(event.event_payload->'dissent') = 'object'
        AND event.event_payload->'dissent'->>'kind' = 'learner_dissent'
        AND length(btrim(COALESCE(event.event_payload->'dissent'->>'reason_ko', ''))) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM public.pragma_improvement_candidate_sources source
          WHERE source.source_type = 'learner_mission_event'
            AND source.source_id = event.id
        )
    )
    SELECT lineage_version_id, target_feature, content_hash,
           realization_pack_id, realization_pack_version,
           array_agg(id ORDER BY id) AS source_ids,
           count(DISTINCT attempt_id)::integer AS distinct_attempts,
           count(DISTINCT profile_id)::integer AS distinct_participants,
           min(recorded_at) AS window_start,
           max(recorded_at) AS window_end
    FROM eligible
    GROUP BY lineage_version_id, target_feature, content_hash,
             realization_pack_id, realization_pack_version
    HAVING count(DISTINCT attempt_id) >= p_min_distinct_attempts
       AND count(DISTINCT profile_id) >= p_min_distinct_participants
  LOOP
    v_fingerprint := encode(
      extensions.digest(
        convert_to(array_to_string(v_group.source_ids, ','), 'UTF8'),
        'sha256'::text
      ),
      'hex'
    );
    SELECT jsonb_agg('learner-event:' || source_id::text ORDER BY source_id)
      INTO v_refs
    FROM unnest(v_group.source_ids) source_id;

    v_candidate_id := NULL;
    INSERT INTO public.pragma_improvement_candidates (
      candidate_key, signal_type, target_feature, content_hash,
      realization_pack_id, realization_pack_version, source_refs, metrics,
      suggested_action, created_by, analysis_contract_version,
      evidence_fingerprint, source_window_start, source_window_end
    ) VALUES (
      'learner:' || v_fingerprint,
      'learner_dissent_cluster',
      v_group.target_feature,
      v_group.content_hash,
      v_group.realization_pack_id,
      v_group.realization_pack_version,
      v_refs,
      jsonb_build_object(
        'lineage_version_id', v_group.lineage_version_id,
        'distinct_attempt_count', v_group.distinct_attempts,
        'distinct_participant_count', v_group.distinct_participants,
        'dissent_event_count', cardinality(v_group.source_ids),
        'minimum_distinct_attempts', p_min_distinct_attempts,
        'minimum_distinct_participants', p_min_distinct_participants
      ),
      'review_content_and_rule_scope',
      auth.uid(),
      'pragma_learner_improvement_signal_v2',
      v_fingerprint,
      v_group.window_start,
      v_group.window_end
    )
    ON CONFLICT (candidate_key) DO NOTHING
    RETURNING id INTO v_candidate_id;

    IF v_candidate_id IS NOT NULL THEN
      INSERT INTO public.pragma_improvement_candidate_sources (
        candidate_id, source_type, source_id, source_snapshot
      )
      SELECT v_candidate_id, 'learner_mission_event', event.id,
             jsonb_build_object(
               'event_type', event.event_type,
               'lineage_version_id', event.lineage_version_id,
               'feature_id', v_group.target_feature,
               'content_hash', event.content_hash,
               'recorded_at', event.recorded_at
             )
      FROM public.learner_mission_events event
      WHERE event.id = ANY(v_group.source_ids);

      v_candidate_ids := array_append(v_candidate_ids, v_candidate_id);
      v_learner_count := v_learner_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.pragma_improvement_refresh_runs (
    contract_version, window_start, window_end, thresholds,
    created_candidate_ids, created_counts, created_by
  ) VALUES (
    'pragma_learner_improvement_materializer_v2',
    p_window_start,
    p_window_end,
    jsonb_build_object(
      'minimum_distinct_attempts', p_min_distinct_attempts,
      'minimum_distinct_participants', p_min_distinct_participants,
      'current_consent_required', true,
      'professor_finalized_or_historical_release_required', true
    ),
    v_candidate_ids,
    jsonb_build_object(
      'learner_dissent_cluster', v_learner_count,
      'total', cardinality(v_candidate_ids)
    ),
    auth.uid()
  ) RETURNING id INTO v_refresh_id;

  RETURN v_refresh_id;
END;
$function$
;
COMMIT;
