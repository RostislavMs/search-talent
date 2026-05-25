"use client";

import { useEffect, useMemo, useState } from "react";
import CreatorCard from "@/components/creator-card";
import ProjectCard from "@/components/project-card";
import {
  CreatorCardGridSkeleton,
  ProjectCardGridSkeleton,
} from "@/components/skeletons/card-skeletons";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import SearchSelect from "@/components/ui/search-select";
import TagSelect from "@/components/ui/tag-select";
import FormSelect from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { ProfileCategory } from "@/lib/profile-categories";
import {
  employmentTypes,
  experienceLevels,
  workFormats,
  type EmploymentType,
  type ExperienceLevel,
  type WorkFormat,
} from "@/lib/profile-sections";
import { projectStatuses, type ProjectStatus } from "@/lib/projects";

export type DiscoveryMode = "projects" | "creators";

type MetaOption = {
  id: number;
  name: string;
};

type SearchProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  score: number | null;
  cover_url: string | null;
  project_status: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  technologies: Array<{ id: number; name: string }>;
  mediaCount: number;
};

type SearchUser = {
  id: string;
  username: string;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
  countryName: string | null;
  city: string | null;
  categoryName: string | null;
  technologies: Array<{ id: number; name: string }>;
};

type SearchResponse = {
  projects: SearchProject[];
  users: SearchUser[];
  totals: {
    projects: number;
    users: number;
  };
};

type Sort = "relevance" | "rating" | "newest";

type DiscoveryPageProps = {
  mode: DiscoveryMode;
  initialCategoryId?: number | null;
};

type DiscoveryCopy = {
  common: {
    filters: string;
    resetFilters: string;
    sortBy: string;
    sortRelevance: string;
    sortRating: string;
    sortNewest: string;
    filterCountry: string;
    anyCountry: string;
    filterSkills: string;
    anySkill: string;
    filterCategory: string;
    anyCategory: string;
    filterProjectStatus: string;
    anyStatus: string;
    onlyWithMedia: string;
    filterRating: string;
    ratingFrom: string;
    ratingTo: string;
    saveSearch: string;
    saveSearchPlaceholder: string;
    savedSearches: string;
    noSavedSearches: string;
    resultsSummary: string;
    activeFilters: string;
    queryLabel: string;
    mediaCount: string;
    loading: string;
    searchFailed: string;
    saveSearchFailed: string;
    projectsMatched: string;
    creatorsMatched: string;
  };
  modes: Record<
    DiscoveryMode,
    {
      eyebrow: string;
      title: string;
      description: string;
      placeholder: string;
      secondaryHref: string;
      secondaryLabel: string;
      summaryDescription: string;
      resultsDescription: string;
      emptyMessage: string;
      heroCards: Array<{
        title: string;
        description: string;
      }>;
    }
  >;
};

function getStatusLabel(
  status: string | null,
  dictionary: ReturnType<typeof useDictionary>,
  anyStatusLabel: string,
) {
  switch (status as ProjectStatus | null) {
    case "planning":
      return dictionary.forms.projectStatusPlanning;
    case "in_progress":
      return dictionary.forms.projectStatusInProgress;
    case "completed":
      return dictionary.forms.projectStatusCompleted;
    case "on_hold":
      return dictionary.forms.projectStatusOnHold;
    default:
      return anyStatusLabel;
  }
}

function DiscoveryModeLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <LocalizedLink
      href={href}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-white text-slate-950"
          : "border border-white/15 bg-white/10 text-white/82 hover:bg-white/16 hover:text-white",
      ].join(" ")}
    >
      {label}
    </LocalizedLink>
  );
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

function getExperienceLevelLabel(value: ExperienceLevel, locale: Locale) {
  if (locale === "uk") {
    const labels: Record<ExperienceLevel, string> = {
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
    };

    return labels[value];
  }

  const labels: Record<ExperienceLevel, string> = {
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
    more_than_10_years: "10+ years",
  };

  return labels[value];
}

