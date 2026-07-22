/**
 * Integration tests connect to a REAL Supabase instance using a dedicated set
 * of env vars — never the app's NEXT_PUBLIC_* / SUPABASE_SERVICE_ROLE_KEY — so
 * there is no chance of a test run pointing at the production project by
 * accident. Point these at a local stack (`supabase start`) or a throwaway
 * cloud test project. See tests/integration/README.md.
 */
export const TEST_DB = {
  url: process.env.SUPABASE_TEST_URL ?? "",
  serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "",
  anonKey: process.env.SUPABASE_TEST_ANON_KEY ?? "",
};

/**
 * True only when all three test-DB env vars are present. Suites gate on this
 * with `describe.skip`, so running without a database is a clean skip.
 */
export const hasTestDb = Boolean(
  TEST_DB.url && TEST_DB.serviceRoleKey && TEST_DB.anonKey,
);
