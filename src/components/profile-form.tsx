"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import {
  createProfileCertificateEntry,
  createDefaultProfileVisibility,
  createProfileEducationEntry,
  createProfileLanguageEntry,
  createProfileQaEntry,
  createProfileWorkExperienceEntry,
  employmentTypes,
  experienceLevels,
  languageLevels,
  preferredContactMethods,
  profileVisibilityKeys,
  salaryCurrencies,
  sanitizeStorageFileName,
  workFormats,
  type EmploymentType,
  type ExperienceLevel,
  type LanguageLevel,
  type PreferredContactMethod,
  type ProfileCertificateEntry,
  type ProfileEducationEntry,
  type ProfileLanguageEntry,
  type ProfileQaEntry,
  type ProfileVisibility,
  type ProfileVisibilityKey,
  type ProfileWorkExperienceEntry,
  type SalaryCurrency,
  type WorkFormat,
} from "@/lib/profile-sections";
import {
  createDefaultProfilePresentation,
  getProfileFontStack,
  getProfileTextScale,
  normalizeProfilePresentation,
  normalizeProfileSettings,
  normalizeSectionOrder,
  profileBackgroundModes,
  profileCardStyles,
  profileFontPresets,
  profileHeroAlignments,
  profileSectionSizes,
  profileTextScales,
  type ProfileBackgroundMode,
  type ProfileCardStyle,
  type ProfileFontPreset,
  type ProfileHeroAlignment,
  type ProfilePresentation,
  type ProfileSectionId,
  type ProfileSectionSize,
  type ProfileSettings,
  type ProfileTextScale,
} from "@/lib/profile-presentation";
import { apiFetch } from "@/lib/api-client";
import { profilePayloadSchema } from "@/lib/validation/profile";
import type { ProfileCategory } from "@/lib/profile-categories";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import OptimizedImage from "@/components/ui/optimized-image";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import RichTextComposer from "@/components/rich-text-composer";
import TagSelect from "./ui/tag-select";
import SearchSelect from "./ui/search-select";

type MetaOption = {
  id: number;
  name: string;
};

type ProfileRecord = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  category_id: number | null;
  headline: string | null;
  bio: string | null;
  country_id: number | null;
  city: string | null;
  website: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  behance: string | null;
  dribbble: string | null;
  artstation: string | null;
  vimeo: string | null;
  youtube: string | null;
  instagram: string | null;
  contact_email: string | null;
  telegram_username: string | null;
  phone: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  experience_level: ExperienceLevel | null;
  experience_years: number | null;
  employment_types: EmploymentType[];
  work_formats: WorkFormat[];
  salary_expectations: string | null;
  salary_currency: SalaryCurrency | null;
  additional_info: string | null;
  profile_visibility: ProfileSettings | null;
  skill_ids: number[];
  languages: ProfileLanguageEntry[];
  education: ProfileEducationEntry[];
  certificates: ProfileCertificateEntry[];
  qas: ProfileQaEntry[];
  work_experience: ProfileWorkExperienceEntry[];
};

type MetaState = {
  countries: MetaOption[];
  skills: MetaOption[];
  languages: MetaOption[];
  categories: ProfileCategory[];
};

function normalizeMetaOptions(value: unknown): MetaOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { id?: unknown }).id !== "number" ||
      typeof (item as { name?: unknown }).name !== "string"
    ) {
      return [];
    }

    return [
      {
        id: (item as { id: number }).id,
        name: (item as { name: string }).name,
      },
    ];
  });
}

function normalizeMetaCategories(value: unknown): ProfileCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { id?: unknown }).id !== "number" ||
      typeof (item as { name?: unknown }).name !== "string"
    ) {
      return [];
    }

    return [
      {
        id: (item as { id: number }).id,
        name: (item as { name: string }).name,
        slug:
          typeof (item as { slug?: unknown }).slug === "string"
            ? (item as { slug: string }).slug
            : null,
      },
    ];
  });
}

type FormState = {
  username: string;
  name: string;
  category_id: number | null;
  headline: string;
  bio: string;
  country_id: number | null;
  city: string;
  website: string;
  github: string;
  twitter: string;
  linkedin: string;
  behance: string;
  dribbble: string;
  artstation: string;
  vimeo: string;
  youtube: string;
  instagram: string;
  contact_email: string;
  telegram_username: string;
  phone: string;
  preferred_contact_method: PreferredContactMethod | "";
  experience_level: ExperienceLevel | "";
  salary_expectations: string;
  salary_currency: SalaryCurrency;
  additional_info: string;
};

function getProfileErrorMessage(
  message: string | null | undefined,
  fallback: string,
  usernameTaken: string,
) {
  if (!message) {
    return fallback;
  }

  if (
    message.includes("profiles_username_key") ||
    message.includes("duplicate key value")
  ) {
    return usernameTaken;
  }

  return message;
}

