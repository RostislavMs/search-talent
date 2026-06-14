import { isPublicModerationStatus } from "@/lib/moderation";
import { listBadgesWithProgress } from "@/lib/db/badges";
import type { BadgeWithProgress } from "@/lib/constants/badges";
import {
  getProfileCompletenessBreakdown,
  type ProfileCompletenessBreakdown,
} from "@/lib/profile-completeness";
import { unstable_noStore as noStore } from "next/cache";
import {
  normalizeProjectMediaItem,
  type ProjectMediaItem,
} from "@/lib/project-media";
import { parseProjectPath } from "@/lib/projects";
import type { PollFeedItem } from "@/lib/polls";
import {
  type EmploymentType,
  type ExperienceLevel,
  type PreferredContactMethod,
  type ProfileVisibility,
  type WorkFormat,
} from "@/lib/profile-sections";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadAcceptedCoAuthorsMap,
  loadCoAuthoredContentIds,
} from "@/lib/db/co-authors";
import type { ContentAuthor } from "@/lib/co-authors";
import { getProfileVoteSummary } from "@/lib/db/profile-votes";
import { getProjectVoteSummary } from "@/lib/db/project-votes";
import { getCreatorRatings, getProjectRatings } from "@/lib/db/leaderboards";
import {
  normalizeProfileSettings,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import {
  RELATED_ITEMS_LIMIT,
  rankBySharedSkills,
  rankRelatedCreators,
  tallySharedSkills,
} from "@/lib/related";

function getRelationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null,
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }

  return relation?.name || null;
}

type PublicProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  description: string | null;
  role: string | null;
  kind: string | null;
  kind_metadata: Record<string, unknown> | null;
  score: number | null;
  cover_url: string | null;
  project_status: string | null;
  team_size: number | null;
  project_url: string | null;
  repository_url: string | null;
  started_on: string | null;
  completed_on: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  created_at: string | null;
  moderation_status: string | null;
  status: string | null;
  github_full_name: string | null;
  github_synced_at: string | null;
  github_stats: import("@/lib/constants/github").GithubProjectStats | null;
  tech_stack: string[] | null;
  github_readme: string | null;
  github_role: import("@/lib/constants/github").GithubProjectRole | null;
  github_contribution: string | null;
  github_motivation: string | null;
  github_tech_decisions: string | null;
  github_learnings: string | null;
  github_showcase_notes: string | null;
  github_production_usage: string | null;
  github_display_options:
    | Partial<import("@/lib/constants/github").GithubDisplayOptions>
    | null;
  github_auto_sync: boolean | null;
  allow_downloads: boolean | null;
};

type PublicProfileRow = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  country_id: number | null;
  city: string | null;
  category_id: number | null;
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
  salary_currency: string | null;
  additional_info: string | null;
  profile_visibility: unknown;
  moderation_status: string | null;
  email_verified: boolean;
};

export type PublicProjectPageData = {
  project: PublicProjectRow;
  owner: {
    id: string;
    userId: string;
    username: string | null;
    name: string | null;
    headline: string | null;
    avatarUrl: string | null;
    city: string | null;
    countryName: string | null;
  } | null;
  /** Accepted co-authors (excludes the owner). Empty for solo projects. */
  coAuthors: ContentAuthor[];
  technologies: Array<{ id: number; name: string }>;
  media: ProjectMediaItem[];
  voteSummary: Awaited<ReturnType<typeof getProjectVoteSummary>>;
  // Composite project rating (0-100) — same value as the homepage / search.
  // Null when the project is not ranked yet (falls back to net votes in the UI).
  rating: number | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isBookmarked: boolean;
};

export type PublicProfilePageData = {
  profile: PublicProfileRow & {
    visibility: ProfileVisibility;
    presentation: ProfilePresentation;
    countryName: string | null;
    categoryName: string | null;
  };
  technologies: Array<{ id: number; name: string }>;
  languages: Array<{ id: string; name: string; level: string | null }>;
  education: Array<{
    id: string;
    institution: string | null;
    degree: string | null;
    field_of_study: string | null;
    started_on: string | null;
    completed_on: string | null;
    description: string | null;
  }>;
  certificates: Array<{
    id: string;
    title: string | null;
    issuer: string | null;
    issued_on: string | null;
    credential_url: string | null;
    file_url: string | null;
    file_name: string | null;
  }>;
  qas: Array<{
    id: string;
    question: string | null;
    answer: string | null;
  }>;
  workExperience: Array<{
    id: string;
    company_name: string | null;
    position: string | null;
    started_year: number | null;
    ended_year: number | null;
    is_current: boolean | null;
    responsibilities: string | null;
  }>;
  projects: Array<{
    id: string;
    title: string;
    slug: string | null;
    description: string | null;
    score: number | null;
    cover_url: string | null;
    is_pinned: boolean | null;
  }>;
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    published_at: string | null;
    created_at: string | null;
  }>;
  badges: BadgeWithProgress[];
  completeness: ProfileCompletenessBreakdown;
  voteSummary: Awaited<ReturnType<typeof getProfileVoteSummary>>;
  // Composite creator rating (0-100) — the same value shown on the talents
  // cards and homepage leaderboard. Null when the profile is not ranked yet.
  profileRating: number | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
};

