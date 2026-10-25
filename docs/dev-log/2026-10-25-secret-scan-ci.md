# Secret scanning in CI (2026-10-25)

Trigger: Railway disclosed on 2026-10-21 that customer environment variables may have been read by a third party. This project's Railway service holds six `VITE_*` variables only (Supabase URL, publishable key and project id, demo flag, two ElevenLabs voice ids). Vite inlines them into the public bundle, so the incident exposed nothing new. Provider API keys live in Supabase Edge Function secrets, not in Railway. The repository is public, so the remaining leak path is a key committed by mistake.

Change
- `.github/workflows/ci.yml`: a "Scan new commits for secrets" step right after checkout in the required `verify` job. It downloads gitleaks v8.30.1 (official release, SHA-256 pinned) and scans only the commits the event adds: `base..head` for a pull request, `before..sha` for a push to main. It runs for docs-only changes too, before the docs-only short-circuit.
- `.gitleaksignore`: four fingerprints from an early committed `.env` (May–June 2026, removed from the tree since). Two are a Supabase JWT with role `anon` and two are `sb_publishable_` keys. Both are public client keys by design.

Validation (local, gitleaks v8.30.1 Windows build, checksum verified)
- Full history, 4193 commits: 4 findings before the ignore file, all the public keys above; 0 after.
- Last five commits of `origin/main`: 0 findings.
- A throwaway commit containing a fake `sk-proj-` key: 1 finding, exit code 1. The commit was on a temporary branch, deleted afterwards.
- `ci.yml` parses as YAML; step order checked.

Not done: the step has not run on GitHub Actions yet (it needs a push).
