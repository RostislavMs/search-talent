export const languageLevels = [
  "beginner",
  "elementary",
  "intermediate",
  "upper_intermediate",
  "advanced",
  "native",
] as const;

export const workFormats = ["remote", "hybrid", "office"] as const;

export const salaryCurrencies = ["uah", "eur", "usd"] as const;

export const preferredContactMethods = [
  "email",
  "telegram",
  "phone",
  "linkedin",
  "website",
] as const;

export const experienceLevels = [
  "no_experience",
  "months_3",
  "months_6",
  "year_1",
  "years_2",
  "years_3",
  "years_4",
  "years_5",
  "years_6",
  "years_7",
  "years_8",
  "years_9",
  "years_10",
  "more_than_10_years",
] as const;

export const profileVisibilityKeys = [
  "about",
  "professionalDetails",
  "workExperience",
  "skills",
  "languages",
  "education",
  "certificates",
  "qa",
  "links",
] as const;

export type LanguageLevel = (typeof languageLevels)[number];
export type WorkFormat = (typeof workFormats)[number];
export type SalaryCurrency = (typeof salaryCurrencies)[number];
export type PreferredContactMethod = (typeof preferredContactMethods)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type ProfileVisibilityKey = (typeof profileVisibilityKeys)[number];

export type ProfileVisibility = Record<ProfileVisibilityKey, boolean>;

export type ProfileLanguageEntry = {
  id: string;
  language_id: number | null;
  proficiency_level: LanguageLevel;
};

export type ProfileEducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  started_on: string;
  completed_on: string;
  description: string;
};

export type ProfileCertificateEntry = {
  id: string;
  title: string;
  issuer: string;
  issued_on: string;
  credential_url: string;
  file_url: string;
  file_name: string;
  storage_path: string;
};

export type ProfileQaEntry = {
  id: string;
  question: string;
  answer: string;
};

export type ProfileWorkExperienceEntry = {
  id: string;
  company_name: string;
  position: string;
  started_year: string;
  ended_year: string;
  is_current: boolean;
  responsibilities: string;
};

export function createProfileLanguageEntry(): ProfileLanguageEntry {
  return {
    id: crypto.randomUUID(),
    language_id: null,
    proficiency_level: "intermediate",
  };
}

export function createProfileEducationEntry(): ProfileEducationEntry {
  return {
    id: crypto.randomUUID(),
    institution: "",
    degree: "",
    field_of_study: "",
    started_on: "",
    completed_on: "",
    description: "",
  };
}

export function createProfileCertificateEntry(): ProfileCertificateEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    issuer: "",
    issued_on: "",
    credential_url: "",
    file_url: "",
    file_name: "",
    storage_path: "",
  };
}

export function createProfileQaEntry(): ProfileQaEntry {
  return {
    id: crypto.randomUUID(),
    question: "",
    answer: "",
  };
}

export function createProfileWorkExperienceEntry(): ProfileWorkExperienceEntry {
  return {
    id: crypto.randomUUID(),
    company_name: "",
    position: "",
    started_year: "",
    ended_year: "",
    is_current: false,
    responsibilities: "",
  };
}

export function createDefaultProfileVisibility(
  overrides: Partial<ProfileVisibility> = {},
): ProfileVisibility {
  return {
    about: true,
    professionalDetails: true,
    workExperience: true,
    skills: true,
    languages: true,
    education: true,
    certificates: true,
    qa: true,
    links: true,
    ...overrides,
  };
}

export function normalizeProfileVisibility(value: unknown): ProfileVisibility {
  const visibility = createDefaultProfileVisibility();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return visibility;
  }

  for (const key of profileVisibilityKeys) {
    const candidate = (value as Record<string, unknown>)[key];

    if (typeof candidate === "boolean") {
      visibility[key] = candidate;
    }
  }

  return visibility;
}

export function sanitizeStorageFileName(name: string) {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
