import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { anonClient, serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createProject, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Guards of database/2026-09-30-companies.sql against the real PostgREST
 * surface: members cannot set the check mark or moderation, strangers cannot
 * edit, the team is written only through the functions, pending invitations
 * stay private. The same rules are exercised offline with PGlite before the
 * migration is applied; this suite re-checks them on a live stack.
 */
suite("RLS: companies", () => {
  let admin: SupabaseClient;
  let owner: TestUser;
  let stranger: TestUser;
  let companyId: string;
  const slug = `it-co-${globalThis.crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    admin = serviceClient();
    owner = await createTestUser(admin);
    stranger = await createTestUser(admin);
    await admin.from("profiles").update({ username: `it-${owner.id.slice(0, 8)}` }).eq("user_id", owner.id);
    await admin.from("profiles").update({ username: `it-${stranger.id.slice(0, 8)}` }).eq("user_id", stranger.id);

    const client = await userClient(owner.email, owner.password);
    const { data, error } = await client
      .from("companies")
      .insert({ slug, name: "IT Company", created_by: owner.id, website: "https://example.test" })
      .select("id")
      .single();
    if (error || !data) throw new Error(`[integration] company insert failed: ${error?.message}`);
    companyId = data.id as string;
  });

  afterAll(async () => {
    if (companyId) await admin.from("companies").delete().eq("id", companyId);
    if (owner) await cleanupUser(admin, owner.id);
    if (stranger) await cleanupUser(admin, stranger.id);
  });

  it("makes the creator the owner", async () => {
    const { data } = await admin
      .from("company_members")
      .select("role, status")
      .eq("company_id", companyId)
      .eq("user_id", owner.id)
      .single();
    expect(data).toEqual({ role: "owner", status: "accepted" });
  });

  it("keeps the check mark and moderation out of the owner's reach", async () => {
    const client = await userClient(owner.email, owner.password);
    await client
      .from("companies")
      .update({ verified_at: new Date().toISOString(), verification_method: "admin", moderation_status: "removed" })
      .eq("id", companyId);

    const { data } = await admin
      .from("companies")
      .select("verified_at, moderation_status")
      .eq("id", companyId)
      .single();
    expect(data).toEqual({ verified_at: null, moderation_status: "approved" });
  });

  it("does not let a stranger edit or delete the page", async () => {
    const client = await userClient(stranger.email, stranger.password);
    await client.from("companies").update({ name: "HACKED" }).eq("id", companyId);
    await client.from("companies").delete().eq("id", companyId);

    const { data } = await admin.from("companies").select("name").eq("id", companyId).single();
    expect(data?.name).toBe("IT Company");
  });

  it("closes direct writes to the team", async () => {
    const client = await userClient(stranger.email, stranger.password);
    const { error } = await client
      .from("company_members")
      .insert({ company_id: companyId, user_id: stranger.id, role: "owner", status: "accepted" });
    expect(error).not.toBeNull();
  });

  it("keeps a pending invitation private", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data } = await client.rpc("invite_company_member", {
      p_company_id: companyId,
      p_user_id: stranger.id,
      p_role: "recruiter",
    });
    expect((data as { status?: string })?.status).toBe("ok");

    const { data: seenByGuest } = await anonClient()
      .from("company_members")
      .select("id, status")
      .eq("company_id", companyId);
    expect((seenByGuest ?? []).every((row) => row.status === "accepted")).toBe(true);

    const invited = await userClient(stranger.email, stranger.password);
    const { data: own } = await invited
      .from("company_members")
      .select("status")
      .eq("company_id", companyId)
      .eq("user_id", stranger.id)
      .single();
    expect(own?.status).toBe("pending");
  });

  it("lets only the author attach a project, and not a stranger take it off", async () => {
    const own = await createProject(admin, owner.id, { status: "published", moderation_status: "approved" });
    const foreign = await createProject(admin, stranger.id, { status: "published", moderation_status: "approved" });
    const client = await userClient(owner.email, owner.password);

    const { error: ownError } = await client
      .from("company_projects")
      .insert({ company_id: companyId, project_id: own.id, added_by: owner.id });
    expect(ownError).toBeNull();

    const { error: foreignError } = await client
      .from("company_projects")
      .insert({ company_id: companyId, project_id: foreign.id, added_by: owner.id });
    expect(foreignError).not.toBeNull();

    const other = await userClient(stranger.email, stranger.password);
    await other.from("company_projects").delete().eq("project_id", own.id);
    const { data } = await admin.from("company_projects").select("project_id").eq("project_id", own.id);
    expect(data).toHaveLength(1);
  });

  it("keeps verification codes away from members", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data } = await client.from("company_verification_codes").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("does not let guests call the team functions", async () => {
    const { error } = await anonClient().rpc("invite_company_member", {
      p_company_id: companyId,
      p_user_id: stranger.id,
      p_role: "admin",
    });
    expect(error).not.toBeNull();
  });
});
