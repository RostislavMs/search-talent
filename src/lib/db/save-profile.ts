import { sanitizeRichTextHtml } from "@/lib/rich-text";
import type { ProfilePayload } from "@/lib/validation/profile";

/**
 * The editor's payload as `save_my_profile` takes it: the profile row, the
 * owner-only details (email, phone, salary, hourly rate never go to the public
 * profiles row) and the sections. Empty section rows are dropped, as before.
 */
export function buildSaveMyProfilePayload(payload: ProfilePayload) {
  const hasHourlyRate = payload.hourly_rate !== null;

  return {
    profile: {
      username: payload.username,
      name: payload.name,
      category_id: payload.category_id,
      headline: payload.headline,
      bio: payload.bio ? sanitizeRichTextHtml(payload.bio) : payload.bio,
      country_id: payload.country_id,
      city: payload.city,
      website: payload.website,
      github: payload.github,
      twitter: payload.twitter,
      linkedin: payload.linkedin,
      behance: payload.behance,
      dribbble: payload.dribbble,
      artstation: payload.artstation,
      vimeo: payload.vimeo,
      youtube: payload.youtube,
      instagram: payload.instagram,
      telegram_username: payload.telegram_username,
      preferred_contact_method: payload.preferred_contact_method,
      experience_years: payload.experience_years,
      experience_level: payload.experience_level,
      open_to: payload.open_to,
      work_formats: payload.work_formats,
      additional_info: payload.additional_info,
      profile_visibility: payload.profile_visibility,
    },
    private: {
      contact_email: payload.contact_email,
      phone: payload.phone,
      salary_expectations: payload.salary_expectations,
      salary_currency: payload.salary_expectations ? payload.salary_currency : null,
      salary_public: payload.salary_expectations ? payload.salary_public : false,
      hourly_rate: payload.hourly_rate,
      hourly_rate_currency: hasHourlyRate ? payload.hourly_rate_currency : null,
      hourly_rate_public: hasHourlyRate ? payload.hourly_rate_public : false,
    },
    skills: payload.skill_ids,
    languages: payload.languages
      .filter((item) => item.language_id !== null)
      .map((item) => ({
        id: item.id,
        language_id: item.language_id,
        proficiency_level: item.proficiency_level,
      })),
    education: payload.education
      .filter((item) => item.institution || item.degree || item.field_of_study)
      .map((item) => ({
        id: item.id,
        institution: item.institution,
        degree: item.degree,
        field_of_study: item.field_of_study,
        started_on: item.started_on,
        completed_on: item.completed_on,
        description: item.description,
      })),
    certificates: payload.certificates
      .filter((item) => item.title || item.issuer || item.credential_url || item.file_url)
      .map((item) => ({
        id: item.id,
        title: item.title,
        issuer: item.issuer,
        issued_on: item.issued_on,
        credential_url: item.credential_url,
        file_url: item.file_url,
        file_name: item.file_name,
        storage_path: item.storage_path,
      })),
    qas: payload.qas.map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
    })),
    work_experience: payload.work_experience
      .filter(
        (item) =>
          item.company_name ||
          item.position ||
          item.responsibilities ||
          item.started_year !== null ||
          item.ended_year !== null,
      )
      .map((item) => ({
        id: item.id,
        company_name: item.company_name,
        position: item.position,
        started_year: item.started_year,
        ended_year: item.is_current ? null : item.ended_year,
        is_current: item.is_current,
        responsibilities: item.responsibilities,
      })),
  };
}

/**
 * The nick is taken: `save_my_profile` reports it as `username_taken`; an
 * update straight on the table names the unique index.
 */
export function isUsernameTakenError(error: { code?: string | null; message?: string | null } | null) {
  if (!error || error.code !== "23505") {
    return false;
  }

  return (error.message ?? "").includes("username");
}
