// ---------------------------------------------------------------------------
// Scoring & leaderboard utilities
// ---------------------------------------------------------------------------
//
// Every rating resolves to an integer on a 0-100 scale.
//
// WEIGHT TABLES — each row is the maximum points for that signal.
// All weights in a table sum to 100.
//
// Adjusting a weight changes how much that signal contributes relative to
// everything else. The helpers (Wilson, diminishing returns, time decay)
// normalise raw counts to a 0-1 range before multiplying by the weight.
// ---------------------------------------------------------------------------

export type LeaderboardTimeframe = "all" | "month";

// ---- weight configuration -------------------------------------------------

type ProjectWeights = {
  communityTrust: number;
  contentQuality: number;
  mediaRichness: number;
  technologyBreadth: number;
  freshness: number;
};

type ProfileWeights = {
  completeness: number;
  portfolio: number;
  communityTrust: number;
  production: number;
  techBreadth: number;
  freshness: number;
};

const PROJECT_WEIGHTS: Record<LeaderboardTimeframe, ProjectWeights> = {
  all: {
    communityTrust: 35,
    contentQuality: 30,
    mediaRichness: 15,
    technologyBreadth: 10,
    freshness: 10,
  },
  month: {
    communityTrust: 40,
    contentQuality: 22,
    mediaRichness: 15,
    technologyBreadth: 8,
    freshness: 15,
  },
};

const PROFILE_WEIGHTS: Record<LeaderboardTimeframe, ProfileWeights> = {
  all: {
    completeness: 25,
    portfolio: 30,
    communityTrust: 20,
    production: 15,
    techBreadth: 10,
    freshness: 0,
  },
  month: {
    completeness: 18,
    portfolio: 28,
    communityTrust: 22,
    production: 18,
    techBreadth: 8,
    freshness: 6,
  },
};

// Saturation points — the count at which a signal reaches ~50 % of its max.
const SATURATION = {
  media: 6,
  technologies: 10,
  projects: 8,
  profileTechnologies: 12,
} as const;

// Half-life in days — how quickly freshness decays by timeframe.
const HALF_LIFE_DAYS: Record<LeaderboardTimeframe, number> = {
  all: 45,
  month: 20,
};

// ---- low-level helpers ----------------------------------------------------

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const monthWindowMs = 30 * 24 * 60 * 60 * 1000;

export function isWithinTimeframe(
  value: string | null | undefined,
  timeframe: LeaderboardTimeframe,
) {
  if (timeframe === "all") return true;
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= monthWindowMs;
}

/**
 * Wilson lower-bound confidence interval (z = 1.96, 95 % CI).
 * Returns a value between 0 and 1. With few votes the score is
 * conservative; it approaches the actual positive ratio as votes grow.
 */
