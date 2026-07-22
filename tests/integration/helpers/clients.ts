import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_DB } from "./env";

const authOpts = {
  auth: { autoRefreshToken: false, persistSession: false },
} as const;

/** Service-role client: bypasses RLS. Use only for seeding and assertions. */
export function serviceClient(): SupabaseClient {
  return createClient(TEST_DB.url, TEST_DB.serviceRoleKey, authOpts);
}

/** Anonymous client (unauthenticated, RLS as role `anon`). */
export function anonClient(): SupabaseClient {
  return createClient(TEST_DB.url, TEST_DB.anonKey, authOpts);
}

/**
 * Client authenticated as a specific seeded user (RLS as role `authenticated`
 * with that user's `auth.uid()`). Signs in with password to obtain a session.
 */
export async function userClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const client = createClient(TEST_DB.url, TEST_DB.anonKey, authOpts);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`[integration] sign-in failed for ${email}: ${error.message}`);
  }
  return client;
}