function getDiscoveryCopy(locale: Locale): DiscoveryCopy {
  if (locale === "uk") {
    return {
      common: {
        filters: "Фільтри",
        resetFilters: "Скинути",
        sortBy: "Сортування",
        sortRelevance: "За релевантністю",
        sortRating: "За рейтингом",
        sortNewest: "Найновіші",
        filterCountry: "Країна",
        anyCountry: "Будь-яка країна",
        filterSkills: "Навички",
        anySkill: "Будь-яка навичка",
        filterCategory: "Напрямок",
        anyCategory: "Будь-який напрямок",
        filterProjectStatus: "Статус проєкту",
        anyStatus: "Будь-який статус",
        onlyWithMedia: "Лише з медіа",
        filterRating: "Рейтинг",
        ratingFrom: "Від",
        ratingTo: "До",
        saveSearch: "Зберегти пошук",
        saveSearchPlaceholder: "Назва пошуку…",
        savedSearches: "Збережені пошуки",
        noSavedSearches: "У вас ще немає збережених пошуків.",
        resultsSummary: "Зведення пошуку",
        activeFilters: "Активні фільтри",
        queryLabel: "Запит",
        mediaCount: "Медіа",
        loading: "Оновлення результатів...",
        searchFailed: "Зараз не вдалося завантажити результати пошуку.",
        saveSearchFailed: "Не вдалося зберегти пошук. Спробуйте ще раз.",
        projectsMatched: "Знайдено проєктів",
        creatorsMatched: "Знайдено талантів",
      },
      modes: {
        projects: {
          eyebrow: "Каталог портфоліо",
          title: "Портфоліо та Реальні IT-Проєкти — Каталог для Натхнення",
          description:
            "Досліджуйте каталог фріланс-портфоліо з реальними IT-проєктами: шукайте за стеком, статусом і темою, щоб знайти натхнення чи відкрити нових авторів.",
          placeholder: "Шукайте проєкти, технології або авторів...",
          secondaryHref: "/talents",
          secondaryLabel: "Шукати таланти",
          summaryDescription:
            "Звужуйте список за стеком, статусом і наявністю медіа, щоб швидше знаходити потрібні роботи.",
          resultsDescription:
            "Тут відображаються лише публічні проєкти, тому шукати й переглядати каталог однаково просто.",
          emptyMessage:
            "Нічого не знайшлося. Спробуйте інший запит або послабте фільтри.",
          heroCards: [
            {
              title: "Пошук за назвою або стеком",
              description:
                "Шукайте за назвою, описом або технологіями, щоб швидко знаходити релевантні роботи.",
            },
            {
              title: "Фільтр за статусом і медіа",
              description:
                "Залишайте у видачі проєкти з потрібним статусом і достатньою кількістю матеріалів.",
            },
            {
              title: "Перехід до автора",
              description:
                "Якщо проєкт зацікавив, одразу переходьте до профілю автора.",
            },
          ],
        },
        creators: {
          eyebrow: "Профілі талантів",
          title: "Пошук Талантів — Профілі Розробників, Дизайнерів та IT-Фахівців",
          description:
            "Переглядайте публічні профілі та портфоліо IT-спеціалістів. Відбирайте авторів за навичками, локацією, досвідом і напрямком роботи — без зайвих проєктних результатів.",
          placeholder: "Шукайте таланти, ролі або навички...",
          secondaryHref: "/projects",
          secondaryLabel: "Шукати проєкти",
          summaryDescription:
            "Комбінуйте фільтри профілю, щоб швидко зібрати короткий список релевантних людей.",
          resultsDescription:
            "Тут відображаються лише профілі, тому ніщо не відволікає від пошуку людей.",
          emptyMessage:
            "Нічого не знайшлося. Спробуйте інший запит або зменшіть кількість фільтрів.",
          heroCards: [
            {
              title: "Пошук за роллю або навичками",
              description:
                "Вкажіть роль, спеціалізацію або ключову технологію й одразу звузьте видачу.",
            },
            {
              title: "Локація й напрямок",
              description:
                "Фільтруйте за країною, напрямком і форматом роботи, коли важливий контекст співпраці.",
            },
            {
              title: "Швидкий перехід у профіль",
              description:
                "Відкривайте профіль, щоб одразу оцінити навички, досвід і пов'язані проєкти.",
            },
          ],
        },
      },
    };
  }

  return {
    common: {
      filters: "Filters",
      resetFilters: "Reset",
      sortBy: "Sort by",
      sortRelevance: "Relevance",
      sortRating: "Rating",
      sortNewest: "Newest",
      filterCountry: "Country",
      anyCountry: "Any country",
      filterSkills: "Skills",
      anySkill: "Any skill",
      filterCategory: "Direction",
      anyCategory: "Any direction",
      filterProjectStatus: "Project status",
      anyStatus: "Any status",
      onlyWithMedia: "Only with media",
      filterRating: "Rating",
      ratingFrom: "From",
      ratingTo: "To",
      saveSearch: "Save search",
      saveSearchPlaceholder: "Search name…",
      savedSearches: "Saved searches",
      noSavedSearches: "You have no saved searches yet.",
      resultsSummary: "Search summary",
      activeFilters: "Active filters",
      queryLabel: "Query",
      mediaCount: "Media",
      loading: "Refreshing results...",
      searchFailed: "Could not load search results right now.",
      saveSearchFailed: "Could not save this search right now. Please try again.",
      projectsMatched: "Projects found",
      creatorsMatched: "Talents found",
    },
    modes: {
      projects: {
        eyebrow: "Portfolio catalog",
        title: "Creative Portfolios & Real IT Projects — Explore the Catalog",
        description:
          "Browse a catalog of creative portfolios and real IT projects. Search by stack, status, or topic to find inspiring work and discover new creators — no profile noise in the results.",
        placeholder: "Search projects, technologies, or authors...",
        secondaryHref: "/talents",
        secondaryLabel: "Search talents",
        summaryDescription:
          "Narrow the list by stack, status, and media so the right projects surface faster.",
        resultsDescription:
          "Only public projects appear here, so searching and browsing the catalog feel like one continuous flow.",
        emptyMessage:
          "No matching projects yet. Try another keyword or relax the filters.",
        heroCards: [
          {
            title: "Search by title or stack",
            description:
              "Search by title, description, or technology tags to find relevant work faster.",
          },
          {
            title: "Filter by status and media",
            description:
              "Keep projects with the right status and enough supporting media in view.",
          },
          {
            title: "Open creator context",
            description:
              "Jump from a project page to the author's profile whenever you need more context.",
          },
        ],
      },
      creators: {
        eyebrow: "Talent profiles",
        title: "Discover IT Talent — Developer, Designer & Specialist Profiles",
        description:
          "Explore public profiles and portfolios of IT specialists. Filter by skills, location, experience, and work format to discover the right creators — no project noise in the results.",
        placeholder: "Search talents, roles, or skills...",
        secondaryHref: "/projects",
        secondaryLabel: "Search projects",
        summaryDescription:
          "Combine profile filters to build a strong shortlist faster.",
        resultsDescription:
          "Only profile cards appear here, so nothing distracts from finding the right people.",
        emptyMessage:
          "No matching talents yet. Try another keyword or reduce the filters.",
        heroCards: [
          {
            title: "Search by role or skill",
            description:
              "Type a role, specialty, or core technology and narrow the list quickly.",
          },
          {
            title: "Filter by location and direction",
            description:
              "Filter by country, category, and work format when collaboration context matters.",
          },
          {
            title: "Open the public profile",
            description:
              "Open a profile to review skills, experience, and linked projects in one place.",
          },
        ],
      },
    },
  };
}