export async function getPublicProjectPageData(
  routeValue: string,
): Promise<PublicProjectPageData | null> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const parsedRoute = parseProjectPath(routeValue);

  let projectQuery = supabase
    .from("projects")
    .select(
      "id, owner_id, title, slug, description, role, kind, kind_metadata, score, cover_url, project_status, team_size, project_url, repository_url, started_on, completed_on, problem, solution, results, created_at, moderation_status, status, github_full_name, github_synced_at, github_stats, tech_stack, github_readme, github_role, github_contribution, github_motivation, github_tech_decisions, github_learnings, github_showcase_notes, github_production_usage, github_display_options, github_auto_sync, allow_downloads",
    )
    .limit(1);

  if (parsedRoute.id) {
    projectQuery = projectQuery.eq("id", parsedRoute.id);
  } else if (parsedRoute.slug) {
    projectQuery = projectQuery.eq("slug", parsedRoute.slug);
  } else {
    return null;
  }

  const { data: project } = await projectQuery.maybeSingle();

  if (!project) {
    return null;
  }

  const typedProject = project as PublicProjectRow;
  const isOwner = user?.id === typedProject.owner_id;

  let isAdmin = false;

  if (user && !isOwner) {
    const { data: adminRecord } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = Boolean(adminRecord);
  }

  if (
    !isOwner &&
    !isAdmin &&
    (!isPublicModerationStatus(typedProject.moderation_status) ||
      typedProject.status !== "published")
  ) {
    return null;
  }

  const [ownerResponse, skillsResponse, mediaResponse, voteSummary, bookmarkResponse] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, user_id, username, name, headline, avatar_url, city, country_id, countries ( name )",
        )
        .eq("user_id", typedProject.owner_id)
        .maybeSingle(),
      supabase
        .from("project_skills")
        .select(
          `
          skill_id,
          skills (
            name
          )
        `,
        )
        .eq("project_id", typedProject.id),
      supabase
        .from("project_media")
        .select(
          "id, project_id, owner_id, url, storage_path, file_name, mime_type, file_size, media_kind, sort_index, created_at",
        )
        .eq("project_id", typedProject.id)
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true }),
      getProjectVoteSummary(supabase, typedProject.id, user?.id),
      user
        ? supabase
            .from("bookmarks")
            .select("id")
            .eq("user_id", user.id)
            .eq("target_project_id", typedProject.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const owner = ownerResponse.data as
    | {
        id: string;
        user_id: string;
        username: string | null;
        name: string | null;
        headline: string | null;
        avatar_url: string | null;
        city: string | null;
        country_id: number | null;
        countries:
          | { name?: string | null }
          | Array<{ name?: string | null }>
          | null;
      }
    | null;
  // Country name is embedded via the profiles.country_id -> countries FK in the
  // owner select above, so no extra round-trip is needed here.
  const countryName = getRelationName(owner?.countries ?? null);

  // Composite rating shown on the homepage / search (votes + media + tech +
  // completeness + freshness), not the Wilson-only net votes. Shares the
  // leaderboard cache.
  const projectRatings = await getProjectRatings();

  const coAuthorsMap = await loadAcceptedCoAuthorsMap(supabase, "project", [
    typedProject.id,
  ]);

  return {
    project: typedProject,
    coAuthors: coAuthorsMap.get(typedProject.id) ?? [],
    owner: owner
      ? {
          id: owner.id,
          userId: owner.user_id,
          username: owner.username || null,
          name: owner.name || null,
          headline: owner.headline || null,
          avatarUrl: owner.avatar_url || null,
          city: owner.city || null,
          countryName,
        }
      : null,
    technologies: ((skillsResponse.data || []) as Array<{
      skill_id: number;
      skills: { name?: string | null } | Array<{ name?: string | null }> | null;
    }>)
      .map((relation) => {
        const name = getRelationName(relation.skills);

        if (!name) {
          return null;
        }

        return {
          id: relation.skill_id,
          name,
        };
      })
      .filter((item): item is { id: number; name: string } => Boolean(item)),
    media: ((mediaResponse.data || []) as ProjectMediaItem[]).map((item) =>
      normalizeProjectMediaItem(item),
    ),
    voteSummary,
    rating: projectRatings[typedProject.id] ?? null,
    isAuthenticated: Boolean(user),
    isOwner,
    isBookmarked: Boolean(bookmarkResponse.data),
  };
}

