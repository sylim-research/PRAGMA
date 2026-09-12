# 2026-09-12 — Gate provenance rebind for the 20 course-cell reviews

## What was wrong

On 2026-09-11 the generation gate was re-run at `quality_v24_reason_facts_severity` on all 20 frozen course
cells. The re-run replaced **only** `mission_content.quality_check`. Everything the review identity is built
from stayed the same: the instructional content, its `provenance.mission_content_hash`, the review
`source_hash` and the review `content_hash`.

The official `content_review_v3` reviews were created before that re-run, so 16 of them still carried
`quality_v22_observed_pdr_scene` in `generation_quality` and inside the immutable `prepared_finalization`.
Approval refused them at two points, both correctly:

- `assert_content_review_base_ready` → `Generation quality evidence does not match the stored mission`
- `finalize_reviewed_mission` → `Finalization cannot replace the current critic result`

The 4 reviews created *after* the re-run (w5-0, w5-1, w12-0, w13-1) already matched.

Measured before state: `docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/preflight-before.json`
— 20 cells, 16 mismatched, 0 professor decisions, 0 overrides, 0 approvals, 0 instructor records,
source hashes all current, prepared instructional content all equal to the live mission.

## What was added (PR #145, main `f47242a0`)

Migration `20260912140000_content_review_gate_rebind.sql`. **No approval condition was relaxed.**

- `rebind_content_review_gate(p_review_id, p_content_hash)` — one transaction, no model call, no content
  write, no approval. It carries an existing review's `snapshot`, rule findings, `openai_review`,
  `claude_review`, `adjudication` and independent-review request onto a **new** row whose
  `generation_quality` and `prepared_finalization.quality_check` are the gate the mission carries now, then
  marks the earlier row `superseded_by` the new one.
- `quality_check` is the only gate-derived field inside a prepared artifact. `finalize_mission` copies the
  mission's `quality_check` verbatim and deletes it (with `provenance`, `hsk_lexical_audit`, `authoring`)
  before computing `mission_content_hash`, so item lineage, the HSK audit and the finalized hash cannot move
  when only the gate does. Verified on live rows: the mission's `mission_content_hash` is byte-identical
  across the v22 and v24 gate records.
- Provenance columns `superseded_by` / `rebound_from` / `rebound_at` / `rebound_by`. A superseded row can
  never be approved (CHECK), edited or deleted (`guard_prepared_content_review`), and readiness now
  **rejects** it for professor decisions and approval — an added condition.
- The review identity `(kind, target_id, week_no, source_hash, content_hash, criteria_version)` is unique
  among **active** rows only (partial index), so replaced rows stay readable as history. The Edge `rules`
  insert tolerates a concurrent duplicate instead of naming an `ON CONFLICT` target.
- Operational reads select active rows only: Edge `inspect`, the weekly dependency lookup,
  `reviewMission`'s prepared-artifact fetch and the admin dashboard counts. The review history list shows
  both rows with their link.
- The new row must clear `assert_content_review_base_ready` inside the same transaction or nothing commits.
  Rebind is idempotent from either id and serialises on the source row.

Verification: `npm run review:db-test` 32/32 (13 new assertions, including `pass→fail`, `pass→warning`,
`pass→pass`, `fail→fail`), `npm run typecheck`, `npm test` 926 passed, `npm run release:policy-test`,
`node --test` on the four edge/db suites, domain bundle `--check`, `npm run build`. CI green on PR #145.

## Operational application

1. `supabase db push` — one pending migration, `20260912140000`, nothing else. Live read-back: RPC present,
   active-identity index present, 4 provenance columns, old 6-column UNIQUE dropped, readiness rejects
   superseded rows.
2. `content-review` Edge **v37** deployed from main lineage `f47242a0` **before** the rebind, so `inspect`
   resolves the single active row. Railway deployment `6405420335` (f47242a0) success.
3. Dry run: 16 `would_rebind`, 4 `no_change`, 0 blocked, 0 errors. Applied: **16 rebound, 4 no_change,
   0 blocked, 0 errors, 0 model calls.**

