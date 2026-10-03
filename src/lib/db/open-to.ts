import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotifications } from "@/lib/db/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How many signed-in people opened «Зв'язатися» on the signed-in owner's
 * profile, each counted once (`my_contact_opens()`). 0 when unknown: until
 * the migration runs the call fails, and the tile in My Space simply stays
 * hidden.
 */
export async function getMyContactOpens(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("my_contact_opens");

  if (error) {
    return 0;
  }

  const row = (Array.isArray(data) ? data[0] : data) as { total?: number | string } | null;
  const total = Number(row?.total ?? 0);

  return Number.isFinite(total) && total > 0 ? total : 0;
}

export type ContactOpenCompany = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  firstOpenedAt: string;
  lastOpenedAt: string;
};

/**
 * The companies that opened the signed-in person's contacts, latest first
 * (`my_contact_open_companies()`). Empty when there are none or before the
 * migration.
 */
export async function getMyContactOpenCompanies(
  supabase: SupabaseClient,
): Promise<ContactOpenCompany[]> {
  const { data, error } = await supabase.rpc("my_contact_open_companies");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (
    data as Array<{
      company_id: string;
      slug: string;
      name: string;
      logo_url: string | null;
      first_opened_at: string;
      last_opened_at: string;
    }>
  ).map((row) => ({
    id: row.company_id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
  }));
}

export type ContactCompany = { id: string; name: string };

type MembershipRow = {
  company:
    | { id: string; name: string; verified_at: string | null; moderation_status: string }
    | Array<{ id: string; name: string; verified_at: string | null; moderation_status: string }>
    | null;
};

/**
 * The companies the person may open contacts for: accepted member, the page
 * verified and visible. The database checks the same before recording.
 */
export async function listContactCompanies(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContactCompany[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company:company_id ( id, name, verified_at, moderation_status )")
    .eq("user_id", userId)
    .eq("status", "accepted");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as unknown as MembershipRow[])
    .map((row) => (Array.isArray(row.company) ? row.company[0] : row.company))
    .filter(
      (company): company is NonNullable<typeof company> =>
        Boolean(company?.verified_at) && company?.moderation_status === "approved",
    )
    .map((company) => ({ id: company.id, name: company.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * A company opened someone's contacts for the first time: they hear which
 * one. Not who in the team: the company is the one getting in touch. Never
 * throws.
 */
export async function notifyCompanyContactOpened({
  ownerUserId,
  companyId,
  actorUserId,
}: {
  ownerUserId: string;
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin || ownerUserId === actorUserId) return;

  try {
    const { data } = await admin
      .from("companies")
      .select("slug, name")
      .eq("id", companyId)
      .maybeSingle();
    const company = data as { slug: string; name: string } | null;
    if (!company) return;

    await createNotifications(admin, {
      recipientUserId: ownerUserId,
      actorUserId: null,
      type: "company_contact_opened",
      targetType: "company",
      targetId: companyId,
      metadata: { companyId, companySlug: company.slug, companyName: company.name },
    });
  } catch (error) {
    console.error("[open-to] company contact notification failed", { companyId, error });
  }
}