export async function getPublicProfilePageData(
  username: string,
): Promise<PublicProfilePageData | null> {
  noStore();
  const supabase = await createClient();
  const dataClient = createAdminClient() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, user_id, username, name, headline, bio, avatar_url, cover_url, country_id, city, category_id, website, github, twitter, linkedin, behance, dribbble, artstation, vimeo, youtube, instagram, contact_email, telegram_username, phone, preferred_contact_method, experience_level, experience_years, employment_types, work_formats, salary_expectations, salary_currency, additional_info, profile_visibility, moderation_status, email_verified",
    )
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const typedProfile = profile as PublicProfileRow;
  const isOwner = user?.id === typedProfile.user_id;

  let isAdmin = false;

  if (user && !isOwner) {
    const { data: adminRecord } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = Boolean(adminRecord);
  }

  if (!isOwner && !isAdmin && !isPublicModerationStatus(typedProfile.moderation_status)) {
    return null;
  }

  const [
    skillsResponse,
    languagesResponse,
    educationResponse,
    certificatesResponse,
    qasResponse,
    workExperienceResponse,
    projectsResponse,
    articlesResponse,
    voteSummary,
    countryResponse,
    categoryResponse,
    bookmarkResponse,
    followResponse,
    badges,
  ] = await Promise.all([
    dataClient
      .from("profile_skills")
      .select(
        `
        skill_id,
        skills (
          name
        )
      `,
      )
      .eq("profile_id", typedProfile.id),
    dataClient
      .from("profile_languages")
      .select(
        `
        id,
        proficiency_level,
        languages (
          name
        )
      `,
      )
      .eq("profile_id", typedProfile.id),
    dataClient
      .from("profile_education")
      .select(
        "id, institution, degree, field_of_study, started_on, completed_on, description",
      )
      .eq("profile_id", typedProfile.id)
      .order("started_on", { ascending: false }),
    dataClient
      .from("profile_certificates")
      .select("id, title, issuer, issued_on, credential_url, file_url, file_name")
      .eq("profile_id", typedProfile.id)
      .order("issued_on", { ascending: false }),
    dataClient
      .from("profile_qas")
      .select("id, question, answer")
      .eq("profile_id", typedProfile.id),
    dataClient
      .from("profile_work_experience")
      .select(
        "id, company_name, position, started_year, ended_year, is_current, responsibilities",
      )
      .eq("profile_id", typedProfile.id)
      .order("started_year", { ascending: false }),
    supabase
      .from("projects")
      .select(
        "id, title, slug, description, score, cover_url, is_pinned, moderation_status, status, kind",
      )
      .eq("owner_id", typedProfile.user_id)
      .eq("status", "published")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("articles")
      .select(
        "id, slug, title, excerpt, cover_image_url, published_at, created_at",
      )
      .eq("author_user_id", typedProfile.user_id)
      .eq("status", "published")
      .eq("moderation_status", "approved")
      .order("published_at", { ascending: false }),
    getProfileVoteSummary(supabase, typedProfile.id, user?.id),
    typedProfile.country_id
      ? dataClient
          .from("countries")
          .select("name")
          .eq("id", typedProfile.country_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    typedProfile.category_id
      ? dataClient
          .from("profile_categories")
          .select("name")
          .eq("id", typedProfile.category_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", user.id)
          .eq("target_profile_id", typedProfile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("follows")
          .select("id")
          .eq("follower_user_id", user.id)
          .eq("following_user_id", typedProfile.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    listBadgesWithProgress(dataClient, typedProfile.user_id),
  ]);

  const profileSettings = normalizeProfileSettings(typedProfile.profile_visibility);

  const skillsCount = (skillsResponse.data || []).length;
  const languagesCount = (languagesResponse.data || []).length;
  const educationCount = (educationResponse.data || []).length;
  const certificatesCount = (certificatesResponse.data || []).length;
  const qaCount = (qasResponse.data || []).length;
  const workExperienceCount = (workExperienceResponse.data || []).length;

  const completeness = getProfileCompletenessBreakdown({
    username: typedProfile.username,
    name: typedProfile.name,
    avatarUrl: typedProfile.avatar_url,
    headline: typedProfile.headline,
    bio: typedProfile.bio,
    countryId: typedProfile.country_id,
    city: typedProfile.city,
    website: typedProfile.website,
    github: typedProfile.github,
    twitter: typedProfile.twitter,
    linkedin: typedProfile.linkedin,
    behance: typedProfile.behance,
    dribbble: typedProfile.dribbble,
    artstation: typedProfile.artstation,
    vimeo: typedProfile.vimeo,
    youtube: typedProfile.youtube,
    instagram: typedProfile.instagram,
    contactEmail: typedProfile.contact_email,
    telegramUsername: typedProfile.telegram_username,
    phone: typedProfile.phone,
    preferredContactMethod: typedProfile.preferred_contact_method,
    experienceLevel: typedProfile.experience_level,
    experienceYears: typedProfile.experience_years,
    employmentTypesCount: typedProfile.employment_types?.length || 0,
    workFormatsCount: typedProfile.work_formats?.length || 0,
    salaryExpectations: typedProfile.salary_expectations,
    salaryCurrency: typedProfile.salary_currency,
    additionalInfo: typedProfile.additional_info,
    skillsCount,
    languagesCount,
    educationCount,
    certificateCount: certificatesCount,
    qaCount,
    workExperienceCount,
  });

  // The persisted projects.score column is Wilson-only (votes), so it reads 0
  // for projects with no votes even when the composite rating shown on the
  // homepage / search is higher. Override with the same composite rating here.
  // The creator rating map (same leaderboard cache) backs the profile rating
  // badge, which would otherwise show only net votes.
  const [projectRatings, creatorRatings] = await Promise.all([
    getProjectRatings(),
    getCreatorRatings(),
  ]);

  return {
    profile: {
      ...typedProfile,
      visibility: {
        about: profileSettings.about,
        professionalDetails: profileSettings.professionalDetails,
        workExperience: profileSettings.workExperience,
        skills: profileSettings.skills,
        languages: profileSettings.languages,
        education: profileSettings.education,
        certificates: profileSettings.certificates,
        qa: profileSettings.qa,
        links: profileSettings.links,
      },
      presentation: profileSettings.presentation,
      countryName: countryResponse.data?.name || null,
      categoryName: categoryResponse.data?.name || null,
    },
    technologies: ((skillsResponse.data || []) as Array<{
      skill_id: number;
      skills: { name?: string | null } | Array<{ name?: string | null }> | null;
    }>)
      .map((relation) => {
        const name = getRelationName(relation.skills);

        if (!name) {
          return null;
        }

        return {
          id: relation.skill_id,
          name,
        };
      })
      .filter((item): item is { id: number; name: string } => Boolean(item)),
    languages: ((languagesResponse.data || []) as Array<{
      id: string;
      proficiency_level: string | null;
      languages: { name?: string | null } | Array<{ name?: string | null }> | null;
    }>)
      .map((item) => {
        const name = getRelationName(item.languages);

        if (!name) {
          return null;
        }

        return {
          id: item.id,
          name,
          level: item.proficiency_level,
        };
      })
      .filter((item): item is { id: string; name: string; level: string | null } =>
        Boolean(item),
      ),
    education: (educationResponse.data || []) as PublicProfilePageData["education"],
    certificates:
      (certificatesResponse.data || []) as PublicProfilePageData["certificates"],
    qas: (qasResponse.data || []) as PublicProfilePageData["qas"],
    workExperience:
      (workExperienceResponse.data || []) as PublicProfilePageData["workExperience"],
    projects: ((projectsResponse.data || []) as Array<{
      id: string;
      title: string;
      slug: string | null;
      description: string | null;
      score: number | null;
      cover_url: string | null;
      is_pinned: boolean | null;
      moderation_status: string | null;
    }>)
      .filter((project) => isPublicModerationStatus(project.moderation_status))
      .map((project) => ({
        ...project,
        score: projectRatings[project.id] ?? project.score,
      })),
    articles:
      (articlesResponse.data || []) as PublicProfilePageData["articles"],
    badges,
    completeness,
    voteSummary,
    profileRating: creatorRatings[typedProfile.id] ?? null,
    isAuthenticated: Boolean(user),
    isOwner,
    isBookmarked: Boolean(bookmarkResponse.data),
    isFollowing: Boolean(followResponse.data),
  };
}

export type UserProjectsPageResult = {
  profile: {
    name: string | null;
    username: string | null;
  };
  projects: Array<{
    id: string;
    title: string;
    slug: string | null;
    description: string | null;
    score: number | null;
    cover_url: string | null;
    is_pinned: boolean | null;
  }>;
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export type UserArticlesPageResult = {
  profile: {
    name: string | null;
    username: string | null;
  };
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string | null;
    cover_image_url: string | null;
    hero_video_url: string | null;
    views_count: number;
    likes_count: number;
    comments_count: number;
    published_at: string | null;
    created_at: string | null;
    pinned_until: string | null;
    category: {
      id: number;
      slug: string;
      name: string;
      nameUk: string | null;
      description: string | null;
      adminOnly: boolean;
    } | null;
    author: {
      userId: string;
      username: string | null;
      name: string | null;
      avatarUrl: string | null;
    } | null;
    coAuthors: ContentAuthor[];
  }>;
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export async function getUserArticlesPage(
  username: string,
  options: { page: number; perPage: number },
): Promise<UserArticlesPageResult | null> {
  noStore();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url, moderation_status")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.user_id;

  if (!isOwner && !isPublicModerationStatus(profile.moderation_status)) {
    return null;
  }

  // Own articles AND co-authored ones (accepted invites).
  const coAuthoredIds = await loadCoAuthoredContentIds(
    supabase,
    "article",
    profile.user_id,
  );
  const authorOrFilter =
    coAuthoredIds.length > 0
      ? `author_user_id.eq.${profile.user_id},id.in.(${coAuthoredIds.join(",")})`
      : null;

  let countQuery = supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("moderation_status", "approved");
  countQuery = authorOrFilter
    ? countQuery.or(authorOrFilter)
    : countQuery.eq("author_user_id", profile.user_id);
  const { count } = await countQuery;

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / options.perPage));
  const currentPage = Math.max(1, Math.min(options.page, totalPages));
  const from = (currentPage - 1) * options.perPage;
  const to = from + options.perPage - 1;

  let articlesQuery = supabase
    .from("articles")
    .select(
      "id, author_user_id, slug, title, excerpt, content, cover_image_url, hero_video_url, views_count, likes_count, comments_count, published_at, created_at, pinned_until, category_id",
    )
    .eq("status", "published")
    .eq("moderation_status", "approved");
  articlesQuery = authorOrFilter
    ? articlesQuery.or(authorOrFilter)
    : articlesQuery.eq("author_user_id", profile.user_id);
  const { data: articles } = await articlesQuery
    .order("published_at", { ascending: false })
    .range(from, to);

  const rows = (articles || []) as Array<{
    id: string;
    author_user_id: string | null;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string | null;
    cover_image_url: string | null;
    hero_video_url: string | null;
    views_count: number | null;
    likes_count: number | null;
    comments_count: number | null;
    published_at: string | null;
    created_at: string | null;
    pinned_until: string | null;
    category_id: number | null;
  }>;
  const categoryIds = Array.from(
    new Set(
      rows
        .map((item) => item.category_id)
        .filter((item): item is number => typeof item === "number"),
    ),
  );

  // Like/comment counts are read straight from the denormalized
  // articles.likes_count / comments_count columns (maintained by triggers),
  // so only category metadata needs a follow-up lookup.
  const categoriesResponse =
    categoryIds.length > 0
      ? await supabase
          .from("article_categories")
          .select("id, slug, name, name_uk, description, admin_only")
          .in("id", categoryIds)
      : { data: [] };

  const categoryRows = (categoriesResponse.data || []) as Array<{
    id: number;
    slug: string;
    name: string;
    name_uk: string | null;
    description: string | null;
    admin_only: boolean | null;
  }>;

  const categoryMap = new Map(
    categoryRows.map((item) => [
      item.id,
      {
        id: item.id,
        slug: item.slug,
        name: item.name,
        nameUk: item.name_uk,
        description: item.description,
        adminOnly: Boolean(item.admin_only),
      },
    ]),
  );

  // Resolve the real primary author per row (a co-authored article's creator
  // is someone other than this profile) plus the accepted co-authors.
  const authorIds = Array.from(
    new Set(rows.map((item) => item.author_user_id).filter(Boolean)),
  ) as string[];
  const { data: authorProfiles } =
    authorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, username, name, avatar_url")
          .in("user_id", authorIds)
      : { data: [] };
  const authorMap = new Map(
    ((authorProfiles || []) as Array<{
      user_id: string;
      username: string | null;
      name: string | null;
      avatar_url: string | null;
    }>).map((row) => [
      row.user_id,
      {
        userId: row.user_id,
        username: row.username,
        name: row.name,
        avatarUrl: row.avatar_url,
      },
    ]),
  );
  const coAuthorsMap = await loadAcceptedCoAuthorsMap(
    supabase,
    "article",
    rows.map((item) => item.id),
  );

  return {
    profile: {
      name: profile.name,
      username: profile.username,
    },
    articles: rows.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      content: item.content,
      cover_image_url: item.cover_image_url,
      hero_video_url: item.hero_video_url,
      views_count: item.views_count || 0,
      likes_count: item.likes_count || 0,
      comments_count: item.comments_count || 0,
      published_at: item.published_at,
      created_at: item.created_at,
      pinned_until: item.pinned_until,
      category: item.category_id ? categoryMap.get(item.category_id) || null : null,
      author: item.author_user_id
        ? authorMap.get(item.author_user_id) || null
        : null,
      coAuthors: coAuthorsMap.get(item.id) ?? [],
    })),
    totalCount,
    currentPage,
    totalPages,
  };
}