| cell | old review (v22) | new review (v24) | | cell | old review (v22) | new review (v24) |
| --- | --- | --- | --- | --- | --- | --- |
| w2-0 | `2c4f98e4` | `13e3fcbb` | | w9-1 | `89682923` | `0d4f266c` |
| w2-1 | `3a0c42ce` | `9dfd50d7` | | w10-0 | `51b9a25f` | `4f14308d` |
| w3-0 | `f8088636` | `c898f9b5` | | w10-1 | `cffe6a4a` | `b7e19943` |
| w3-1 | `d592ded2` | `90883831` | | w11-0 | `f506d87a` | `e84a336b` |
| w4-0 | `d1b5d819` | `309daa71` | | w11-1 | `b4b5e458` | `afa9fbbd` |
| w4-1 | `982af629` | `3efc6268` | | w12-1 | `7cbf69ab` | `ecffa75a` |
| w6-0 | `9984e588` | `6348a1d9` | | w13-0 | `f2f4423c` | `08a25fb9` |
| w6-1 | `9d3a6f60` | `3f6e2648` | | | | |
| w9-0 | `e5de3076` | `4558dc3a` | | | | |

Unchanged (already on the current gate): w5-0 `a6b277fa`, w5-1 `f4450900`, w12-0 `850bae2f`,
w13-1 `9ffe8d11`.

## After state (read-only, all 20 cells)

- `gq_matches` **20/20**; prepared `quality_check` matches the live mission 20/20; source hashes current
  20/20; 0 approvals, 0 professor decisions, 0 overrides recorded.
- Old rows: 16/16 preserved, still `quality_v22_observed_pdr_scene` in both `generation_quality` and
  `prepared_finalization`, none approved, all linked both ways (`superseded_by` ↔ `rebound_from`).
- Semantic evidence carried unchanged on all 16 (snapshot, rules, model reviews, adjudication, hashes,
  criteria version, independent-review request). Claude findings and adjudications are the originals:
  w6-0 2/2, w6-1 1/1, w10-0 3/3 (plus the four unchanged cells: w5-0 1/1, w5-1 1/1, w12-0 5/5, w13-1 2/2).
- Table-wide: 125 active rows, 16 superseded, 16 rebound, 60 approvals — no existing approval touched.
- Deployed `inspect` resolves exactly one active row for all 20, all on the v24 gate, all `next=professor`,
  history showing both rows.

Evidence: `preflight-before.json`, `rebind-dry-run.json`, `rebind-result.json`, `preflight-after.json`,
`verify-after.json`, `inspect-check.json` under
`docs/research-trail/evidence/2026-09-12-gate-provenance-rebind/`.

## What the professor now has to decide

The rebind deliberately carries **no** professor judgement forward, so the 6 critical findings on the
current gate need a rationale at approval time:

| cell | current gate | findings needing an override rationale |
| --- | --- | --- |
| w2-0 | fail | `generation-1`, `generation-2` |
| w10-0 | fail | `generation-1`, `generation-2` |
| w11-0 | fail | `generation-1` |
| w13-1 | fail | `generation-1` |

The other 16 cells approve without a finding rationale. Nothing was approved and nothing was scheduled in
this session.

## Not done here (unchanged scope)

- The `rules` action still overwrites `generation_quality` in place on an existing unapproved row
  (`content-review/index.ts`). On a `focused_v1` row it is not auto-invoked by entering the review screen,
  and on a rebound row it would write back the identical current evidence, so it cannot break this
  provenance. Left as P1.
- The evaluator (`quality_v24`) is untouched and is still not declared stable.
- `src/lib/pragma/packReleaseManifest.generated.ts` and `promptSnapshot.generated.ts` on `main` carry a
  stale stamp (`source_commit_ref` `8282ab7c`, `git_dirty: true`) from an earlier commit. The prebuild
  rewrites only the commit ref and timestamp — every content hash is identical — so the regeneration was
  reverted rather than folded into this PR. Pre-existing, not addressed here.
