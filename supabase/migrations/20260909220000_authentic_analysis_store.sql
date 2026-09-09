-- 실제 자료 활용 분석 보관함.
--
-- 지금까지 「활용 가능성 분석」 결과는 화면에만 있었다. 후보 3건 중 시나리오로 넘긴
-- 1건만 살아남고 나머지는 화면을 벗어나는 순간 사라졌다. 라운지 표현 후보는 시나리오로
-- 넘길 수도 없어(억지 화행화 금지) 아무것도 남지 않았다.
--
-- 여기서 분석 1회와 그 후보 전부를 보관한다 — 고르지 않은 후보도 남는다.
-- 쓰기는 전부 is_admin() RPC를 거친다(테이블 직접 쓰기 권한 없음).

CREATE TABLE public.authentic_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL CHECK (source_type IN ('image', 'text')),
  source_ref text CHECK (source_ref IS NULL OR length(source_ref) <= 500),
  -- 관리자가 확정한 원문. 업로드 이미지 자체는 저장하지 않는다(분석에만 쓴다).
  source_original text NOT NULL CHECK (length(source_original) BETWEEN 1 AND 4000),
  extraction_confidence text,
  scene_ko text,
  linguistic_features_ko text,
  recommendation_reason_ko text,
  recommended_uses text[],
  connectable_speech_acts text[]
);

CREATE TABLE public.authentic_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.authentic_analyses(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  usage_type text NOT NULL,
  label_ko text,
  source_text text,
  preceding_turn text,
  situation_seed_ko text,
  source_usage_note_ko text,
  ai_adaptation_note_ko text,
  -- 화행·수준·방향·P/D/R 등 정규화된 enum 묶음. 보관·재현용이라 컬럼으로 펴지 않는다
  -- (ENUMS.md와 이중 관리가 되면 스키마가 계약을 따라다녀야 한다).
  conditions jsonb NOT NULL CHECK (jsonb_typeof(conditions) = 'object'),
  -- 라운지 표현 후보 전용(text·meaning_ko·usage_note_ko·example_zh·tags).
  expression jsonb CHECK (expression IS NULL OR jsonb_typeof(expression) = 'object'),
  status text NOT NULL DEFAULT 'stored'
    CHECK (status IN ('stored', 'used', 'held', 'discarded')),
  -- 시나리오로 넘어갔을 때 무엇이 됐는지.
  used_scenario_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, ordinal)
);

CREATE INDEX authentic_candidates_analysis_idx
  ON public.authentic_candidates (analysis_id, ordinal);
CREATE INDEX authentic_analyses_created_idx
  ON public.authentic_analyses (created_at DESC);

ALTER TABLE public.authentic_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authentic_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY authentic_analyses_admin_read ON public.authentic_analyses
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY authentic_candidates_admin_read ON public.authentic_candidates
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE ALL ON public.authentic_analyses FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.authentic_candidates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.authentic_analyses TO authenticated, service_role;
GRANT SELECT ON public.authentic_candidates TO authenticated, service_role;

-- ── 쓰기 RPC (전부 is_admin 게이트) ─────────────────────────────────────

CREATE FUNCTION public.save_authentic_analysis(p_analysis jsonb, p_candidates jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_candidate jsonb;
  v_ordinal integer := 0;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  IF jsonb_typeof(p_candidates) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_candidates) > 12 THEN
    RAISE EXCEPTION 'Invalid candidate list';
  END IF;

  INSERT INTO public.authentic_analyses (
    created_by, source_type, source_ref, source_original, extraction_confidence,
    scene_ko, linguistic_features_ko, recommendation_reason_ko,
    recommended_uses, connectable_speech_acts
  ) VALUES (
    auth.uid(),
    p_analysis->>'source_type',
    NULLIF(p_analysis->>'source_ref', ''),
    p_analysis->>'source_original',
    NULLIF(p_analysis->>'extraction_confidence', ''),
    NULLIF(p_analysis->>'scene_ko', ''),
    NULLIF(p_analysis->>'linguistic_features_ko', ''),
    NULLIF(p_analysis->>'recommendation_reason_ko', ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_analysis->'recommended_uses')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_analysis->'connectable_speech_acts')), '{}')
  ) RETURNING id INTO v_id;

  FOR v_candidate IN SELECT * FROM jsonb_array_elements(p_candidates) LOOP
    INSERT INTO public.authentic_candidates (
      analysis_id, ordinal, usage_type, label_ko, source_text, preceding_turn,
      situation_seed_ko, source_usage_note_ko, ai_adaptation_note_ko,
      conditions, expression
    ) VALUES (
      v_id, v_ordinal,
      v_candidate->>'usage_type',
      NULLIF(v_candidate->>'label_ko', ''),
      NULLIF(v_candidate->>'source_text', ''),
      NULLIF(v_candidate->>'preceding_turn', ''),
      NULLIF(v_candidate->>'situation_seed_ko', ''),
      NULLIF(v_candidate->>'source_usage_note_ko', ''),
      NULLIF(v_candidate->>'ai_adaptation_note_ko', ''),
      COALESCE(v_candidate->'conditions', '{}'::jsonb),
      CASE WHEN jsonb_typeof(v_candidate->'expression') = 'object'
           THEN v_candidate->'expression' ELSE NULL END
    );
    v_ordinal := v_ordinal + 1;
  END LOOP;

  RETURN v_id;
END;
$$;

CREATE FUNCTION public.set_authentic_candidate_status(
  p_candidate_id uuid, p_status text, p_scenario_id text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  UPDATE public.authentic_candidates
     SET status = p_status,
         used_scenario_id = COALESCE(p_scenario_id, used_scenario_id)
   WHERE id = p_candidate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_authentic_analysis(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_authentic_candidate_status(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_authentic_analysis(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_authentic_candidate_status(uuid, text, text) TO authenticated;
