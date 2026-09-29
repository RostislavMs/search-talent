import { awardSqlBadgesForUser } from "@/lib/db/badges";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateTemporaryUsername } from "@/lib/username";
import type {
  ExperienceLevel,
  LanguageLevel,
  PreferredContactMethod,
  ProfileCertificateEntry,
  ProfileEducationEntry,
  ProfileLanguageEntry,
  ProfileQaEntry,
  ProfileWorkExperienceEntry,
  SalaryCurrency,
  WorkFormat,
} from "@/lib/profile-sections";
import {
  experienceLevels,
  preferredContactMethods,
  salaryCurrencies,
} from "@/lib/profile-sections";
import { normalizeOpenTo } from "@/lib/open-to";
import {
  isValidHourlyRate,
  PROFILE_PRIVATE_DETAILS_COLUMNS,
  type ProfilePrivateDetailsRow,
} from "@/lib/profile-private";
import { normalizeProfileSettings, type ProfileSettings } from "@/lib/profile-presentation";

function getExperienceLevel(value: unknown) {
  return typeof value === "string" && experienceLevels.includes(value as ExperienceLevel)
    ? (value as ExperienceLevel)
    : null;
}

function getSalaryCurrency(value: unknown) {
  return typeof value === "string" && salaryCurrencies.includes(value as SalaryCurrency)
    ? (value as SalaryCurrency)
    : null;
}

function getPreferredContactMethod(value: unknown) {
  return typeof value === "string" &&
    preferredContactMethods.includes(value as PreferredContactMethod)
    ? (value as PreferredContactMethod)
    : null;
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// Collisions on six random characters are practically impossible; a few
// attempts cover the theoretical case without looping forever.
const TEMPORARY_USERNAME_ATTEMPTS = 3;

/**
 * Creates the profile row for a new account with a temporary `user-xxxxxx`
 * nick (the person picks their own on the first onboarding step). When two
 * requests race to create the same row, the loser reads the winner's row.
 */
async function createProfileRow<TColumns extends string>(
  supabase: ServerSupabase,
  userId: string,
  columns: TColumns,
) {
  for (let attempt = 0; attempt < TEMPORARY_USERNAME_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ user_id: userId, username: generateTemporaryUsername() })
      .select(columns)
      .single();

    if (!error) {
      return data;
    }

    if (!error.message?.includes("username")) {
      break;
    }
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select(columns)
    .eq("user_id", userId)
    .maybeSingle();

  return existing;
}

/**
 * Supabase Auth confirms the email; the public "email verified" mark on the
 * profile follows it automatically instead of waiting for a button press. The
 * guard trigger on `profiles` only lets the flag turn on when the auth email
 * really is confirmed, so this cannot be forged.
 */
async function syncEmailVerified(supabase: ServerSupabase, userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ email_verified: true, email_verified_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (!error) {
    // The `verified_email` badge is awarded right away rather than on the next
    // unrelated trigger. Failures are logged inside and must not break the page.
    // The award RPC takes any user id, so browsers cannot call it; the server
    // does, with the service key.
    await awardSqlBadgesForUser(createAdminClient() ?? supabase, userId);
  }
}

export async function ensureProfileForUser(
  supabase: ServerSupabase,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null },
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("name, username, avatar_url, email_verified")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile =
    existing ??
    (await createProfileRow(supabase, user.id, "name, username, avatar_url, email_verified"));

  if (profile && user.email_confirmed_at && !profile.email_verified) {
    await syncEmailVerified(supabase, user.id);
  }

  return profile;
}

