import type {
  EmploymentType,
  ExperienceLevel,
  PreferredContactMethod,
  ProfileWorkExperienceEntry,
  SalaryCurrency,
  WorkFormat,
} from "@/lib/profile-sections";
import type { ProfileSettings } from "@/lib/profile-presentation";

export type Profile = {
  id: string;
  user_id: string;

  username: string | null;
  name: string | null;
  avatar_url: string | null;

  headline: string | null;
  bio: string | null;

  country: string | null;
  city: string | null;

  skills: string[] | null;
  languages: string[] | null;

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
  employment_types: EmploymentType[] | null;
  work_formats: WorkFormat[] | null;
  salary_expectations: string | null;
  salary_currency: SalaryCurrency | null;
  additional_info: string | null;
  profile_visibility: ProfileSettings | null;
  work_experience: ProfileWorkExperienceEntry[] | null;
};
