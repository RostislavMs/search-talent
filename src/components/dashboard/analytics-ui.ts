import type { Locale } from "@/lib/i18n/config";

// Number/date formatting and the bilingual UI string map for the dashboard
// analytics view. Pure helpers extracted from dashboard-analytics.tsx.

export function formatCompactNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatMonthLabel(value: string, locale: Locale) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    month: "short",
  }).format(date);
}

export function getDashboardUi(locale: Locale) {
  if (locale === "uk") {
    return {
      publicProfiles: "Публічні профілі",
      creatorDirections: "Напрямки",
      creatorCountries: "Країни",
      creatorOrigins: "Географія фахівців",
      creatorDirectionsMix: "Розподіл за напрямками",
      profileReadiness: "Якість профілів",
      skillsUniverse: "Карта скілів платформи",
      skillsDescription:
        "Навички з профілів і технології з проєктів разом — реальний стек платформи.",
      starter: "Початковий",
      growing: "Розвивається",
      complete: "Сильний",
      directionLabel: "Напрямок",
      ownerLabel: "Автор",
      likesLabel: "Лайки",
      dislikesLabel: "Дизлайки",
      editProfile: "Редагувати профіль",
      manageProjects: "Керувати проєктами",
      openSearch: "Пошук",
      savedItems: "Збережене",
      followingAuthors: "Підписки",
      writeArticle: "Написати статтю",
      createPoll: "Створити опитування",
      showMore: "Показати більше",
      showLess: "Згорнути",
      experienceDistribution: "Рівень досвіду",
      salaryDistribution: "Зарплатні очікування",
      salaryByCountry: "Середня зарплата по країнам",
      salaryByCategory: "Середня зарплата по напрямкам",
      avgSalaryLabel: "~${avg} $",
      profilesCount: "{count} профілів",
      workFormatDistribution: "Бажаний формат роботи",
      employmentTypeDistribution: "Варіант зайнятості",
      contactMethodDistribution: "Бажаний спосіб зв'язку",
      experienceLevels: {
        no_experience: "Без досвіду",
        months_3: "3 міс",
        months_6: "6 міс",
        year_1: "1 рік",
        years_2: "2 роки",
        years_3: "3 роки",
        years_4: "4 роки",
        years_5: "5 років",
        years_6: "6 років",
        years_7: "7 років",
        years_8: "8 років",
        years_9: "9 років",
        years_10: "10 років",
        more_than_10_years: "> 10 років",
      },
      salaryRanges: {
        under_500: "до 500 $",
        "500_1000": "500 – 1000 $",
        "1000_2000": "1000 – 2000 $",
        "2000_3500": "2000 – 3500 $",
        "3500_5000": "3500 – 5000 $",
        "5000_plus": "5000 $ і більше",
        custom: "Інше",
      },
      workFormats: {
        remote: "Віддалено",
        hybrid: "Гібридно",
        office: "В офісі",
      },
      employmentTypes: {
        full_time: "Повна зайнятість",
        part_time: "Часткова зайнятість",
        contract: "Контракт",
        freelance: "Фриланс",
        internship: "Стажування",
      },
      contactMethods: {
        email: "Email",
        telegram: "Telegram",
        phone: "Телефон",
        linkedin: "LinkedIn",
        website: "Сайт",
      },
    };
  }

  return {
    publicProfiles: "Public profiles",
    creatorDirections: "Directions",
    creatorCountries: "Countries",
    creatorOrigins: "Talent geography",
    creatorDirectionsMix: "Direction distribution",
    profileReadiness: "Profile readiness",
    skillsUniverse: "Platform skill map",
    skillsDescription:
      "Profile skills and project technologies combined — the actual platform stack.",
    starter: "Starter",
    growing: "Growing",
    complete: "Strong",
    directionLabel: "Direction",
    ownerLabel: "Owner",
    likesLabel: "Likes",
    dislikesLabel: "Dislikes",
    editProfile: "Edit profile",
    manageProjects: "Manage projects",
    openSearch: "Search",
    savedItems: "Saved",
    followingAuthors: "Following",
    writeArticle: "Write article",
    createPoll: "Create poll",
    showMore: "Show more",
    showLess: "Collapse",
    experienceDistribution: "Experience level",
    salaryDistribution: "Salary expectations",
    salaryByCountry: "Average salary by country",
    salaryByCategory: "Average salary by direction",
    avgSalaryLabel: "~${avg} $",
    profilesCount: "{count} profiles",
    workFormatDistribution: "Preferred work format",
    employmentTypeDistribution: "Employment type",
    contactMethodDistribution: "Preferred contact method",
    experienceLevels: {
      no_experience: "No experience",
      months_3: "3 months",
      months_6: "6 months",
      year_1: "1 year",
      years_2: "2 years",
      years_3: "3 years",
      years_4: "4 years",
      years_5: "5 years",
      years_6: "6 years",
      years_7: "7 years",
      years_8: "8 years",
      years_9: "9 years",
      years_10: "10 years",
      more_than_10_years: "More than 10 years",
    },
    salaryRanges: {
      under_500: "under $500",
      "500_1000": "$500 – 1000",
      "1000_2000": "$1000 – 2000",
      "2000_3500": "$2000 – 3500",
      "3500_5000": "$3500 – 5000",
      "5000_plus": "$5000 and above",
      custom: "Other",
    },
    workFormats: {
      remote: "Remote",
      hybrid: "Hybrid",
      office: "Office",
    },
    employmentTypes: {
      full_time: "Full-time",
      part_time: "Part-time",
      contract: "Contract",
      freelance: "Freelance",
      internship: "Internship",
    },
    contactMethods: {
      email: "Email",
      telegram: "Telegram",
      phone: "Phone",
      linkedin: "LinkedIn",
      website: "Website",
    },
  };
}

/* ─── Small reusable pieces ─── */
