import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { anonClient, serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Guards of database/2026-09-30-vacancies.sql against the real PostgREST
 * surface: only the team posts, the database stamps the dates, an unverified
 * company's vacancy waits for review, drafts stay private, the team cannot
 * lift moderation. The same rules run offline in PGlite before the migration
 * is applied; this suite re-checks them on a live stack.
 */
suite("RLS: vacancies", () => {
  let admin: SupabaseClient;
  let owner: TestUser;
  let stranger: TestUser;
  let companyId: string;
  const companySlug = `it-vac-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  const slug = (label: string) => `${label}-${globalThis.crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    admin = serviceClient();
    owner = await createTestUser(admin);
    stranger = await createTestUser(admin);

    const client = await userClient(owner.email, owner.password);
    const { data, error } = await client
      .from("companies")
      .insert({ slug: companySlug, name: "IT Vacancies", created_by: owner.id })
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

  it("stamps the dates and sends an unverified company's vacancy to review", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data, error } = await client
      .from("vacancies")
      .insert({
        company_id: companyId,
        author_user_id: owner.id,
        slug: slug("intern"),
        title: "Design intern",
        kind: "internship",
        status: "published",
        pay_min: 100,
        pay_max: 200,
        pay_currency: "usd",
        pay_period: "month",
        expires_at: "2099-01-01T00:00:00Z",
      })
      .select("published_at, expires_at, moderation_status")
      .single();

    expect(error).toBeNull();
    expect(data?.moderation_status).toBe("under_review");
    const days = (new Date(data!.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(60);
  });

  it("keeps drafts and vacancies under review away from guests", async () => {
    const client = await userClient(owner.email, owner.password);
    await client.from("vacancies").insert({
      company_id: companyId,
      author_user_id: owner.id,
      slug: slug("draft"),
      title: "Draft vacancy",
      kind: "freelance",
    });

    const { data } = await anonClient().from("vacancies").select("id").eq("company_id", companyId);
    expect(data ?? []).toHaveLength(0);
  });

  it("does not let a stranger post for the company", async () => {
    const client = await userClient(stranger.email, stranger.password);
    const { error } = await client.from("vacancies").insert({
      company_id: companyId,
      author_user_id: stranger.id,
      slug: slug("fake"),
      title: "Fake vacancy",
      kind: "freelance",
    });
    expect(error).not.toBeNull();
  });

  it("keeps moderation out of the team's reach", async () => {
    const client = await userClient(owner.email, owner.password);
    await client
      .from("vacancies")
      .update({ moderation_status: "approved" })
      .eq("company_id", companyId);

    const { data } = await admin
      .from("vacancies")
      .select("moderation_status")
      .eq("company_id", companyId)
      .eq("status", "published");
    expect((data ?? []).every((row) => row.moderation_status === "under_review")).toBe(true);
  });

  it("does not let the team mark a vacancy expired", async () => {
    const client = await userClient(owner.email, owner.password);
    const { error } = await client
      .from("vacancies")
      .update({ status: "expired" })
      .eq("company_id", companyId)
      .eq("status", "published");
    expect(error).not.toBeNull();
  });
});
