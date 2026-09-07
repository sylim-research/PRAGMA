-- pg_net grants request queue access to PUBLIC by default. The queue contains our worker header.
REVOKE ALL ON TABLE net.http_request_queue FROM PUBLIC, anon, authenticated;
-- Scheduler reads this value for every dispatch; rotation does not require an Edge deployment.
UPDATE pragma_private.generation_worker_config
SET token = gen_random_uuid()::text || gen_random_uuid()::text WHERE singleton;
