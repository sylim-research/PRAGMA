-- GOLD 1+2: append-only teacher drafts; existing content-review remains the publication gate.
CREATE TABLE public.weekly_teaching_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_id uuid NOT NULL REFERENCES public.curriculum_outlines(id),
  week_no integer NOT NULL CHECK (week_no IN (2,3,4,5,6,7,9,10,11,12,13,14)),
  revision integer NOT NULL CHECK (revision > 0),
  kind text NOT NULL CHECK (kind IN ('lesson','discussion')),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_config jsonb NOT NULL,
  sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array'),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outline_id, week_no, revision),
  CHECK ((kind = 'discussion') = (week_no IN (7,14)))
);
ALTER TABLE public.weekly_teaching_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_teaching_admin_read ON public.weekly_teaching_materials
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.weekly_teaching_materials FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.weekly_teaching_materials TO authenticated, service_role;

-- Keep the original source projection for stable hashes on weeks without new material.
ALTER FUNCTION public.content_review_source_internal(text, uuid, integer) RENAME TO content_review_base_source_internal;

CREATE FUNCTION public.teaching_material_context_internal(p_outline_id uuid, p_week_no integer, p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_base jsonb; v_refs jsonb; v_semantic jsonb; v_ids jsonb := p_config->'missionIds';
BEGIN
  IF jsonb_typeof(v_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(v_ids) > 6
    OR length(COALESCE(p_config->>'extraText','')) > 12000 OR length(COALESCE(p_config->>'extraRef','')) > 500
    THEN RAISE EXCEPTION 'Invalid source selection'; END IF;
  v_base := public.content_review_base_source_internal('weekly_material', p_outline_id, p_week_no);
  IF p_week_no NOT IN (2,3,4,5,6,7,9,10,11,12,13,14) OR v_base#>>'{source,week,type}' IS DISTINCT FROM 'regular'
    THEN RAISE EXCEPTION 'Only lesson and discussion weeks are supported'; END IF;
  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'scenario_id'), '[]'::jsonb) INTO v_refs FROM (
    SELECT public.content_review_scenario_source(to_jsonb(s), true) || jsonb_build_object('week_no', min(a.week_no),
      'content_release_id',to_jsonb(s)->'content_release_id') AS r
    FROM public.scenarios s JOIN public.curriculum_week_scenarios a ON a.scenario_id = s.scenario_id
    WHERE a.outline_id = p_outline_id AND s.scenario_id::text IN (SELECT jsonb_array_elements_text(v_ids))
      AND s.mission_status IN ('reviewed','released') AND s.mission_content IS NOT NULL
      AND ((p_week_no IN (7,14) AND a.week_no >= 2 AND a.week_no < p_week_no)
        OR (p_week_no NOT IN (7,14) AND a.week_no = p_week_no))
    GROUP BY s.scenario_id
  ) selected;
  -- The old review source omitted release IDs. Enrich only this new path from saved rows, never from the caller.
  v_base := jsonb_set(v_base,'{source,scenarios}',COALESCE((SELECT jsonb_agg(r || jsonb_build_object(
    'content_release_id',(SELECT to_jsonb(s)->'content_release_id' FROM public.scenarios s WHERE s.scenario_id=(r->>'scenario_id')::uuid))
    ORDER BY r->>'scenario_id') FROM jsonb_array_elements(v_base#>'{source,scenarios}') r),'[]'::jsonb));
  SELECT COALESCE(jsonb_agg(jsonb_set(r, '{mission_content}', public.pragma_review_instructional_mission(r->'mission_content'))
    ORDER BY r->>'scenario_id'), '[]'::jsonb) INTO v_semantic FROM jsonb_array_elements(v_refs) r;
  RETURN jsonb_build_object('base', v_base->'source', 'references', v_refs,
    'source_hash', encode(extensions.digest(jsonb_build_object('base_hash', v_base->>'source_hash',
      'references', v_semantic, 'config', p_config)::text, 'sha256'), 'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.teaching_material_context_internal(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_teaching_material_context(p_outline_id uuid, p_week_no integer, p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (COALESCE(public.is_admin(),false) OR COALESCE(auth.role() = 'service_role',false)) THEN RAISE EXCEPTION 'Admin required'; END IF;
  RETURN public.teaching_material_context_internal(p_outline_id, p_week_no, p_config);
END;
$$;
REVOKE ALL ON FUNCTION public.get_teaching_material_context(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teaching_material_context(uuid, integer, jsonb) TO authenticated, service_role;

CREATE FUNCTION public.get_teaching_material_state(p_outline_id uuid, p_week_no integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_draft public.weekly_teaching_materials; v_context jsonb;
BEGIN
  IF NOT (COALESCE(public.is_admin(),false) OR COALESCE(auth.role() = 'service_role',false)) THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO v_draft FROM public.weekly_teaching_materials WHERE outline_id = p_outline_id AND week_no = p_week_no ORDER BY revision DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('draft',null,'current',true); END IF;
  v_context := public.teaching_material_context_internal(p_outline_id,p_week_no,v_draft.source_config);
  RETURN jsonb_build_object('draft',to_jsonb(v_draft),'current',v_context->>'source_hash' = v_draft.source_hash);
END;
$$;
REVOKE ALL ON FUNCTION public.get_teaching_material_state(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teaching_material_state(uuid, integer) TO authenticated, service_role;

-- Server validates schema before this call. Serialize revision changes and re-read the source after the model call.
CREATE FUNCTION public.save_teaching_material(p_outline_id uuid, p_week_no integer, p_expected_revision integer,
  p_source_hash text, p_config jsonb, p_sources jsonb, p_content jsonb, p_provenance jsonb, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_revision integer; v_context jsonb; v_draft public.weekly_teaching_materials;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_outline_id::text || ':' || p_week_no::text, 0));
  SELECT COALESCE(max(revision),0) INTO v_revision FROM public.weekly_teaching_materials WHERE outline_id=p_outline_id AND week_no=p_week_no;
  IF v_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Draft changed; reload before saving'; END IF;
  v_context := public.teaching_material_context_internal(p_outline_id,p_week_no,p_config);
  IF v_context->>'source_hash' IS DISTINCT FROM p_source_hash THEN RAISE EXCEPTION 'Source changed; prepare again'; END IF;
  IF jsonb_array_length(v_context->'references') <> jsonb_array_length(p_config->'missionIds')
    OR jsonb_array_length(v_context->'references') = 0 THEN RAISE EXCEPTION 'Choose current assigned reviewed missions'; END IF;
  IF jsonb_typeof(p_content->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(p_content->'sections') <> 4
    OR jsonb_typeof(p_content->'instructor_notes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_content->'instructor_notes') = 0
    OR COALESCE(p_provenance->>'prompt_version','') <> 'weekly_teaching_v1'
    OR COALESCE(p_provenance->>'response_id','') = '' THEN RAISE EXCEPTION 'Incomplete draft'; END IF;
  INSERT INTO public.weekly_teaching_materials(outline_id,week_no,revision,kind,source_hash,source_config,sources,content,provenance,created_by)
    VALUES(p_outline_id,p_week_no,v_revision+1,CASE WHEN p_week_no IN (7,14) THEN 'discussion' ELSE 'lesson' END,
      p_source_hash,p_config,p_sources,p_content,p_provenance,p_actor) RETURNING * INTO v_draft;
  RETURN to_jsonb(v_draft);
END;
$$;
REVOKE ALL ON FUNCTION public.save_teaching_material(uuid,integer,integer,text,jsonb,jsonb,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_teaching_material(uuid,integer,integer,text,jsonb,jsonb,jsonb,jsonb,uuid) TO service_role;

CREATE FUNCTION public.content_review_source_internal(p_kind text,p_target_id uuid,p_week_no integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public,extensions AS $$
DECLARE v_base jsonb; v_context jsonb; v_draft public.weekly_teaching_materials; v_added jsonb;
BEGIN
  v_base := public.content_review_base_source_internal(p_kind,p_target_id,p_week_no);
  IF p_kind <> 'weekly_material' THEN RETURN v_base; END IF;
  SELECT * INTO v_draft FROM public.weekly_teaching_materials WHERE outline_id=p_target_id AND week_no=p_week_no ORDER BY revision DESC LIMIT 1;
  IF NOT FOUND THEN RETURN v_base; END IF;
  v_context := public.teaching_material_context_internal(p_target_id,p_week_no,v_draft.source_config);
  v_added := jsonb_build_object('teaching_draft',to_jsonb(v_draft),'teaching_current',v_context->>'source_hash'=v_draft.source_hash,
    'teaching_references',v_context->'references');
  RETURN jsonb_build_object('source',(v_context->'base') || v_added,
    'source_hash',encode(extensions.digest(jsonb_build_object('base_hash',v_base->>'source_hash',
      'draft',v_draft.id,'content',v_draft.content,'current_source_hash',v_context->>'source_hash')::text,'sha256'),'hex'));
END;
$$;
REVOKE ALL ON FUNCTION public.content_review_source_internal(text,uuid,integer) FROM PUBLIC,anon,authenticated;

-- Prior-week discussion sources have the same current-mission approval requirement as assigned lesson missions.
ALTER FUNCTION public.assert_content_review_ready(uuid,text) RENAME TO assert_content_review_base_ready;
CREATE FUNCTION public.assert_content_review_ready(p_review_id uuid,p_content_hash text)
RETURNS public.content_review_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_review public.content_review_runs; v_source jsonb; v_ref jsonb; v_hash text;
BEGIN
  v_review := public.assert_content_review_base_ready(p_review_id,p_content_hash);
  IF v_review.kind='weekly_material' THEN
    v_source := public.content_review_source_internal(v_review.kind,v_review.target_id,v_review.week_no);
    IF v_source#>'{source,teaching_draft}' IS NOT NULL THEN
      IF v_source#>>'{source,teaching_current}' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Teaching source changed'; END IF;
      FOR v_ref IN SELECT jsonb_array_elements(v_source#>'{source,teaching_references}') LOOP
        v_hash := public.content_review_source_internal('mission',(v_ref->>'scenario_id')::uuid,0)->>'source_hash';
        IF NOT EXISTS (SELECT 1 FROM public.content_review_runs WHERE kind='mission' AND target_id=(v_ref->>'scenario_id')::uuid
          AND source_hash=v_hash AND criteria_version='content_review_v2' AND approved_at IS NOT NULL)
          THEN RAISE EXCEPTION 'Approve the current version of each teaching source mission first'; END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_content_review_ready(uuid,text) FROM PUBLIC,anon,authenticated;
