-- 2026-10-27 model roles: generation = Gemini 3.1 Pro, checking = GPT-6 Astra, final approval = instructor.
-- The focused flow no longer runs the Claude comprehensive review or its adjudication. The optional Chinese
-- expression review (stored as deepseek_review, now run by GPT-6 Astra) follows the primary quality review
-- directly, and its findings go straight to the instructor instead of requiring adjudication.
-- Earlier runs that already hold a Claude review keep their rule: Claude findings still need adjudication.
-- Both functions are patched on their deployed definitions so every other condition is preserved verbatim.
DO $migration$
DECLARE v_definition text; v_anchor text;
BEGIN
  SELECT pg_get_functiondef('public.validate_content_review_outputs(public.content_review_runs)'::regprocedure) INTO v_definition;
  -- Single-line anchors: the deployed body may carry either line ending.
  v_anchor := $a$p_review.deepseek_review IS NOT NULL AND (NOT v_light OR p_review.claude_review IS NULL) THEN$a$;
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected review output validation definition'; END IF;
  v_definition := replace(v_definition, v_anchor, $r$p_review.deepseek_review IS NOT NULL AND NOT v_light THEN$r$);
  v_anchor := $a$'Chinese expression review belongs to the cross-check after Claude'$a$;
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected review output validation message'; END IF;
  EXECUTE replace(v_definition, v_anchor, $r$'Chinese expression review belongs to the focused review flow'$r$);

  SELECT pg_get_functiondef('public.assert_content_review_base_ready(uuid,text)'::regprocedure) INTO v_definition;
  v_anchor := $a$(v_review.claude_review IS NULL OR (jsonb_array_length(v_review.claude_review#>'{result,findings}') + jsonb_array_length(public.content_review_deepseek_findings(v_review)) > 0 AND v_review.adjudication IS NULL))$a$;
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Unexpected review readiness definition'; END IF;
  EXECUTE replace(v_definition, v_anchor,
    $r$((v_review.claude_review IS NULL AND v_review.deepseek_review IS NULL) OR (jsonb_array_length(COALESCE(v_review.claude_review#>'{result,findings}', '[]'::jsonb)) > 0 AND v_review.adjudication IS NULL))$r$);
END;
$migration$;
