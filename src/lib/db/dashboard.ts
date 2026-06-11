import { getProfileCompletenessScore } from "@/lib/leaderboards";
import { createClient } from "@/lib/supabase/server";

type EmbeddedCount = { count: number }[] | null;

type DashboardProfileRow = {
  id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  bio: string | null;
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
  preferred_contact_method: string | null;
  avatar_url: string | null;
  country_id: number | null;
  category_id: number | null;
  experience_level: string | null;
  experience_years: number | null;
  employment_types: string[] | null;
  work_formats: string[] | null;
  salary_expectations: string | null;
  salary_currency: string | null;
  additional_info: string | null;
  profile_skills: EmbeddedCount;
  profile_languages: EmbeddedCount;
  profile_education: EmbeddedCount;
  profile_certificates: EmbeddedCount;
  profile_qas: EmbeddedCount;
  profile_work_experience: EmbeddedCount;
};

export type UserDashboardStats = {
  name: string | null;
  username: string | null;
  projectsCount: number;
  articlesCount: number;
  pollsCount: number;
  followersCount: number;
  followingCount: number;
  bookmarksCount: number;
  receivedLikes: number;
  receivedDislikes: number;
  articleViews: number;
};

export type DashboardStats = {
  siteTotals: {
    profiles: number;
    publicProfiles: number;
    countries: number;
    categories: number;
    projects: number;
    votes: number;
    likes: number;
    dislikes: number;
    avgProfileCompletion: number;
    avgProjectScore: number;
  };
  monthlyActivity: Array<{
    key: string;
    profiles: number;
    projects: number;
    votes: number;
  }>;
  statusBreakdown: Array<{
    key: string;
    value: number;
  }>;
  categoryBreakdown: Array<{
    label: string;
    value: number;
  }>;
  countryBreakdown: Array<{
    label: string;
    value: number;
  }>;
  completionBreakdown: Array<{
    key: "starter" | "growing" | "complete";
    value: number;
  }>;
  topProjects: Array<{
    id: string;
    title: string;
    slug: string | null;
    likes: number;
    dislikes: number;
    score: number;
    ownerName: string | null;
    categoryName: string | null;
  }>;
  topSkills: Array<{
    name: string;
    value: number;
  }>;
  experienceBreakdown: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  salaryBreakdown: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  workFormatBreakdown: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  employmentTypeBreakdown: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  contactMethodBreakdown: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  salaryByCountry: Array<{
    label: string;
    avgSalary: number;
    count: number;
  }>;
  salaryByCategory: Array<{
    label: string;
    avgSalary: number;
    count: number;
  }>;
};

// Shape returned by the get_dashboard_activity() SQL RPC (heavy-table aggregates
// computed in Postgres). The profile-derived breakdowns below are computed in JS
// because they depend on the shared completeness formula and salary text parsing.
type DashboardActivity = {
  projectsTotal: number;
  profilesTotal: number;
  publicProfilesTotal: number;
  categoriesTotal: number;
  votesTotal: number;
  likes: number;
  dislikes: number;
  avgProjectScore: number;
  monthlyActivity: DashboardStats["monthlyActivity"];
  statusBreakdown: DashboardStats["statusBreakdown"];
  topProjects: DashboardStats["topProjects"];
  topSkills: DashboardStats["topSkills"];
};

