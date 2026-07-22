import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seeding + teardown helpers, all driven by a service-role client so they
 * bypass RLS. Rows use random slugs/emails so parallel or repeated runs never
 * collide.
 */

export type TestUser = { id: string; email: string; password: string };

// Meets typical Supabase password policy (length + mixed classes).
const PASSWORD = "It-passw0rd!42";

function uid(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Creates an auth user and ensures a matching `profiles` row exists. The upsert
 * is idempotent in case the schema auto-creates a profile via trigger.
 */
export async function createTestUser(
  admin: SupabaseClient,
  opts: { confirmed?: boolean } = {},
): Promise<TestUser> {
  const email = `it-${uid()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: opts.confirmed ?? true,
  });
  if (error || !data.user) {
    throw new Error(`[integration] createUser failed: ${error?.message}`);
  }
  const userId = data.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (profileError) {
    throw new Error(`[integration] profile upsert failed: ${profileError.message}`);
  }

  return { id: userId, email, password: PASSWORD };
}

/** Resolves the `profiles.id` (PK) for a given auth user id. */
export async function getProfileId(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    throw new Error(`[integration] profile lookup failed: ${error?.message}`);
  }
  return data.id as string;
}

export async function createProject(
  admin: SupabaseClient,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("projects")
    .insert({
      owner_id: ownerId,
      title: "IT Project",
      slug: `it-project-${uid()}`,
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`[integration] createProject failed: ${error?.message}`);
  }
  return { id: data.id as string };
}

export async function createArticle(
  admin: SupabaseClient,
  authorUserId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_user_id: authorUserId,
      title: "IT Article",
      slug: `it-article-${uid()}`,
      content: "<p>original body</p>",
      status: "published",
      moderation_status: "approved",
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`[integration] createArticle failed: ${error?.message}`);
  }
  return { id: data.id as string };
}

/**
 * Best-effort teardown: removes the user's content, then the auth user. Errors
 * are swallowed so one failed delete never masks a test result; FKs may already
 * cascade from auth.users, in which case these are no-ops.
 */
export async function cleanupUser(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  await admin.from("votes").delete().eq("user_id", userId);
  await admin.from("profile_votes").delete().eq("user_id", userId);
  await admin.from("articles").delete().eq("author_user_id", userId);
  await admin.from("projects").delete().eq("owner_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}