function isFilled(value: string) {
  return value.trim().length > 0;
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function getLanguageLevelLabel(
  level: LanguageLevel,
  dictionary: ReturnType<typeof useDictionary>,
) {
  switch (level) {
    case "beginner":
      return dictionary.forms.languageLevelBeginner;
    case "elementary":
      return dictionary.forms.languageLevelElementary;
    case "intermediate":
      return dictionary.forms.languageLevelIntermediate;
    case "upper_intermediate":
      return dictionary.forms.languageLevelUpperIntermediate;
    case "advanced":
      return dictionary.forms.languageLevelAdvanced;
    case "native":
      return dictionary.forms.languageLevelNative;
    default:
      return level;
  }
}

function getEmploymentTypeLabel(
  value: EmploymentType,
  dictionary: ReturnType<typeof useDictionary>,
) {
  switch (value) {
    case "full_time":
      return dictionary.forms.employmentTypeFullTime;
    case "part_time":
      return dictionary.forms.employmentTypePartTime;
    case "contract":
      return dictionary.forms.employmentTypeContract;
    case "freelance":
      return dictionary.forms.employmentTypeFreelance;
    case "internship":
      return dictionary.forms.employmentTypeInternship;
    default:
      return value;
  }
}

function getWorkFormatLabel(
  value: WorkFormat,
  dictionary: ReturnType<typeof useDictionary>,
) {
  switch (value) {
    case "remote":
      return dictionary.forms.workFormatRemote;
    case "hybrid":
      return dictionary.forms.workFormatHybrid;
    case "office":
      return dictionary.forms.workFormatOffice;
    default:
      return value;
  }
}

function getExperienceLevelLabel(value: ExperienceLevel, locale: string) {
  if (locale === "uk") {
    switch (value) {
      case "no_experience":
        return "\u0411\u0435\u0437 \u0434\u043e\u0441\u0432\u0456\u0434\u0443";
      case "months_3":
        return "3 \u043c\u0456\u0441";
      case "months_6":
        return "6 \u043c\u0456\u0441";
      case "year_1":
        return "1 \u0440\u0456\u043a";
      case "years_2":
        return "2 \u0440\u043e\u043a\u0438";
      case "years_3":
        return "3 \u0440\u043e\u043a\u0438";
      case "years_4":
        return "4 \u0440\u043e\u043a\u0438";
      case "years_5":
        return "5 \u0440\u043e\u043a\u0456\u0432";
      case "years_6":
        return "6 \u0440\u043e\u043a\u0456\u0432";
      case "years_7":
        return "7 \u0440\u043e\u043a\u0456\u0432";
      case "years_8":
        return "8 \u0440\u043e\u043a\u0456\u0432";
      case "years_9":
        return "9 \u0440\u043e\u043a\u0456\u0432";
      case "years_10":
        return "10 \u0440\u043e\u043a\u0456\u0432";
      case "more_than_10_years":
        return "> 10 \u0440\u043e\u043a\u0456\u0432";
      default:
        return value;
    }
  }

  switch (value) {
    case "no_experience":
      return "No experience";
    case "months_3":
      return "3 months";
    case "months_6":
      return "6 months";
    case "year_1":
      return "1 year";
    case "years_2":
      return "2 years";
    case "years_3":
      return "3 years";
    case "years_4":
      return "4 years";
    case "years_5":
      return "5 years";
    case "years_6":
      return "6 years";
    case "years_7":
      return "7 years";
    case "years_8":
      return "8 years";
    case "years_9":
      return "9 years";
    case "years_10":
      return "10 years";
    case "more_than_10_years":
      return "More than 10 years";
    default:
      return value;
  }
}

function getSalaryCurrencyLabel(value: SalaryCurrency, locale: string) {
  if (locale === "uk") {
    switch (value) {
      case "uah":
        return "\u0433\u0440\u043d";
      case "eur":
        return "\u0454\u0432\u0440\u043e";
      case "usd":
        return "\u0434\u043e\u043b\u0430\u0440";
      default:
        return value;
    }
  }

  switch (value) {
    case "uah":
      return "UAH";
    case "eur":
      return "EUR";
    case "usd":
      return "USD";
    default:
      return value;
  }
}

function getPreferredContactMethodLabel(
  value: PreferredContactMethod,
  dictionary: ReturnType<typeof useDictionary>,
) {
  switch (value) {
    case "email":
      return dictionary.forms.contactMethodEmail;
    case "telegram":
      return dictionary.forms.contactMethodTelegram;
    case "phone":
      return dictionary.forms.contactMethodPhone;
    case "linkedin":
      return dictionary.forms.contactMethodLinkedin;
    case "website":
      return dictionary.forms.contactMethodWebsite;
    default:
      return value;
  }
}

function getVisibilityLabel(
  value: ProfileVisibilityKey,
  dictionary: ReturnType<typeof useDictionary>,
) {
  switch (value) {
    case "about":
      return dictionary.forms.visibilityAbout;
    case "professionalDetails":
      return dictionary.forms.visibilityProfessionalDetails;
    case "workExperience":
      return dictionary.forms.visibilityWorkExperience;
    case "skills":
      return dictionary.forms.visibilitySkills;
    case "languages":
      return dictionary.forms.visibilityLanguages;
    case "education":
      return dictionary.forms.visibilityEducation;
    case "certificates":
      return dictionary.forms.visibilityCertificates;
    case "qa":
      return dictionary.forms.visibilityQa;
    case "links":
      return dictionary.forms.visibilityLinks;
    default:
      return value;
  }
}
function getExperiencePlaceholder(locale: string) {
  return locale === "uk"
    ? "\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0434\u043e\u0441\u0432\u0456\u0434"
    : "Choose experience";
}

function getSalaryCurrencyPlaceholder(locale: string) {
  return locale === "uk" ? "\u0412\u0430\u043b\u044e\u0442\u0430" : "Currency";
}

function getPreferredContactMethodPlaceholder(locale: string) {
  return locale === "uk"
    ? "\u0411\u0430\u0436\u0430\u043d\u0438\u0439 \u0441\u043f\u043e\u0441\u0456\u0431 \u0437\u0432'\u044f\u0437\u043a\u0443"
    : "Preferred contact method";
}

function getSectionOrderLabel(
  sectionId: ProfileSectionId,
  dictionary: ReturnType<typeof useDictionary>,
  locale: string,
) {
  switch (sectionId) {
    case "contacts":
      return locale === "uk"
        ? "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u0438 \u0442\u0430 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f"
        : "Contacts and links";
    case "projects":
      return locale === "uk" ? "\u041f\u0440\u043e\u0454\u043a\u0442\u0438" : "Projects";
    case "articles":
      return locale === "uk" ? "\u0421\u0442\u0430\u0442\u0442\u0456" : "Articles";
    default:
      return getVisibilityLabel(sectionId as ProfileVisibilityKey, dictionary);
  }
}

function clampOverlayStrength(value: number) {
  return Math.max(0, Math.min(85, Math.round(value)));
}

function inferBackgroundMode(file: File): ProfileBackgroundMode {
  return file.type.startsWith("video/") ? "video" : "image";
}

function getBackgroundAcceptValue(mode: ProfileBackgroundMode) {
  return mode === "video" ? "video/*" : "image/*";
}

function getBackgroundMaxSize(mode: ProfileBackgroundMode) {
  return mode === "video" ? 120 * 1024 * 1024 : 15 * 1024 * 1024;
}

function serializeProfileDraft({
  form,
  skills,
  selectedEmploymentTypes,
  selectedWorkFormats,
  visibility,
  presentation,
  languages,
  education,
  certificates,
  qas,
  workExperience,
}: {
  form: FormState;
  skills: number[];
  selectedEmploymentTypes: EmploymentType[];
  selectedWorkFormats: WorkFormat[];
  visibility: ProfileVisibility;
  presentation: ProfilePresentation;
  languages: ProfileLanguageEntry[];
  education: ProfileEducationEntry[];
  certificates: ProfileCertificateEntry[];
  qas: ProfileQaEntry[];
  workExperience: ProfileWorkExperienceEntry[];
}) {
  return JSON.stringify({
    form: {
      username: form.username.trim(),
      name: form.name.trim(),
      category_id: form.category_id,
      headline: form.headline.trim(),
      bio: form.bio.trim(),
      country_id: form.country_id,
      city: form.city.trim(),
      website: form.website.trim(),
      github: form.github.trim(),
      twitter: form.twitter.trim(),
      linkedin: form.linkedin.trim(),
      behance: form.behance.trim(),
      dribbble: form.dribbble.trim(),
      artstation: form.artstation.trim(),
      vimeo: form.vimeo.trim(),
      youtube: form.youtube.trim(),
      instagram: form.instagram.trim(),
      contact_email: form.contact_email.trim(),
      telegram_username: form.telegram_username.trim(),
      phone: form.phone.trim(),
      preferred_contact_method: form.preferred_contact_method || null,
      experience_level: form.experience_level || null,
      salary_expectations: form.salary_expectations.trim(),
      salary_currency: form.salary_currency,
      additional_info: form.additional_info.trim(),
    },
    skills: [...skills].sort((a, b) => a - b),
    selectedEmploymentTypes: employmentTypes.filter((item) =>
      selectedEmploymentTypes.includes(item),
    ),
    selectedWorkFormats: workFormats.filter((item) =>
      selectedWorkFormats.includes(item),
    ),
    visibility: {
      ...createDefaultProfileVisibility(),
      ...visibility,
    },
    presentation: normalizeProfilePresentation(presentation),
    languages: languages
      .filter((item) => item.language_id !== null)
      .map((item) => ({
        id: item.id,
        language_id: item.language_id,
        proficiency_level: item.proficiency_level,
      })),
    education: education
      .filter(
        (item) =>
          isFilled(item.institution) ||
          isFilled(item.degree) ||
          isFilled(item.field_of_study) ||
          isFilled(item.description),
      )
      .map((item) => ({
        id: item.id,
        institution: item.institution.trim(),
        degree: item.degree.trim(),
        field_of_study: item.field_of_study.trim(),
        started_on: item.started_on,
        completed_on: item.completed_on,
        description: item.description.trim(),
      })),
    certificates: certificates
      .filter(
        (item) =>
          isFilled(item.title) ||
          isFilled(item.issuer) ||
          isFilled(item.credential_url) ||
          isFilled(item.file_url),
      )
      .map((item) => ({
        id: item.id,
        title: item.title.trim(),
        issuer: item.issuer.trim(),
        issued_on: item.issued_on,
        credential_url: item.credential_url.trim(),
        file_url: item.file_url.trim(),
        file_name: item.file_name.trim(),
        storage_path: item.storage_path.trim(),
      })),
    qas: qas
      .filter((item) => isFilled(item.question) || isFilled(item.answer))
      .map((item) => ({
        id: item.id,
        question: item.question.trim(),
        answer: item.answer.trim(),
      })),
    workExperience: workExperience
      .map((item) => ({
        id: item.id,
        company_name: item.company_name.trim(),
        position: item.position.trim(),
        started_year: parseOptionalInteger(item.started_year),
        ended_year: item.is_current
          ? null
          : parseOptionalInteger(item.ended_year),
        is_current: item.is_current,
        responsibilities: item.responsibilities.trim(),
      }))
      .filter(
        (item) =>
          Boolean(item.company_name) ||
          Boolean(item.position) ||
          Boolean(item.responsibilities) ||
          item.started_year !== null ||
          item.ended_year !== null,
      ),
  });
}

export default function ProfileForm({ profile }: { profile: ProfileRecord }) {
  const supabase = createClient();
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useCurrentLocale();
  const profileSettings = normalizeProfileSettings(profile.profile_visibility);
  const profileUi =
    locale === "uk"
      ? {
          categoryLabel: "\u041d\u0430\u043f\u0440\u044f\u043c\u043e\u043a",
          categoryPlaceholder:
            "\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u043d\u0430\u043f\u0440\u044f\u043c\u043e\u043a",
        }
      : {
          categoryLabel: "Direction",
          categoryPlaceholder: "Choose direction",
        };
  const customizationUi =
    locale === "uk"
      ? {
          title:
            "\u0412\u0456\u0437\u0443\u0430\u043b\u044c\u043d\u0438\u0439 \u0441\u0442\u0438\u043b\u044c \u043f\u0440\u043e\u0444\u0456\u043b\u044e",
          description:
            "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u0432\u043b\u0430\u0441\u043d\u0443 \u043f\u0430\u043b\u0456\u0442\u0440\u0443, \u0448\u0440\u0438\u0444\u0442, \u0444\u043e\u043d \u0456 \u043f\u043e\u0440\u044f\u0434\u043e\u043a \u0431\u043b\u043e\u043a\u0456\u0432, \u0449\u043e\u0431 \u043f\u0443\u0431\u043b\u0456\u0447\u043d\u0438\u0439 \u043f\u0440\u043e\u0444\u0456\u043b\u044c \u0432\u0438\u0433\u043b\u044f\u0434\u0430\u0432 \u044f\u043a \u0432\u0430\u0448 \u043e\u0441\u043e\u0431\u0438\u0441\u0442\u0438\u0439 \u043f\u0440\u043e\u0441\u0442\u0456\u0440.",
          accentColor: "\u0410\u043a\u0446\u0435\u043d\u0442",
          surfaceColor: "\u041a\u043e\u043b\u0456\u0440 hero",
          panelColor:
            "\u041a\u043e\u043b\u0456\u0440 \u043a\u0430\u0440\u0442\u043e\u043a",
          textColor:
            "\u041e\u0441\u043d\u043e\u0432\u043d\u0438\u0439 \u0442\u0435\u043a\u0441\u0442",
          mutedColor:
            "\u0414\u0440\u0443\u0433\u043e\u0440\u044f\u0434\u043d\u0438\u0439 \u0442\u0435\u043a\u0441\u0442",
          fontPreset: "\u0428\u0440\u0438\u0444\u0442",
          textScale:
            "\u0420\u043e\u0437\u043c\u0456\u0440 \u0442\u0435\u043a\u0441\u0442\u0443",
          backgroundMode: "\u0422\u0438\u043f \u0444\u043e\u043d\u0443",
          backgroundUrl:
            "\u041f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u043d\u0430 \u0444\u043e\u043d",
          backgroundHint:
            "\u041f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f URL \u0434\u043b\u044f \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f \u0430\u0431\u043e \u0432\u0456\u0434\u0435\u043e. \u0414\u043b\u044f video \u0432\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u043e\u0432\u0443\u0439\u0442\u0435 \u043f\u0440\u044f\u043c\u0435 mp4/webm \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f.",
          overlay:
            "\u0421\u0438\u043b\u0430 \u043e\u0432\u0435\u0440\u043b\u0435\u044e",
          cardStyle:
            "\u0421\u0442\u0438\u043b\u044c \u043a\u0430\u0440\u0442\u043e\u043a",
          heroAlignment:
            "\u0412\u0438\u0440\u0456\u0432\u043d\u044e\u0432\u0430\u043d\u043d\u044f hero",
          sectionOrder:
            "\u041f\u043e\u0440\u044f\u0434\u043e\u043a \u0431\u043b\u043e\u043a\u0456\u0432",
          sectionOrderHint:
            "\u041f\u0435\u0440\u0435\u0441\u0443\u0432\u0430\u0439\u0442\u0435 \u0431\u043b\u043e\u043a\u0438, \u0449\u043e\u0431 \u0432\u0430\u0436\u043b\u0438\u0432\u0435 \u0431\u0443\u043b\u043e \u0432\u0438\u0449\u0435.",
          preview:
            "\u041f\u0440\u0435\u0432'\u044e \u0441\u0442\u0438\u043b\u044e",
          modes: {
            gradient: "\u0413\u0440\u0430\u0434\u0456\u0454\u043d\u0442",
            image: "\u0424\u043e\u0442\u043e",
            video: "\u0412\u0456\u0434\u0435\u043e",
          },
          fonts: {
            modern: "\u0421\u0443\u0447\u0430\u0441\u043d\u0438\u0439",
            editorial:
              "\u0420\u0435\u0434\u0430\u043a\u0446\u0456\u0439\u043d\u0438\u0439",
            friendly: "\u0416\u0438\u0432\u0438\u0439",
            technical: "\u0422\u0435\u0445\u043d\u0456\u0447\u043d\u0438\u0439",
          },
          scales: {
            sm: "\u041a\u043e\u043c\u043f\u0430\u043a\u0442\u043d\u0438\u0439",
            md: "\u0411\u0430\u043b\u0430\u043d\u0441",
            lg: "\u0412\u0438\u0440\u0430\u0437\u043d\u0438\u0439",
          },
          cards: {
            soft: "\u041c'\u044f\u043a\u0456",
            glass: "\u0421\u043a\u043b\u043e",
            outline: "\u041a\u043e\u043d\u0442\u0443\u0440",
          },
          alignments: {
            left: "\u041b\u0456\u0432\u043e\u0440\u0443\u0447",
            center: "\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443",
          },
          moveUp: "\u0412\u0438\u0449\u0435",
          moveDown: "\u041d\u0438\u0436\u0447\u0435",
        }
      : {
          title: "Profile presentation",
          description:
            "Shape how your public page feels: pick colors, typography, background, and the order of sections so the profile looks like your own space.",
          accentColor: "Accent",
          surfaceColor: "Hero color",
          panelColor: "Card color",
          textColor: "Primary text",
          mutedColor: "Secondary text",
          fontPreset: "Font",
          textScale: "Text scale",
          backgroundMode: "Background mode",
          backgroundUrl: "Background URL",
          backgroundHint:
            "Use an image URL or a direct video URL. For video backgrounds, prefer mp4 or webm files.",
          overlay: "Overlay strength",
          cardStyle: "Card style",
          heroAlignment: "Hero alignment",
          sectionOrder: "Section order",
          sectionOrderHint:
            "Move sections so the most important blocks stay first.",
          preview: "Style preview",
          modes: {
            gradient: "Gradient",
            image: "Photo",
            video: "Video",
          },
          fonts: {
            modern: "Modern",
            editorial: "Editorial",
            friendly: "Friendly",
            technical: "Technical",
          },
          scales: {
            sm: "Compact",
            md: "Balanced",
            lg: "Expressive",
          },
          cards: {
            soft: "Soft",
            glass: "Glass",
            outline: "Outline",
          },
          alignments: {
            left: "Left",
            center: "Center",
          },
          moveUp: "Move up",
          moveDown: "Move down",
        };
  const presentationExtrasUi =
    locale === "uk"
      ? {
          uploadBackground: "Завантажити фон",
          replaceBackground: "Замінити фон",
          removeBackground: "Прибрати фон",
          backgroundReady: "Фон готовий",
          backgroundUploading: "Завантаження фону...",
          backgroundUploadFailed: "Не вдалося завантажити фон.",
          dragHint: "Перетягуйте блоки мишкою, щоб змінювати порядок.",
          dragHandle: "тягнути",
          blockSize: "Ширина блоку",
          sizes: {
            compact: "Компактний",
            regular: "Звичайний",
            wide: "Широкий",
            full: "На всю ширину",
          },
          bioHint:
            "Розкажіть коротко, чим ви сильні, у якому стилі працюєте і що важливо для співпраці.",
        }
      : {
          uploadBackground: "Upload background",
          replaceBackground: "Replace background",
          removeBackground: "Remove background",
          backgroundReady: "Background ready",
          backgroundUploading: "Uploading background...",
          backgroundUploadFailed: "Could not upload the background.",
          dragHint: "Drag cards to change the order.",
          dragHandle: "drag",
          blockSize: "Block width",
          sizes: {
            compact: "Compact",
            regular: "Regular",
            wide: "Wide",
            full: "Full width",
          },
          bioHint:
            "Summarize what makes you strong, how you like to work, and what kind of opportunities fit you.",
        };
  const workspaceUi =
    locale === "uk"
      ? {
          content: "Редагування профілю",
          builder: "Конструктор профілю",
          contentDescription:
            "Тут змінюються самі дані: тексти, досвід, контакти, сертифікати, навички та інше наповнення.",
          builderDescription:
            "Тут збирається зовнішній вигляд профілю: фон, стиль і реальні блоки, які можна перетягувати та змінювати по ширині.",
          canvasTitle: "Полотно конструктора",
          canvasDescription:
            "Перетягніть картку на нове місце, а ширину змінюйте прямо на самій картці.",
        }
      : {
          content: "Profile content",
          builder: "Profile builder",
          contentDescription:
            "Edit the actual content here: texts, experience, contacts, certificates, skills, and the rest of the profile data.",
          builderDescription:
            "Use this mode to shape presentation: background, style, and real cards you can drag and resize.",
          canvasTitle: "Builder canvas",
          canvasDescription:
            "Drag a card to a new position and change its width directly on the card.",
        };
  const draftUi =
    locale === "uk"
      ? {
          resetCustomization: "Скинути кастомізацію",
          resetCustomizationHint:
            "Повертає кольори, фон, стиль карток, порядок і ширину блоків до стандартного вигляду.",
          unsavedChanges: "Є незбережені зміни.",
          unsavedChangesHint:
            "Якщо підете зі сторінки зараз, ці правки можуть загубитися.",
          confirmLeave:
            "У вас є незбережені зміни профілю. Справді перейти зі сторінки?",
          confirmLeaveTitle: "Залишити сторінку?",
          confirmLeaveContinue: "Так, піти",
          confirmLeaveStay: "Залишитись",
        }
      : {
          resetCustomization: "Reset customization",
          resetCustomizationHint:
            "Restore default colors, background, card style, block order, and block widths.",
          unsavedChanges: "You have unsaved changes.",
          unsavedChangesHint:
            "If you leave now, those profile edits may be lost.",
          confirmLeave:
            "You have unsaved profile changes. Do you really want to leave this page?",
          confirmLeaveTitle: "Leave this page?",
          confirmLeaveContinue: "Leave",
          confirmLeaveStay: "Stay",
        };

  const [meta, setMeta] = useState<MetaState>({
    countries: [],
    skills: [],
    languages: [],
    categories: [],
  });

  const [form, setForm] = useState<FormState>({
    username: profile.username || "",
    name: profile.name || "",
    category_id: profile.category_id || null,
    headline: profile.headline || "",
    bio: profile.bio || "",
    country_id: profile.country_id || null,
    city: profile.city || "",
    website: profile.website || "",
    github: profile.github || "",
    twitter: profile.twitter || "",
    linkedin: profile.linkedin || "",
    behance: profile.behance || "",
    dribbble: profile.dribbble || "",
    artstation: profile.artstation || "",
    vimeo: profile.vimeo || "",
    youtube: profile.youtube || "",
    instagram: profile.instagram || "",
    contact_email: profile.contact_email || "",
    telegram_username: profile.telegram_username || "",
    phone: profile.phone || "",
    preferred_contact_method: profile.preferred_contact_method || "",
    experience_level: profile.experience_level || "",
    salary_expectations: profile.salary_expectations || "",
    salary_currency: profile.salary_currency || "uah",
    additional_info: profile.additional_info || "",
  });
  const [skills, setSkills] = useState<number[]>(profile.skill_ids || []);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<
    EmploymentType[]
  >(Array.isArray(profile.employment_types) ? profile.employment_types : []);
  const [selectedWorkFormats, setSelectedWorkFormats] = useState<WorkFormat[]>(
    Array.isArray(profile.work_formats) ? profile.work_formats : [],
  );
  const [visibility, setVisibility] = useState<ProfileVisibility>({
    about: profileSettings.about,
    professionalDetails: profileSettings.professionalDetails,
    workExperience: profileSettings.workExperience,
    skills: profileSettings.skills,
    languages: profileSettings.languages,
    education: profileSettings.education,
    certificates: profileSettings.certificates,
    qa: profileSettings.qa,
    links: profileSettings.links,
  });
  const [presentation, setPresentation] = useState<ProfilePresentation>(
    profileSettings.presentation || createDefaultProfilePresentation(),
  );
  const [languages, setLanguages] = useState<ProfileLanguageEntry[]>(
    profile.languages?.length
      ? profile.languages
      : [createProfileLanguageEntry()],
  );
  const [education, setEducation] = useState<ProfileEducationEntry[]>(
    profile.education || [],
  );
  const [certificates, setCertificates] = useState<ProfileCertificateEntry[]>(
    profile.certificates || [],
  );
  const [qas, setQas] = useState<ProfileQaEntry[]>(profile.qas || []);
  const [workExperience, setWorkExperience] = useState<
    ProfileWorkExperienceEntry[]
  >(profile.work_experience || []);
  const [editorMode, setEditorMode] = useState<"content" | "builder">(
    "content",
  );
  const [saving, setSaving] = useState(false);
  const [uploadingCertificateId, setUploadingCertificateId] = useState<
    string | null
  >(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [draggingSectionId, setDraggingSectionId] =
    useState<ProfileSectionId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialBackgroundStoragePathRef = useRef(
    profileSettings.presentation.backgroundStoragePath,
  );

  const initialCertificateMap = useMemo(
    () =>
      new Map(profile.certificates.map((item) => [item.id, item.storage_path])),
    [profile.certificates],
  );

  useEffect(() => {
    async function loadMeta() {
      const result = await apiFetch<Partial<MetaState>>("/api/meta");

      if (!result.ok) {
        return;
      }

      setMeta({
        countries: normalizeMetaOptions(result.data.countries),
        skills: normalizeMetaOptions(result.data.skills),
        languages: normalizeMetaOptions(result.data.languages),
        categories: normalizeMetaCategories(result.data.categories),
      });
    }

    void loadMeta();
  }, []);

  const currentDraftSnapshot = useMemo(
    () =>
      serializeProfileDraft({
        form,
        skills,
        selectedEmploymentTypes,
        selectedWorkFormats,
        visibility,
        presentation,
        languages,
        education,
        certificates,
        qas,
        workExperience,
      }),
    [
      certificates,
      education,
      form,
      languages,
      presentation,
      qas,
      selectedEmploymentTypes,
      selectedWorkFormats,
      skills,
      visibility,
      workExperience,
    ],
  );
  const savedDraftSnapshotRef = useRef(currentDraftSnapshot);
  const hasUnsavedChanges =
    currentDraftSnapshot !== savedDraftSnapshotRef.current;

  const [pendingLeaveUrl, setPendingLeaveUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);

      if (
        nextUrl.origin !== window.location.origin ||
        nextUrl.href === window.location.href
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingLeaveUrl(nextUrl.href);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

  const cancelLeave = () => setPendingLeaveUrl(null);
  const confirmLeave = () => {
    if (!pendingLeaveUrl) return;
    const target = pendingLeaveUrl;
    setPendingLeaveUrl(null);
    window.location.href = target;
  };

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLanguage = (
    entryId: string,
    field: keyof Omit<ProfileLanguageEntry, "id">,
    value: number | LanguageLevel | null,
  ) => {
    setLanguages((prev) =>
      prev.map((item) =>
        item.id === entryId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateEducation = (
    entryId: string,
    field: keyof Omit<ProfileEducationEntry, "id">,
    value: string,
  ) => {
    setEducation((prev) =>
      prev.map((item) =>
        item.id === entryId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateCertificate = (
    entryId: string,
    field: keyof Omit<ProfileCertificateEntry, "id">,
    value: string,
  ) => {
    setCertificates((prev) =>
      prev.map((item) =>
        item.id === entryId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateQa = (
    entryId: string,
    field: keyof Omit<ProfileQaEntry, "id">,
    value: string,
  ) => {
    setQas((prev) =>
      prev.map((item) =>
        item.id === entryId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateWorkExperience = (
    entryId: string,
    field: keyof Omit<ProfileWorkExperienceEntry, "id">,
    value: string | boolean,
  ) => {
    setWorkExperience((prev) =>
      prev.map((item) =>
        item.id === entryId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const toggleEmploymentType = (value: EmploymentType) => {
    setSelectedEmploymentTypes((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const toggleWorkFormat = (value: WorkFormat) => {
    setSelectedWorkFormats((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const toggleVisibility = (key: ProfileVisibilityKey) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updatePresentation = <K extends keyof ProfilePresentation>(
    field: K,
    value: ProfilePresentation[K],
  ) => {
    setPresentation((prev) => ({ ...prev, [field]: value }));
  };

  const updateSectionSize = (
    sectionId: ProfileSectionId,
    size: ProfileSectionSize,
  ) => {
    setPresentation((prev) => {
      if (!prev.sectionSizes[sectionId]) {
        return prev;
      }

      return {
        ...prev,
        sectionSizes: {
          ...prev.sectionSizes,
          [sectionId]: size,
        },
      };
    });
  };

  const reorderSections = (
    draggedId: ProfileSectionId,
    targetId: ProfileSectionId,
  ) => {
    if (draggedId === targetId) {
      return;
    }

    setPresentation((prev) => {
      const nextOrder = [...prev.sectionOrder];
      const fromIndex = nextOrder.indexOf(draggedId);
      const toIndex = nextOrder.indexOf(targetId);

      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }

      const [moved] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, moved);

      return {
        ...prev,
        sectionOrder: nextOrder,
      };
    });
  };

  const uploadCertificateFile = async (entryId: string, file: File) => {
    const currentCertificate = certificates.find((item) => item.id === entryId);

    if (!currentCertificate) {
      return;
    }

    setUploadingCertificateId(entryId);
    setErrorMessage(null);

    try {
      const filePath = `${profile.user_id}/${entryId}-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-certificates")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-certificates").getPublicUrl(filePath);

      if (
        currentCertificate.storage_path &&
        currentCertificate.storage_path !== filePath &&
        !initialCertificateMap.get(currentCertificate.id)
      ) {
        await supabase.storage
          .from("profile-certificates")
          .remove([currentCertificate.storage_path]);
      }

      setCertificates((prev) =>
        prev.map((item) =>
          item.id === entryId
            ? {
                ...item,
                file_url: publicUrl,
                file_name: file.name,
                storage_path: filePath,
              }
            : item,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : dictionary.forms.errorUploadingCertificate,
      );
    } finally {
      setUploadingCertificateId(null);
    }
  };

  const uploadBackgroundAsset = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingBackground(true);
    setErrorMessage(null);

    try {
      const nextMode = inferBackgroundMode(file);
      if (file.size > getBackgroundMaxSize(nextMode)) {
        throw new Error(
          locale === "uk"
            ? "Файл фону завеликий для цього типу."
            : "Background file is too large for this type.",
        );
      }
      const filePath = `profile-backgrounds/${profile.user_id}/${Date.now()}-${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;
      const previousPath = presentation.backgroundStoragePath;

      const { error: uploadError } = await supabase.storage
        .from("project-media")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-media").getPublicUrl(filePath);

      setPresentation((prev) => ({
        ...prev,
        backgroundMode: nextMode,
        backgroundUrl: publicUrl,
        backgroundStoragePath: filePath,
      }));

      if (
        previousPath &&
        previousPath !== filePath &&
        previousPath !== initialBackgroundStoragePathRef.current
      ) {
        await supabase.storage.from("project-media").remove([previousPath]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : presentationExtrasUi.backgroundUploadFailed,
      );
    } finally {
      event.target.value = "";
      setUploadingBackground(false);
    }
  };

  const clearBackgroundAsset = async () => {
    const previousPath = presentation.backgroundStoragePath;

    setPresentation((prev) => ({
      ...prev,
      backgroundUrl: null,
      backgroundStoragePath: null,
      backgroundMode: "gradient",
    }));

    if (previousPath) {
      if (previousPath !== initialBackgroundStoragePathRef.current) {
        await supabase.storage.from("project-media").remove([previousPath]);
      }
    }
  };

  const resetCustomization = async () => {
    const previousPath = presentation.backgroundStoragePath;

    setPresentation(createDefaultProfilePresentation());

    if (
      previousPath &&
      previousPath !== initialBackgroundStoragePathRef.current
    ) {
      await supabase.storage.from("project-media").remove([previousPath]);
    }
  };

  const removeLanguage = (entryId: string) => {
    setLanguages((prev) => prev.filter((item) => item.id !== entryId));
  };

  const removeEducation = (entryId: string) => {
    setEducation((prev) => prev.filter((item) => item.id !== entryId));
  };

  const removeCertificate = async (entryId: string) => {
    const currentCertificate = certificates.find((item) => item.id === entryId);

    if (!currentCertificate) {
      return;
    }

    if (
      currentCertificate.storage_path &&
      !initialCertificateMap.has(currentCertificate.id)
    ) {
      await supabase.storage
        .from("profile-certificates")
        .remove([currentCertificate.storage_path]);
    }

    setCertificates((prev) => prev.filter((item) => item.id !== entryId));
  };

  const removeQa = (entryId: string) => {
    setQas((prev) => prev.filter((item) => item.id !== entryId));
  };

  const removeWorkExperience = (entryId: string) => {
    setWorkExperience((prev) => prev.filter((item) => item.id !== entryId));
  };

  const save = async () => {
    setSaving(true);
    setErrorMessage(null);

    const hasInvalidWorkExperienceRange = workExperience.some((item) => {
      const startedYear = parseOptionalInteger(item.started_year);
      const endedYear = parseOptionalInteger(item.ended_year);

      return (
        startedYear !== null &&
        endedYear !== null &&
        !item.is_current &&
        endedYear < startedYear
      );
    });

    if (hasInvalidWorkExperienceRange) {
      setErrorMessage(dictionary.forms.invalidWorkExperienceRange);
      setSaving(false);
      return;
    }

    const profilePayload = {
      username: form.username.trim() || null,
      name: form.name.trim() || null,
      category_id: form.category_id,
      headline: form.headline.trim() || null,
      bio: form.bio.trim() || null,
      country_id: form.country_id,
      city: form.city.trim() || null,
      website: form.website.trim() || null,
      github: form.github.trim() || null,
      twitter: form.twitter.trim() || null,
      linkedin: form.linkedin.trim() || null,
      behance: form.behance.trim() || null,
      dribbble: form.dribbble.trim() || null,
      artstation: form.artstation.trim() || null,
      vimeo: form.vimeo.trim() || null,
      youtube: form.youtube.trim() || null,
      instagram: form.instagram.trim() || null,
      contact_email: form.contact_email.trim() || null,
      telegram_username: form.telegram_username.trim() || null,
      phone: form.phone.trim() || null,
      preferred_contact_method: form.preferred_contact_method || null,
      experience_years: null,
      experience_level: form.experience_level || null,
      employment_types: selectedEmploymentTypes.filter((item) =>
        employmentTypes.includes(item),
      ),
      work_formats: selectedWorkFormats.filter((item) =>
        workFormats.includes(item),
      ),
      salary_expectations: form.salary_expectations.trim() || null,
      salary_currency: form.salary_expectations.trim()
        ? form.salary_currency
        : null,
      additional_info: form.additional_info.trim() || null,
      profile_visibility: {
        ...createDefaultProfileVisibility(),
        ...visibility,
        presentation: {
          ...createDefaultProfilePresentation(),
          ...presentation,
          overlayStrength: clampOverlayStrength(presentation.overlayStrength),
          sectionOrder: normalizeSectionOrder(presentation.sectionOrder),
          backgroundUrl: presentation.backgroundUrl?.trim() || null,
          backgroundStoragePath:
            presentation.backgroundStoragePath?.trim() || null,
          sectionSizes: {
            ...createDefaultProfilePresentation().sectionSizes,
            ...presentation.sectionSizes,
          },
        },
      },
    };

    const sanitizedLanguages = languages.filter((item) => item.language_id);
    const sanitizedEducation = education.filter(
      (item) =>
        isFilled(item.institution) ||
        isFilled(item.degree) ||
        isFilled(item.field_of_study),
    );
    const sanitizedCertificates = certificates.filter(
      (item) =>
        isFilled(item.title) ||
        isFilled(item.issuer) ||
        isFilled(item.credential_url) ||
        isFilled(item.file_url),
    );
    const sanitizedQas = qas.filter(
      (item) => isFilled(item.question) && isFilled(item.answer),
    );
    const sanitizedWorkExperience = workExperience
      .map((item) => ({
        id: item.id,
        company_name: item.company_name.trim(),
        position: item.position.trim(),
        started_year: parseOptionalInteger(item.started_year),
        ended_year: item.is_current
          ? null
          : parseOptionalInteger(item.ended_year),
        is_current: item.is_current,
        responsibilities: item.responsibilities.trim(),
      }))
      .filter(
        (item) =>
          Boolean(item.company_name) ||
          Boolean(item.position) ||
          Boolean(item.responsibilities) ||
          item.started_year !== null ||
          item.ended_year !== null,
      );

    const payload = {
      ...profilePayload,
      skill_ids: skills,
      languages: sanitizedLanguages,
      education: sanitizedEducation.map((item) => ({
        id: item.id,
        institution: item.institution.trim() || null,
        degree: item.degree.trim() || null,
        field_of_study: item.field_of_study.trim() || null,
        started_on: item.started_on || null,
        completed_on: item.completed_on || null,
        description: item.description.trim() || null,
      })),
      certificates: sanitizedCertificates.map((item) => ({
        id: item.id,
        title: item.title.trim() || null,
        issuer: item.issuer.trim() || null,
        issued_on: item.issued_on || null,
        credential_url: item.credential_url.trim() || null,
        file_url: item.file_url.trim() || null,
        file_name: item.file_name.trim() || null,
        storage_path: item.storage_path.trim() || null,
      })),
      qas: sanitizedQas.map((item) => ({
        id: item.id,
        question: item.question.trim(),
        answer: item.answer.trim(),
      })),
      work_experience: sanitizedWorkExperience,
    };

    const parsedPayload = profilePayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      setErrorMessage(
        parsedPayload.error.issues[0]?.message ||
          dictionary.forms.errorSavingProfile,
      );
      setSaving(false);
      return;
    }

    const result = await apiFetch("/api/profile", {
      method: "PUT",
      body: parsedPayload.data,
    });

    if (!result.ok) {
      setErrorMessage(
        getProfileErrorMessage(
          result.error,
          dictionary.forms.errorSavingProfile,
          dictionary.forms.usernameTaken,
        ),
      );
      setSaving(false);
      return;
    }

    const currentCertificateIds = new Set(
      sanitizedCertificates.map((item) => item.id),
    );
    const removedStoragePaths = profile.certificates
      .filter(
        (item) => item.storage_path && !currentCertificateIds.has(item.id),
      )
      .map((item) => item.storage_path)
      .filter(Boolean);

    if (removedStoragePaths.length > 0) {
      await supabase.storage
        .from("profile-certificates")
        .remove(removedStoragePaths);
    }

    const savedBackgroundStoragePath =
      parsedPayload.data.profile_visibility.presentation.backgroundStoragePath;

    if (
      initialBackgroundStoragePathRef.current &&
      initialBackgroundStoragePathRef.current !== savedBackgroundStoragePath
    ) {
      await supabase.storage
        .from("project-media")
        .remove([initialBackgroundStoragePathRef.current]);
    }

    initialBackgroundStoragePathRef.current = savedBackgroundStoragePath;
    savedDraftSnapshotRef.current = currentDraftSnapshot;

    setSaving(false);
    router.refresh();
  };

  const previewScale = getProfileTextScale(presentation.textScale);
  const previewFontFamily = getProfileFontStack(presentation.fontPreset);
  const previewPanelStyle =
    presentation.cardStyle === "glass"
      ? {
          backgroundColor: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.18)",
        }
      : presentation.cardStyle === "outline"
        ? {
            backgroundColor: "transparent",
            border: `1px solid ${presentation.accentColor}`,
          }
        : {
            backgroundColor: presentation.panelColor,
            border: "1px solid rgba(255,255,255,0.08)",
          };
  const getBuilderSpanClass = (size: ProfileSectionSize) => {
    switch (size) {
      case "compact":
        return "lg:col-span-4";
      case "wide":
        return "lg:col-span-8";
      case "full":
        return "lg:col-span-12";
      case "regular":
      default:
        return "lg:col-span-6";
    }
  };
  const builderCards = presentation.sectionOrder.map((sectionId) => {
    const title = getSectionOrderLabel(sectionId, dictionary, locale);

    switch (sectionId) {
      case "about":
        return {
          id: sectionId,
          title,
          lines: [
            form.headline ||
              (locale === "uk" ? "Додайте headline" : "Add a headline"),
            form.bio ||
              (locale === "uk"
                ? "Заповніть біо, щоб блок виглядав живо."
                : "Fill the bio so this card feels alive."),
          ],
        };
      case "professionalDetails":
        return {
          id: sectionId,
          title,
          lines: [
            form.experience_level
              ? getExperienceLevelLabel(form.experience_level, locale)
              : locale === "uk"
                ? "Оберіть досвід"
                : "Choose experience",
            form.salary_expectations
              ? `${form.salary_expectations}${form.salary_currency ? ` ${form.salary_currency.toUpperCase()}` : ""}`
              : locale === "uk"
                ? "Додайте очікування по оплаті"
                : "Add salary expectations",
            selectedEmploymentTypes.length > 0
              ? selectedEmploymentTypes
                  .map((item) => getEmploymentTypeLabel(item, dictionary))
                  .join(", ")
              : locale === "uk"
                ? "Варіанти зайнятості"
                : "Employment types",
          ],
        };
      case "workExperience":
        return {
          id: sectionId,
          title,
          lines:
            workExperience.length > 0
              ? workExperience
                  .slice(0, 3)
                  .map((item) =>
                    [
                      item.position ||
                        (locale === "uk" ? "Посада" : "Position"),
                      item.company_name ||
                        (locale === "uk" ? "Компанія" : "Company"),
                    ]
                      .filter(Boolean)
                      .join(" • "),
                  )
              : [locale === "uk" ? "Додайте місце роботи" : "Add a work entry"],
        };
      case "skills":
        return {
          id: sectionId,
          title,
          lines:
            skills.length > 0
              ? meta.skills
                  .filter((item) => skills.includes(item.id))
                  .slice(0, 6)
                  .map((item) => item.name)
              : [locale === "uk" ? "Оберіть навички" : "Choose skills"],
        };
      case "languages":
        return {
          id: sectionId,
          title,
          lines:
            languages.length > 0
              ? languages.slice(0, 4).map((item) => {
                  const languageName =
                    meta.languages.find(
                      (option) => option.id === item.language_id,
                    )?.name || (locale === "uk" ? "Мова" : "Language");
                  return `${languageName} • ${getLanguageLevelLabel(item.proficiency_level, dictionary)}`;
                })
              : [locale === "uk" ? "Додайте мови" : "Add languages"],
        };
      case "education":
        return {
          id: sectionId,
          title,
          lines:
            education.length > 0
              ? education
                  .slice(0, 3)
                  .map((item) =>
                    [
                      item.institution ||
                        (locale === "uk" ? "Навчальний заклад" : "Institution"),
                      item.degree || item.field_of_study || "",
                    ]
                      .filter(Boolean)
                      .join(" • "),
                  )
              : [locale === "uk" ? "Додайте освіту" : "Add education"],
        };
      case "certificates":
        return {
          id: sectionId,
          title,
          lines:
            certificates.length > 0
              ? certificates
                  .slice(0, 3)
                  .map((item) => item.title || item.issuer || "Certificate")
              : [locale === "uk" ? "Додайте сертифікати" : "Add certificates"],
        };
      case "qa":
        return {
          id: sectionId,
          title,
          lines:
            qas.length > 0
              ? qas
                  .slice(0, 2)
                  .map(
                    (item) =>
                      item.question ||
                      (locale === "uk" ? "Питання" : "Question"),
                  )
              : [locale === "uk" ? "Додайте Q&A" : "Add Q&A"],
        };
      case "contacts":
        return {
          id: sectionId,
          title,
          lines: [
            form.contact_email ||
              (locale === "uk" ? "Email не додано" : "No email yet"),
            form.telegram_username ||
              form.phone ||
              form.linkedin ||
              (locale === "uk"
                ? "Додайте способи зв'язку"
                : "Add contact methods"),
          ],
        };
      case "articles":
        return {
          id: sectionId,
          title,
          lines: [
            locale === "uk"
              ? "Блок показує опубліковані статті з публічної сторінки."
              : "This block shows published articles on the public page.",
            locale === "uk"
              ? "У конструкторі ви керуєте розташуванням і шириною."
              : "Use the builder to control its position and width.",
          ],
        };
      case "projects":
      default:
        return {
          id: sectionId,
          title,
          lines: [
            locale === "uk"
              ? "Блок показує опубліковані проєкти з публічної сторінки."
              : "This block shows published projects on the public page.",
            locale === "uk"
              ? "У конструкторі ви керуєте розташуванням і шириною."
              : "Use the builder to control its position and width.",
          ],
        };
    }
  });

  return (
    <div className="space-y-8">
      <section className="rounded-panel app-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {editorMode === "content"
                ? workspaceUi.content
                : workspaceUi.builder}
            </h2>
            <p className="mt-2 text-sm leading-6 app-muted">
              {editorMode === "content"
                ? workspaceUi.contentDescription
                : workspaceUi.builderDescription}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={editorMode === "content" ? "primary" : "secondary"}
              onClick={() => setEditorMode("content")}
            >
              {workspaceUi.content}
            </Button>
            <Button
              variant={editorMode === "builder" ? "primary" : "secondary"}
              onClick={() => setEditorMode("builder")}
            >
              {workspaceUi.builder}
            </Button>
          </div>
        </div>
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.basicProfileInfo}
        </h2>

        <input
          className="app-input w-full"
          placeholder={dictionary.forms.username}
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
        />

        <input
          className="app-input w-full"
          placeholder={dictionary.forms.fullName}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />

        <div>
          <p className="mb-2 font-semibold text-[color:var(--foreground)]">
            {profileUi.categoryLabel}
          </p>

          <FormSelect
            className="w-full"
            triggerClassName="w-full"
            value={form.category_id ? String(form.category_id) : ""}
            placeholder={profileUi.categoryPlaceholder}
            onChange={(value) =>
              update("category_id", value ? Number(value) : null)
            }
            options={meta.categories.map((option) => ({
              value: String(option.id),
              label: option.name,
            }))}
          />
        </div>

        <input
          className="app-input w-full"
          placeholder={dictionary.forms.headline}
          value={form.headline}
          onChange={(e) => update("headline", e.target.value)}
        />

        <RichTextComposer
          locale={locale}
          value={form.bio}
          onChange={(nextValue) => update("bio", nextValue)}
          label={dictionary.forms.bio}
          hint={presentationExtrasUi.bioHint}
          placeholder={dictionary.forms.bio}
          maxLength={5000}
          minHeight={280}
          contentClassName="min-h-[17rem] text-[15px] leading-8"
        />
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.professionalDetails}
        </h2>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem]">
          <FormSelect
            triggerClassName="w-full"
            value={form.experience_level}
            placeholder={getExperiencePlaceholder(locale)}
            onChange={(value) =>
              update("experience_level", value as ExperienceLevel | "")
            }
            options={experienceLevels.map((option) => ({
              value: option,
              label: getExperienceLevelLabel(option, locale),
            }))}
          />

          <input
            className="app-input"
            placeholder={dictionary.forms.salaryExpectations}
            value={form.salary_expectations}
            onChange={(e) => update("salary_expectations", e.target.value)}
          />

          <FormSelect
            triggerClassName="w-full"
            value={form.salary_currency}
            placeholder={getSalaryCurrencyPlaceholder(locale)}
            onChange={(value) =>
              update("salary_currency", value as SalaryCurrency)
            }
            options={salaryCurrencies.map((option) => ({
              value: option,
              label: getSalaryCurrencyLabel(option, locale),
            }))}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold text-[color:var(--foreground)]">
            {dictionary.forms.employmentTypes}
          </p>
          <div className="flex flex-wrap gap-2">
            {employmentTypes.map((option) => {
              const active = selectedEmploymentTypes.includes(option);
              return (
                <Button
                  key={option}
                  variant={active ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => toggleEmploymentType(option)}
                >
                  {getEmploymentTypeLabel(option, dictionary)}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 font-semibold text-[color:var(--foreground)]">
            {dictionary.forms.workFormats}
          </p>
          <div className="flex flex-wrap gap-2">
            {workFormats.map((option) => {
              const active = selectedWorkFormats.includes(option);
              return (
                <Button
                  key={option}
                  variant={active ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => toggleWorkFormat(option)}
                >
                  {getWorkFormatLabel(option, dictionary)}
                </Button>
              );
            })}
          </div>
        </div>

        <FormTextarea
          className="min-h-24 w-full p-4 text-[color:var(--foreground)]"
          placeholder={dictionary.forms.additionalInfo}
          value={form.additional_info}
          onChange={(e) => update("additional_info", e.target.value)}
        />
      </section>

      <section
        className={
          editorMode === "builder"
            ? "space-y-5 rounded-panel app-panel p-5"
            : "hidden"
        }
      >
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {customizationUi.title}
              </h2>
              <p className="mt-2 text-sm leading-6 app-muted">
                {customizationUi.description}
              </p>
            </div>
            <div className="max-w-sm text-right">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void resetCustomization()}
              >
                {draftUi.resetCustomization}
              </Button>
              <p className="mt-2 text-xs app-soft">
                {draftUi.resetCustomizationHint}
              </p>
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-panel border border-white/10 p-5"
          style={{
            background:
              presentation.backgroundMode === "gradient" ||
              !presentation.backgroundUrl
                ? `linear-gradient(135deg, ${presentation.surfaceColor} 0%, ${presentation.panelColor} 55%, ${presentation.accentColor} 100%)`
                : presentation.surfaceColor,
            color: presentation.textColor,
            fontFamily: previewFontFamily,
          }}
        >
          {presentation.backgroundUrl &&
            presentation.backgroundMode === "image" && (
              <OptimizedImage
                src={presentation.backgroundUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                className="object-cover"
              />
            )}
          {presentation.backgroundUrl &&
            presentation.backgroundMode === "video" && (
              <video
                src={presentation.backgroundUrl}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${presentation.surfaceColor}dd 0%, ${presentation.panelColor}dd 58%, ${presentation.accentColor}55 100%)`,
            }}
          />
          <div
            className="relative rounded-3xl p-5"
            style={{
              ...previewPanelStyle,
              textAlign: presentation.heroAlignment,
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-eyebrow"
              style={{ color: presentation.mutedColor }}
            >
              {customizationUi.preview}
            </p>
            <h3
              className="mt-3 font-semibold"
              style={{
                fontSize: `${2.1 * previewScale.heading}rem`,
                lineHeight: 1.05,
              }}
            >
              {form.name || form.username || "Your profile"}
            </h3>
            <p
              className="mt-3 max-w-2xl"
              style={{
                color: presentation.mutedColor,
                fontSize: `${1 * previewScale.body}rem`,
              }}
            >
              {form.headline ||
                (locale === "uk"
                  ? "\u0422\u0443\u0442 \u0431\u0443\u0434\u0435 \u0432\u0438\u0434\u043d\u043e, \u044f\u043a \u0432\u0438\u0433\u043b\u044f\u0434\u0430\u0442\u0438\u043c\u0435 \u0432\u0430\u0448 hero-\u0431\u043b\u043e\u043a."
                  : "This shows how your hero section will feel on the public page.")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["About", "Projects", "Contacts"].map((item) => (
                <span
                  key={item}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: presentation.accentColor,
                    color: presentation.surfaceColor,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(
            [
              ["accentColor", customizationUi.accentColor],
              ["surfaceColor", customizationUi.surfaceColor],
              ["panelColor", customizationUi.panelColor],
              ["textColor", customizationUi.textColor],
              ["mutedColor", customizationUi.mutedColor],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-2">
              <span className="block text-sm font-medium text-[color:var(--foreground)]">
                {label}
              </span>
              <input
                type="color"
                className="h-12 w-full rounded-2xl border app-border bg-[color:var(--surface)] p-2"
                value={presentation[key]}
                onChange={(event) =>
                  updatePresentation(
                    key,
                    event.target.value as ProfilePresentation[typeof key],
                  )
                }
              />
            </label>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {customizationUi.fontPreset}
            </p>
            <div className="flex flex-wrap gap-2">
              {profileFontPresets.map((fontPreset) => (
                <Button
                  key={fontPreset}
                  variant={
                    presentation.fontPreset === fontPreset
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                  onClick={() =>
                    updatePresentation(
                      "fontPreset",
                      fontPreset as ProfileFontPreset,
                    )
                  }
                >
                  {customizationUi.fonts[fontPreset]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {customizationUi.textScale}
            </p>
            <div className="flex flex-wrap gap-2">
              {profileTextScales.map((textScale) => (
                <Button
                  key={textScale}
                  variant={
                    presentation.textScale === textScale
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                  onClick={() =>
                    updatePresentation(
                      "textScale",
                      textScale as ProfileTextScale,
                    )
                  }
                >
                  {customizationUi.scales[textScale]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {customizationUi.cardStyle}
            </p>
            <div className="flex flex-wrap gap-2">
              {profileCardStyles.map((cardStyle) => (
                <Button
                  key={cardStyle}
                  variant={
                    presentation.cardStyle === cardStyle
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                  onClick={() =>
                    updatePresentation(
                      "cardStyle",
                      cardStyle as ProfileCardStyle,
                    )
                  }
                >
                  {customizationUi.cards[cardStyle]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {customizationUi.heroAlignment}
            </p>
            <div className="flex flex-wrap gap-2">
              {profileHeroAlignments.map((heroAlignment) => (
                <Button
                  key={heroAlignment}
                  variant={
                    presentation.heroAlignment === heroAlignment
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                  onClick={() =>
                    updatePresentation(
                      "heroAlignment",
                      heroAlignment as ProfileHeroAlignment,
                    )
                  }
                >
                  {customizationUi.alignments[heroAlignment]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {customizationUi.backgroundMode}
            </p>
            <div className="flex flex-wrap gap-2">
              {profileBackgroundModes.map((backgroundMode) => (
                <Button
                  key={backgroundMode}
                  variant={
                    presentation.backgroundMode === backgroundMode
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                  onClick={() =>
                    updatePresentation(
                      "backgroundMode",
                      backgroundMode as ProfileBackgroundMode,
                    )
                  }
                >
                  {customizationUi.modes[backgroundMode]}
                </Button>
              ))}
            </div>
            <div className="rounded-2xl border app-border bg-[color:var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm app-muted">
                  {presentation.backgroundUrl
                    ? presentationExtrasUi.backgroundReady
                    : customizationUi.backgroundHint}
                </span>
                {presentation.backgroundUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void clearBackgroundAsset()}
                  >
                    {presentationExtrasUi.removeBackground}
                  </Button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-full border app-border bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                  <span>
                    {uploadingBackground
                      ? presentationExtrasUi.backgroundUploading
                      : presentation.backgroundUrl
                        ? presentationExtrasUi.replaceBackground
                        : presentationExtrasUi.uploadBackground}
                  </span>
                  <input
                    type="file"
                    accept={getBackgroundAcceptValue(
                      presentation.backgroundMode,
                    )}
                    disabled={uploadingBackground}
                    className="sr-only"
                    onChange={(event) => void uploadBackgroundAsset(event)}
                  />
                </label>
              </div>
            </div>
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-[color:var(--foreground)]">
              {customizationUi.overlay}
            </span>
            <input
              type="range"
              min="0"
              max="85"
              step="1"
              value={presentation.overlayStrength}
              onChange={(event) =>
                updatePresentation(
                  "overlayStrength",
                  clampOverlayStrength(Number(event.target.value)),
                )
              }
            />
            <span className="text-sm app-muted">
              {presentation.overlayStrength}%
            </span>
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                {workspaceUi.canvasTitle}
              </h3>
              <p className="mt-1 text-sm app-muted">
                {workspaceUi.canvasDescription}
              </p>
            </div>
            <p className="text-sm app-soft">{presentationExtrasUi.dragHint}</p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            {builderCards.map((card, index) => {
              const sectionId = card.id;

              return (
                <div
                  key={sectionId}
                  draggable
                  onDragStart={() => setDraggingSectionId(sectionId)}
                  onDragEnd={() => setDraggingSectionId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();

                    if (draggingSectionId) {
                      reorderSections(draggingSectionId, sectionId);
                    }

                    setDraggingSectionId(null);
                  }}
                  className={`${getBuilderSpanClass(presentation.sectionSizes[sectionId])} flex flex-col gap-4 rounded-3xl border app-border bg-[color:var(--surface)] p-5 ${
                    draggingSectionId === sectionId ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div
                        className="mb-4 h-1.5 w-18 rounded-full"
                        style={{ backgroundColor: presentation.accentColor }}
                      />
                      <p className="text-sm font-medium text-[color:var(--foreground)]">
                        {index + 1}. {card.title}
                      </p>
                      {sectionId === "contacts" && !visibility.links && (
                        <p className="mt-1 text-xs app-muted">
                          {locale === "uk"
                            ? "\u0411\u043b\u043e\u043a \u0437\u0430\u0440\u0430\u0437 \u043f\u0440\u0438\u0445\u043e\u0432\u0430\u043d\u0438\u0439 \u043d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f\u043c \u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u0456."
                            : "This block is currently hidden by your visibility settings."}
                        </p>
                      )}
                    </div>
                    <span className="cursor-grab rounded-full border app-border px-3 py-1 text-xs app-soft active:cursor-grabbing">
                      {presentationExtrasUi.dragHandle}
                    </span>
                  </div>

                  <div className="space-y-3 rounded-2xl app-panel p-4">
                    {card.lines.map((line, lineIndex) => (
                      <p
                        key={`${sectionId}-${lineIndex}`}
                        className={
                          lineIndex === 0
                            ? "font-semibold text-[color:var(--foreground)]"
                            : "text-sm app-muted"
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
                      {presentationExtrasUi.blockSize}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profileSectionSizes.map((size) => (
                        <Button
                          key={`${sectionId}-${size}`}
                          variant={
                            presentation.sectionSizes[sectionId] === size
                              ? "primary"
                              : "secondary"
                          }
                          size="sm"
                          onClick={() => updateSectionSize(sectionId, size)}
                        >
                          {presentationExtrasUi.sizes[size]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {dictionary.forms.workExperience}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setWorkExperience((prev) => [
                ...prev,
                createProfileWorkExperienceEntry(),
              ])
            }
          >
            {dictionary.forms.addWorkExperience}
          </Button>
        </div>

        <div className="space-y-4">
          {workExperience.map((item) => (
            <article key={item.id} className="rounded-3xl app-panel p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="app-input"
                  placeholder={dictionary.forms.workCompanyName}
                  value={item.company_name}
                  onChange={(e) =>
                    updateWorkExperience(
                      item.id,
                      "company_name",
                      e.target.value,
                    )
                  }
                />
                <input
                  className="app-input"
                  placeholder={dictionary.forms.workPosition}
                  value={item.position}
                  onChange={(e) =>
                    updateWorkExperience(item.id, "position", e.target.value)
                  }
                />
                <input
                  type="number"
                  min="1950"
                  max="2100"
                  className="app-input"
                  placeholder={dictionary.forms.workStartYear}
                  value={item.started_year}
                  onChange={(e) =>
                    updateWorkExperience(
                      item.id,
                      "started_year",
                      e.target.value,
                    )
                  }
                />
                <input
                  type="number"
                  min="1950"
                  max="2100"
                  disabled={item.is_current}
                  className="app-input disabled:opacity-60"
                  placeholder={dictionary.forms.workEndYear}
                  value={item.ended_year}
                  onChange={(e) =>
                    updateWorkExperience(item.id, "ended_year", e.target.value)
                  }
                />
                <label className="inline-flex items-center gap-3 text-sm font-medium text-[color:var(--foreground)] md:col-span-2">
                  <input
                    type="checkbox"
                    className="app-checkbox"
                    checked={item.is_current}
                    onChange={(e) =>
                      updateWorkExperience(
                        item.id,
                        "is_current",
                        e.target.checked,
                      )
                    }
                  />
                  <span>{dictionary.forms.workCurrent}</span>
                </label>
                <FormTextarea
                  className="min-h-24 p-4 text-[color:var(--foreground)] md:col-span-2"
                  placeholder={dictionary.forms.workResponsibilities}
                  value={item.responsibilities}
                  onChange={(e) =>
                    updateWorkExperience(
                      item.id,
                      "responsibilities",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeWorkExperience(item.id)}
                >
                  {dictionary.forms.removeItem}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.locationContactsAndLinks}
        </h2>
        <div>
          <p className="mb-2 font-semibold text-[color:var(--foreground)]">
            {dictionary.forms.country}
          </p>
          <SearchSelect
            options={meta.countries}
            value={form.country_id ?? undefined}
            placeholder={dictionary.forms.searchCountry}
            onChange={(value) => update("country_id", value)}
          />
        </div>
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.city}
          value={form.city}
          onChange={(e) => update("city", e.target.value)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="app-input"
            placeholder={dictionary.forms.contactEmail}
            value={form.contact_email}
            onChange={(e) => update("contact_email", e.target.value)}
          />
          <input
            className="app-input"
            placeholder={dictionary.forms.telegram}
            value={form.telegram_username}
            onChange={(e) => update("telegram_username", e.target.value)}
          />
          <input
            className="app-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={dictionary.forms.phone}
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
          <FormSelect
            triggerClassName="w-full"
            value={form.preferred_contact_method}
            placeholder={getPreferredContactMethodPlaceholder(locale)}
            onChange={(value) =>
              update(
                "preferred_contact_method",
                value as PreferredContactMethod | "",
              )
            }
            options={preferredContactMethods.map((option) => ({
              value: option,
              label: getPreferredContactMethodLabel(option, dictionary),
            }))}
          />
        </div>
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.website}
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.github}
          value={form.github}
          onChange={(e) => update("github", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.twitter}
          value={form.twitter}
          onChange={(e) => update("twitter", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.linkedin}
          value={form.linkedin}
          onChange={(e) => update("linkedin", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.behance}
          value={form.behance}
          onChange={(e) => update("behance", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.dribbble}
          value={form.dribbble}
          onChange={(e) => update("dribbble", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.artstation}
          value={form.artstation}
          onChange={(e) => update("artstation", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.vimeo}
          value={form.vimeo}
          onChange={(e) => update("vimeo", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.youtube}
          value={form.youtube}
          onChange={(e) => update("youtube", e.target.value)}
        />
        <input
          className="app-input w-full"
          placeholder={dictionary.forms.instagram}
          value={form.instagram}
          onChange={(e) => update("instagram", e.target.value)}
        />
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.skills}
        </h2>
        <TagSelect
          options={meta.skills}
          value={skills}
          placeholder={dictionary.forms.searchSkills}
          onChange={(values) => setSkills(values.map(Number))}
        />
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {dictionary.forms.languagesWithLevel}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setLanguages((prev) => [...prev, createProfileLanguageEntry()])
            }
          >
            {dictionary.forms.addLanguage}
          </Button>
        </div>
        <div className="space-y-4">
          {languages.map((item) => (
            <div key={item.id} className="rounded-3xl app-panel p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
                <SearchSelect
                  options={meta.languages}
                  value={item.language_id ?? undefined}
                  placeholder={dictionary.forms.searchLanguages}
                  onChange={(value) =>
                    updateLanguage(item.id, "language_id", value)
                  }
                />
                <FormSelect
                  triggerClassName="w-full"
                  value={item.proficiency_level}
                  onChange={(value) =>
                    updateLanguage(
                      item.id,
                      "proficiency_level",
                      value as LanguageLevel,
                    )
                  }
                  options={languageLevels.map((level) => ({
                    value: level,
                    label: getLanguageLevelLabel(level, dictionary),
                  }))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLanguage(item.id)}
                >
                  {dictionary.forms.removeItem}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {dictionary.forms.education}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setEducation((prev) => [...prev, createProfileEducationEntry()])
            }
          >
            {dictionary.forms.addEducation}
          </Button>
        </div>
        <div className="space-y-4">
          {education.map((item) => (
            <article key={item.id} className="rounded-3xl app-panel p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="app-input"
                  placeholder={dictionary.forms.educationInstitution}
                  value={item.institution}
                  onChange={(e) =>
                    updateEducation(item.id, "institution", e.target.value)
                  }
                />
                <input
                  className="app-input"
                  placeholder={dictionary.forms.educationDegree}
                  value={item.degree}
                  onChange={(e) =>
                    updateEducation(item.id, "degree", e.target.value)
                  }
                />
                <input
                  className="app-input md:col-span-2"
                  placeholder={dictionary.forms.educationField}
                  value={item.field_of_study}
                  onChange={(e) =>
                    updateEducation(item.id, "field_of_study", e.target.value)
                  }
                />
                <input
                  type="date"
                  className="app-input"
                  value={item.started_on}
                  onChange={(e) =>
                    updateEducation(item.id, "started_on", e.target.value)
                  }
                />
                <input
                  type="date"
                  className="app-input"
                  value={item.completed_on}
                  onChange={(e) =>
                    updateEducation(item.id, "completed_on", e.target.value)
                  }
                />
                <FormTextarea
                  className="min-h-24 p-4 text-[color:var(--foreground)] md:col-span-2"
                  placeholder={dictionary.forms.educationDescription}
                  value={item.description}
                  onChange={(e) =>
                    updateEducation(item.id, "description", e.target.value)
                  }
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEducation(item.id)}
                >
                  {dictionary.forms.removeItem}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {dictionary.forms.certificates}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setCertificates((prev) => [
                ...prev,
                createProfileCertificateEntry(),
              ])
            }
          >
            {dictionary.forms.addCertificate}
          </Button>
        </div>
        <div className="space-y-4">
          {certificates.map((item) => (
            <article key={item.id} className="rounded-3xl app-panel p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="app-input"
                  placeholder={dictionary.forms.certificateTitle}
                  value={item.title}
                  onChange={(e) =>
                    updateCertificate(item.id, "title", e.target.value)
                  }
                />
                <input
                  className="app-input"
                  placeholder={dictionary.forms.certificateIssuer}
                  value={item.issuer}
                  onChange={(e) =>
                    updateCertificate(item.id, "issuer", e.target.value)
                  }
                />
                <input
                  type="date"
                  className="app-input"
                  value={item.issued_on}
                  onChange={(e) =>
                    updateCertificate(item.id, "issued_on", e.target.value)
                  }
                />
                <input
                  className="app-input"
                  placeholder={dictionary.forms.certificateUrl}
                  value={item.credential_url}
                  onChange={(e) =>
                    updateCertificate(item.id, "credential_url", e.target.value)
                  }
                />
                <div className="md:col-span-2">
                  <label className="inline-flex cursor-pointer items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                    <span>
                      {uploadingCertificateId === item.id
                        ? dictionary.forms.uploadingCertificate
                        : dictionary.forms.uploadCertificateFile}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png"
                      disabled={uploadingCertificateId === item.id}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }
                        void uploadCertificateFile(item.id, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {(item.file_url || item.credential_url) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.credential_url && (
                        <a
                          href={item.credential_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border app-border px-4 py-2 text-sm app-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                        >
                          {dictionary.forms.openCertificateLink}
                        </a>
                      )}
                      {item.file_url && (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border app-border px-4 py-2 text-sm app-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                        >
                          {item.file_name ||
                            dictionary.forms.openCertificateFile}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeCertificate(item.id)}
                >
                  {dictionary.forms.removeItem}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={editorMode === "content" ? "space-y-4" : "hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {dictionary.forms.profileQa}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQas((prev) => [...prev, createProfileQaEntry()])}
          >
            {dictionary.forms.addQa}
          </Button>
        </div>
        <div className="space-y-4">
          {qas.map((item) => (
            <article key={item.id} className="rounded-3xl app-panel p-4">
              <div className="grid gap-4">
                <input
                  className="app-input"
                  placeholder={dictionary.forms.qaQuestion}
                  value={item.question}
                  onChange={(e) =>
                    updateQa(item.id, "question", e.target.value)
                  }
                />
                <FormTextarea
                  className="min-h-24 p-4 text-[color:var(--foreground)]"
                  placeholder={dictionary.forms.qaAnswer}
                  value={item.answer}
                  onChange={(e) => updateQa(item.id, "answer", e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQa(item.id)}
                >
                  {dictionary.forms.removeItem}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className={
          editorMode === "builder"
            ? "space-y-4 rounded-3xl app-panel p-5"
            : "hidden"
        }
      >
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {dictionary.forms.blockVisibility}
          </h2>
          <p className="mt-2 text-sm app-muted">
            {dictionary.forms.blockVisibilityHint}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profileVisibilityKeys.map((key) => {
            const active = visibility[key];
            return (
              <Button
                key={key}
                variant={active ? "primary" : "secondary"}
                size="sm"
                aria-pressed={active}
                onClick={() => toggleVisibility(key)}
              >
                {getVisibilityLabel(key, dictionary)}:{" "}
                {active
                  ? dictionary.forms.sectionVisible
                  : dictionary.forms.sectionHidden}
              </Button>
            );
          })}
        </div>
      </section>

      {hasUnsavedChanges ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {draftUi.unsavedChanges}
          </p>
          <p className="mt-1 text-sm app-muted">{draftUi.unsavedChangesHint}</p>
        </div>
      ) : null}

      <Button
        onClick={save}
        disabled={
          saving || Boolean(uploadingCertificateId) || uploadingBackground
        }
      >
        {saving ? dictionary.forms.saving : dictionary.forms.saveProfile}
      </Button>
      {errorMessage && <p className="text-sm text-rose-500">{errorMessage}</p>}

      <ConfirmDialog
        open={pendingLeaveUrl !== null}
        title={draftUi.confirmLeaveTitle}
        description={draftUi.confirmLeave}
        confirmLabel={draftUi.confirmLeaveContinue}
        cancelLabel={draftUi.confirmLeaveStay}
        confirmVariant="primary"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}