export type UserPollsPageResult = {
  profile: { name: string | null; username: string | null };
  polls: PollFeedItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export async function getUserPollsPage(
  username: string,
  options: { page: number; perPage: number },
): Promise<UserPollsPageResult | null> {
  noStore();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url, moderation_status")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.user_id;

  if (!isOwner && !isPublicModerationStatus(profile.moderation_status)) {
    return null;
  }

  // Own polls AND co-authored ones (accepted invites).
  const coAuthoredIds = await loadCoAuthoredContentIds(
    supabase,
    "poll",
    profile.user_id,
  );
  const authorOrFilter =
    coAuthoredIds.length > 0
      ? `author_user_id.eq.${profile.user_id},id.in.(${coAuthoredIds.join(",")})`
      : null;

  let countQuery = supabase
    .from("polls")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("moderation_status", "approved");
  countQuery = authorOrFilter
    ? countQuery.or(authorOrFilter)
    : countQuery.eq("author_user_id", profile.user_id);
  const { count } = await countQuery;

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / options.perPage));
  const currentPage = Math.max(1, Math.min(options.page, totalPages));
  const from = (currentPage - 1) * options.perPage;
  const to = from + options.perPage - 1;

  let pollsQuery = supabase
    .from("polls")
    .select(
      "id, author_user_id, slug, title, excerpt, cover_image_url, views_count, likes_count, comments_count, responses_count, published_at, created_at, closes_at, pinned_until, category_id",
    )
    .eq("status", "published")
    .eq("moderation_status", "approved");
  pollsQuery = authorOrFilter
    ? pollsQuery.or(authorOrFilter)
    : pollsQuery.eq("author_user_id", profile.user_id);
  const { data: pollRows } = await pollsQuery
    .order("published_at", { ascending: false })
    .range(from, to);

  const rows = (pollRows || []) as Array<{
    id: string;
    author_user_id: string | null;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    views_count: number | null;
    likes_count: number | null;
    comments_count: number | null;
    responses_count: number | null;
    published_at: string | null;
    created_at: string | null;
    closes_at: string | null;
    pinned_until: string | null;
    category_id: number | null;
  }>;

  const categoryIds = Array.from(
    new Set(
      rows
        .map((item) => item.category_id)
        .filter((item): item is number => typeof item === "number"),
    ),
  );
  const pollIds = rows.map((item) => item.id);

  const [categoriesResponse, questionRowsResponse] = await Promise.all([
    categoryIds.length > 0
      ? supabase
          .from("poll_categories")
          .select("id, slug, name, name_uk, description, admin_only")
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
    pollIds.length > 0
      ? supabase.from("poll_questions").select("poll_id").in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
  ]);

  const categoryRows = (categoriesResponse.data || []) as Array<{
    id: number;
    slug: string;
    name: string;
    name_uk: string | null;
    description: string | null;
    admin_only: boolean | null;
  }>;
  const categoryMap = new Map(
    categoryRows.map((item) => [
      item.id,
      {
        id: item.id,
        slug: item.slug,
        name: item.name,
        nameUk: item.name_uk,
        description: item.description,
        adminOnly: Boolean(item.admin_only),
      },
    ]),
  );

  const questionCountByPoll = new Map<string, number>();
  for (const row of (questionRowsResponse.data || []) as Array<{ poll_id: string }>) {
    questionCountByPoll.set(row.poll_id, (questionCountByPoll.get(row.poll_id) ?? 0) + 1);
  }

  // Resolve the real primary author per row plus accepted co-authors, so a
  // co-authored poll shows its true creator on every author's profile.
  const authorIds = Array.from(
    new Set(rows.map((item) => item.author_user_id).filter(Boolean)),
  ) as string[];
  const { data: authorProfiles } =
    authorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, username, name, avatar_url")
          .in("user_id", authorIds)
      : { data: [] };
  const authorMap = new Map(
    ((authorProfiles || []) as Array<{
      user_id: string;
      username: string | null;
      name: string | null;
      avatar_url: string | null;
    }>).map((row) => [
      row.user_id,
      {
        userId: row.user_id,
        username: row.username,
        name: row.name,
        avatarUrl: row.avatar_url,
      },
    ]),
  );
  const coAuthorsMap = await loadAcceptedCoAuthorsMap(
    supabase,
    "poll",
    rows.map((item) => item.id),
  );

  return {
    profile: { name: profile.name, username: profile.username },
    polls: rows.map(
      (item): PollFeedItem => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        excerpt: item.excerpt,
        content: null,
        coverImageUrl: item.cover_image_url,
        publishedAt: item.published_at,
        createdAt: item.created_at,
        closesAt: item.closes_at,
        viewsCount: item.views_count || 0,
        likesCount: item.likes_count || 0,
        commentsCount: item.comments_count || 0,
        responsesCount: item.responses_count || 0,
        questionCount: questionCountByPoll.get(item.id) ?? 0,
        category: item.category_id ? categoryMap.get(item.category_id) || null : null,
        author: item.author_user_id
          ? authorMap.get(item.author_user_id) || null
          : null,
        coAuthors: coAuthorsMap.get(item.id) ?? [],
        authorDeleted: false,
        pinnedUntil: item.pinned_until,
      }),
    ),
    totalCount,
    currentPage,
    totalPages,
  };
}

