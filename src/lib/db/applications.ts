import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MY_APPLICATIONS_PATH,
  buildTeamApplicationsPath,
  isApplicantNoticeEmailed,
  normalizeApplicationStatus,
  type ApplicantNotice,
  type ApplicationProject,
  type MyApplication,
  type TeamApplication,
} from "@/lib/applications";
import { loadEmailRecipient } from "@/lib/db/email-recipients";
import { createNotifications } from "@/lib/db/notifications";
import {
  loadVacancyForNotification,
  vacancyMetadata,
  vacancyRecipients,
  type VacancyForNotification,
} from "@/lib/db/vacancies";
import { sendEmail } from "@/lib/email/resend";
import {
  buildApplicationReceivedEmail,
  buildApplicationStatusEmail,
} from "@/lib/email/templates";
import type { Locale } from "@/lib/i18n/config";
import { normalizeOpenTo } from "@/lib/open-to";
import { getSiteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVacancyStatus, resolveVacancyState } from "@/lib/vacancies";

type Joined<T> = T | T[] | null | undefined;

function firstJoined<T>(value: Joined<T>): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// --- Projects ----------------------------------------------------------------------------

type ProjectRow = {
  id: string;
  title: string;
  slug: string | null;
  cover_url: string | null;
  kind: string | null;
  status: string;
  moderation_status: string | null;
};

const PROJECT_COLUMNS = "id, title, slug, cover_url, kind, status, moderation_status";

function toApplicationProject(row: ProjectRow): ApplicationProject {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.cover_url,
    kind: row.kind,
  };
}

function isShownProject(row: ProjectRow): boolean {
  return row.status === "published" && (row.moderation_status ?? "approved") === "approved";
}

/** Published, visible projects by id. A project deleted or hidden since simply drops out. */
async function loadProjects(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, ApplicationProject>> {
  const map = new Map<string, ApplicationProject>();
  const unique = Array.from(new Set(ids.filter(Boolean)));

  if (unique.length === 0) {
    return map;
  }

  const { data } = await supabase.from("projects").select(PROJECT_COLUMNS).in("id", unique);

  for (const row of (data ?? []) as ProjectRow[]) {
    if (isShownProject(row)) {
      map.set(row.id, toApplicationProject(row));
    }
  }

  return map;
}

function pickProjects(ids: string[] | null, map: Map<string, ApplicationProject>): ApplicationProject[] {
  return (ids ?? [])
    .map((id) => map.get(id))
    .filter((project): project is ApplicationProject => Boolean(project));
}

/**
 * What the candidate can attach: their published projects and the ones they
 * co-authored (an accepted invitation), newest own first. apply_to_vacancy()
 * checks the same.
 */
export async function listApplicableProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<ApplicationProject[]> {
  const [own, coAuthored] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("owner_id", userId)
      .eq("status", "published")
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("project_authors")
      .select("project_id")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .limit(100),
  ]);

  const projects = ((own.data ?? []) as ProjectRow[]).filter(isShownProject).map(toApplicationProject);
  const seen = new Set(projects.map((project) => project.id));
  const coAuthoredIds = ((coAuthored.data ?? []) as Array<{ project_id: string }>)
    .map((row) => row.project_id)
    .filter((id) => !seen.has(id));

  if (coAuthoredIds.length > 0) {
    const shared = await loadProjects(supabase, coAuthoredIds);
    for (const id of coAuthoredIds) {
      const project = shared.get(id);
      if (project) {
        projects.push(project);
      }
    }
  }

  return projects;
}

/**
 * The email and phone the company would get: the contact email from the
 * profile, or the account's email (vacancy_application_contacts() picks the
 * same). Shown in the form before the candidate agrees.
 */