function embeddedCount(relation: EmbeddedCount): number {
  return relation?.[0]?.count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  // Heavy aggregates (votes / projects / skills / monthly / top lists) are
  // computed in SQL. Only profile rows are read into JS — with per-profile
  // section counts via PostgREST `(count)` embedding (no join-row fetches) —
  // because completeness scoring and salary parsing stay in the TS layer.
  const [activityResponse, profilesResponse, countriesResponse, categoriesResponse] =
    await Promise.all([
      supabase.rpc("get_dashboard_activity"),
      supabase
        .from("profiles")
        .select(
          "id, username, name, headline, bio, city, website, github, twitter, linkedin, behance, dribbble, artstation, vimeo, youtube, instagram, contact_email, telegram_username, phone, preferred_contact_method, avatar_url, country_id, category_id, experience_level, experience_years, employment_types, work_formats, salary_expectations, salary_currency, additional_info, profile_skills(count), profile_languages(count), profile_education(count), profile_certificates(count), profile_qas(count), profile_work_experience(count)",
        ),
      supabase.from("countries").select("id, name"),
      supabase.from("profile_categories").select("id, name"),
    ]);

  const activity = (activityResponse.data || {}) as Partial<DashboardActivity>;
  const profiles = (profilesResponse.data || []) as unknown as DashboardProfileRow[];
  const countries = (countriesResponse.data || []) as Array<{ id: number; name: string }>;
  const categories = (categoriesResponse.data || []) as Array<{ id: number; name: string }>;

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

  const countryCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const completionCounts = new Map<"starter" | "growing" | "complete", number>([
    ["starter", 0],
    ["growing", 0],
    ["complete", 0],
  ]);
  const experienceCounts = new Map<string, number>();
  const salaryCounts = new Map<string, number>();
  const workFormatCounts = new Map<string, number>();
  const employmentTypeCounts = new Map<string, number>();
  const contactMethodCounts = new Map<string, number>();
  const salaryByCountryAcc = new Map<string, { total: number; count: number }>();
  const salaryByCategoryAcc = new Map<string, { total: number; count: number }>();

  function parseSalaryNumeric(raw: string | null): number | null {
    if (!raw) return null;
    const numericMatch = raw.match(/\d[\d\s.,]*/);
    if (!numericMatch) return null;
    const cleaned = numericMatch[0].replace(/[\s,]/g, "").replace(/\.+$/, "");
    const value = Number.parseInt(cleaned, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function bucketSalary(raw: string | null): string | null {
    const numeric = parseSalaryNumeric(raw);
    if (numeric === null) return raw ? "custom" : null;
    if (numeric < 500) return "under_500";
    if (numeric < 1000) return "500_1000";
    if (numeric < 2000) return "1000_2000";
    if (numeric < 3500) return "2000_3500";
    if (numeric < 5000) return "3500_5000";
    return "5000_plus";
  }

  const completionScores = profiles.map((profile) => {
    const score = Math.round(
      getProfileCompletenessScore({
        username: profile.username,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        headline: profile.headline,
        bio: profile.bio,
        countryId: profile.country_id,
        city: profile.city,
        website: profile.website,
        github: profile.github,
        twitter: profile.twitter,
        linkedin: profile.linkedin,
        behance: profile.behance,
        dribbble: profile.dribbble,
        artstation: profile.artstation,
        vimeo: profile.vimeo,
        youtube: profile.youtube,
        instagram: profile.instagram,
        contactEmail: profile.contact_email,
        telegramUsername: profile.telegram_username,
        phone: profile.phone,
        preferredContactMethod: profile.preferred_contact_method,
        experienceLevel: profile.experience_level,
        experienceYears: profile.experience_years,
        employmentTypesCount: profile.employment_types?.length || 0,
        workFormatsCount: profile.work_formats?.length || 0,
        salaryExpectations: profile.salary_expectations,
        salaryCurrency: profile.salary_currency,
        additionalInfo: profile.additional_info,
        skillsCount: embeddedCount(profile.profile_skills),
        languagesCount: embeddedCount(profile.profile_languages),
        educationCount: embeddedCount(profile.profile_education),
        certificateCount: embeddedCount(profile.profile_certificates),
        qaCount: embeddedCount(profile.profile_qas),
        workExperienceCount: embeddedCount(profile.profile_work_experience),
      }) * 100,
    );
    const band = score >= 80 ? "complete" : score >= 45 ? "growing" : "starter";
    completionCounts.set(band, (completionCounts.get(band) || 0) + 1);

    if (profile.country_id && countryMap.get(profile.country_id)) {
      const countryName = countryMap.get(profile.country_id) as string;
      countryCounts.set(countryName, (countryCounts.get(countryName) || 0) + 1);
    }
    if (profile.category_id && categoryMap.get(profile.category_id)) {
      const categoryName = categoryMap.get(profile.category_id) as string;
      categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + 1);
    }

    if (profile.experience_level) {
      const expKey = profile.experience_level;
      experienceCounts.set(expKey, (experienceCounts.get(expKey) || 0) + 1);
    }

    const salaryBucket = bucketSalary(profile.salary_expectations);
    if (salaryBucket) {
      salaryCounts.set(salaryBucket, (salaryCounts.get(salaryBucket) || 0) + 1);
    }

    for (const format of profile.work_formats || []) {
      if (!format) continue;
      workFormatCounts.set(format, (workFormatCounts.get(format) || 0) + 1);
    }

    for (const type of profile.employment_types || []) {
      if (!type) continue;
      employmentTypeCounts.set(type, (employmentTypeCounts.get(type) || 0) + 1);
    }

    if (profile.preferred_contact_method) {
      const method = profile.preferred_contact_method;
      contactMethodCounts.set(method, (contactMethodCounts.get(method) || 0) + 1);
    }

    const numericSalary = parseSalaryNumeric(profile.salary_expectations);
    if (numericSalary !== null) {
      if (profile.country_id && countryMap.get(profile.country_id)) {
        const cName = countryMap.get(profile.country_id) as string;
        const prev = salaryByCountryAcc.get(cName) || { total: 0, count: 0 };
        salaryByCountryAcc.set(cName, { total: prev.total + numericSalary, count: prev.count + 1 });
      }
      if (profile.category_id && categoryMap.get(profile.category_id)) {
        const dName = categoryMap.get(profile.category_id) as string;
        const prev = salaryByCategoryAcc.get(dName) || { total: 0, count: 0 };
        salaryByCategoryAcc.set(dName, { total: prev.total + numericSalary, count: prev.count + 1 });
      }
    }

    return score;
  });

  const averageProfileCompletion =
    completionScores.length > 0
      ? Math.round(completionScores.reduce((sum, value) => sum + value, 0) / completionScores.length)
      : 0;

  return {
    siteTotals: {
      profiles: activity.profilesTotal ?? 0,
      publicProfiles: activity.publicProfilesTotal ?? 0,
      countries: countryCounts.size,
      categories: activity.categoriesTotal ?? 0,
      projects: activity.projectsTotal ?? 0,
      votes: activity.votesTotal ?? 0,
      likes: activity.likes ?? 0,
      dislikes: activity.dislikes ?? 0,
      avgProfileCompletion: averageProfileCompletion,
      avgProjectScore: activity.avgProjectScore ?? 0,
    },
    monthlyActivity: activity.monthlyActivity ?? [],
    statusBreakdown: activity.statusBreakdown ?? [],
    categoryBreakdown: [...categoryCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 10),
    countryBreakdown: [...countryCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 10),
    completionBreakdown: [...completionCounts.entries()].map(([key, value]) => ({ key, value })),
    topProjects: activity.topProjects ?? [],
    topSkills: activity.topSkills ?? [],
    experienceBreakdown: [...experienceCounts.entries()]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((left, right) => right.value - left.value),
    salaryBreakdown: [...salaryCounts.entries()]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((left, right) => right.value - left.value),
    workFormatBreakdown: [...workFormatCounts.entries()]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((left, right) => right.value - left.value),
    employmentTypeBreakdown: [...employmentTypeCounts.entries()]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((left, right) => right.value - left.value),
    contactMethodBreakdown: [...contactMethodCounts.entries()]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((left, right) => right.value - left.value),
    salaryByCountry: [...salaryByCountryAcc.entries()]
      .map(([label, data]) => ({ label, avgSalary: Math.round(data.total / data.count), count: data.count }))
      .sort((left, right) => right.avgSalary - left.avgSalary)
      .slice(0, 10),
    salaryByCategory: [...salaryByCategoryAcc.entries()]
      .map(([label, data]) => ({ label, avgSalary: Math.round(data.total / data.count), count: data.count }))
      .sort((left, right) => right.avgSalary - left.avgSalary)
      .slice(0, 10),
  };
}

export async function getUserDashboardStats(userId: string): Promise<UserDashboardStats> {
  const supabase = await createClient();

  const [
    profileResponse,
    projectsCountResponse,
    articlesResponse,
    pollsCountResponse,
    receivedVotesResponse,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, username, followers_count, following_count, bookmarks_count")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("articles").select("views_count").eq("author_user_id", userId),
    supabase.from("polls").select("id", { count: "exact", head: true }).eq("author_user_id", userId),
    // Likes/dislikes across all of the user's projects, aggregated in SQL instead
    // of fetching every vote row to count in JS. Follower / following / bookmark
    // totals are read from the denormalized counters on the profile row.
    supabase.rpc("get_user_received_votes", { p_user_id: userId }).single(),
  ]);

  const profile = profileResponse.data as {
    id: string;
    name: string | null;
    username: string | null;
    followers_count: number | null;
    following_count: number | null;
    bookmarks_count: number | null;
  } | null;
  const userArticles = (articlesResponse.data || []) as Array<{ views_count: number | null }>;
  const receivedVotes = (receivedVotesResponse.data || { likes: 0, dislikes: 0 }) as {
    likes: number;
    dislikes: number;
  };

  return {
    name: profile?.name || profile?.username || null,
    username: profile?.username || null,
    projectsCount: projectsCountResponse.count || 0,
    articlesCount: userArticles.length,
    pollsCount: pollsCountResponse.count || 0,
    followersCount: profile?.followers_count ?? 0,
    followingCount: profile?.following_count ?? 0,
    bookmarksCount: profile?.bookmarks_count ?? 0,
    receivedLikes: receivedVotes?.likes || 0,
    receivedDislikes: receivedVotes?.dislikes || 0,
    articleViews: userArticles.reduce((sum, a) => sum + (a.views_count || 0), 0),
  };
}
