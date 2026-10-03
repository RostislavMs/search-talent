import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { anonClient, serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Hiring 8.4 against the real PostgREST surface: a job alert is the person's
 * own saved search (filters fixed once saved, only the email switch and the
 * name change), deliveries are written by the server only, «Зв'язатися» on
 * behalf of a company needs a verified team, the person sees which companies
 * opened their contacts, and the hiring metrics are for the service key only.
 * The same rules run offline in PGlite before the migration is applied; this
 * suite re-checks them live.
 */
suite("RLS: job alerts and contacts on behalf of a company", () => {
  let admin: SupabaseClient;
  let recruiter: TestUser;
  let candidate: TestUser;
  let stranger: TestUser;
  let companyId: string;
  let candidateProfileId: string;
  let alertId: string;
  const short = () => globalThis.crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    admin = serviceClient();
    recruiter = await createTestUser(admin);
    candidate = await createTestUser(admin);
    stranger = await createTestUser(admin);
    await admin.from("profiles").update({ username: `it-ja-${short()}` }).eq("user_id", candidate.id);
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", candidate.id).single();
    candidateProfileId = (profile as { id: string }).id;

    const client = await userClient(recruiter.email, recruiter.password);
    const { data, error } = await client
      .from("companies")
      .insert({ slug: `it-ja-${short()}`, name: "IT Job Alerts", created_by: recruiter.id })
      .select("id")
      .single();
    if (error || !data) throw new Error(`[integration] company insert failed: ${error?.message}`);
    companyId = data.id as string;
  });

  afterAll(async () => {
    if (companyId) await admin.from("companies").delete().eq("id", companyId);
    for (const user of [recruiter, candidate, stranger]) {
      if (user) await cleanupUser(admin, user.id);
    }
  });

  it("saves a job alert once, for oneself only", async () => {
    const client = await userClient(candidate.email, candidate.password);
    const { data, error } = await client
      .from("saved_searches")
      .insert({ user_id: candidate.id, name: "Internships", mode: "vacancies", params: { kind: "internship" }, notify_email: true })
      .select("id")
      .single();
    expect(error).toBeNull();
    alertId = (data as { id: string }).id;

    const again = await client
      .from("saved_searches")
      .insert({ user_id: candidate.id, name: "Again", mode: "vacancies", params: { kind: "internship" } });
    expect(again.error).not.toBeNull();

    const forSomeoneElse = await client
      .from("saved_searches")
      .insert({ user_id: stranger.id, name: "x", mode: "vacancies", params: {} });
    expect(forSomeoneElse.error).not.toBeNull();
  });

  it("lets the owner switch the email, not change the filters", async () => {
    const client = await userClient(candidate.email, candidate.password);
    const email = await client.from("saved_searches").update({ notify_email: false }).eq("id", alertId).select("notify_email");
    expect(email.data).toEqual([{ notify_email: false }]);

    const filters = await client.from("saved_searches").update({ params: {} }).eq("id", alertId);
    expect(filters.error).not.toBeNull();

    const asStranger = await userClient(stranger.email, stranger.password);
    const theirs = await asStranger.from("saved_searches").update({ notify_email: true }).eq("id", alertId).select("id");
    expect(theirs.data ?? []).toHaveLength(0);
  });

  it("keeps deliveries server-written and owner-read", async () => {
    const client = await userClient(candidate.email, candidate.password);
    const vacancyId = globalThis.crypto.randomUUID();
    const insert = await client.from("job_alert_deliveries").insert({ saved_search_id: alertId, vacancy_id: vacancyId });
    expect(insert.error).not.toBeNull();

    expect((await client.from("job_alert_deliveries").select("vacancy_id")).error).toBeNull();
    const guest = await anonClient().from("job_alert_deliveries").select("vacancy_id");
    expect(guest.error).not.toBeNull();
  });

  it("opens contacts as a company only for a verified team", async () => {
    const asRecruiter = await userClient(recruiter.email, recruiter.password);
    const unverified = await asRecruiter.rpc("open_profile_contacts", {
      p_profile_id: candidateProfileId,
      p_company_id: companyId,
    });
    expect(unverified.data?.status).toBe("company_not_allowed");

    await admin.from("companies").update({ verified_at: new Date().toISOString() }).eq("id", companyId);

    const first = await asRecruiter.rpc("open_profile_contacts", {
      p_profile_id: candidateProfileId,
      p_company_id: companyId,
    });
    expect(first.data).toMatchObject({ status: "ok", as_company: true, company_first_open: true });

    const asStranger = await userClient(stranger.email, stranger.password);
    const outsider = await asStranger.rpc("open_profile_contacts", {
      p_profile_id: candidateProfileId,
      p_company_id: companyId,
    });
    expect(outsider.data?.status).toBe("company_not_allowed");
  });

  it("shows the person which companies opened their contacts, and nobody else", async () => {
    const asCandidate = await userClient(candidate.email, candidate.password);
    const mine = await asCandidate.rpc("my_contact_open_companies");
    expect((mine.data as Array<{ company_id: string }>).map((row) => row.company_id)).toContain(companyId);

    const asStranger = await userClient(stranger.email, stranger.password);
    expect((await asStranger.rpc("my_contact_open_companies")).data ?? []).toHaveLength(0);
    expect((await asStranger.from("profile_contact_company_opens").select("company_id")).error).not.toBeNull();
  });

  it("keeps the hiring metrics to the service key", async () => {
    const asRecruiter = await userClient(recruiter.email, recruiter.password);
    expect((await asRecruiter.rpc("admin_metrics_hiring_signals")).error).not.toBeNull();
    expect((await admin.rpc("admin_metrics_hiring_signals")).error).toBeNull();
  });
});