export async function getApplicantContactPreview(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<{ email: string | null; phone: string | null }> {
  const { data } = await supabase
    .from("profile_private_details")
    .select("contact_email, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = data as { contact_email: string | null; phone: string | null } | null;

  return {
    email: row?.contact_email?.trim() || user.email?.trim() || null,
    phone: row?.phone?.trim() || null,
  };
}

/**
 * What the vacancy page needs to offer the form to a signed-in visitor: a
 * public profile, something to attach, and the contacts the company would get.
 */
export async function getApplyContext(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<{
  hasProfile: boolean;
  projects: ApplicationProject[];
  contacts: { email: string | null; phone: string | null };
}> {
  const [{ data: profile }, projects, contacts] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, moderation_status")
      .eq("user_id", user.id)
      .maybeSingle(),
    listApplicableProjects(supabase, user.id),
    getApplicantContactPreview(supabase, user),
  ]);

  const row = profile as { username: string | null; moderation_status: string | null } | null;

  return {
    hasProfile: Boolean(row?.username) && (row?.moderation_status ?? "approved") === "approved",
    projects,
    contacts,
  };
}

// --- The candidate's side -----------------------------------------------------------------

export type MyApplicationForVacancy = {
  id: string;
  status: ReturnType<typeof normalizeApplicationStatus>;
  createdAt: string;
};

/** The person's application to this vacancy, withdrawn included; null before the migration. */
export async function getMyApplicationForVacancy(
  supabase: SupabaseClient,
  userId: string,
  vacancyId: string,
): Promise<MyApplicationForVacancy | null> {
  const { data, error } = await supabase
    .from("vacancy_applications")
    .select("id, status, created_at")
    .eq("vacancy_id", vacancyId)
    .eq("applicant_user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as { id: string; status: string; created_at: string };
  return { id: row.id, status: normalizeApplicationStatus(row.status), createdAt: row.created_at };
}

/** How many vacancies the person applied to, withdrawn ones included. 0 on any error. */
export async function countMyApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("vacancy_applications")
    .select("id", { count: "exact", head: true })
    .eq("applicant_user_id", userId);

  return error ? 0 : (count ?? 0);
}

/** Whether the person ever applied; drives the "My applications" link. False on any error. */
export async function hasVacancyApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await countMyApplications(supabase, userId)) > 0;
}

type MyApplicationRow = {
  id: string;
  status: string;
  project_ids: string[] | null;
  created_at: string;
  status_changed_at: string | null;
  vacancy: Joined<{
    id: string;
    slug: string;
    title: string;
    status: string;
    expires_at: string | null;
    company: Joined<{ slug: string; name: string; logo_url: string | null }>;
  }>;
};

