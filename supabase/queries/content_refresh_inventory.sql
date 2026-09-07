-- PRAGMA generated-content refresh inventory (READ ONLY)
-- Current candidate: pragma_natural_scene_candidate_20260907_01
--
-- Supabase SQL Editor에서 실행한다. 결과 한 행은 삭제 대상과 보존/분리할 참조를
-- 함께 보여 준다. 이 파일에는 쓰기 문장을 넣지 않는다.

WITH settings AS (
  SELECT 'pragma_natural_scene_candidate_20260907_01'::text AS current_release_id
),
generated_scenarios AS (
  SELECT
    s.scenario_id,
    s.mission_status,
    s.usage_assignment,
    s.generation_prompt_version AS core_prompt_version,
    s.core_content #>> '{generation,content_release_id}' AS core_release_id,
    s.mission_content #>> '{provenance,prompt_version}' AS mission_prompt_version,
    s.mission_content #>> '{provenance,content_release_id}' AS mission_release_id
  FROM public.scenarios s
  WHERE s.content_format = 'scenario_core_v1'
),
reference_counts AS (
  SELECT
    (SELECT count(*) FROM public.curriculum_week_scenarios cws
      JOIN generated_scenarios gs ON gs.scenario_id = cws.scenario_id) AS curriculum_refs,
    (SELECT count(*) FROM public.package_items pi
      JOIN generated_scenarios gs ON gs.scenario_id = pi.scenario_id) AS package_refs,
    (SELECT count(*) FROM public.assessment_form_items afi
      JOIN generated_scenarios gs ON gs.scenario_id = afi.scenario_id) AS assessment_refs,
    (SELECT count(*) FROM public.learner_mission_logs lml
      JOIN generated_scenarios gs ON gs.scenario_id = lml.cell_id) AS learner_log_refs,
    (SELECT count(*) FROM public.scenarios child
      JOIN generated_scenarios gs ON gs.scenario_id = child.supersedes_scenario_id) AS supersedes_refs,
    (SELECT count(*) FROM public.scenario_feedback sf
      JOIN generated_scenarios gs ON gs.scenario_id = sf.scenario_id) AS feedback_rows,
    (SELECT count(*) FROM public.scenario_candidates sc
      JOIN generated_scenarios gs ON gs.scenario_id = sc.scenario_id) AS legacy_candidate_rows
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'current_release_id', settings.current_release_id,
    'generated_scenarios', (SELECT count(*) FROM generated_scenarios),
    'current_core_rows', (SELECT count(*) FROM generated_scenarios gs
      WHERE gs.core_release_id = settings.current_release_id),
    'current_complete_rows', (SELECT count(*) FROM generated_scenarios gs
      WHERE gs.core_release_id = settings.current_release_id
        AND gs.mission_release_id = settings.current_release_id),
    'legacy_or_stale_core_rows', (SELECT count(*) FROM generated_scenarios gs
      WHERE gs.core_release_id IS DISTINCT FROM settings.current_release_id),
    'legacy_or_stale_mission_rows', (SELECT count(*) FROM generated_scenarios gs
      WHERE gs.mission_status IS NOT NULL
        AND gs.mission_release_id IS DISTINCT FROM settings.current_release_id),
    'generated_missions', (SELECT count(*) FROM generated_scenarios
      WHERE mission_status = 'generated'),
    'reviewed_missions', (SELECT count(*) FROM generated_scenarios
      WHERE mission_status = 'reviewed'),
    'experiment_locked_rows', (SELECT count(*) FROM generated_scenarios
      WHERE usage_assignment = 'experiment_locked'),
    'references', to_jsonb(reference_counts)
  )
) AS refresh_inventory
FROM settings, reference_counts;

-- 버전별 분포. 위 요약에서 stale이 있으면 어떤 계열인지 확인한다.
WITH generated_scenarios AS (
  SELECT
    s.mission_status,
    s.generation_prompt_version AS core_prompt_version,
    s.core_content #>> '{generation,content_release_id}' AS core_release_id,
    s.mission_content #>> '{provenance,prompt_version}' AS mission_prompt_version,
    s.mission_content #>> '{provenance,content_release_id}' AS mission_release_id
  FROM public.scenarios s
  WHERE s.content_format = 'scenario_core_v1'
)
SELECT
  COALESCE(core_release_id, '(unversioned)') AS core_release_id,
  COALESCE(core_prompt_version, '(missing)') AS core_prompt_version,
  COALESCE(mission_release_id, '(unversioned)') AS mission_release_id,
  COALESCE(mission_prompt_version, '(missing)') AS mission_prompt_version,
  COALESCE(mission_status, '(core only)') AS mission_status,
  count(*) AS rows
FROM generated_scenarios
GROUP BY 1, 2, 3, 4, 5
ORDER BY rows DESC, 1, 2, 3, 4, 5;