export default function DiscoveryPage({
  mode,
  initialCategoryId = null,
}: DiscoveryPageProps) {
  const dictionary = useDictionary();
  const toast = useToast();
  const locale = useCurrentLocale();
  const copy = useMemo(() => getDiscoveryCopy(locale), [locale]);
  const pageUi = copy.modes[mode];
  const commonUi = copy.common;
  const scope = mode;
  const [meta, setMeta] = useState<{
    countries: MetaOption[];
    languages: MetaOption[];
    skills: MetaOption[];
    categories: ProfileCategory[];
  }>({
    countries: [],
    languages: [],
    skills: [],
    categories: [],
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [countryId, setCountryId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId);
  const [languageIds, setLanguageIds] = useState<number[]>([]);
  const [skillIds, setSkillIds] = useState<number[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">(
    "",
  );
  const [employmentTypeFilters, setEmploymentTypeFilters] = useState<
    EmploymentType[]
  >([]);
  const [workFormatFilters, setWorkFormatFilters] = useState<WorkFormat[]>([]);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | "">("");
  const [hasMedia, setHasMedia] = useState(false);
  const [hasAvatar, setHasAvatar] = useState(false);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [maxScore, setMaxScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<
    Array<{ id: string; name: string; mode: string; params: Record<string, unknown>; created_at: string }>
  >([]);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [totals, setTotals] = useState({
    projects: 0,
    users: 0,
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = mobileFiltersOpen ? "hidden" : previous;
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileFiltersOpen]);

  useEffect(() => {
    async function loadMeta() {
      const result = await apiFetch<{
        countries?: MetaOption[];
        languages?: MetaOption[];
        skills?: MetaOption[];
        categories?: ProfileCategory[];
      }>("/api/meta");

      if (!result.ok) {
        return;
      }

      setMeta({
        countries: result.data.countries || [],
        languages: result.data.languages || [],
        skills: result.data.skills || [],
        categories: result.data.categories || [],
      });
    }

    loadMeta();
  }, []);

  useEffect(() => {
    async function loadSavedSearches() {
      const result = await apiFetch<{ searches?: unknown[] }>(
        "/api/saved-searches",
      );

      // ignore failure — user might not be authenticated
      if (result.ok) {
        setSavedSearches(
          (result.data.searches as typeof savedSearches) || [],
        );
      }
    }

    loadSavedSearches();
  }, []);

  const saveCurrentSearch = async () => {
    if (!saveSearchName.trim()) return;
    setSavingSearch(true);

    const params: Record<string, unknown> = {};
    if (query.trim()) params.query = query.trim();
    if (sort !== "relevance") params.sort = sort;
    if (countryId) params.countryId = countryId;
    if (categoryId) params.categoryId = categoryId;
    if (skillIds.length > 0) params.skillIds = skillIds;
    if (languageIds.length > 0) params.languageIds = languageIds;
    if (experienceLevel) params.experienceLevel = experienceLevel;
    if (employmentTypeFilters.length > 0) params.employmentTypes = employmentTypeFilters;
    if (workFormatFilters.length > 0) params.workFormats = workFormatFilters;
    if (projectStatus) params.projectStatus = projectStatus;
    if (hasMedia) params.hasMedia = true;
    if (hasAvatar) params.hasAvatar = true;
    if (minScore !== null) params.minScore = minScore;
    if (maxScore !== null) params.maxScore = maxScore;

    const result = await apiFetch<{ search: unknown }>("/api/saved-searches", {
      method: "POST",
      body: { name: saveSearchName.trim(), mode, params },
    });

    setSavingSearch(false);

    if (!result.ok) {
      toast.error(result.error || commonUi.saveSearchFailed);
      return;
    }

    setSavedSearches((prev) => [
      result.data.search as (typeof prev)[number],
      ...prev,
    ]);
    setSaveSearchName("");
    setShowSaveForm(false);
  };

  const deleteSavedSearch = async (id: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    await apiFetch(`/api/saved-searches?id=${id}`, { method: "DELETE" });
  };

  const applySavedSearch = (params: Record<string, unknown>) => {
    setQuery((params.query as string) || "");
    setSort((params.sort as Sort) || "relevance");
    setCountryId((params.countryId as number) || null);
    setCategoryId((params.categoryId as number) || null);
    setSkillIds((params.skillIds as number[]) || []);
    setLanguageIds((params.languageIds as number[]) || []);
    setExperienceLevel((params.experienceLevel as ExperienceLevel | "") || "");
    setEmploymentTypeFilters((params.employmentTypes as EmploymentType[]) || []);
    setWorkFormatFilters((params.workFormats as WorkFormat[]) || []);
    setProjectStatus((params.projectStatus as ProjectStatus | "") || "");
    setHasMedia(Boolean(params.hasMedia));
    setHasAvatar(Boolean(params.hasAvatar));
    setMinScore((params.minScore as number) ?? null);
    setMaxScore((params.maxScore as number) ?? null);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setErrorMessage(null);

        const params = new URLSearchParams();

        if (query.trim()) {
          params.set("q", query.trim());
        }

        params.set("scope", scope);
        params.set("sort", sort);

        if (countryId && mode === "creators") {
          params.set("countryId", String(countryId));
        }

        if (categoryId && mode === "creators") {
          params.set("categoryId", String(categoryId));
        }

        if (skillIds.length > 0) {
          params.set("skillIds", skillIds.join(","));
        }

        if (languageIds.length > 0 && mode === "creators") {
          params.set("languageIds", languageIds.join(","));
        }

        if (experienceLevel && mode === "creators") {
          params.set("experienceLevel", experienceLevel);
        }

        if (employmentTypeFilters.length > 0 && mode === "creators") {
          params.set("employmentTypes", employmentTypeFilters.join(","));
        }

        if (workFormatFilters.length > 0 && mode === "creators") {
          params.set("workFormats", workFormatFilters.join(","));
        }

        if (projectStatus && mode === "projects") {
          params.set("projectStatus", projectStatus);
        }

        if (hasMedia && mode === "projects") {
          params.set("hasMedia", "1");
        }

        if (hasAvatar && mode === "creators") {
          params.set("hasAvatar", "1");
        }

        if (minScore !== null) {
          params.set("minScore", String(minScore));
        }

        if (maxScore !== null) {
          params.set("maxScore", String(maxScore));
        }

        const result = await apiFetch<SearchResponse>(
          `/api/search?${params.toString()}`,
        );

        if (!result.ok) {
          setProjects([]);
          setUsers([]);
          setTotals({ projects: 0, users: 0 });
          setErrorMessage(result.error || commonUi.searchFailed);
          setLoading(false);
          setInitialLoading(false);
          return;
        }

        setProjects(result.data.projects || []);
        setUsers(result.data.users || []);
        setTotals({
          projects: result.data.totals?.projects || 0,
          users: result.data.totals?.users || 0,
        });
        setLoading(false);
        setInitialLoading(false);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    categoryId,
    commonUi.searchFailed,
    countryId,
    employmentTypeFilters,
    experienceLevel,
    hasAvatar,
    hasMedia,
    languageIds,
    maxScore,
    minScore,
    mode,
    projectStatus,
    query,
    scope,
    skillIds,
    sort,
    workFormatFilters,
  ]);

  const hasFilters =
    Boolean(query.trim()) ||
    Boolean(countryId) ||
    Boolean(categoryId) ||
    Boolean(experienceLevel) ||
    Boolean(projectStatus) ||
    hasAvatar ||
    hasMedia ||
    languageIds.length > 0 ||
    employmentTypeFilters.length > 0 ||
    skillIds.length > 0 ||
    workFormatFilters.length > 0 ||
    minScore !== null ||
    maxScore !== null ||
    sort !== "relevance";
  const selectedCountryName =
    meta.countries.find((country) => country.id === countryId)?.name || null;
  const selectedCategoryLabel =
    meta.categories.find((option) => option.id === categoryId)?.name || null;
  const avatarFilterLabel = locale === "uk" ? "Лише з фото" : "Only with photo";
  const anyExperienceLabel =
    locale === "uk" ? "Будь-який досвід" : "Any experience";
  const activeFilterItems: Array<{ key: string; label: string; remove: () => void }> = [
    query.trim()
      ? { key: "query", label: `${commonUi.queryLabel}: ${query.trim()}`, remove: () => setQuery("") }
      : null,
    sort !== "relevance"
      ? { key: "sort", label: sort === "rating" ? commonUi.sortRating : commonUi.sortNewest, remove: () => setSort("relevance") }
      : null,
    mode === "creators" && selectedCountryName
      ? { key: "country", label: `${commonUi.filterCountry}: ${selectedCountryName}`, remove: () => setCountryId(null) }
      : null,
    mode === "creators" && selectedCategoryLabel
      ? { key: "category", label: `${commonUi.filterCategory}: ${selectedCategoryLabel}`, remove: () => setCategoryId(null) }
      : null,
    mode === "creators" && experienceLevel
      ? { key: "experience", label: `${dictionary.forms.totalExperienceYears}: ${getExperienceLevelLabel(experienceLevel, locale)}`, remove: () => setExperienceLevel("") }
      : null,
    mode === "projects" && projectStatus
      ? { key: "status", label: `${commonUi.filterProjectStatus}: ${getStatusLabel(projectStatus, dictionary, commonUi.anyStatus)}`, remove: () => setProjectStatus("") }
      : null,
    mode === "creators" && hasAvatar
      ? { key: "avatar", label: avatarFilterLabel, remove: () => setHasAvatar(false) }
      : null,
    mode === "projects" && hasMedia
      ? { key: "media", label: commonUi.onlyWithMedia, remove: () => setHasMedia(false) }
      : null,
    minScore !== null || maxScore !== null
      ? { key: "score", label: `${commonUi.filterRating}: ${minScore ?? 0}–${maxScore ?? 100}`, remove: () => { setMinScore(null); setMaxScore(null); } }
      : null,
    ...meta.languages
      .filter((language) => languageIds.includes(language.id))
      .map((language) => ({
        key: `lang-${language.id}`,
        label: `${dictionary.forms.languages}: ${language.name}`,
        remove: () => setLanguageIds((prev) => prev.filter((id) => id !== language.id)),
      })),
    ...meta.skills
      .filter((skill) => skillIds.includes(skill.id))
      .map((skill) => ({
        key: `skill-${skill.id}`,
        label: `${commonUi.filterSkills}: ${skill.name}`,
        remove: () => setSkillIds((prev) => prev.filter((id) => id !== skill.id)),
      })),
    ...employmentTypeFilters.map((item) => ({
      key: `emp-${item}`,
      label: `${dictionary.forms.employmentTypes}: ${getEmploymentTypeLabel(item, dictionary)}`,
      remove: () => setEmploymentTypeFilters((prev) => prev.filter((et) => et !== item)),
    })),
    ...workFormatFilters.map((item) => ({
      key: `wf-${item}`,
      label: `${dictionary.forms.workFormats}: ${getWorkFormatLabel(item, dictionary)}`,
      remove: () => setWorkFormatFilters((prev) => prev.filter((wf) => wf !== item)),
    })),
  ].filter(Boolean) as Array<{ key: string; label: string; remove: () => void }>;
  const talentsLabel = locale === "uk" ? "Таланти" : "Talents";
  const resultCount = mode === "projects" ? totals.projects : totals.users;
  const resultLabel =
    mode === "projects" ? commonUi.projectsMatched : commonUi.creatorsMatched;

  const resetFilters = () => {
    setQuery("");
    setSort("relevance");
    setCountryId(null);
    setCategoryId(null);
    setLanguageIds([]);
    setSkillIds([]);
    setExperienceLevel("");
    setEmploymentTypeFilters([]);
    setWorkFormatFilters([]);
    setProjectStatus("");
    setHasAvatar(false);
    setHasMedia(false);
    setMinScore(null);
    setMaxScore(null);
  };

  return (
    <section>
      <section className="rounded-2xl border app-border bg-[linear-gradient(145deg,_rgba(15,23,42,0.97),_rgba(30,64,175,0.9)_58%,_rgba(245,158,11,0.72))] p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:rounded-[2.25rem] sm:p-8 md:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70 sm:text-sm">
              {pageUi.eyebrow}
            </p>
            <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl md:text-4xl">
              {pageUi.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/78 sm:mt-4 sm:text-base sm:leading-8">
              {pageUi.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <ButtonLink
              href="/dashboard"
              variant="ghost"
              className="border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
            >
              {dictionary.search.dashboard}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-white/10 p-3 backdrop-blur sm:mt-8 sm:rounded-[1.75rem] sm:p-4">
          <div className="flex flex-wrap gap-2">
            <DiscoveryModeLink
              active={mode === "projects"}
              href="/projects"
              label={dictionary.common.projects}
            />
            <DiscoveryModeLink
              active={mode === "creators"}
              href="/talents"
              label={talentsLabel}
            />
          </div>

          <input
            type="text"
            placeholder={pageUi.placeholder}
            className="mt-3 w-full rounded-xl border border-white/15 bg-white/90 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-900 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {!hasFilters && (
          <div className="mt-5 hidden gap-4 sm:mt-8 md:grid md:grid-cols-3">
            {pageUi.heroCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.5rem] border border-white/12 bg-white/10 p-5 backdrop-blur"
              >
                <p className="font-semibold text-white">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 xl:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
          aria-expanded={mobileFiltersOpen}
          aria-controls="discovery-filters-drawer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>{commonUi.filters}</span>
          {activeFilterItems.length > 0 ? (
            <span className="rounded-full bg-[color:var(--foreground)] px-2 py-0.5 text-xs font-semibold text-[color:var(--background)]">
              {activeFilterItems.length}
            </span>
          ) : null}
        </button>
        <span className="text-sm app-muted">
          {resultCount} {dictionary.search.results}
        </span>
      </div>

      <section className="mt-5 grid gap-8 sm:mt-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside
          id="discovery-filters-drawer"
          className={[
            "space-y-4 xl:block xl:sticky xl:top-24 xl:self-start xl:bg-transparent xl:p-0 xl:backdrop-blur-none",
            mobileFiltersOpen
              ? "fixed inset-0 z-50 overflow-y-auto bg-[color:var(--background)]/95 px-4 pb-10 pt-4 backdrop-blur-md"
              : "hidden",
          ].join(" ")}
          {...(mobileFiltersOpen
            ? ({ role: "dialog", "aria-modal": true } as const)
            : {})}
        >
          {mobileFiltersOpen && (
            <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center justify-between border-b app-border bg-[color:var(--background)]/95 px-4 py-3 backdrop-blur xl:hidden">
              <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                {commonUi.filters}
              </h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label={locale === "uk" ? "Закрити фільтри" : "Close filters"}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
          <section className="rounded-[2rem] app-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                {commonUi.filters}
              </h2>
              <button
                type="button"
                onClick={resetFilters}
                className="cursor-pointer text-sm app-muted transition hover:text-[color:var(--foreground)]"
              >
                {commonUi.resetFilters}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                  {commonUi.sortBy}
                </p>
                <FormSelect
                  className="w-full"
                  triggerClassName="w-full"
                  value={sort}
                  onChange={(value) => setSort(value as Sort)}
                  options={[
                    { value: "relevance", label: commonUi.sortRelevance },
                    { value: "rating", label: commonUi.sortRating },
                    { value: "newest", label: commonUi.sortNewest },
                  ]}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                  {commonUi.filterRating}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={commonUi.ratingFrom}
                    value={minScore ?? ""}
                    onChange={(event) =>
                      setMinScore(
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                    className="w-full rounded-xl border app-border bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                  />
                  <span className="text-sm app-muted">—</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={commonUi.ratingTo}
                    value={maxScore ?? ""}
                    onChange={(event) =>
                      setMaxScore(
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                    className="w-full rounded-xl border app-border bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                  />
                </div>
              </div>

              {mode === "creators" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                    {commonUi.filterCountry}
                  </p>
                  <SearchSelect
                    options={meta.countries}
                    value={countryId ?? undefined}
                    placeholder={commonUi.anyCountry}
                    onChange={(value) => setCountryId(value)}
                  />
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                  {commonUi.filterSkills}
                </p>
                <TagSelect
                  options={meta.skills}
                  value={skillIds}
                  placeholder={commonUi.anySkill}
                  onChange={(values) => setSkillIds(values.map(Number))}
                />
              </div>

              {mode === "creators" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                    {dictionary.forms.languages}
                  </p>
                  <TagSelect
                    options={meta.languages}
                    value={languageIds}
                    placeholder={dictionary.forms.searchLanguages}
                    onChange={(values) => setLanguageIds(values.map(Number))}
                  />
                </div>
              )}

              {mode === "creators" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                    {commonUi.filterCategory}
                  </p>
                  <FormSelect
                    className="w-full"
                    triggerClassName="w-full"
                    value={categoryId ? String(categoryId) : ""}
                    placeholder={commonUi.anyCategory}
                    onChange={(value) =>
                      setCategoryId(value ? Number(value) : null)
                    }
                    options={meta.categories.map((option) => ({
                      value: String(option.id),
                      label: option.name,
                    }))}
                  />
                </div>
              )}

              {mode === "creators" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                    {dictionary.forms.totalExperienceYears}
                  </p>
                  <FormSelect
                    className="w-full"
                    triggerClassName="w-full"
                    value={experienceLevel}
                    placeholder={anyExperienceLabel}
                    onChange={(value) =>
                      setExperienceLevel(value as ExperienceLevel | "")
                    }
                    options={experienceLevels.map((option) => ({
                      value: option,
                      label: getExperienceLevelLabel(option, locale),
                    }))}
                  />
                </div>
              )}

              {mode === "creators" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                    {dictionary.forms.employmentTypes}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {employmentTypes.map((option) => {
                      const selected = employmentTypeFilters.includes(option);

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setEmploymentTypeFilters((current) =>
                              selected
                                ? current.filter((item) => item !== option)
                                : [...current, option],
                            )
                          }
                          className={[
                            "cursor-pointer rounded-full border px-3 py-2 text-sm transition-colors",
                            selected
                              ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                              : "app-border bg-[color:var(--surface)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
                          ].join(" ")}
                        >
                          {getEmploymentTypeLabel(option, dictionary)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === "creators" && (
                <div>
                  <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                    {dictionary.forms.workFormats}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {workFormats.map((option) => {
                      const selected = workFormatFilters.includes(option);

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setWorkFormatFilters((current) =>
                              selected
                                ? current.filter((item) => item !== option)
                                : [...current, option],
                            )
                          }
                          className={[
                            "cursor-pointer rounded-full border px-3 py-2 text-sm transition-colors",
                            selected
                              ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                              : "app-border bg-[color:var(--surface)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
                          ].join(" ")}
                        >
                          {getWorkFormatLabel(option, dictionary)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === "creators" && (
                <label className="flex items-center justify-between gap-3 rounded-2xl border app-border bg-[color:var(--surface)] px-4 py-3">
                  <span className="text-sm font-medium text-[color:var(--foreground)]">
                    {avatarFilterLabel}
                  </span>
                  <input
                    type="checkbox"
                    checked={hasAvatar}
                    onChange={(event) => setHasAvatar(event.target.checked)}
                    className="app-checkbox"
                  />
                </label>
              )}

              {mode === "projects" && (
                <>
                  <div>
                    <p className="mb-2 text-sm font-medium text-[color:var(--foreground)]">
                      {commonUi.filterProjectStatus}
                    </p>
                    <FormSelect
                      className="w-full"
                      triggerClassName="w-full"
                      value={projectStatus}
                      placeholder={commonUi.anyStatus}
                      onChange={(value) =>
                        setProjectStatus(value as ProjectStatus | "")
                      }
                      options={projectStatuses.map((status) => ({
                        value: status,
                        label: getStatusLabel(
                          status,
                          dictionary,
                          commonUi.anyStatus,
                        ),
                      }))}
                    />
                  </div>

                  <label className="flex items-center justify-between gap-3 rounded-2xl border app-border bg-[color:var(--surface)] px-4 py-3">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">
                      {commonUi.onlyWithMedia}
                    </span>
                    <input
                      type="checkbox"
                      checked={hasMedia}
                      onChange={(event) => setHasMedia(event.target.checked)}
                      className="app-checkbox"
                    />
                  </label>
                </>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] app-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] app-soft">
                {commonUi.savedSearches}
              </h2>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => setShowSaveForm((v) => !v)}
                  className="cursor-pointer text-sm font-medium text-[color:var(--foreground)] transition hover:opacity-70"
                >
                  + {commonUi.saveSearch}
                </button>
              )}
            </div>

            {showSaveForm && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder={commonUi.saveSearchPlaceholder}
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCurrentSearch();
                  }}
                  className="w-full rounded-xl border app-border bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                />
                <button
                  type="button"
                  disabled={savingSearch || !saveSearchName.trim()}
                  onClick={saveCurrentSearch}
                  className="shrink-0 cursor-pointer rounded-xl bg-[color:var(--foreground)] px-3 py-2 text-sm font-medium text-[color:var(--background)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            )}

            <div className="mt-3 space-y-1.5">
              {savedSearches.filter((s) => s.mode === mode).length === 0 ? (
                <p className="text-sm app-muted">{commonUi.noSavedSearches}</p>
              ) : (
                savedSearches
                  .filter((s) => s.mode === mode)
                  .map((search) => (
                    <div
                      key={search.id}
                      className="group flex items-center justify-between gap-2 rounded-xl app-panel px-3 py-2 transition hover:bg-[color:var(--surface-muted)]"
                    >
                      <button
                        type="button"
                        onClick={() => applySavedSearch(search.params)}
                        className="min-w-0 cursor-pointer truncate text-left text-sm font-medium text-[color:var(--foreground)]"
                      >
                        {search.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedSearch(search.id)}
                        className="shrink-0 cursor-pointer text-sm app-muted opacity-0 transition hover:text-red-500 group-hover:opacity-100 group-focus-within:opacity-100"
                        aria-label="Delete"
                      >
                        &times;
                      </button>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] app-card p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] app-soft">
              {commonUi.resultsSummary}
            </p>
            <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
              {resultCount}
            </p>
            <p className="mt-2 text-sm leading-6 app-muted">
              {loading ? commonUi.loading : pageUi.summaryDescription}
            </p>

            <div className="mt-5 rounded-[1.5rem] app-panel px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                {resultLabel}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {resultCount}
              </p>
            </div>
          </section>
        </aside>

        <div className="space-y-8">
          {activeFilterItems.length > 0 && (
            <section className="rounded-[2rem] app-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                    {commonUi.activeFilters}
                  </h2>
                  <p className="mt-1 text-sm app-muted">
                    {pageUi.summaryDescription}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="cursor-pointer text-sm app-muted transition hover:text-[color:var(--foreground)]"
                >
                  {commonUi.resetFilters}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {activeFilterItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.remove}
                    className="group flex cursor-pointer items-center gap-1.5 rounded-full app-panel px-3 py-1 text-sm app-muted transition hover:bg-[color:var(--surface-muted)]"
                  >
                    {item.label}
                    <span className="text-xs opacity-50 transition group-hover:opacity-100">&times;</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {errorMessage && (
            <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              {errorMessage}
            </section>
          )}

          <section className="rounded-[2rem] app-card p-6 sm:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {mode === "projects"
                    ? dictionary.common.projects
                    : talentsLabel}
                </h2>
                <p className="mt-2 app-muted">{pageUi.resultsDescription}</p>
              </div>

              <span className="text-sm app-muted">
                {resultCount} {dictionary.search.results}
              </span>
            </div>

            {mode === "projects" ? (
              initialLoading || (loading && projects.length === 0) ? (
                <ProjectCardGridSkeleton />
              ) : projects.length > 0 ? (
                <div
                  className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
                  aria-busy={loading}
                >
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      dictionary={dictionary}
                      project={project}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-[1.75rem] app-panel-dashed p-6 text-sm app-muted">
                  {pageUi.emptyMessage}
                </p>
              )
            ) : initialLoading || (loading && users.length === 0) ? (
              <CreatorCardGridSkeleton />
            ) : users.length > 0 ? (
              <div
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                aria-busy={loading}
              >
                {users.map((creator) => (
                  <CreatorCard
                    key={creator.id}
                    dictionary={dictionary}
                    creator={{
                      username: creator.username,
                      name: creator.name,
                      headline: creator.headline,
                      avatar_url: creator.avatar_url,
                      categoryName: creator.categoryName,
                      countryName: creator.countryName,
                      city: creator.city,
                      technologies: creator.technologies,
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-[1.75rem] app-panel-dashed p-6 text-sm app-muted">
                {pageUi.emptyMessage}
              </p>
            )}
          </section>
        </div>
      </section>
    </section>
  );
}