/** "My applications", newest first. */
export async function listMyApplications(
  supabase: SupabaseClient,
  userId: string,
  now: number = Date.now(),
): Promise<MyApplication[]> {
  const { data, error } = await supabase
    .from("vacancy_applications")
    .select(
      "id, status, project_ids, created_at, status_changed_at, vacancy:vacancy_id ( id, slug, title, status, expires_at, company:company_id ( slug, name, logo_url ) )",
    )
    .eq("applicant_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as MyApplicationRow[];
  const projects = await loadProjects(
    supabase,
    rows.flatMap((row) => row.project_ids ?? []),
  );

  return rows.map((row) => {
    const vacancy = firstJoined(row.vacancy);
    const company = vacancy ? firstJoined(vacancy.company) : null;

    return {
      id: row.id,
      status: normalizeApplicationStatus(row.status),
      createdAt: row.created_at,
      statusChangedAt: row.status_changed_at,
      projects: pickProjects(row.project_ids, projects),
      vacancy:
        vacancy && company
          ? {
              id: vacancy.id,
              slug: vacancy.slug,
              title: vacancy.title,
              state: resolveVacancyState(
                { status: normalizeVacancyStatus(vacancy.status), expiresAt: vacancy.expires_at },
                now,
              ),
              company: { slug: company.slug, name: company.name, logoUrl: company.logo_url },
            }
          : null,
    };
  });
}

// --- The team's side ------------------------------------------------------------------------

type TeamApplicationRow = {
  id: string;
  status: string;
  message: string | null;
  project_ids: string[] | null;
  created_at: string;
  viewed_at: string | null;
  withdrawn_at: string | null;
  applicant_user_id: string;
};

type ApplicantRow = {
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
  open_to: string[] | null;
};

/**
 * Applications to one vacancy, newest first, as its company's team sees them:
 * the candidate's public profile, the projects they chose and their contacts.
 * RLS returns nothing to anyone outside the team.
 */
export async function listTeamApplications(
  supabase: SupabaseClient,
  vacancyId: string,
): Promise<TeamApplication[]> {
  const { data, error } = await supabase
    .from("vacancy_applications")
    .select("id, status, message, project_ids, created_at, viewed_at, withdrawn_at, applicant_user_id")
    .eq("vacancy_id", vacancyId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !data) {
    return [];
  }

  const rows = data as TeamApplicationRow[];

  if (rows.length === 0) {
    return [];
  }

  const [profilesResult, projects, contactsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, username, name, avatar_url, headline, open_to")
      .in("user_id", Array.from(new Set(rows.map((row) => row.applicant_user_id)))),
    loadProjects(
      supabase,
      rows.flatMap((row) => row.project_ids ?? []),
    ),
    supabase.rpc("vacancy_application_contacts", { p_vacancy_id: vacancyId }),
  ]);

  const profiles = new Map<string, ApplicantRow>();
  for (const row of (profilesResult.data ?? []) as ApplicantRow[]) {
    if (row.user_id && row.username) {
      profiles.set(row.user_id, row);
    }
  }

  const contacts = new Map<string, { email: string | null; phone: string | null }>();
  for (const row of (contactsResult.data ?? []) as Array<{
    application_id: string;
    email: string | null;
    phone: string | null;
  }>) {
    contacts.set(row.application_id, { email: row.email, phone: row.phone });
  }

  return rows.map((row) => {
    const profile = profiles.get(row.applicant_user_id);

    return {
      id: row.id,
      status: normalizeApplicationStatus(row.status),
      message: row.message ?? "",
      projects: pickProjects(row.project_ids, projects),
      createdAt: row.created_at,
      viewedAt: row.viewed_at,
      withdrawnAt: row.withdrawn_at,
      applicantUserId: row.applicant_user_id,
      applicant: profile
        ? {
            userId: profile.user_id,
            username: profile.username as string,
            name: profile.name,
            avatarUrl: profile.avatar_url,
            headline: profile.headline,
            openTo: normalizeOpenTo(profile.open_to),
          }
        : null,
      contacts: contacts.get(row.id) ?? null,
    };
  });
}

export type VacancyApplicationCount = { total: number; fresh: number };

/**
 * Applications per vacancy (withdrawn ones left out) and how many nobody has
 * opened. Counted in the database: fetching rows would stop at the API's row
 * limit. Empty on any error, e.g. before the migration.
 */
