import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  EmploymentType,
  ExperienceLevel,
  LanguageLevel,
  PreferredContactMethod,
  ProfileVisibilityKey,
  SalaryCurrency,
  WorkFormat,
} from "@/lib/profile-sections";
import type { ProfileSectionId } from "@/lib/profile-presentation";

// Pure label/placeholder helpers for the profile form. Each maps an enum value
// (plus the active dictionary or locale) to a localized string. Extracted from
// profile-form.tsx.

export function getLanguageLevelLabel(
  level: LanguageLevel,
  dictionary: Dictionary,
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

export function getEmploymentTypeLabel(
  value: EmploymentType,
  dictionary: Dictionary,
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

export function getWorkFormatLabel(
  value: WorkFormat,
  dictionary: Dictionary,
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

export function getExperienceLevelLabel(value: ExperienceLevel, locale: string) {
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

export function getSalaryCurrencyLabel(value: SalaryCurrency, locale: string) {
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

export function getPreferredContactMethodLabel(
  value: PreferredContactMethod,
  dictionary: Dictionary,
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

export function getVisibilityLabel(
  value: ProfileVisibilityKey,
  dictionary: Dictionary,
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
export function getExperiencePlaceholder(locale: string) {
  return locale === "uk"
    ? "\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0434\u043e\u0441\u0432\u0456\u0434"
    : "Choose experience";
}

export function getSalaryCurrencyPlaceholder(locale: string) {
  return locale === "uk" ? "\u0412\u0430\u043b\u044e\u0442\u0430" : "Currency";
}

export function getPreferredContactMethodPlaceholder(locale: string) {
  return locale === "uk"
    ? "\u0411\u0430\u0436\u0430\u043d\u0438\u0439 \u0441\u043f\u043e\u0441\u0456\u0431 \u0437\u0432'\u044f\u0437\u043a\u0443"
    : "Preferred contact method";
}

export function getSectionOrderLabel(
  sectionId: ProfileSectionId,
  dictionary: Dictionary,
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
