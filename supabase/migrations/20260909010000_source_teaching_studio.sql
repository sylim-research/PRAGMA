-- Source-first drafts reuse the append-only store and the existing publication gate.
-- Neither existing drafts nor their hashes are rewritten.
ALTER TABLE public.weekly_teaching_materials DROP CONSTRAINT weekly_teaching_materials_check;
ALTER FUNCTION public.teaching_material_context_internal(uuid,integer,jsonb) RENAME TO teaching_material_context_v1_internal;

CREATE FUNCTION public.teaching_material_context_internal(p_outline_id uuid,p_week_no integer,p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_context jsonb; v_scope jsonb; v_sources jsonb := p_config->'sources'; v_source jsonb;
BEGIN
  v_context := public.teaching_material_context_v1_internal(p_outline_id,p_week_no,p_config);
  IF p_config->>'workflow' IS DISTINCT FROM 'source' THEN RETURN v_context; END IF;
  IF jsonb_typeof(v_sources) IS DISTINCT FROM 'array' OR jsonb_array_length(v_sources) NOT BETWEEN 1 AND 6
    OR COALESCE(p_config->>'outputKind','') NOT IN ('lesson','discussion')
    OR length(COALESCE(p_config->>'focus','')) > 2000
    OR COALESCE(p_config->>'activityMode','') NOT IN ('individual','pair','group','whole_class')
    OR COALESCE(p_config->>'extraText','') <> '' OR COALESCE(p_config->>'extraRef','') <> ''
    THEN RAISE EXCEPTION 'Invalid confirmed sources or generation settings'; END IF;
  FOR v_source IN SELECT jsonb_array_elements(v_sources) LOOP
    IF v_source->>'confirmed' IS DISTINCT FROM 'true' OR length(trim(COALESCE(v_source->>'text',''))) = 0
      OR length(trim(COALESCE(v_source->>'label',''))) NOT BETWEEN 1 AND 160
      OR length(trim(COALESCE(v_source->>'ref',''))) NOT BETWEEN 1 AND 500
      OR COALESCE(v_source->>'id','') !~ '^S[a-zA-Z0-9]{1,12}$'
      OR COALESCE(v_source->>'kind','') NOT IN ('text','pdf')
      THEN RAISE EXCEPTION 'Confirm source text and attribution'; END IF;
  END LOOP;
  IF (SELECT sum(length(s->>'text')) > 60000 OR count(DISTINCT s->>'id') <> count(*) FROM jsonb_array_elements(v_sources) s)
    THEN RAISE EXCEPTION 'Invalid source size or duplicate source'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('week_no',week_no,'speech_act',speech_act,'can_do',can_do) ORDER BY week_no),'[]'::jsonb)
    INTO v_scope FROM public.curriculum_weeks WHERE outline_id=p_outline_id AND type='regular'
      AND ((p_week_no IN (7,14) AND week_no>=2 AND week_no<p_week_no AND speech_act IS NOT NULL) OR week_no=p_week_no);
  v_context := jsonb_set(v_context,'{base,scope_weeks}',v_scope);
  RETURN jsonb_set(v_context,'{source_hash}',to_jsonb(encode(extensions.digest(
    jsonb_build_object('source_hash',v_context->>'source_hash','scope_weeks',v_scope)::text,'sha256'),'hex')));
END;
$$;
REVOKE ALL ON FUNCTION public.teaching_material_context_internal(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_teaching_material(p_outline_id uuid,p_week_no integer,p_expected_revision integer,
  p_source_hash text,p_config jsonb,p_sources jsonb,p_content jsonb,p_provenance jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_revision integer; v_context jsonb; v_draft public.weekly_teaching_materials;
  v_source_mode boolean := COALESCE(p_config->>'workflow'='source',false);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_outline_id::text||':'||p_week_no::text,0));
  SELECT COALESCE(max(revision),0) INTO v_revision FROM public.weekly_teaching_materials WHERE outline_id=p_outline_id AND week_no=p_week_no;
  IF v_revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Draft changed; reload before saving'; END IF;
  v_context := public.teaching_material_context_internal(p_outline_id,p_week_no,p_config);
  IF v_context->>'source_hash' IS DISTINCT FROM p_source_hash THEN RAISE EXCEPTION 'Source changed; prepare again'; END IF;
  IF jsonb_array_length(v_context->'references') <> jsonb_array_length(p_config->'missionIds')
    OR (NOT v_source_mode AND jsonb_array_length(v_context->'references')=0) THEN RAISE EXCEPTION 'Choose current assigned reviewed missions'; END IF;
  IF jsonb_typeof(p_content->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(p_content->'sections')<>4
    OR jsonb_typeof(p_content->'instructor_notes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_content->'instructor_notes')=0
    OR COALESCE(p_provenance->>'prompt_version','') <> (CASE WHEN v_source_mode THEN 'source_teaching_v2' ELSE 'weekly_teaching_v1' END)
    OR COALESCE(p_provenance->>'response_id','')='' THEN RAISE EXCEPTION 'Incomplete draft'; END IF;
  INSERT INTO public.weekly_teaching_materials(outline_id,week_no,revision,kind,source_hash,source_config,sources,content,provenance,created_by)
    VALUES(p_outline_id,p_week_no,v_revision+1,
      CASE WHEN v_source_mode THEN p_config->>'outputKind' WHEN p_week_no IN (7,14) THEN 'discussion' ELSE 'lesson' END,
      p_source_hash,p_config,p_sources,p_content,p_provenance,p_actor) RETURNING * INTO v_draft;
  RETURN to_jsonb(v_draft);
END;
$$;
REVOKE ALL ON FUNCTION public.save_teaching_material(uuid,integer,integer,text,jsonb,jsonb,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_teaching_material(uuid,integer,integer,text,jsonb,jsonb,jsonb,jsonb,uuid) TO service_role;
