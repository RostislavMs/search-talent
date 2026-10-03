import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationMetadata } from "@/lib/constants/notifications";
import { createNotifications } from "@/lib/db/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  JOBS_PAGE_SIZE,
  normalizeVacancyHours,
  normalizeVacancyKind,
  normalizeVacancyLevel,
  normalizeVacancyLocale,
  normalizeVacancyStatus,
  normalizeVacancyWorkFormats,
  resolveVacancyState,
  toVacancyPay,
  type VacancyCompany,
  type VacancyDetails,
  type VacancyFilters,
  type VacancySummary,
} from "@/lib/vacancies";
import type { VacancyPayload } from "@/lib/validation/vacancies";

const COMPANY_JOIN = "company:company_id ( id, slug, name, logo_url, verified_at, moderation_status )";
const NAME_JOINS = "country:country_id ( name ), category:category_id ( name )";

const SUMMARY_COLUMNS =
  "id, slug, title, kind, hours, work_formats, city, experience_level, pay_min, pay_max, pay_currency, pay_period, locale, status, published_at, expires_at, moderation_status, company_id";

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, description, country_id, category_id, author_user_id, closed_at, created_at, updated_at`;

type Joined<T> = T | T[] | null | undefined;

type CompanyJoinRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  verified_at: string | null;
  moderation_status: string;
};

export type VacancySummaryRow = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  hours: string | null;
  work_formats: string[] | null;
  city: string | null;
  experience_level: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
  locale: string;
  status: string;
  published_at: string | null;
  expires_at: string | null;
  moderation_status: string;
  company_id: string;
  company?: Joined<CompanyJoinRow>;
  country?: Joined<{ name: string | null }>;
  category?: Joined<{ name: string | null }>;
};

export type VacancyDetailRow = VacancySummaryRow & {
  description: string | null;
  country_id: number | null;
  category_id: number | null;
  author_user_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

function firstJoined<T>(value: Joined<T>): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapCompany(row: CompanyJoinRow | null, companyId: string): VacancyCompany {
  return {
    id: row?.id ?? companyId,
    slug: row?.slug ?? "",
    name: row?.name ?? "",
    logoUrl: row?.logo_url ?? null,
    verified: Boolean(row?.verified_at),
    moderationStatus: row?.moderation_status ?? "approved",
  };
}

export function mapVacancySummary(row: VacancySummaryRow, now: number = Date.now()): VacancySummary {
  const status = normalizeVacancyStatus(row.status);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: normalizeVacancyKind(row.kind),
    hours: normalizeVacancyHours(row.hours),
    workFormats: normalizeVacancyWorkFormats(row.work_formats),
    city: row.city,
    countryName: firstJoined(row.country)?.name ?? null,
    experienceLevel: normalizeVacancyLevel(row.experience_level),
    categoryName: firstJoined(row.category)?.name ?? null,
    pay: toVacancyPay(row),
    locale: normalizeVacancyLocale(row.locale),
    status,
    state: resolveVacancyState({ status, expiresAt: row.expires_at }, now),
    moderationStatus: row.moderation_status,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    company: mapCompany(firstJoined(row.company), row.company_id),
  };
}

export function mapVacancyDetails(
  row: VacancyDetailRow,
  skills: Array<{ id: number; name: string }>,
  now: number = Date.now(),
): VacancyDetails {
  return {
    ...mapVacancySummary(row, now),
    description: row.description ?? "",
    countryId: row.country_id,
    categoryId: row.category_id,
    skills,
    authorUserId: row.author_user_id,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The columns the create/edit form writes; the description arrives sanitized. */
export function vacancyPayloadToRow(payload: VacancyPayload, description: string) {
  return {
    title: payload.title,
    description,
    kind: payload.kind,
    hours: payload.hours,
    work_formats: payload.work_formats,
    country_id: payload.country_id,
    city: payload.city,
    experience_level: payload.experience_level,
    category_id: payload.category_id,
    pay_min: payload.pay?.min ?? null,
    pay_max: payload.pay?.max ?? null,
    pay_currency: payload.pay?.currency ?? null,
    pay_period: payload.pay?.period ?? null,
    locale: payload.locale,
  };
}

// --- Reading -------------------------------------------------------------------------

export async function listVacancySkills(
  supabase: SupabaseClient,
  vacancyId: string,
): Promise<Array<{ id: number; name: string }>> {
  const { data, error } = await supabase
    .from("vacancy_skills")
    .select("skill_id, skill:skill_id ( id, name )")
    .eq("vacancy_id", vacancyId);

  if (error || !data) {
    return [];
  }

  return (data as unknown as Array<{ skill_id: number; skill: Joined<{ id: number; name: string }> }>)
    .map((row) => firstJoined(row.skill))
    .filter((skill): skill is { id: number; name: string } => Boolean(skill?.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getVacancyBy(
  supabase: SupabaseClient,
  column: "slug" | "id",
  value: string,
): Promise<VacancyDetails | null> {
  const { data, error } = await supabase
    .from("vacancies")
    .select(`${DETAIL_COLUMNS}, ${COMPANY_JOIN}, ${NAME_JOINS}`)
    .eq(column, value)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as VacancyDetailRow;
  return mapVacancyDetails(row, await listVacancySkills(supabase, row.id));
}

/**
 * A vacancy as the caller may see it (RLS: approved vacancies of visible
 * companies for everyone, any vacancy for the company's team and admins).
 */
export function getVacancyBySlug(supabase: SupabaseClient, slug: string) {
  return getVacancyBy(supabase, "slug", slug);
}

export function getVacancyById(supabase: SupabaseClient, id: string) {
  return getVacancyBy(supabase, "id", id);
}

/**
 * `_` and `%` are wildcards in ILIKE, and PostgREST reads `*` as `%` too; a
 * search for "c++_dev" means the text. A `*` cannot be escaped there, so it
 * is dropped.
 */
function escapeLike(value: string): string {
  return value.replace(/\*/g, " ").trim().replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Open vacancies for /jobs, newest first. "Open" is decided here too, not
 * only by the cron: one that ran out a minute ago is not listed. The company
 * join is inner so a team member does not see their hidden page's vacancies
 * mixed into the public list.
 */
export async function listOpenVacancies(
  supabase: SupabaseClient,
  filters: VacancyFilters,
  { pageSize = JOBS_PAGE_SIZE, now = Date.now() }: { pageSize?: number; now?: number } = {},
): Promise<{ items: VacancySummary[]; total: number }> {
  const skillJoin = filters.skillId ? ", vacancy_skills!inner ( skill_id )" : "";
  const companyJoin = "company:company_id!inner ( id, slug, name, logo_url, verified_at, moderation_status )";

  let query = supabase
    .from("vacancies")
    .select(`${SUMMARY_COLUMNS}, ${companyJoin}, ${NAME_JOINS}${skillJoin}`, { count: "exact" })
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .gt("expires_at", new Date(now).toISOString())
    .eq("company.moderation_status", "approved");

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.format) query = query.contains("work_formats", [filters.format]);
  if (filters.level) query = query.eq("experience_level", filters.level);
  if (filters.countryId) query = query.eq("country_id", filters.countryId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.skillId) query = query.eq("vacancy_skills.skill_id", filters.skillId);
  if (filters.paid) query = query.not("pay_min", "is", null);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);

  const from = (Math.max(filters.page, 1) - 1) * pageSize;
  const { data, error, count } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error || !data) {
    if (error) {
      console.error("[vacancies] list failed:", error.message);
    }
    return { items: [], total: 0 };
  }

  return {
    items: (data as unknown as VacancySummaryRow[]).map((row) => mapVacancySummary(row, now)),
    total: count ?? data.length,
  };
}

/** What the /jobs filters can offer: only places, roles and skills open vacancies have. */
export type JobsFilterOptions = {
  countries: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  skills: Array<{ id: number; name: string }>;
};

export async function getJobsFilterOptions(
  supabase: SupabaseClient,
  now: number = Date.now(),
): Promise<JobsFilterOptions> {
  const { data, error } = await supabase
    .from("vacancies")
    .select(
      "country_id, category_id, country:country_id ( name ), category:category_id ( name ), vacancy_skills ( skill:skill_id ( id, name ) )",
    )
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .gt("expires_at", new Date(now).toISOString())
    .limit(500);

  if (error || !data) {
    return { countries: [], categories: [], skills: [] };
  }

  const countries = new Map<number, string>();
  const categories = new Map<number, string>();
  const skills = new Map<number, string>();

  type Row = {
    country_id: number | null;
    category_id: number | null;
    country: Joined<{ name: string | null }>;
    category: Joined<{ name: string | null }>;
    vacancy_skills: Array<{ skill: Joined<{ id: number; name: string }> }> | null;
  };

  for (const row of data as unknown as Row[]) {
    const country = firstJoined(row.country)?.name;
    if (row.country_id && country) countries.set(row.country_id, country);
    const category = firstJoined(row.category)?.name;
    if (row.category_id && category) categories.set(row.category_id, category);
    for (const link of row.vacancy_skills ?? []) {
      const skill = firstJoined(link.skill);
      if (skill?.name) skills.set(skill.id, skill.name);
    }
  }

  const sorted = (map: Map<number, string>) =>
    [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return { countries: sorted(countries), categories: sorted(categories), skills: sorted(skills) };
}

/** The form's lists: every country, specialization and skill. */
export async function getVacancyFormOptions(supabase: SupabaseClient): Promise<JobsFilterOptions> {
  const [countries, categories, skills] = await Promise.all([
    supabase.from("countries").select("id, name").order("name"),
    supabase.from("profile_categories").select("id, name").order("name"),
    supabase.from("skills").select("id, name").order("name"),
  ]);

  const list = (result: { data: unknown }) =>
    ((result.data ?? []) as Array<{ id: number; name: string }>).filter((row) => row.name);

  return { countries: list(countries), categories: list(categories), skills: list(skills) };
}

/** The company's open vacancies for its page, newest first. */
export async function listCompanyOpenVacancies(
  supabase: SupabaseClient,
  companyId: string,
  { limit = 20, now = Date.now() }: { limit?: number; now?: number } = {},
): Promise<VacancySummary[]> {
  const { data, error } = await supabase
    .from("vacancies")
    .select(`${SUMMARY_COLUMNS}, ${COMPANY_JOIN}, ${NAME_JOINS}`)
    .eq("company_id", companyId)
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .gt("expires_at", new Date(now).toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return (data as unknown as VacancySummaryRow[]).map((row) => mapVacancySummary(row, now));
}

export type TeamVacancy = VacancySummary & {
  updatedAt: string;
  authorUserId: string | null;
  views: number | null;
};

/**
 * Every vacancy of the given companies, any status, recently edited first:
 * the team's own list in /my-space/vacancies. RLS limits it to companies the
 * caller is in; views come from the service key, when there is one.
 */
export async function listTeamVacancies(
  supabase: SupabaseClient,
  companyIds: string[],
  now: number = Date.now(),
): Promise<TeamVacancy[]> {
  if (companyIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("vacancies")
    .select(`${SUMMARY_COLUMNS}, updated_at, author_user_id, ${COMPANY_JOIN}, ${NAME_JOINS}`)
    .in("company_id", companyIds)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as Array<VacancySummaryRow & { updated_at: string; author_user_id: string | null }>;
  const views = await countVacancyViews(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...mapVacancySummary(row, now),
    updatedAt: row.updated_at,
    authorUserId: row.author_user_id,
    views: views ? (views.get(row.id) ?? 0) : null,
  }));
}

/**
 * Visitors per vacancy (one per person a day, the team excluded — see
 * record_content_view). Null without the service key: the events table is
 * closed to everyone else.
 */
export async function countVacancyViews(ids: string[]): Promise<Map<string, number> | null> {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const counts = new Map<string, number>();

  if (ids.length === 0) {
    return counts;
  }

  // Counted in the database (vacancy_view_counts): fetching the rows would
  // stop at the API's row limit and undercount without a word.
  const { data, error } = await admin.rpc("vacancy_view_counts", { p_ids: ids });

  if (error) {
    console.error("[vacancies] view counts failed:", error.message);
    return null;
  }

  for (const row of (data ?? []) as Array<{ vacancy_id: string; views: number | string }>) {
    counts.set(row.vacancy_id, Number(row.views) || 0);
  }

  return counts;
}

// --- Writing ----------------------------------------------------------------------------

/** Replaces the vacancy's skills. Returns the database error, if any. */
export async function setVacancySkills(
  supabase: SupabaseClient,
  vacancyId: string,
  skillIds: number[],
): Promise<{ message?: string | null; code?: string | null } | null> {
  const { error: deleteError } = await supabase
    .from("vacancy_skills")
    .delete()
    .eq("vacancy_id", vacancyId);

  if (deleteError) {
    return deleteError;
  }

  if (skillIds.length === 0) {
    return null;
  }

  const { error } = await supabase
    .from("vacancy_skills")
    .insert(skillIds.map((skillId) => ({ vacancy_id: vacancyId, skill_id: skillId })));

  return error ?? null;
}

/**
 * Auto-moderation flagged the text, or a report came in: only the team sees
 * the vacancy until an admin looks at it. Needs the service key, since the
 * team cannot touch moderation. A vacancy already waiting (an unverified
 * company's) gets the note, so the admin sees why; a stricter decision an
 * admin already made is never lifted. True when a row was held.
 */
export async function holdVacancyForReview(vacancyId: string, note: string | null): Promise<boolean> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn(`[vacancies] SUPABASE_SERVICE_ROLE_KEY missing — could not hold ${vacancyId}`);
    return false;
  }

  const { data, error } = await admin
    .from("vacancies")
    .update({
      moderation_status: "under_review",
      moderation_note: note,
      moderated_at: new Date().toISOString(),
      moderated_by: null,
    })
    .eq("id", vacancyId)
    .in("moderation_status", ["approved", "under_review"])
    .select("id");

  if (error) {
    console.error(`[vacancies] could not hold ${vacancyId}: ${error.message}`);
    return false;
  }

  return Boolean(data && data.length > 0);
}

// --- Notifications ----------------------------------------------------------------------
// Written with the service key and never thrown: a lost notification must not
// undo the change that caused it.

export type VacancyForNotification = {
  id: string;
  slug: string;
  title: string;
  company_id: string;
  author_user_id: string | null;
};

export async function loadVacancyForNotification(
  admin: SupabaseClient,
  vacancyId: string,
): Promise<VacancyForNotification | null> {
  const { data } = await admin
    .from("vacancies")
    .select("id, slug, title, company_id, author_user_id")
    .eq("id", vacancyId)
    .maybeSingle();

  return (data as VacancyForNotification | null) ?? null;
}

/**
 * Who hears about a vacancy: its author while they are still in the team,
 * otherwise the company's owners and admins.
 */
export async function vacancyRecipients(
  admin: SupabaseClient,
  vacancy: VacancyForNotification,
): Promise<string[]> {
  const { data } = await admin
    .from("company_members")
    .select("user_id, role")
    .eq("company_id", vacancy.company_id)
    .eq("status", "accepted");

  const members = (data ?? []) as Array<{ user_id: string; role: string }>;

  if (vacancy.author_user_id && members.some((member) => member.user_id === vacancy.author_user_id)) {
    return [vacancy.author_user_id];
  }

  return members
    .filter((member) => member.role === "owner" || member.role === "admin")
    .map((member) => member.user_id);
}

export async function vacancyMetadata(
  admin: SupabaseClient,
  vacancy: VacancyForNotification,
  extra: NotificationMetadata = {},
): Promise<NotificationMetadata> {
  const { data } = await admin
    .from("companies")
    .select("slug, name")
    .eq("id", vacancy.company_id)
    .maybeSingle();
  const company = data as { slug: string; name: string } | null;

  return {
    vacancyId: vacancy.id,
    vacancySlug: vacancy.slug,
    vacancyTitle: vacancy.title,
    companyId: vacancy.company_id,
    companySlug: company?.slug,
    companyName: company?.name,
    ...extra,
  };
}

async function notifyAboutVacancy(
  admin: SupabaseClient,
  vacancy: VacancyForNotification,
  type: "vacancy_approved" | "vacancy_expired" | "moderation_decision",
  extra: NotificationMetadata = {},
): Promise<void> {
  const recipients = await vacancyRecipients(admin, vacancy);

  if (recipients.length === 0) {
    return;
  }

  const metadata = await vacancyMetadata(admin, vacancy, extra);

  await createNotifications(
    admin,
    recipients.map((recipientUserId) => ({
      recipientUserId,
      actorUserId: null,
      type,
      targetType: "vacancy" as const,
      targetId: vacancy.id,
      metadata,
    })),
  );
}

/** A moderator let a held vacancy out. */
export async function notifyVacancyApproved(vacancyId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const vacancy = await loadVacancyForNotification(admin, vacancyId);
  if (!vacancy) return;

  await notifyAboutVacancy(admin, vacancy, "vacancy_approved");
}

/** A moderation decision that hides the vacancy. */
export async function notifyVacancyModeration({
  vacancyId,
  status,
}: {
  vacancyId: string;
  status: "removed" | "restricted";
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const vacancy = await loadVacancyForNotification(admin, vacancyId);
  if (!vacancy) return;

  await notifyAboutVacancy(admin, vacancy, "moderation_decision", {
    moderationStatus: status,
    contentKind: "vacancy",
    contentTitle: vacancy.title,
  });
}

/**
 * The daily cron: published vacancies whose 60 days ran out become expired,
 * and their authors hear of it (one click extends them). Returns how many.
 */
export async function expireVacancies(now: number = Date.now()): Promise<number> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[vacancies] SUPABASE_SERVICE_ROLE_KEY missing — nothing expired");
    return 0;
  }

  const { data, error } = await admin
    .from("vacancies")
    .update({ status: "expired" })
    .eq("status", "published")
    .lte("expires_at", new Date(now).toISOString())
    .select("id, slug, title, company_id, author_user_id");

  if (error) {
    throw new Error(error.message);
  }

  const expired = (data ?? []) as VacancyForNotification[];

  for (const vacancy of expired) {
    try {
      await notifyAboutVacancy(admin, vacancy, "vacancy_expired");
    } catch (notifyError) {
      console.error("[vacancies] expiry notification failed", { id: vacancy.id, notifyError });
    }
  }

  return expired.length;
}

// --- Admin -------------------------------------------------------------------------------

export type AdminVacancyFilter = "review" | "open" | "hidden" | "all";

export type AdminVacancyItem = VacancySummary & {
  createdAt: string;
  moderationNote: string | null;
};

/**
 * Vacancies for /admin/content/vacancies. Reads with the admin's own session:
 * RLS lets platform admins see drafts and moderated ones too. Drafts are left
 * out — nothing to moderate before a vacancy goes out.
 */
export async function listVacanciesForAdmin(
  supabase: SupabaseClient,
  filter: AdminVacancyFilter = "review",
  limit = 200,
): Promise<AdminVacancyItem[]> {
  let query = supabase
    .from("vacancies")
    .select(`${SUMMARY_COLUMNS}, created_at, moderation_note, ${COMPANY_JOIN}, ${NAME_JOINS}`)
    .neq("status", "draft");

  if (filter === "review") {
    query = query.eq("moderation_status", "under_review");
  } else if (filter === "open") {
    query = query
      .eq("status", "published")
      .eq("moderation_status", "approved")
      .gt("expires_at", new Date().toISOString());
  } else if (filter === "hidden") {
    query = query.in("moderation_status", ["restricted", "removed"]);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error || !data) {
    return [];
  }

  return (
    data as unknown as Array<VacancySummaryRow & { created_at: string; moderation_note: string | null }>
  ).map((row) => ({
    ...mapVacancySummary(row),
    createdAt: row.created_at,
    moderationNote: row.moderation_note,
  }));
}
