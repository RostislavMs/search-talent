import { isPublicModerationStatus } from "@/lib/moderation";
import { unstable_noStore as noStore } from "next/cache";
import {
  normalizeProjectMediaItem,
  type ProjectMediaItem,
} from "@/lib/project-media";
import { parseProjectPath } from "@/lib/projects";
import {
  type EmploymentType,
  type ExperienceLevel,
  type PreferredContactMethod,
  type ProfileVisibility,
  type WorkFormat,
} from "@/lib/profile-sections";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileVoteSummary } from "@/lib/db/profile-votes";
import { getProjectVoteSummary } from "@/lib/db/project-votes";
import {
  normalizeProfileSettings,
  type ProfilePresentation,
} from "@/lib/profile-presentation";

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
};

type PublicProfileRow = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  country_id: number | null;
  city: string | null;
  category_id: number | null;
  website: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
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
  technologies: Array<{ id: number; name: string }>;
  media: ProjectMediaItem[];
  voteSummary: Awaited<ReturnType<typeof getProjectVoteSummary>>;
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
  voteSummary: Awaited<ReturnType<typeof getProfileVoteSummary>>;
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
      "id, owner_id, title, slug, description, role, score, cover_url, project_status, team_size, project_url, repository_url, started_on, completed_on, problem, solution, results, created_at, moderation_status, status",
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
        .select("id, user_id, username, name, headline, avatar_url, city, country_id")
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

  const owner = ownerResponse.data;
  let countryName: string | null = null;

  if (owner?.country_id) {
    const { data: country } = await supabase
      .from("countries")
      .select("name")
      .eq("id", owner.country_id)
      .maybeSingle();

    countryName = country?.name || null;
  }

  return {
    project: typedProject,
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
      "id, user_id, username, name, headline, bio, avatar_url, country_id, city, category_id, website, github, twitter, linkedin, contact_email, telegram_username, phone, preferred_contact_method, experience_level, experience_years, employment_types, work_formats, salary_expectations, salary_currency, additional_info, profile_visibility, moderation_status, email_verified",
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
        "id, title, slug, description, score, cover_url, moderation_status, status",
      )
      .eq("owner_id", typedProfile.user_id)
      .eq("status", "published")
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
  ]);

  const profileSettings = normalizeProfileSettings(typedProfile.profile_visibility);

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
      moderation_status: string | null;
    }>).filter((project) => isPublicModerationStatus(project.moderation_status)),
    articles:
      (articlesResponse.data || []) as PublicProfilePageData["articles"],
    voteSummary,
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

  const baseFilter = supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("author_user_id", profile.user_id)
    .eq("status", "published")
    .eq("moderation_status", "approved");

  const { count } = await baseFilter;

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / options.perPage));
  const currentPage = Math.max(1, Math.min(options.page, totalPages));
  const from = (currentPage - 1) * options.perPage;
  const to = from + options.perPage - 1;

  const { data: articles } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, content, cover_image_url, hero_video_url, views_count, published_at, created_at, pinned_until, category_id",
    )
    .eq("author_user_id", profile.user_id)
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .order("published_at", { ascending: false })
    .range(from, to);

  const rows = (articles || []) as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string | null;
    cover_image_url: string | null;
    hero_video_url: string | null;
    views_count: number | null;
    published_at: string | null;
    created_at: string | null;
    pinned_until: string | null;
    category_id: number | null;
  }>;
  const articleIds = rows.map((item) => item.id);
  const categoryIds = Array.from(
    new Set(
      rows
        .map((item) => item.category_id)
        .filter((item): item is number => typeof item === "number"),
    ),
  );

  const [likesResponse, commentsResponse, categoriesResponse] = await Promise.all([
    articleIds.length > 0
      ? supabase.from("article_likes").select("article_id").in("article_id", articleIds)
      : Promise.resolve({ data: [] }),
    articleIds.length > 0
      ? supabase
          .from("article_comments")
          .select("article_id")
          .in("article_id", articleIds)
      : Promise.resolve({ data: [] }),
    categoryIds.length > 0
      ? supabase
          .from("article_categories")
          .select("id, slug, name, name_uk, description, admin_only")
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
  ]);

  const likeRows = (likesResponse.data || []) as Array<{ article_id: string }>;
  const commentRows = (commentsResponse.data || []) as Array<{ article_id: string }>;
  const categoryRows = (categoriesResponse.data || []) as Array<{
    id: number;
    slug: string;
    name: string;
    name_uk: string | null;
    description: string | null;
    admin_only: boolean | null;
  }>;

  const likesMap = new Map<string, number>();
  for (const row of likeRows) {
    likesMap.set(row.article_id, (likesMap.get(row.article_id) || 0) + 1);
  }
  const commentsMap = new Map<string, number>();
  for (const row of commentRows) {
    commentsMap.set(row.article_id, (commentsMap.get(row.article_id) || 0) + 1);
  }
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

  const author = {
    userId: profile.user_id as string,
    username: profile.username as string | null,
    name: profile.name as string | null,
    avatarUrl: (profile as { avatar_url: string | null }).avatar_url,
  };

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
      likes_count: likesMap.get(item.id) || 0,
      comments_count: commentsMap.get(item.id) || 0,
      published_at: item.published_at,
      created_at: item.created_at,
      pinned_until: item.pinned_until,
      category: item.category_id ? categoryMap.get(item.category_id) || null : null,
      author,
    })),
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

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", profile.user_id)
    .eq("moderation_status", "approved")
    .eq("status", "published");

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / options.perPage));
  const currentPage = Math.max(1, Math.min(options.page, totalPages));
  const from = (currentPage - 1) * options.perPage;
  const to = from + options.perPage - 1;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, slug, description, score, cover_url")
    .eq("owner_id", profile.user_id)
    .eq("moderation_status", "approved")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    profile: {
      name: profile.name,
      username: profile.username,
    },
    projects: (projects || []) as UserProjectsPageResult["projects"],
    totalCount,
    currentPage,
    totalPages,
  };
}
