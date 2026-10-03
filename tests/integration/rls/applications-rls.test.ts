import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { anonClient, serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createProject, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Guards of database/2026-10-02-applications.sql against the real PostgREST
 * surface: applying only through apply_to_vacancy(), the candidate and the
 * company's team see the application and nobody else does, contacts only for
 * the team, the team moves the status but never writes the row directly,
 * withdrawing wipes what the candidate sent. The same rules run offline in
 * PGlite before the migration is applied; this suite re-checks them live.
 */
suite("RLS: vacancy applications", () => {
  let admin: SupabaseClient;
  let owner: TestUser;
  let candidate: TestUser;
  let stranger: TestUser;
  let companyId: string;
  let vacancyId: string;
  let projectId: string;
  let applicationId: string;
  const short = () => globalThis.crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    admin = serviceClient();
    owner = await createTestUser(admin);
    candidate = await createTestUser(admin);
    stranger = await createTestUser(admin);
    await admin.from("profiles").update({ username: `it-cand-${short()}` }).eq("user_id", candidate.id);
    projectId = (await createProject(admin, candidate.id, { status: "published" })).id;

    const client = await userClient(owner.email, owner.password);
    const { data, error } = await client
      .from("companies")
      .insert({ slug: `it-app-${short()}`, name: "IT Applications", created_by: owner.id })
      .select("id")
      .single();
    if (error || !data) throw new Error(`[integration] company insert failed: ${error?.message}`);
    companyId = data.id as string;

    const { data: vacancy, error: vacancyError } = await admin
      .from("vacancies")
      .insert({
        company_id: companyId,
        author_user_id: owner.id,
        slug: `it-app-vacancy-${short()}`,
        title: "Design intern",
        kind: "internship",
        status: "published",
        pay_min: 100,
        pay_max: 200,
        pay_currency: "usd",
        pay_period: "month",
      })
      .select("id")
      .single();
    if (vacancyError || !vacancy) throw new Error(`[integration] vacancy insert failed: ${vacancyError?.message}`);
    vacancyId = vacancy.id as string;
  });

  afterAll(async () => {
    if (companyId) await admin.from("companies").delete().eq("id", companyId);
    for (const user of [owner, candidate, stranger]) {
      if (user) await cleanupUser(admin, user.id);
    }
  });

  it("does not let anyone insert an application directly", async () => {
    const client = await userClient(candidate.email, candidate.password);
    const { error } = await client.from("vacancy_applications").insert({
      vacancy_id: vacancyId,
      company_id: companyId,
      applicant_user_id: candidate.id,
      project_ids: [projectId],
    });
    expect(error).not.toBeNull();
  });

  it("applies through apply_to_vacancy, once", async () => {
    const client = await userClient(candidate.email, candidate.password);
    const { data } = await client.rpc("apply_to_vacancy", {
      p_vacancy_id: vacancyId,
      p_message: "Hello",
      p_project_ids: [projectId],
    });
    expect(data?.status).toBe("ok");
    applicationId = data.application_id;

    const again = await client.rpc("apply_to_vacancy", {
      p_vacancy_id: vacancyId,
      p_message: "Again",
      p_project_ids: [projectId],
    });
    expect(again.data?.status).toBe("already_applied");
  });

  it("does not let the team apply to its own vacancy", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data } = await client.rpc("apply_to_vacancy", {
      p_vacancy_id: vacancyId,
      p_message: "",
      p_project_ids: [projectId],
    });
    expect(data?.status).toBe("own_company");
  });

  it("shows the application to the candidate and the team only", async () => {
    const asCandidate = await userClient(candidate.email, candidate.password);
    const asOwner = await userClient(owner.email, owner.password);
    const asStranger = await userClient(stranger.email, stranger.password);

    expect((await asCandidate.from("vacancy_applications").select("id").eq("id", applicationId)).data).toHaveLength(1);
    expect((await asOwner.from("vacancy_applications").select("id").eq("id", applicationId)).data).toHaveLength(1);
    expect((await asStranger.from("vacancy_applications").select("id").eq("id", applicationId)).data ?? []).toHaveLength(0);
    const guest = await anonClient().from("vacancy_applications").select("id").eq("id", applicationId);
    expect(guest.data ?? []).toHaveLength(0);
  });

  it("hands the candidate's contacts to the team, and to nobody else", async () => {
    const asOwner = await userClient(owner.email, owner.password);
    const asStranger = await userClient(stranger.email, stranger.password);

    const team = await asOwner.rpc("vacancy_application_contacts", { p_vacancy_id: vacancyId });
    expect(team.data).toEqual([{ application_id: applicationId, email: candidate.email, phone: null }]);
    expect((await asStranger.rpc("vacancy_application_contacts", { p_vacancy_id: vacancyId })).data ?? []).toHaveLength(0);
  });

  it("lets the team move the status but not edit the row", async () => {
    const asOwner = await userClient(owner.email, owner.password);
    const direct = await asOwner.from("vacancy_applications").update({ message: "edited" }).eq("id", applicationId);
    expect(direct.error).not.toBeNull();

    const { data } = await asOwner.rpc("set_vacancy_application_status", {
      p_application_id: applicationId,
      p_status: "shortlisted",
    });
    expect(data).toMatchObject({ status: "ok", changed: true, previous_status: "new" });

    const asStranger = await userClient(stranger.email, stranger.password);
    const refused = await asStranger.rpc("set_vacancy_application_status", {
      p_application_id: applicationId,
      p_status: "rejected",
    });
    expect(refused.data?.status).toBe("not_found");
  });

  it("wipes what the candidate sent when they withdraw", async () => {
    const asCandidate = await userClient(candidate.email, candidate.password);
    const { data } = await asCandidate.rpc("withdraw_vacancy_application", { p_application_id: applicationId });
    expect(data?.status).toBe("ok");

    const { data: row } = await admin
      .from("vacancy_applications")
      .select("status, message, project_ids")
      .eq("id", applicationId)
      .single();
    expect(row).toEqual({ status: "withdrawn", message: "", project_ids: [] });

    const asOwner = await userClient(owner.email, owner.password);
    expect((await asOwner.rpc("vacancy_application_contacts", { p_vacancy_id: vacancyId })).data ?? []).toHaveLength(0);
  });
});
