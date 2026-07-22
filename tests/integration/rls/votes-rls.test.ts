import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createProject, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Self-vote / score-tampering guards live in the votes WITH CHECK policy
 * (supabase/33_rating_security_rls.sql). These assert the secure expectation;
 * they pass only when migrations up to 33 are applied, and fail against a DB
 * stuck at 06/19 (documenting that the hardening migration is missing).
 */
suite("RLS: vote authorization", () => {
  let admin: SupabaseClient;
  let owner: TestUser;
  let voter: TestUser;
  let projectId: string;

  beforeAll(async () => {
    admin = serviceClient();
    owner = await createTestUser(admin, { confirmed: true });
    voter = await createTestUser(admin, { confirmed: true });
    const project = await createProject(admin, owner.id);
    projectId = project.id;
  });

  afterAll(async () => {
    if (owner) await cleanupUser(admin, owner.id);
    if (voter) await cleanupUser(admin, voter.id);
  });

  it("blocks a user from voting on their own project [requires migration 33]", async () => {
    const client = await userClient(owner.email, owner.password);
    const { error } = await client
      .from("votes")
      .insert({ project_id: projectId, user_id: owner.id, value: 1 });
    expect(error).not.toBeNull();

    const { data } = await admin
      .from("votes")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", owner.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("lets a different confirmed user vote on the project", async () => {
    const client = await userClient(voter.email, voter.password);
    const { error } = await client
      .from("votes")
      .insert({ project_id: projectId, user_id: voter.id, value: 1 });
    expect(error).toBeNull();

    const { data } = await admin
      .from("votes")
      .select("value")
      .eq("project_id", projectId)
      .eq("user_id", voter.id)
      .single();
    expect(data?.value).toBe(1);
  });

  it("rejects a vote whose user_id is not the caller (spoofed owner)", async () => {
    // voter tries to write a row attributed to owner — WITH CHECK auth.uid()=user_id.
    const client = await userClient(voter.email, voter.password);
    const { error } = await client
      .from("votes")
      .insert({ project_id: projectId, user_id: owner.id, value: -1 });
    expect(error).not.toBeNull();
  });
});
