# Integration / RLS tests

These tests run against a **real Supabase instance** — they exercise the
row-level-security policies, auth roles, and triggers that unit tests cannot
reach. They are **not** part of the unit `test` / `test:coverage` gate and never
run in the normal CI job; they self-skip unless the test-DB env vars are set.

## What they cover

The first suites pin the security guards flagged in prior audits:

| Suite | Guard | Passes when |
|-------|-------|-------------|
| `rls/articles-rls.test.ts` | Only author/admin may UPDATE an article | `articles_update_compat` drops the `status='published'` disjunct **(open hole today → expected red)** |
| `rls/votes-rls.test.ts` | No self-vote; no spoofed `user_id` | migration `33_rating_security_rls.sql` applied |
| `rls/score-guard.test.ts` | `score` not user-writable | migration `32_rating_score_triggers.sql` applied |
| `rls/moderation-status-rls.test.ts` | User can't restore own `moderation_status` | a guard is added **(open hole today → expected red)** |

Tests tagged **[KNOWN HOLE]** assert the *secure* behavior, so they fail against
the current unpatched schema — that failure **is** the regression signal. They
turn green once the corresponding fix lands.

## Running

### Option A — local stack (recommended, needs Docker)

```bash
pnpm exec supabase start          # boots Postgres + auth + applies supabase/*.sql
# copy the API URL + keys it prints:
export SUPABASE_TEST_URL="http://127.0.0.1:54321"
export SUPABASE_TEST_SERVICE_ROLE_KEY="<service_role key from `supabase status`>"
export SUPABASE_TEST_ANON_KEY="<anon key from `supabase status`>"

pnpm test:integration
```

### Option B — dedicated cloud test project

Create a throwaway Supabase project, push the migrations (`supabase db push`),
then point the same three env vars at it. **Never** set these to the production
project — the tests create and delete users and rows.

### Without a DB

`pnpm test:integration` with the env vars unset prints a hint and skips every
suite (exit 0), so it is safe to run anywhere.

## Notes

- Clients are built from `SUPABASE_TEST_*` only (see `helpers/env.ts`) — the
  app's `NEXT_PUBLIC_*` / `SUPABASE_SERVICE_ROLE_KEY` are deliberately not read.
- Seed helpers create auth users + profiles with random emails/slugs and clean
  up in `afterAll`; a run leaves no residue on success.
- The "unconfirmed email cannot vote" case depends on the project's auth
  settings allowing unconfirmed sign-in; it is intentionally left out of the
  first pass to avoid environment-dependent flakiness.
