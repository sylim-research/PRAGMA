-- Server recovery continues even after all browser tabs close. No long-running Edge worker.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE FUNCTION public.dispatch_generation_jobs() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.generation_jobs WHERE status IN ('queued','running')
    AND next_run_at <= now() AND (lease_until IS NULL OR lease_until < now())) THEN
    PERFORM net.http_post(
      url := 'https://tlnjxagqwvefeqdagtkq.supabase.co/functions/v1/generation-jobs',
      headers := jsonb_build_object('Content-Type','application/json','x-pragma-worker-token',
        (SELECT token FROM pragma_private.generation_worker_config WHERE singleton)),
      body := '{"action":"work"}'::jsonb, timeout_milliseconds := 60000);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_generation_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_generation_jobs() TO service_role;
SELECT cron.schedule('pragma-generation-recovery', '* * * * *', 'SELECT public.dispatch_generation_jobs()');
