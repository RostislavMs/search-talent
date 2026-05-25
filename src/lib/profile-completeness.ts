export type ProfileCompletenessItemKey =
  | "username"
  | "name"
  | "avatar"
  | "headline"
  | "bio"
  | "country"
  | "city"
  | "website"
  | "github"
  | "twitter"
  | "linkedin"
  | "contact"
  | "preferredContact"
  | "experience"
  | "employmentTypes"
  | "workFormats"
  | "salary"
  | "additionalInfo"
  | "skills"
  | "languages"
  | "education"
  | "certificates"
  | "qa"
  | "workExperience";

export type ProfileCompletenessItem = {
  key: ProfileCompletenessItemKey;
  filled: boolean;
  weight: number;
};

export type ProfileCompletenessBreakdown = {
  items: ProfileCompletenessItem[];
  /** 0–100 integer. */
  percent: number;
};

/**
 * Same scoring rules as `getProfileCompletenessScore` in
 * `src/lib/leaderboards.ts`, but returns the per-field breakdown so the
 * UI can highlight which fields are still empty. Keep the two functions
 * in sync if weights change.
 */
export function getProfileCompletenessBreakdown(input: {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  countryId: number | null;
  city: string | null;
  website: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  contactEmail: string | null;
  telegramUsername: string | null;
  phone: string | null;
  preferredContactMethod: string | null;
  experienceLevel: string | null;
  experienceYears: number | null;
  employmentTypesCount: number;
  workFormatsCount: number;
  salaryExpectations: string | null;
  salaryCurrency: string | null;
  additionalInfo: string | null;
  skillsCount: number;
  languagesCount: number;
  educationCount: number;
  certificateCount: number;
  qaCount: number;
  workExperienceCount: number;
}): ProfileCompletenessBreakdown {
  const items: ProfileCompletenessItem[] = [
    { key: "username", filled: Boolean(input.username), weight: 1.5 },
    { key: "name", filled: Boolean(input.name), weight: 1 },
    { key: "avatar", filled: Boolean(input.avatarUrl), weight: 1.2 },
    { key: "headline", filled: Boolean(input.headline), weight: 1 },
    { key: "bio", filled: Boolean(input.bio), weight: 1.4 },
    { key: "country", filled: Boolean(input.countryId), weight: 0.8 },
    { key: "city", filled: Boolean(input.city), weight: 0.5 },
    { key: "website", filled: Boolean(input.website), weight: 0.8 },
    { key: "github", filled: Boolean(input.github), weight: 0.8 },
    { key: "twitter", filled: Boolean(input.twitter), weight: 0.5 },
    { key: "linkedin", filled: Boolean(input.linkedin), weight: 0.8 },
    {
      key: "contact",
      filled:
        Boolean(input.contactEmail) ||
        Boolean(input.telegramUsername) ||
        Boolean(input.phone),
      weight: 0.9,
    },
    {
      key: "preferredContact",
      filled: Boolean(input.preferredContactMethod),
      weight: 0.4,
    },
    {
      key: "experience",
      filled:
        Boolean(input.experienceLevel) || input.experienceYears !== null,
      weight: 1,
    },
    {
      key: "employmentTypes",
      filled: input.employmentTypesCount > 0,
      weight: 0.8,
    },
    { key: "workFormats", filled: input.workFormatsCount > 0, weight: 0.8 },
    {
      key: "salary",
      filled:
        Boolean(input.salaryExpectations) && Boolean(input.salaryCurrency),
      weight: 0.7,
    },
    {
      key: "additionalInfo",
      filled: Boolean(input.additionalInfo),
      weight: 0.9,
    },
    { key: "skills", filled: input.skillsCount > 0, weight: 1.4 },
    { key: "languages", filled: input.languagesCount > 0, weight: 0.8 },
    { key: "education", filled: input.educationCount > 0, weight: 1 },
    { key: "certificates", filled: input.certificateCount > 0, weight: 1 },
    { key: "qa", filled: input.qaCount > 0, weight: 1.1 },
    {
      key: "workExperience",
      filled: input.workExperienceCount > 0,
      weight: 1.3,
    },
  ];

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const filledWeight = items.reduce(
    (sum, item) => sum + (item.filled ? item.weight : 0),
    0,
  );
  const percent =
    totalWeight === 0 ? 0 : Math.round((filledWeight / totalWeight) * 100);

  return { items, percent };
}

const LABELS_EN: Record<ProfileCompletenessItemKey, string> = {
  username: "Username",
  name: "Full name",
  avatar: "Avatar",
  headline: "Headline",
  bio: "Bio",
  country: "Country",
  city: "City",
  website: "Website",
  github: "GitHub",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  contact: "Contact (email / Telegram / phone)",
  preferredContact: "Preferred contact method",
  experience: "Experience",
  employmentTypes: "Employment types",
  workFormats: "Work formats",
  salary: "Salary expectations",
  additionalInfo: "Additional info",
  skills: "Skills",
  languages: "Languages",
  education: "Education",
  certificates: "Certificates",
  qa: "Q&A",
  workExperience: "Work experience",
};

const LABELS_UK: Record<ProfileCompletenessItemKey, string> = {
  username: "Username",
  name: "Імʼя",
  avatar: "Аватар",
  headline: "Заголовок",
  bio: "Біо",
  country: "Країна",
  city: "Місто",
  website: "Сайт",
  github: "GitHub",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  contact: "Контакти (email / Telegram / телефон)",
  preferredContact: "Спосіб звʼязку",
  experience: "Досвід",
  employmentTypes: "Зайнятість",
  workFormats: "Формат роботи",
  salary: "Зарплатні очікування",
  additionalInfo: "Додаткова інформація",
  skills: "Навички",
  languages: "Мови",
  education: "Освіта",
  certificates: "Сертифікати",
  qa: "Q&A",
  workExperience: "Досвід роботи",
};

export function getProfileCompletenessItemLabel(
  key: ProfileCompletenessItemKey,
  locale: string,
): string {
  return locale === "uk" ? LABELS_UK[key] : LABELS_EN[key];
}
