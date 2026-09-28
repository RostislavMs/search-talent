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
  | "portfolioLinks"
  | "contact"
  | "preferredContact"
  | "experience"
  | "openTo"
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
  /**
   * Suggested, never required: an empty optional item does not lower the
   * percent. «Відкрито до…» is one — someone who isn't looking for anything
   * shouldn't lose points for saying so.
   */
  optional?: boolean;
};

export type ProfileCompletenessBreakdown = {
  items: ProfileCompletenessItem[];
  /** 0–100 integer. */
  percent: number;
};

export type ProfileCompletenessInput = {
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
  behance?: string | null;
  dribbble?: string | null;
  artstation?: string | null;
  vimeo?: string | null;
  youtube?: string | null;
  instagram?: string | null;
  /** Email or phone, kept in the owner-only table (the public row can't tell). */
  hasPrivateContact: boolean;
  telegramUsername: string | null;
  preferredContactMethod: string | null;
  experienceLevel: string | null;
  experienceYears: number | null;
  openToCount: number;
  additionalInfo: string | null;
  skillsCount: number;
  languagesCount: number;
  educationCount: number;
  certificateCount: number;
  qaCount: number;
  workExperienceCount: number;
};

/**
 * The one list of completeness signals. The rating (`getProfileCompletenessScore`
 * in `src/lib/leaderboards.ts`), the percent on the profile, "My Space" and the
 * `complete_profile` badge all read it.
 *
 * Salary, employment types and work format used to be required. They are
 * hiring details: asking everyone for them pushed people to publish a salary
 * just to reach the 90% badge.
 */
export function getProfileCompletenessItems(
  input: ProfileCompletenessInput,
): ProfileCompletenessItem[] {
  return [
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
      // Discipline portfolio link — at least one of behance/dribbble/
      // artstation/vimeo/youtube/instagram. Grouped because no single
      // role uses all six; designers reach for Behance, video editors
      // for Vimeo, photographers for Instagram.
      key: "portfolioLinks",
      filled:
        Boolean(input.behance) ||
        Boolean(input.dribbble) ||
        Boolean(input.artstation) ||
        Boolean(input.vimeo) ||
        Boolean(input.youtube) ||
        Boolean(input.instagram),
      weight: 0.9,
    },
    {
      key: "contact",
      filled: input.hasPrivateContact || Boolean(input.telegramUsername),
      weight: 0.9,
    },
    {
      key: "preferredContact",
      filled: Boolean(input.preferredContactMethod),
      weight: 0.4,
    },
    {
      key: "experience",
      filled: Boolean(input.experienceLevel) || input.experienceYears !== null,
      weight: 1,
    },
    { key: "openTo", filled: input.openToCount > 0, weight: 0.8, optional: true },
    { key: "additionalInfo", filled: Boolean(input.additionalInfo), weight: 0.9 },
    { key: "skills", filled: input.skillsCount > 0, weight: 1.4 },
    { key: "languages", filled: input.languagesCount > 0, weight: 0.8 },
    { key: "education", filled: input.educationCount > 0, weight: 1 },
    { key: "certificates", filled: input.certificateCount > 0, weight: 1 },
    { key: "qa", filled: input.qaCount > 0, weight: 1.1 },
    { key: "workExperience", filled: input.workExperienceCount > 0, weight: 1.3 },
  ];
}

/** 0–1 share of the required weight that is filled. */
export function getCompletenessRatio(items: readonly ProfileCompletenessItem[]) {
  const required = items.filter((item) => !item.optional);
  const total = required.reduce((sum, item) => sum + item.weight, 0);

  if (total === 0) {
    return 0;
  }

  const filled = required.reduce((sum, item) => sum + (item.filled ? item.weight : 0), 0);
  return filled / total;
}

/** Per-field breakdown, so the UI can point at what is still empty. */
export function getProfileCompletenessBreakdown(
  input: ProfileCompletenessInput,
): ProfileCompletenessBreakdown {
  const items = getProfileCompletenessItems(input);

  return { items, percent: Math.round(getCompletenessRatio(items) * 100) };
}

type OptionalText = string | null | undefined;

/** The owner's own profile as `getMyProfile()` returns it. */
export type EditableProfileCompletenessSource = {
  username: OptionalText;
  name: OptionalText;
  avatar_url: OptionalText;
  headline: OptionalText;
  bio: OptionalText;
  country_id: number | null | undefined;
  city: OptionalText;
  website: OptionalText;
  github: OptionalText;
  twitter: OptionalText;
  linkedin: OptionalText;
  behance: OptionalText;
  dribbble: OptionalText;
  artstation: OptionalText;
  vimeo: OptionalText;
  youtube: OptionalText;
  instagram: OptionalText;
  contact_email: OptionalText;
  telegram_username: OptionalText;
  phone: OptionalText;
  preferred_contact_method: OptionalText;
  experience_level: OptionalText;
  experience_years: number | null | undefined;
  open_to: readonly unknown[];
  additional_info: OptionalText;
  skill_ids: readonly unknown[];
  languages: readonly unknown[];
  education: readonly unknown[];
  certificates: readonly unknown[];
  qas: readonly unknown[];
  work_experience: readonly unknown[];
};

/** Completeness for the signed-in owner ("My Space", onboarding). */
export function getEditableProfileCompleteness(
  profile: EditableProfileCompletenessSource,
): ProfileCompletenessBreakdown {
  return getProfileCompletenessBreakdown({
    username: profile.username ?? null,
    name: profile.name ?? null,
    avatarUrl: profile.avatar_url ?? null,
    headline: profile.headline ?? null,
    bio: profile.bio ?? null,
    countryId: profile.country_id ?? null,
    city: profile.city ?? null,
    website: profile.website ?? null,
    github: profile.github ?? null,
    twitter: profile.twitter ?? null,
    linkedin: profile.linkedin ?? null,
    behance: profile.behance ?? null,
    dribbble: profile.dribbble ?? null,
    artstation: profile.artstation ?? null,
    vimeo: profile.vimeo ?? null,
    youtube: profile.youtube ?? null,
    instagram: profile.instagram ?? null,
    hasPrivateContact: Boolean(profile.contact_email) || Boolean(profile.phone),
    telegramUsername: profile.telegram_username ?? null,
    preferredContactMethod: profile.preferred_contact_method ?? null,
    experienceLevel: profile.experience_level ?? null,
    experienceYears: profile.experience_years ?? null,
    openToCount: profile.open_to.length,
    additionalInfo: profile.additional_info ?? null,
    skillsCount: profile.skill_ids.length,
    languagesCount: profile.languages.length,
    educationCount: profile.education.length,
    certificateCount: profile.certificates.length,
    qaCount: profile.qas.length,
    workExperienceCount: profile.work_experience.length,
  });
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
  portfolioLinks: "Portfolio links (Behance / Dribbble / Vimeo / etc.)",
  contact: "Contact (email / Telegram / phone)",
  preferredContact: "Preferred contact method",
  experience: "Experience",
  openTo: "Open to offers (optional)",
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
  portfolioLinks: "Портфоліо-посилання (Behance / Dribbble / Vimeo / тощо)",
  contact: "Контакти (email / Telegram / телефон)",
  preferredContact: "Спосіб звʼязку",
  experience: "Досвід",
  openTo: "Відкрито до пропозицій (необовʼязково)",
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