export async function getUserProjectsPage(
  username: string,
  options: { page: number; perPage: number },
): Promise<UserProjectsPageResult | null> {
  noStore();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, name, moderation_status")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.user_id;

  if (!isOwner && !isPublicModerationStatus(profile.moderation_status)) {
    return null;
  }

  // A profile lists the user's own projects AND the ones they co-author
  // (accepted invites), so collaborative work surfaces on every author's page.
  const coAuthoredIds = await loadCoAuthoredContentIds(
    supabase,
    "project",
    profile.user_id,
  );
  const authorOrFilter =
    coAuthoredIds.length > 0
      ? `owner_id.eq.${profile.user_id},id.in.(${coAuthoredIds.join(",")})`
      : null;

  let countQuery = supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("moderation_status", "approved")
    .eq("status", "published");
  countQuery = authorOrFilter
    ? countQuery.or(authorOrFilter)
    : countQuery.eq("owner_id", profile.user_id);
  const { count } = await countQuery;

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / options.perPage));
  const currentPage = Math.max(1, Math.min(options.page, totalPages));
  const from = (currentPage - 1) * options.perPage;
  const to = from + options.perPage - 1;

  let projectsQuery = supabase
    .from("projects")
    .select("id, title, slug, description, score, cover_url, is_pinned, kind")
    .eq("moderation_status", "approved")
    .eq("status", "published");
  projectsQuery = authorOrFilter
    ? projectsQuery.or(authorOrFilter)
    : projectsQuery.eq("owner_id", profile.user_id);
  const { data: projects } = await projectsQuery
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Override the Wilson-only persisted score with the composite rating shown on
  // the homepage / search (see getPublicProfilePageData for the rationale).
  const projectRatings = await getProjectRatings();

  return {
    profile: {
      name: profile.name,
      username: profile.username,
    },
    projects: ((projects || []) as UserProjectsPageResult["projects"]).map(
      (project) => ({
        ...project,
        score: projectRatings[project.id] ?? project.score,
      }),
    ),
    totalCount,
    currentPage,
    totalPages,
  };
}

