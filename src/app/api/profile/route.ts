import { NextResponse } from "next/server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { profilePayloadSchema } from "@/lib/validation/profile";
import { parseJsonRequest } from "@/lib/validation/request";

function isDuplicateUsernameError(message: string | undefined) {
  if (!message) {
    return false;
  }

  return (
    message.includes("profiles_username_key") ||
    message.includes("duplicate key value")
  );
}

export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, profilePayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json(
      { error: existingProfileError.message || "Could not load profile" },
      { status: 400 },
    );
  }

  if (!existingProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
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
      contact_email: payload.contact_email,
      telegram_username: payload.telegram_username,
      phone: payload.phone,
      preferred_contact_method: payload.preferred_contact_method,
      experience_years: payload.experience_years,
      experience_level: payload.experience_level,
      employment_types: payload.employment_types,
      work_formats: payload.work_formats,
      salary_expectations: payload.salary_expectations,
      salary_currency: payload.salary_expectations ? payload.salary_currency : null,
      additional_info: payload.additional_info,
      profile_visibility: payload.profile_visibility,
    })
    .eq("user_id", user.id);

  if (profileError) {
    return NextResponse.json(
      {
        error: isDuplicateUsernameError(profileError.message)
          ? "This username is already taken."
          : (profileError.message || "Could not save profile"),
      },
      { status: isDuplicateUsernameError(profileError.message) ? 409 : 400 },
    );
  }

  const profileId = existingProfile.id;

  const deleteResults = await Promise.all([
    supabase.from("profile_skills").delete().eq("profile_id", profileId),
    supabase.from("profile_languages").delete().eq("profile_id", profileId),
    supabase.from("profile_education").delete().eq("profile_id", profileId),
    supabase.from("profile_certificates").delete().eq("profile_id", profileId),
    supabase.from("profile_qas").delete().eq("profile_id", profileId),
    supabase.from("profile_work_experience").delete().eq("profile_id", profileId),
  ]);

  const deleteError = deleteResults.find((result) => result.error)?.error;

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Could not update profile relations" },
      { status: 400 },
    );
  }

  const relationWrites = [];

  if (payload.skill_ids.length > 0) {
    relationWrites.push(
      supabase.from("profile_skills").insert(
        payload.skill_ids.map((skillId) => ({
          profile_id: profileId,
          skill_id: skillId,
        })),
      ),
    );
  }

  const languages = payload.languages.filter((item) => item.language_id !== null);
  if (languages.length > 0) {
    relationWrites.push(
      supabase.from("profile_languages").insert(
        languages.map((item) => ({
          id: item.id,
          profile_id: profileId,
          language_id: item.language_id,
          proficiency_level: item.proficiency_level,
        })),
      ),
    );
  }

  const education = payload.education.filter(
    (item) => item.institution || item.degree || item.field_of_study,
  );
  if (education.length > 0) {
    relationWrites.push(
      supabase.from("profile_education").insert(
        education.map((item) => ({
          id: item.id,
          profile_id: profileId,
          institution: item.institution,
          degree: item.degree,
          field_of_study: item.field_of_study,
          started_on: item.started_on,
          completed_on: item.completed_on,
          description: item.description,
        })),
      ),
    );
  }

  const certificates = payload.certificates.filter(
    (item) => item.title || item.issuer || item.credential_url || item.file_url,
  );
  if (certificates.length > 0) {
    relationWrites.push(
      supabase.from("profile_certificates").insert(
        certificates.map((item) => ({
          id: item.id,
          profile_id: profileId,
          title: item.title,
          issuer: item.issuer,
          issued_on: item.issued_on,
          credential_url: item.credential_url,
          file_url: item.file_url,
          file_name: item.file_name,
          storage_path: item.storage_path,
        })),
      ),
    );
  }

  if (payload.qas.length > 0) {
    relationWrites.push(
      supabase.from("profile_qas").insert(
        payload.qas.map((item) => ({
          id: item.id,
          profile_id: profileId,
          question: item.question,
          answer: item.answer,
        })),
      ),
    );
  }

  const workExperience = payload.work_experience.filter(
    (item) =>
      item.company_name ||
      item.position ||
      item.responsibilities ||
      item.started_year !== null ||
      item.ended_year !== null,
  );
  if (workExperience.length > 0) {
    relationWrites.push(
      supabase.from("profile_work_experience").insert(
        workExperience.map((item) => ({
          id: item.id,
          profile_id: profileId,
          company_name: item.company_name,
          position: item.position,
          started_year: item.started_year,
          ended_year: item.is_current ? null : item.ended_year,
          is_current: item.is_current,
          responsibilities: item.responsibilities,
        })),
      ),
    );
  }

  if (relationWrites.length > 0) {
    const relationResults = await Promise.all(relationWrites);
    const relationError = relationResults.find((result) => result.error)?.error;

    if (relationError) {
      return NextResponse.json(
        { error: relationError.message || "Could not save profile details" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
