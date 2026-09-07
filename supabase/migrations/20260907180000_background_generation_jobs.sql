-- Durable administrator generation. Existing scenarios and learner data are not modified.
CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  request_key text NOT NULL,
  request_body jsonb NOT NULL,
  release_id text NOT NULL,
  model text NOT NULL CHECK (model = 'gpt-6-astra'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb,
  error text,
  lease_token uuid,
  lease_until timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.generation_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.generation_jobs TO service_role;
CREATE POLICY generation_admin_read ON public.generation_jobs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE INDEX generation_jobs_due ON public.generation_jobs(next_run_at) WHERE status IN ('queued','running');

CREATE FUNCTION public.claim_generation_job(p_job_id uuid DEFAULT NULL)
RETURNS SETOF public.generation_jobs LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.generation_jobs SET lease_token = gen_random_uuid(), lease_until = now() + interval '90 seconds',
    status = 'running', updated_at = now()
  WHERE id = (SELECT id FROM public.generation_jobs
    WHERE status IN ('queued','running') AND next_run_at <= now()
      AND (lease_until IS NULL OR lease_until < now()) AND (p_job_id IS NULL OR id = p_job_id)
    ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_generation_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_job(uuid) TO service_role;

-- Private scheduler credential: never returned to browser roles or embedded in the repository.
CREATE SCHEMA IF NOT EXISTS pragma_private;
REVOKE ALL ON SCHEMA pragma_private FROM PUBLIC, anon, authenticated;
CREATE TABLE pragma_private.generation_worker_config (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), token text NOT NULL);
REVOKE ALL ON pragma_private.generation_worker_config FROM PUBLIC, anon, authenticated;
INSERT INTO pragma_private.generation_worker_config VALUES (true, gen_random_uuid()::text || gen_random_uuid()::text);
CREATE FUNCTION public.authorize_generation_worker(p_token text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM pragma_private.generation_worker_config WHERE token = p_token);
$$;
REVOKE ALL ON FUNCTION public.authorize_generation_worker(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_generation_worker(text) TO service_role;

COMMENT ON TABLE public.generation_jobs IS 'Admin-only provider jobs and recoverable drafts. Completed does not mean quality checked or professor approved.';