export type RelatedProjectItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  score: number | null;
  cover_url: string | null;
  kind: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  coAuthorNames: string[];
};

type RelatedProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  description: string | null;
  score: number | null;
  cover_url: string | null;
  kind: string | null;
  created_at: string | null;
  moderation_status: string | null;
};

/**
 * Public projects that share at least one technology with the given project,
 * ranked by overlap (then score, then recency). Powers the "Related projects"
 * section on the project detail page — internal linking that deepens crawl
 * paths and keeps visitors exploring. Returns `[]` when the project has no
 * skills or nothing public overlaps, so the caller can skip the section.
 */
export async function getRelatedProjects(
  projectId: string,
  referenceSkillIds: number[],
  limit = RELATED_ITEMS_LIMIT,
): Promise<RelatedProjectItem[]> {
  noStore();

  if (referenceSkillIds.length === 0 || limit <= 0) {
    return [];
  }

  const supabase = await createClient();

  // 1. Candidate projects that share at least one of the reference skills.
  const { data: skillLinks } = await supabase
    .from("project_skills")
    .select("project_id, skill_id")
    .in("skill_id", referenceSkillIds)
    .limit(1000);

  const sharedCounts = tallySharedSkills(
    ((skillLinks || []) as Array<{ project_id: string; skill_id: number }>).map(
      (row) => ({ entityId: row.project_id, skillId: row.skill_id }),
    ),
    referenceSkillIds,
    projectId,
  );

  if (sharedCounts.size === 0) {
    return [];
  }

  // Hydrate a few more candidates than we need so published / moderation
  // filtering still leaves a full row to rank.
  const hydrateCap = Math.max(limit * 4, 24);
  const candidateIds = Array.from(sharedCounts.keys())
    .sort((a, b) => (sharedCounts.get(b) || 0) - (sharedCounts.get(a) || 0))
    .slice(0, hydrateCap);

  // 2. Keep only public, published candidates with a slug to link to.
  const { data: rows } = await supabase
    .from("projects")
    .select(
      "id, owner_id, title, slug, description, score, cover_url, kind, created_at, moderation_status",
    )
    .in("id", candidateIds)
    .eq("status", "published")
    .not("slug", "is", null);

  const projects = ((rows || []) as RelatedProjectRow[]).filter((row) =>
    isPublicModerationStatus(row.moderation_status),
  );

  if (projects.length === 0) {
    return [];
  }

  // 3. Resolve owner display names in a single batched query.
  const ownerIds = Array.from(new Set(projects.map((row) => row.owner_id)));
  const { data: owners } = await supabase
    .from("profiles")
    .select("user_id, name, username")
    .in("user_id", ownerIds);
  const ownerByUserId = new Map(
    (
      (owners || []) as Array<{
        user_id: string;
        name: string | null;
        username: string | null;
      }>
    ).map((owner) => [owner.user_id, owner]),
  );

  // Override the Wilson-only persisted score with the composite rating shown on
  // the homepage / search (see getPublicProfilePageData for the rationale).
  const projectRatings = await getProjectRatings();
  const ratingFor = (row: RelatedProjectRow) =>
    projectRatings[row.id] ?? row.score;

  // 4. Rank by shared-skill overlap, breaking ties on score then recency.
  const ranked = rankBySharedSkills(
    projects.map((row) => ({
      id: row.id,
      sharedSkillCount: sharedCounts.get(row.id) || 0,
      score: ratingFor(row) ?? 0,
      createdAt: row.created_at,
      row,
    })),
    limit,
  );

  const items = ranked.map(({ row }) => {
    const owner = ownerByUserId.get(row.owner_id);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug as string,
      description: row.description,
      score: ratingFor(row),
      cover_url: row.cover_url,
      kind: row.kind,
      ownerName: owner?.name ?? null,
      ownerUsername: owner?.username ?? null,
      coAuthorNames: [] as string[],
    };
  });

  const coAuthorsMap = await loadAcceptedCoAuthorsMap(
    supabase,
    "project",
    items.map((item) => item.id),
  );
  for (const item of items) {
    item.coAuthorNames = (coAuthorsMap.get(item.id) ?? [])
      .map((author) => author.name || author.username || "")
      .filter(Boolean);
  }

  return items;
}