export function getWilsonScore(positive: number, negative: number) {
  const n = positive + negative;
  if (n === 0) return 0;
  const z = 1.96;
  const phat = positive / n;
  return (
    (phat +
      (z * z) / (2 * n) -
      z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}

/**
 * Smooth saturation curve.  Returns 0-1.
 * At `count === saturation` the result is ~0.5.
 * Prevents gaming: adding 20 items is only marginally better than 10.
 */
function diminishing(count: number, saturation: number) {
  if (count <= 0) return 0;
  return 1 - Math.exp((-count * Math.LN2) / saturation);
}

/**
 * Exponential freshness decay.  Returns 0-1.
 * At `halfLifeDays` after creation the result is 0.5.
 */
function freshness(createdAt: string | null, halfLifeDays: number) {
  if (!createdAt) return 0;
  const ms = Date.now() - new Date(createdAt).getTime();
  if (ms < 0 || Number.isNaN(ms)) return 1;
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.exp((-days * Math.LN2) / halfLifeDays);
}

// ---- completeness scores (0-1) -------------------------------------------

function weightedCompletion(values: Array<{ filled: boolean; weight: number }>) {
  const total = values.reduce((s, i) => s + i.weight, 0);
  if (total === 0) return 0;
  const filled = values.reduce((s, i) => s + (i.filled ? i.weight : 0), 0);
  return filled / total;
}

export function getProfileCompletenessScore(input: {
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
}) {
  return weightedCompletion([
    { filled: Boolean(input.username), weight: 1.5 },
    { filled: Boolean(input.name), weight: 1 },
    { filled: Boolean(input.avatarUrl), weight: 1.2 },
    { filled: Boolean(input.headline), weight: 1 },
    { filled: Boolean(input.bio), weight: 1.4 },
    { filled: Boolean(input.countryId), weight: 0.8 },
    { filled: Boolean(input.city), weight: 0.5 },
    { filled: Boolean(input.website), weight: 0.8 },
    { filled: Boolean(input.github), weight: 0.8 },
    { filled: Boolean(input.twitter), weight: 0.5 },
    { filled: Boolean(input.linkedin), weight: 0.8 },
    {
      // Discipline portfolio link — at least one of behance/dribbble/
      // artstation/vimeo/youtube/instagram. Grouped because no single
      // role uses all six; designers reach for Behance, video editors
      // for Vimeo, photographers for Instagram.
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
      filled:
        Boolean(input.contactEmail) ||
        Boolean(input.telegramUsername) ||
        Boolean(input.phone),
      weight: 0.9,
    },
    { filled: Boolean(input.preferredContactMethod), weight: 0.4 },
    {
      filled: Boolean(input.experienceLevel) || input.experienceYears !== null,
      weight: 1,
    },
    { filled: input.employmentTypesCount > 0, weight: 0.8 },
    { filled: input.workFormatsCount > 0, weight: 0.8 },
    {
      filled: Boolean(input.salaryExpectations) && Boolean(input.salaryCurrency),
      weight: 0.7,
    },
    { filled: Boolean(input.additionalInfo), weight: 0.9 },
    { filled: input.skillsCount > 0, weight: 1.4 },
    { filled: input.languagesCount > 0, weight: 0.8 },
    { filled: input.educationCount > 0, weight: 1 },
    { filled: input.certificateCount > 0, weight: 1 },
    { filled: input.qaCount > 0, weight: 1.1 },
    { filled: input.workExperienceCount > 0, weight: 1.3 },
  ]);
}

// Kinds where the problem/solution/results narrative is a natural part
// of the work. Photo / audio / video / motion / 3d projects rarely need
// it — scoring them on its absence punished media-first creators.
const STORY_KINDS = new Set(["code", "qa", "writing", "design", "other"]);

export function getProjectCompletenessScore(input: {
  description: string | null;
  role: string | null;
  status: string | null;
  teamSize: number | null;
  projectUrl: string | null;
  repositoryUrl: string | null;
  startedOn: string | null;
  completedOn: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  coverUrl: string | null;
  mediaCount: number;
  technologyCount: number;
  hasKindMetadata?: boolean;
  kind?: string | null;
}) {
  // Repository URL only matters for code projects. Designers and
  // photographers should not be penalised for not having a repo.
  const repoWeight = input.kind === "code" ? 0.7 : 0;
  // Story fields keep full weight for code/qa/writing, half weight for
  // design (case-study format is common but not always present), and
  // zero for media-heavy kinds (photo/audio/video/motion/3d).
  const storyMultiplier = !input.kind || STORY_KINDS.has(input.kind)
    ? input.kind === "design"
      ? 0.5
      : 1
    : 0;

  return weightedCompletion([
    { filled: Boolean(input.description), weight: 1.2 },
    { filled: Boolean(input.role), weight: 0.8 },
    { filled: Boolean(input.status), weight: 0.5 },
    { filled: Boolean(input.teamSize), weight: 0.4 },
    { filled: Boolean(input.projectUrl), weight: 0.7 },
    { filled: Boolean(input.repositoryUrl), weight: repoWeight },
    { filled: Boolean(input.startedOn), weight: 0.5 },
    { filled: Boolean(input.completedOn), weight: 0.5 },
    { filled: Boolean(input.problem), weight: 1 * storyMultiplier },
    { filled: Boolean(input.solution), weight: 1.2 * storyMultiplier },
    { filled: Boolean(input.results), weight: 1 * storyMultiplier },
    { filled: Boolean(input.coverUrl), weight: 1 },
    { filled: input.mediaCount > 0, weight: 1 },
    { filled: input.technologyCount > 0, weight: 1 },
    // Kind-specific details (Design / Code / Video / Photo / 3D / Audio
    // / QA / Motion / Writing). Weight is high because filling these
    // fields is the strongest signal of a polished, discipline-aware
    // project page.
    { filled: Boolean(input.hasKindMetadata), weight: 1.5 },
  ]);
}

// ---- composite ratings (0-100) --------------------------------------------

export function calculateProjectRating(input: {
  timeframe: LeaderboardTimeframe;
  likes: number;
  dislikes: number;
  recentLikes: number;
  recentDislikes: number;
  mediaCount: number;
  recentMediaCount: number;
  technologyCount: number;
  completenessScore: number; // 0-1
  createdAt: string | null;
}) {
  const w = PROJECT_WEIGHTS[input.timeframe];

  // Community trust — Wilson score. For monthly, blend recent and overall.
  const overallWilson = getWilsonScore(input.likes, input.dislikes);
  const communityTrust =
    input.timeframe === "month"
      ? getWilsonScore(input.recentLikes, input.recentDislikes) * 0.75 +
        overallWilson * 0.25
      : overallWilson;

  // Media — use recent count for monthly, overall for all-time.
  const mediaCount =
    input.timeframe === "month" ? input.recentMediaCount : input.mediaCount;

  return clamp(
    Math.round(
      communityTrust * w.communityTrust +
        input.completenessScore * w.contentQuality +
        diminishing(mediaCount, SATURATION.media) * w.mediaRichness +
        diminishing(input.technologyCount, SATURATION.technologies) * w.technologyBreadth +
        freshness(input.createdAt, HALF_LIFE_DAYS[input.timeframe]) * w.freshness,
    ),
    0,
    100,
  );
}

export function calculateUserRating(input: {
  timeframe: LeaderboardTimeframe;
  profileLikes: number;
  profileDislikes: number;
  recentProfileLikes: number;
  recentProfileDislikes: number;
  profileCompleteness: number; // 0-1
  projectCount: number;
  recentProjectCount: number;
  mediaCount: number;
  recentMediaCount: number;
  technologyCount: number;
  bestProjectRating: number; // 0-100
  averageProjectRating: number; // 0-100
  newestProjectCreatedAt: string | null;
  /**
   * Optional bonus from earned badges. Pre-capped by the caller via
   * `getBadgeBonusPoints` so the formula stays a pure summation.
   */
  badgeBonus?: number;
}) {
  const w = PROFILE_WEIGHTS[input.timeframe];

  // Community trust on the profile itself.
  const overallWilson = getWilsonScore(input.profileLikes, input.profileDislikes);
  const communityTrust =
    input.timeframe === "month"
      ? getWilsonScore(input.recentProfileLikes, input.recentProfileDislikes) * 0.75 +
        overallWilson * 0.25
      : overallWilson;

  // Portfolio strength — blend of average and best project ratings (already 0-100).
  const portfolio =
    (input.averageProjectRating * 0.6 + input.bestProjectRating * 0.4) / 100;

  // Production output — projects + media with diminishing returns.
  const projectCount =
    input.timeframe === "month" ? input.recentProjectCount : input.projectCount;
  const mediaCount =
    input.timeframe === "month" ? input.recentMediaCount : input.mediaCount;
  const production =
    diminishing(projectCount, SATURATION.projects) * 0.6 +
    diminishing(mediaCount, SATURATION.media) * 0.4;

  return clamp(
    Math.round(
      input.profileCompleteness * w.completeness +
        portfolio * w.portfolio +
        communityTrust * w.communityTrust +
        production * w.production +
        diminishing(input.technologyCount, SATURATION.profileTechnologies) * w.techBreadth +
        freshness(input.newestProjectCreatedAt, HALF_LIFE_DAYS[input.timeframe]) * w.freshness,
    ) + (input.badgeBonus ?? 0),
    0,
    100,
  );
}