export async function countVacancyApplications(
  supabase: SupabaseClient,
  vacancyIds: string[],
): Promise<Map<string, VacancyApplicationCount>> {
  const counts = new Map<string, VacancyApplicationCount>();

  if (vacancyIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase.rpc("vacancy_application_counts", {
    p_vacancy_ids: vacancyIds,
  });

  if (error) {
    return counts;
  }

  for (const row of (data ?? []) as Array<{
    vacancy_id: string;
    total: number | string;
    fresh: number | string;
  }>) {
    counts.set(row.vacancy_id, { total: Number(row.total) || 0, fresh: Number(row.fresh) || 0 });
  }

  return counts;
}

// --- Notifications and email --------------------------------------------------------------------
// Written with the service key and never thrown: a lost notification must not
// undo the application or the decision that caused it.

function absoluteUrl(locale: Locale, path: string): string {
  return `${getSiteUrl().replace(/\/$/, "")}/${locale}${path}`;
}

/**
 * A candidate applied: the vacancy's author (or, if they left the team, its
 * owners and admins) gets a notification and an email.
 */
export async function notifyApplicationReceived({
  applicationId,
  vacancyId,
  applicantUserId,
}: {
  applicationId: string;
  vacancyId: string;
  applicantUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    const vacancy = await loadVacancyForNotification(admin, vacancyId);
    if (!vacancy) return;

    const recipients = (await vacancyRecipients(admin, vacancy)).filter(
      (userId) => userId !== applicantUserId,
    );
    if (recipients.length === 0) return;

    const metadata = await vacancyMetadata(admin, vacancy, { applicationId });

    await createNotifications(
      admin,
      recipients.map((recipientUserId) => ({
        recipientUserId,
        actorUserId: applicantUserId,
        type: "application_received" as const,
        targetType: "vacancy_application" as const,
        targetId: applicationId,
        metadata,
      })),
    );

    const { data: applicantProfile } = await admin
      .from("profiles")
      .select("name, username")
      .eq("user_id", applicantUserId)
      .maybeSingle();
    const applicant = applicantProfile as { name: string | null; username: string | null } | null;
    const applicantName = applicant?.name?.trim() || applicant?.username || "";

    for (const userId of recipients) {
      const recipient = await loadEmailRecipient(admin, userId);
      if (!recipient) continue;

      const message = buildApplicationReceivedEmail({
        recipientName: recipient.name,
        applicantName,
        vacancyTitle: vacancy.title,
        companyName: metadata.companyName ?? "",
        url: absoluteUrl(recipient.locale, buildTeamApplicationsPath(vacancy.id)),
        locale: recipient.locale,
      });
      await sendEmail({ to: recipient.email, ...message });
    }
  } catch (error) {
    console.error("[applications] new application notification failed", { applicationId, error });
  }
}

async function notifyApplicant(
  admin: SupabaseClient,
  vacancy: VacancyForNotification,
  {
    applicationId,
    applicantUserId,
    notice,
  }: { applicationId: string; applicantUserId: string; notice: ApplicantNotice },
): Promise<void> {
  const metadata = await vacancyMetadata(admin, vacancy, {
    applicationId,
    applicationStatus: notice,
  });

  await createNotifications(admin, {
    recipientUserId: applicantUserId,
    actorUserId: null,
    type: "application_status",
    targetType: "vacancy_application",
    targetId: applicationId,
    metadata,
  });

  if (!isApplicantNoticeEmailed(notice)) {
    return;
  }

  const recipient = await loadEmailRecipient(admin, applicantUserId);
  if (!recipient) return;

  const message = buildApplicationStatusEmail({
    recipientName: recipient.name,
    vacancyTitle: vacancy.title,
    companyName: metadata.companyName ?? "",
    notice,
    url: absoluteUrl(recipient.locale, MY_APPLICATIONS_PATH),
    locale: recipient.locale,
  });
  await sendEmail({ to: recipient.email, ...message });
}

/** The team decided something: the candidate hears it (decisions by email too). */
export async function notifyApplicationStatus({
  applicationId,
  vacancyId,
  applicantUserId,
  notice,
}: {
  applicationId: string;
  vacancyId: string;
  applicantUserId: string;
  notice: ApplicantNotice;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    const vacancy = await loadVacancyForNotification(admin, vacancyId);
    if (!vacancy) return;

    await notifyApplicant(admin, vacancy, { applicationId, applicantUserId, notice });
  } catch (error) {
    console.error("[applications] status notification failed", { applicationId, error });
  }
}

/** The team opened these applications for the first time. */
export async function notifyApplicationsViewed(
  rows: Array<{ application_id: string; applicant_user_id: string; vacancy_id: string }>,
): Promise<void> {
  if (rows.length === 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  const vacancies = new Map<string, VacancyForNotification | null>();

  for (const row of rows) {
    try {
      if (!vacancies.has(row.vacancy_id)) {
        vacancies.set(row.vacancy_id, await loadVacancyForNotification(admin, row.vacancy_id));
      }
      const vacancy = vacancies.get(row.vacancy_id);
      if (!vacancy) continue;

      await notifyApplicant(admin, vacancy, {
        applicationId: row.application_id,
        applicantUserId: row.applicant_user_id,
        notice: "viewed",
      });
    } catch (error) {
      console.error("[applications] viewed notification failed", { id: row.application_id, error });
    }
  }
}

/**
 * The daily cron: applications go 12 months after their vacancy closed or ran
 * out. Returns how many; 0 without the service key.
 */
export async function purgeOldApplications(): Promise<number> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[applications] SUPABASE_SERVICE_ROLE_KEY missing — nothing purged");
    return 0;
  }

  const { data, error } = await admin.rpc("purge_old_vacancy_applications");

  if (error) {
    throw new Error(error.message);
  }

  return Number(data) || 0;
}
