import { getProfileCompletenessScore } from "@/lib/leaderboards";
import { createClient } from "@/lib/supabase/server";

type CreatedAtRow = {
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
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
  created_at: string | null;
  experience_level: string | null;
  experience_years: number | null;
  employment_types: string[] | null;
  work_formats: string[] | null;
  salary_expectations: string | null;
  salary_currency: string | null;
  additional_info: string | null;
};

type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  project_status: string | null;
  created_at: string | null;
};

type VoteRow = {
  project_id: string;
  value: number | null;
  created_at: string | null;
};

type CountryRow = {
  id: number;
  name: string;
};

type CategoryRow = {
  id: number;
  name: string;
};

type SkillRelationRow = {
  skills: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type ProfileRelationRow = {
  profile_id: string;
};

export type UserDashboardStats = {
  name: string | null;
  username: string | null;
  projectsCount: number;
  articlesCount: number;
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

function getMonthKeys(length: number) {
  const keys: string[] = [];
  const current = new Date();
  const firstDayUtc = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1);

  for (let index = length - 1; index >= 0; index -= 1) {
    const date = new Date(firstDayUtc);
    date.setUTCMonth(date.getUTCMonth() - index);
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    keys.push(`${year}-${month}`);
  }

  return keys;
}

function toMonthKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}`;
}

function aggregateByMonth(rows: CreatedAtRow[], monthKeys: string[]) {
  const counts = new Map<string, number>(monthKeys.map((key) => [key, 0]));

  for (const row of rows) {
    const key = toMonthKey(row.created_at);
    if (!key || !counts.has(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

function getRelationName(relation: SkillRelationRow["skills"]) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }

  return relation?.name || null;
}

function getCountMap(rows: ProfileRelationRow[]) {
  const countMap = new Map<string, number>();
  for (const row of rows) {
    countMap.set(row.profile_id, (countMap.get(row.profile_id) || 0) + 1);
  }
  return countMap;
}

function getProfileCompletionScore(
  profile: ProfileRow,
  profileSkills: Map<string, number>,
  profileLanguages: Map<string, number>,
  profileEducation: Map<string, number>,
  profileCertificates: Map<string, number>,
  profileQas: Map<string, number>,
  profileWorkExperience: Map<string, number>,
) {
  return Math.round(
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
      skillsCount: profileSkills.get(profile.id) || 0,
      languagesCount: profileLanguages.get(profile.id) || 0,
      educationCount: profileEducation.get(profile.id) || 0,
      certificateCount: profileCertificates.get(profile.id) || 0,
      qaCount: profileQas.get(profile.id) || 0,
      workExperienceCount: profileWorkExperience.get(profile.id) || 0,
    }) * 100,
  );
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const monthKeys = getMonthKeys(6);

  const [
    profilesResponse,
    projectsResponse,
    votesResponse,
    countriesResponse,
    categoriesResponse,
    projectSkillsResponse,
    profileSkillsResponse,
    profileLanguagesResponse,
    profileEducationResponse,
    profileCertificatesResponse,
    profileQasResponse,
    profileWorkExperienceResponse,
  ] = await Promise.all([
    supabase.from("profiles").select("id, user_id, username, name, headline, bio, city, website, github, twitter, linkedin, behance, dribbble, artstation, vimeo, youtube, instagram, contact_email, telegram_username, phone, preferred_contact_method, avatar_url, country_id, category_id, created_at, experience_level, experience_years, employment_types, work_formats, salary_expectations, salary_currency, additional_info"),
    supabase.from("projects").select("id, owner_id, title, slug, project_status, created_at"),
    supabase.from("votes").select("project_id, value, created_at"),
    supabase.from("countries").select("id, name"),
    supabase.from("profile_categories").select("id, name"),
    supabase.from("project_skills").select(`project_id, skills ( name )`),
    supabase.from("profile_skills").select(`profile_id, skills ( name )`),
    supabase.from("profile_languages").select("profile_id"),
    supabase.from("profile_education").select("profile_id"),
    supabase.from("profile_certificates").select("profile_id"),
    supabase.from("profile_qas").select("profile_id"),
    supabase.from("profile_work_experience").select("profile_id"),
  ]);

  const profiles = (profilesResponse.data || []) as ProfileRow[];
  const projects = (projectsResponse.data || []) as ProjectRow[];
  const votes = (votesResponse.data || []) as VoteRow[];
  const countries = (countriesResponse.data || []) as CountryRow[];
  const categories = (categoriesResponse.data || []) as CategoryRow[];
  const projectSkills = (projectSkillsResponse.data || []) as Array<SkillRelationRow & { project_id: string }>;
  const profileSkills = (profileSkillsResponse.data || []) as Array<SkillRelationRow & { profile_id: string }>;
  const profileLanguages = (profileLanguagesResponse.data || []) as ProfileRelationRow[];
  const profileEducation = (profileEducationResponse.data || []) as ProfileRelationRow[];
  const profileCertificates = (profileCertificatesResponse.data || []) as ProfileRelationRow[];
  const profileQas = (profileQasResponse.data || []) as ProfileRelationRow[];
  const profileWorkExperience = (profileWorkExperienceResponse.data || []) as ProfileRelationRow[];

  const countryMap = new Map(countries.map((country) => [country.id, country.name]));
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const profileSkillCountMap = getCountMap(profileSkills.map((item) => ({ profile_id: item.profile_id })));
  const profileLanguageCountMap = getCountMap(profileLanguages);
  const profileEducationCountMap = getCountMap(profileEducation);
  const profileCertificateCountMap = getCountMap(profileCertificates);
  const profileQaCountMap = getCountMap(profileQas);
  const profileWorkExperienceCountMap = getCountMap(profileWorkExperience);

  const statusCounts = new Map<string, number>();
  for (const project of projects) {
    const key = project.project_status || "unknown";
    statusCounts.set(key, (statusCounts.get(key) || 0) + 1);
  }

  const voteStatsByProject = new Map<string, { likes: number; dislikes: number; score: number }>();
  for (const vote of votes) {
    const current = voteStatsByProject.get(vote.project_id) || { likes: 0, dislikes: 0, score: 0 };
    if (vote.value === 1) {
      current.likes += 1;
      current.score += 1;
    }
    if (vote.value === -1) {
      current.dislikes += 1;
      current.score -= 1;
    }
    voteStatsByProject.set(vote.project_id, current);
  }

  const countryCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const completionCounts = new Map<"starter" | "growing" | "complete", number>([["starter", 0], ["growing", 0], ["complete", 0]]);
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
    const score = getProfileCompletionScore(profile, profileSkillCountMap, profileLanguageCountMap, profileEducationCountMap, profileCertificateCountMap, profileQaCountMap, profileWorkExperienceCountMap);
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

  const combinedSkillCounts = new Map<string, number>();
  for (const relation of [...projectSkills, ...profileSkills]) {
    const name = getRelationName(relation.skills);
    if (!name) continue;
    combinedSkillCounts.set(name, (combinedSkillCounts.get(name) || 0) + 1);
  }

  const profileMonthly = aggregateByMonth(profiles, monthKeys);
  const projectsMonthly = aggregateByMonth(projects, monthKeys);
  const votesMonthly = aggregateByMonth(votes, monthKeys);

  const topProjects = projects
    .map((project) => {
      const voteStats = voteStatsByProject.get(project.id) || { likes: 0, dislikes: 0, score: 0 };
      const ownerProfile = profileByUserId.get(project.owner_id);
      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        likes: voteStats.likes,
        dislikes: voteStats.dislikes,
        score: voteStats.score,
        ownerName: ownerProfile?.name || ownerProfile?.username || null,
        categoryName:
          ownerProfile?.category_id && categoryMap.get(ownerProfile.category_id)
            ? (categoryMap.get(ownerProfile.category_id) as string)
            : null,
      };
    })
    .sort((left, right) => right.score - left.score || right.likes - left.likes)
    .slice(0, 6);

  const averageProjectScore =
    projects.length > 0
      ? Math.round(projects.reduce((sum, project) => sum + (voteStatsByProject.get(project.id)?.score || 0), 0) / projects.length)
      : 0;

  const averageProfileCompletion =
    completionScores.length > 0
      ? Math.round(completionScores.reduce((sum, value) => sum + value, 0) / completionScores.length)
      : 0;

  return {
    siteTotals: {
      profiles: profiles.length,
      publicProfiles: profiles.filter((profile) => Boolean(profile.username)).length,
      countries: countryCounts.size,
      categories: categories.length,
      projects: projects.length,
      votes: votes.length,
      likes: votes.filter((vote) => vote.value === 1).length,
      dislikes: votes.filter((vote) => vote.value === -1).length,
      avgProfileCompletion: averageProfileCompletion,
      avgProjectScore: averageProjectScore,
    },
    monthlyActivity: monthKeys.map((key) => ({ key, profiles: profileMonthly.get(key) || 0, projects: projectsMonthly.get(key) || 0, votes: votesMonthly.get(key) || 0 })),
    statusBreakdown: [...statusCounts.entries()].map(([key, value]) => ({ key, value })).sort((left, right) => right.value - left.value),
    categoryBreakdown: [...categoryCounts.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value).slice(0, 10),
    countryBreakdown: [...countryCounts.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value).slice(0, 10),
    completionBreakdown: [...completionCounts.entries()].map(([key, value]) => ({ key, value })),
    topProjects,
    topSkills: [...combinedSkillCounts.entries()].map(([name, value]) => ({ name, value })).sort((left, right) => right.value - left.value).slice(0, 14),
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
    projectsResponse,
    articlesResponse,
    followersResponse,
    followingResponse,
    bookmarksResponse,
  ] = await Promise.all([
    supabase.from("profiles").select("id, name, username").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("id").eq("owner_id", userId),
    supabase.from("articles").select("id, views_count").eq("author_user_id", userId),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_user_id", userId),
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_user_id", userId),
    supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const profile = profileResponse.data;
  const userProjects = projectsResponse.data || [];
  const userArticles = (articlesResponse.data || []) as Array<{ id: string; views_count: number | null }>;

  let receivedLikes = 0;
  let receivedDislikes = 0;

  if (userProjects.length > 0) {
    const projectIds = userProjects.map((p) => p.id);
    const { data: projectVotes } = await supabase
      .from("votes")
      .select("value")
      .in("project_id", projectIds);

    for (const vote of projectVotes || []) {
      if (vote.value === 1) receivedLikes += 1;
      if (vote.value === -1) receivedDislikes += 1;
    }
  }

  return {
    name: profile?.name || profile?.username || null,
    username: profile?.username || null,
    projectsCount: userProjects.length,
    articlesCount: userArticles.length,
    followersCount: followersResponse.count || 0,
    followingCount: followingResponse.count || 0,
    bookmarksCount: bookmarksResponse.count || 0,
    receivedLikes,
    receivedDislikes,
    articleViews: userArticles.reduce((sum, a) => sum + (a.views_count || 0), 0),
  };
}
