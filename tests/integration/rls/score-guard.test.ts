import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createProject, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * The `score` column is pinned by a BEFORE UPDATE trigger (guard_score_column,
 * supabase/32_rating_score_triggers.sql): only the SECURITY DEFINER recompute
 * functions may change it. A direct owner PATCH must be silently ignored.
 * Passes only when migration 32 is applied.
 */
suite("Trigger: score is not user-writable", () => {
  let admin: SupabaseClient;
  let owner: TestUser;
  let projectId: string;

  beforeAll(async () => {
    admin = serviceClient();
    owner = await createTestUser(admin);
    const project = await createProject(admin, owner.id);
    projectId = project.id;
  });

  afterAll(async () => {
    if (owner) await cleanupUser(admin, owner.id);
  });

  it("silently pins projects.score on a direct owner PATCH [requires migration 32]", async () => {
    const { data: before } = await admin
      .from("projects")
      .select("score")
      .eq("id", projectId)
      .single();

    const client = await userClient(owner.email, owner.password);
    // The owner IS allowed to update their project (projects_update_compat), but
    // the trigger must keep score unchanged.
    await client.from("projects").update({ score: 9999, title: "Renamed" }).eq("id", projectId);

    const { data: after } = await admin
      .from("projects")
      .select("score, title")
      .eq("id", projectId)
      .single();
    expect(after?.score).toBe(before?.score);
    // Sanity: the non-guarded column DID change, proving the update ran.
    expect(after?.title).toBe("Renamed");
  });
});
