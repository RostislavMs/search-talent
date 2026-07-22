import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createProject, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * moderation_status has no column-level guard (no trigger, and the owner UPDATE
 * policies only check ownership). A restricted user can therefore restore their
 * own status via a direct PATCH. These assert the SECURE expectation, so they
 * are EXPECTED TO FAIL against the current schema — they document the hole and
 * turn green once a guard (trigger or column-scoped policy) is added.
 */
suite("RLS: moderation_status self-tampering", () => {
  let admin: SupabaseClient;
  let user: TestUser;
  let projectId: string;

  beforeAll(async () => {
    admin = serviceClient();
    user = await createTestUser(admin);
    const project = await createProject(admin, user.id);
    projectId = project.id;
    // Moderator action: restrict both the profile and the project.
    await admin.from("profiles").update({ moderation_status: "restricted" }).eq("user_id", user.id);
    await admin.from("projects").update({ moderation_status: "restricted" }).eq("id", projectId);
  });

  afterAll(async () => {
    if (user) await cleanupUser(admin, user.id);
  });

  it("blocks a user restoring their own profile moderation_status [KNOWN HOLE]", async () => {
    const client = await userClient(user.email, user.password);
    await client.from("profiles").update({ moderation_status: "approved" }).eq("user_id", user.id);

    const { data } = await admin
      .from("profiles")
      .select("moderation_status")
      .eq("user_id", user.id)
      .single();
    expect(data?.moderation_status).toBe("restricted");
  });

  it("blocks a user restoring their own project moderation_status [KNOWN HOLE]", async () => {
    const client = await userClient(user.email, user.password);
    await client.from("projects").update({ moderation_status: "approved" }).eq("id", projectId);

    const { data } = await admin
      .from("projects")
      .select("moderation_status")
      .eq("id", projectId)
      .single();
    expect(data?.moderation_status).toBe("restricted");
  });
});
