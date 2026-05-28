import { createClient } from "@/lib/supabase/server";
import type {
  EmploymentType,
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
import { normalizeProfileSettings, type ProfileSettings } from "@/lib/profile-presentation";

function normalizeUsernameCandidate(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "user"
  );
}

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

async function generateUniqueUsername(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: string | null | undefined,
) {
  const baseUsername = normalizeUsernameCandidate(source);
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .ilike("username", `${baseUsername}%`);

  const existingUsernames = new Set(
    (data || [])
      .map((profile) => profile.username?.trim().toLowerCase())
      .filter((username): username is string => Boolean(username)),
  );

  if (!existingUsernames.has(baseUsername)) {
    return baseUsername;
  }

  let suffix = 2;

  while (existingUsernames.has(`${baseUsername}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseUsername}-${suffix}`;
}

export async function ensureProfileForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("name, username, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const defaultUsername = await generateUniqueUsername(
    supabase,
    user.email?.split("@")[0],
  );

  const { data: created } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      username: defaultUsername,
    })
    .select("name, username, avatar_url")
    .single();

  return created;
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
    const defaultUsername = await generateUniqueUsername(
      supabase,
      user.email?.split("@")[0],
    );

    const { data } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        username: defaultUsername,
      })
      .select("*")
      .single();

    profile = data;
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
  ]);

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
    employment_types: Array.isArray(profile.employment_types)
      ? (profile.employment_types as EmploymentType[])
      : [],
    work_formats: Array.isArray(profile.work_formats)
      ? (profile.work_formats as WorkFormat[])
      : [],
    salary_expectations:
      typeof profile.salary_expectations === "string" ? profile.salary_expectations : null,
    salary_currency: getSalaryCurrency(profile.salary_currency),
    behance: typeof profile.behance === "string" ? profile.behance : null,
    dribbble: typeof profile.dribbble === "string" ? profile.dribbble : null,
    artstation:
      typeof profile.artstation === "string" ? profile.artstation : null,
    vimeo: typeof profile.vimeo === "string" ? profile.vimeo : null,
    youtube: typeof profile.youtube === "string" ? profile.youtube : null,
    instagram:
      typeof profile.instagram === "string" ? profile.instagram : null,
    contact_email:
      typeof profile.contact_email === "string" ? profile.contact_email : null,
    telegram_username:
      typeof profile.telegram_username === "string" ? profile.telegram_username : null,
    phone: typeof profile.phone === "string" ? profile.phone : null,
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