export async function getMyProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    profile = await createProfileRow(supabase, user.id, "*");
  }

  if (!profile) {
    return null;
  }

  const [
    { data: profileSkills },
    { data: profileLanguages },
    educationResponse,
    certificatesResponse,
    qaResponse,
    workExperienceResponse,
    privateDetailsResponse,
  ] = await Promise.all([
    supabase
      .from("profile_skills")
      .select("skill_id")
      .eq("profile_id", profile.id),
    supabase
      .from("profile_languages")
      .select("id, language_id, proficiency_level")
      .eq("profile_id", profile.id),
    supabase
      .from("profile_education")
      .select(
        "id, institution, degree, field_of_study, started_on, completed_on, description",
      )
      .eq("profile_id", profile.id)
      .order("started_on", { ascending: false }),
    supabase
      .from("profile_certificates")
      .select(
        "id, title, issuer, issued_on, credential_url, file_url, file_name, storage_path",
      )
      .eq("profile_id", profile.id)
      .order("issued_on", { ascending: false }),
    supabase
      .from("profile_qas")
      .select("id, question, answer")
      .eq("profile_id", profile.id),
    supabase
      .from("profile_work_experience")
      .select(
        "id, company_name, position, started_year, ended_year, is_current, responsibilities",
      )
      .eq("profile_id", profile.id)
      .order("started_year", { ascending: false }),
    // Email, phone, salary and the hourly rate: the owner-only table (RLS lets
    // the owner read it).
    supabase
      .from("profile_private_details")
      .select(PROFILE_PRIVATE_DETAILS_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const privateDetails = (privateDetailsResponse.data ?? null) as ProfilePrivateDetailsRow | null;
  const hourlyRate = privateDetails?.hourly_rate;

  const education =
    educationResponse.error || !educationResponse.data
      ? []
      : (educationResponse.data as Array<{
          id: string;
          institution: string | null;
          degree: string | null;
          field_of_study: string | null;
          started_on: string | null;
          completed_on: string | null;
          description: string | null;
        }>).map(
          (item): ProfileEducationEntry => ({
            id: item.id,
            institution: item.institution || "",
            degree: item.degree || "",
            field_of_study: item.field_of_study || "",
            started_on: item.started_on || "",
            completed_on: item.completed_on || "",
            description: item.description || "",
          }),
        );

  const certificates =
    certificatesResponse.error || !certificatesResponse.data
      ? []
      : (certificatesResponse.data as Array<{
          id: string;
          title: string | null;
          issuer: string | null;
          issued_on: string | null;
          credential_url: string | null;
          file_url: string | null;
          file_name: string | null;
          storage_path: string | null;
        }>).map(
          (item): ProfileCertificateEntry => ({
            id: item.id,
            title: item.title || "",
            issuer: item.issuer || "",
            issued_on: item.issued_on || "",
            credential_url: item.credential_url || "",
            file_url: item.file_url || "",
            file_name: item.file_name || "",
            storage_path: item.storage_path || "",
          }),
        );

  const qas =
    qaResponse.error || !qaResponse.data
      ? []
      : (qaResponse.data as Array<{
          id: string;
          question: string | null;
          answer: string | null;
        }>).map(
          (item): ProfileQaEntry => ({
            id: item.id,
            question: item.question || "",
            answer: item.answer || "",
          }),
        );

  const work_experience =
    workExperienceResponse.error || !workExperienceResponse.data
      ? []
      : (workExperienceResponse.data as Array<{
          id: string;
          company_name: string | null;
          position: string | null;
          started_year: number | null;
          ended_year: number | null;
          is_current: boolean | null;
          responsibilities: string | null;
        }>).map(
          (item): ProfileWorkExperienceEntry => ({
            id: item.id,
            company_name: item.company_name || "",
            position: item.position || "",
            started_year:
              typeof item.started_year === "number" ? String(item.started_year) : "",
            ended_year:
              typeof item.ended_year === "number" ? String(item.ended_year) : "",
            is_current: Boolean(item.is_current),
            responsibilities: item.responsibilities || "",
          }),
        );

  return {
    ...profile,
    moderation_status:
      typeof profile.moderation_status === "string" ? profile.moderation_status : null,
    moderation_note:
      typeof profile.moderation_note === "string" ? profile.moderation_note : null,
    category_id: typeof profile.category_id === "number" ? profile.category_id : null,
    experience_level: getExperienceLevel(profile.experience_level),
    experience_years:
      typeof profile.experience_years === "number" ? profile.experience_years : null,
    open_to: normalizeOpenTo(profile.open_to),
    open_to_updated_at:
      typeof profile.open_to_updated_at === "string" ? profile.open_to_updated_at : null,
    work_formats: Array.isArray(profile.work_formats)
      ? (profile.work_formats as WorkFormat[])
      : [],
    salary_expectations: privateDetails?.salary_expectations ?? null,
    salary_currency: getSalaryCurrency(privateDetails?.salary_currency),
    salary_public: Boolean(privateDetails?.salary_public),
    hourly_rate: isValidHourlyRate(hourlyRate) ? hourlyRate : null,
    hourly_rate_currency: getSalaryCurrency(privateDetails?.hourly_rate_currency),
    hourly_rate_public: Boolean(privateDetails?.hourly_rate_public),
    behance: typeof profile.behance === "string" ? profile.behance : null,
    dribbble: typeof profile.dribbble === "string" ? profile.dribbble : null,
    artstation:
      typeof profile.artstation === "string" ? profile.artstation : null,
    vimeo: typeof profile.vimeo === "string" ? profile.vimeo : null,
    youtube: typeof profile.youtube === "string" ? profile.youtube : null,
    instagram:
      typeof profile.instagram === "string" ? profile.instagram : null,
    contact_email: privateDetails?.contact_email ?? null,
    telegram_username:
      typeof profile.telegram_username === "string" ? profile.telegram_username : null,
    phone: privateDetails?.phone ?? null,
    preferred_contact_method: getPreferredContactMethod(
      profile.preferred_contact_method,
    ),
    additional_info:
      typeof profile.additional_info === "string" ? profile.additional_info : null,
    profile_visibility: normalizeProfileSettings(profile.profile_visibility) as ProfileSettings,
    skill_ids: (profileSkills || []).map((item) => item.skill_id),
    language_ids: (profileLanguages || []).map((item) => item.language_id),
    languages:
      (profileLanguages as
        | Array<{
            id: string;
            language_id: number | null;
            proficiency_level: LanguageLevel | null;
          }>
        | null
        | undefined)?.map(
        (item): ProfileLanguageEntry => ({
          id: item.id,
          language_id: item.language_id,
          proficiency_level: item.proficiency_level || "intermediate",
        }),
      ) || [],
    education,
    certificates,
    qas,
    work_experience,
  };
}