export type RelatedCreatorItem = {
  username: string;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
  categoryName: string | null;
  countryName: string | null;
  city: string | null;
  technologies: Array<{ id: number; name: string }>;
};

type RelatedCreatorRow = {
  id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
  city: string | null;
  country_id: number | null;
  category_id: number | null;
  created_at: string | null;
  moderation_status: string | null;
};

/**
 * Public creators related to the given profile, ranked by shared technologies
 * and (as a fallback / tiebreaker) the same profile category. Powers the
 * "Related creators" section on the public profile page — profile-to-profile
 * internal links that help visitors discover similar talent. Returns `[]` when
 * nothing public is related, so the caller can skip the section.
 */
export async function getRelatedCreators(
  profileId: string,
  referenceSkillIds: number[],
  categoryId: number | null,
  limit = RELATED_ITEMS_LIMIT,
): Promise<RelatedCreatorItem[]> {
  noStore();

  if (limit <= 0) {
    return [];
  }

  const supabase = await createClient();

  // 1. Skill-overlap candidates.
  let sharedCounts = new Map<string, number>();
  if (referenceSkillIds.length > 0) {
    const { data: skillLinks } = await supabase
      .from("profile_skills")
      .select("profile_id, skill_id")
      .in("skill_id", referenceSkillIds)
      .limit(1000);

    sharedCounts = tallySharedSkills(
      (
        (skillLinks || []) as Array<{ profile_id: string; skill_id: number }>
      ).map((row) => ({ entityId: row.profile_id, skillId: row.skill_id })),
      referenceSkillIds,
      profileId,
    );
  }

  const hydrateCap = Math.max(limit * 4, 24);
  const candidateIds = new Set<string>(
    Array.from(sharedCounts.keys())
      .sort((a, b) => (sharedCounts.get(b) || 0) - (sharedCounts.get(a) || 0))
      .slice(0, hydrateCap),
  );

  // 2. Same-category fill so creators with few skills still get neighbours.
  if (categoryId !== null) {
    const { data: categoryRows } = await supabase
      .from("profiles")
      .select("id")
      .eq("category_id", categoryId)
      .eq("moderation_status", "approved")
      .not("username", "is", null)
      .neq("id", profileId)
      // Surface the strongest creators in the category fallback instead of an
      // arbitrary heap-order slice once the category grows past hydrateCap.
      .order("score", { ascending: false })
      .limit(hydrateCap);

    for (const row of (categoryRows || []) as Array<{ id: string }>) {
      candidateIds.add(row.id);
    }
  }

  if (candidateIds.size === 0) {
    return [];
  }

  // 3. Hydrate candidate profiles (public only).
  const { data: profileRows } = await supabase
    .from("profiles")
    .select(
      "id, username, name, headline, avatar_url, city, country_id, category_id, created_at, moderation_status",
    )
    .in("id", Array.from(candidateIds))
    .not("username", "is", null);

  const candidates = ((profileRows || []) as RelatedCreatorRow[]).filter(
    (row) =>
      row.id !== profileId &&
      row.username !== null &&
      isPublicModerationStatus(row.moderation_status),
  );

  if (candidates.length === 0) {
    return [];
  }

  // 4. Rank by skill overlap, then same-category, then recency.
  const ranked = rankRelatedCreators(
    candidates.map((row) => ({
      id: row.id,
      sharedSkillCount: sharedCounts.get(row.id) || 0,
      sameCategory: categoryId !== null && row.category_id === categoryId,
      createdAt: row.created_at,
      row,
    })),
    limit,
  );

  if (ranked.length === 0) {
    return [];
  }

  // 5. Resolve display details (skills, country, category) in batched queries.
  const rankedIds = ranked.map((item) => item.id);
  const countryIds = Array.from(
    new Set(
      ranked
        .map((item) => item.row.country_id)
        .filter((value): value is number => typeof value === "number"),
    ),
  );
  const categoryIds = Array.from(
    new Set(
      ranked
        .map((item) => item.row.category_id)
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  const [skillsResponse, countriesResponse, categoriesResponse] =
    await Promise.all([
      supabase
        .from("profile_skills")
        .select("profile_id, skill_id, skills ( name )")
        .in("profile_id", rankedIds),
      countryIds.length > 0
        ? supabase.from("countries").select("id, name").in("id", countryIds)
        : Promise.resolve({ data: [] }),
      categoryIds.length > 0
        ? supabase
            .from("profile_categories")
            .select("id, name")
            .in("id", categoryIds)
        : Promise.resolve({ data: [] }),
    ]);

  const technologiesByProfile = new Map<
    string,
    Array<{ id: number; name: string }>
  >();
  for (const relation of (skillsResponse.data || []) as Array<{
    profile_id: string;
    skill_id: number;
    skills: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>) {
    const name = getRelationName(relation.skills);
    if (!name) {
      continue;
    }
    const list = technologiesByProfile.get(relation.profile_id) || [];
    list.push({ id: relation.skill_id, name });
    technologiesByProfile.set(relation.profile_id, list);
  }

  const countryNameById = new Map(
    ((countriesResponse.data || []) as Array<{ id: number; name: string }>).map(
      (row) => [row.id, row.name],
    ),
  );
  const categoryNameById = new Map(
    ((categoriesResponse.data || []) as Array<{ id: number; name: string }>).map(
      (row) => [row.id, row.name],
    ),
  );

  return ranked.map(({ row }) => ({
    username: row.username as string,
    name: row.name,
    headline: row.headline,
    avatar_url: row.avatar_url,
    categoryName:
      row.category_id !== null
        ? categoryNameById.get(row.category_id) ?? null
        : null,
    countryName:
      row.country_id !== null
        ? countryNameById.get(row.country_id) ?? null
        : null,
    city: row.city,
    technologies: technologiesByProfile.get(row.id) || [],
  }));
}
