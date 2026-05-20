import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateProjectRating,
  calculateUserRating,
  clamp,
  getProfileCompletenessScore,
  getProjectCompletenessScore,
  getWilsonScore,
  isWithinTimeframe,
} from "@/lib/leaderboards";

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

describe("clamp", () => {
  it("returns value when within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps below min", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("works for negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-20, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// getWilsonScore (Wilson lower-bound, 95% CI)
// ---------------------------------------------------------------------------

describe("getWilsonScore", () => {
  it("returns 0 when there are no votes", () => {
    expect(getWilsonScore(0, 0)).toBe(0);
  });

  it("returns a value below 1 even with only positive votes (CI lower bound)", () => {
    const score = getWilsonScore(10, 0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns ~0 when only dislikes exist", () => {
    expect(getWilsonScore(0, 10)).toBeCloseTo(0, 5);
  });

  it("approaches the positive ratio as sample grows", () => {
    const small = getWilsonScore(8, 2);
    const large = getWilsonScore(800, 200);
    expect(large).toBeGreaterThan(small);
    // 0.8 is the true ratio; with 1000 votes Wilson lower-bound should be close.
    expect(large).toBeGreaterThan(0.75);
    expect(large).toBeLessThan(0.8);
  });

  it("monotonically rewards more positive votes", () => {
    expect(getWilsonScore(5, 5)).toBeLessThan(getWilsonScore(10, 5));
    expect(getWilsonScore(10, 5)).toBeLessThan(getWilsonScore(20, 5));
  });

  it("monotonically penalises more negative votes", () => {
    expect(getWilsonScore(10, 0)).toBeGreaterThan(getWilsonScore(10, 5));
    expect(getWilsonScore(10, 5)).toBeGreaterThan(getWilsonScore(10, 20));
  });

  it("returns a finite number for extreme inputs", () => {
    expect(Number.isFinite(getWilsonScore(1_000_000, 1))).toBe(true);
    expect(Number.isFinite(getWilsonScore(1, 1_000_000))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isWithinTimeframe
// ---------------------------------------------------------------------------

describe("isWithinTimeframe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for any value when timeframe is 'all'", () => {
    expect(isWithinTimeframe(null, "all")).toBe(true);
    expect(isWithinTimeframe("2020-01-01T00:00:00.000Z", "all")).toBe(true);
  });

  it("returns false for null/undefined when timeframe is 'month'", () => {
    expect(isWithinTimeframe(null, "month")).toBe(false);
    expect(isWithinTimeframe(undefined, "month")).toBe(false);
  });

  it("returns false for malformed dates", () => {
    expect(isWithinTimeframe("not-a-date", "month")).toBe(false);
  });

  it("returns true for a date within the last 30 days", () => {
    expect(isWithinTimeframe("2026-05-10T12:00:00.000Z", "month")).toBe(true);
  });

  it("returns false for a date older than 30 days", () => {
    expect(isWithinTimeframe("2026-04-10T00:00:00.000Z", "month")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getProfileCompletenessScore
// ---------------------------------------------------------------------------

function emptyProfileInput() {
  return {
    username: null,
    name: null,
    avatarUrl: null,
    headline: null,
    bio: null,
    countryId: null,
    city: null,
    website: null,
    github: null,
    twitter: null,
    linkedin: null,
    contactEmail: null,
    telegramUsername: null,
    phone: null,
    preferredContactMethod: null,
    experienceLevel: null,
    experienceYears: null,
    employmentTypesCount: 0,
    workFormatsCount: 0,
    salaryExpectations: null,
    salaryCurrency: null,
    additionalInfo: null,
    skillsCount: 0,
    languagesCount: 0,
    educationCount: 0,
    certificateCount: 0,
    qaCount: 0,
    workExperienceCount: 0,
  };
}

function fullProfileInput() {
  return {
    username: "ros",
    name: "Ros",
    avatarUrl: "https://example.com/a.png",
    headline: "Engineer",
    bio: "About me",
    countryId: 1,
    city: "Kyiv",
    website: "https://ros.dev",
    github: "https://github.com/ros",
    twitter: "@ros",
    linkedin: "https://linkedin.com/in/ros",
    contactEmail: "ros@example.com",
    telegramUsername: "@ros",
    phone: "+380...",
    preferredContactMethod: "email",
    experienceLevel: "senior",
    experienceYears: 8,
    employmentTypesCount: 2,
    workFormatsCount: 2,
    salaryExpectations: "5000",
    salaryCurrency: "USD",
    additionalInfo: "Notes",
    skillsCount: 5,
    languagesCount: 2,
    educationCount: 1,
    certificateCount: 2,
    qaCount: 3,
    workExperienceCount: 3,
  };
}

describe("getProfileCompletenessScore", () => {
  it("returns 0 for a fully empty profile", () => {
    expect(getProfileCompletenessScore(emptyProfileInput())).toBe(0);
  });

  it("returns 1 for a fully filled profile", () => {
    expect(getProfileCompletenessScore(fullProfileInput())).toBe(1);
  });

  it("returns a value strictly between 0 and 1 for partial profiles", () => {
    const partial = { ...emptyProfileInput(), username: "ros", name: "Ros" };
    const score = getProfileCompletenessScore(partial);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("treats any single contact channel as a fulfilled contact field", () => {
    const onlyEmail = { ...emptyProfileInput(), contactEmail: "x@y.z" };
    const onlyPhone = { ...emptyProfileInput(), phone: "+380" };
    expect(getProfileCompletenessScore(onlyEmail)).toBe(
      getProfileCompletenessScore(onlyPhone),
    );
  });
});

// ---------------------------------------------------------------------------
// getProjectCompletenessScore
// ---------------------------------------------------------------------------

function emptyProjectInput() {
  return {
    description: null,
    role: null,
    status: null,
    teamSize: null,
    projectUrl: null,
    repositoryUrl: null,
    startedOn: null,
    completedOn: null,
    problem: null,
    solution: null,
    results: null,
    coverUrl: null,
    mediaCount: 0,
    technologyCount: 0,
  };
}

function fullProjectInput() {
  return {
    description: "desc",
    role: "lead",
    status: "shipped",
    teamSize: 4,
    projectUrl: "https://example.com",
    repositoryUrl: "https://github.com/x/y",
    startedOn: "2025-01-01",
    completedOn: "2025-06-01",
    problem: "p",
    solution: "s",
    results: "r",
    coverUrl: "https://example.com/cover.png",
    mediaCount: 5,
    technologyCount: 6,
  };
}

describe("getProjectCompletenessScore", () => {
  it("returns 0 for a fully empty project", () => {
    expect(getProjectCompletenessScore(emptyProjectInput())).toBe(0);
  });

  it("returns 1 for a fully filled project", () => {
    expect(getProjectCompletenessScore(fullProjectInput())).toBe(1);
  });

  it("monotonically grows when adding fields", () => {
    const a = emptyProjectInput();
    const b = { ...a, description: "x" };
    const c = { ...b, problem: "p", solution: "s", results: "r" };
    expect(getProjectCompletenessScore(b)).toBeGreaterThan(
      getProjectCompletenessScore(a),
    );
    expect(getProjectCompletenessScore(c)).toBeGreaterThan(
      getProjectCompletenessScore(b),
    );
  });
});

// ---------------------------------------------------------------------------
// calculateProjectRating
// ---------------------------------------------------------------------------

function baseProjectRatingInput() {
  return {
    timeframe: "all" as const,
    likes: 0,
    dislikes: 0,
    recentLikes: 0,
    recentDislikes: 0,
    mediaCount: 0,
    recentMediaCount: 0,
    technologyCount: 0,
    completenessScore: 0,
    createdAt: null as string | null,
  };
}

describe("calculateProjectRating", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 for a fully empty project", () => {
    expect(calculateProjectRating(baseProjectRatingInput())).toBe(0);
  });

  it("returns an integer in the 0-100 range", () => {
    const score = calculateProjectRating({
      ...baseProjectRatingInput(),
      likes: 50,
      dislikes: 2,
      mediaCount: 10,
      technologyCount: 8,
      completenessScore: 0.9,
      createdAt: "2026-05-15T12:00:00.000Z",
    });
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("grows monotonically with positive votes (all other things equal)", () => {
    const base = { ...baseProjectRatingInput(), completenessScore: 0.5 };
    const a = calculateProjectRating({ ...base, likes: 5, dislikes: 0 });
    const b = calculateProjectRating({ ...base, likes: 50, dislikes: 0 });
    const c = calculateProjectRating({ ...base, likes: 500, dislikes: 0 });
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("emphasises recent votes when timeframe is 'month'", () => {
    const all = calculateProjectRating({
      ...baseProjectRatingInput(),
      timeframe: "all",
      likes: 100,
      recentLikes: 0,
    });
    const month = calculateProjectRating({
      ...baseProjectRatingInput(),
      timeframe: "month",
      likes: 100,
      recentLikes: 0,
    });
    // 'month' should weigh the (empty) recent window heavier, dropping the score.
    expect(month).toBeLessThan(all);
  });

  it("never exceeds 100 even with maxed-out inputs", () => {
    const score = calculateProjectRating({
      ...baseProjectRatingInput(),
      likes: 100000,
      dislikes: 0,
      recentLikes: 100000,
      recentDislikes: 0,
      mediaCount: 1000,
      recentMediaCount: 1000,
      technologyCount: 1000,
      completenessScore: 1,
      createdAt: new Date().toISOString(),
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// calculateUserRating
// ---------------------------------------------------------------------------

function baseUserRatingInput() {
  return {
    timeframe: "all" as const,
    profileLikes: 0,
    profileDislikes: 0,
    recentProfileLikes: 0,
    recentProfileDislikes: 0,
    profileCompleteness: 0,
    projectCount: 0,
    recentProjectCount: 0,
    mediaCount: 0,
    recentMediaCount: 0,
    technologyCount: 0,
    bestProjectRating: 0,
    averageProjectRating: 0,
    newestProjectCreatedAt: null as string | null,
  };
}

describe("calculateUserRating", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 for a fully empty creator", () => {
    expect(calculateUserRating(baseUserRatingInput())).toBe(0);
  });

  it("returns an integer in the 0-100 range", () => {
    const score = calculateUserRating({
      ...baseUserRatingInput(),
      profileCompleteness: 0.8,
      projectCount: 4,
      mediaCount: 10,
      technologyCount: 7,
      bestProjectRating: 90,
      averageProjectRating: 75,
      newestProjectCreatedAt: "2026-05-15T00:00:00.000Z",
    });
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("grows with profile completeness (all other things equal)", () => {
    const base = baseUserRatingInput();
    const a = calculateUserRating({ ...base, profileCompleteness: 0 });
    const b = calculateUserRating({ ...base, profileCompleteness: 0.5 });
    const c = calculateUserRating({ ...base, profileCompleteness: 1 });
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("grows with stronger portfolio ratings (all other things equal)", () => {
    const base = { ...baseUserRatingInput(), profileCompleteness: 0.5 };
    const weak = calculateUserRating({
      ...base,
      averageProjectRating: 10,
      bestProjectRating: 20,
    });
    const strong = calculateUserRating({
      ...base,
      averageProjectRating: 80,
      bestProjectRating: 95,
    });
    expect(strong).toBeGreaterThan(weak);
  });

  it("never exceeds 100 even with maxed-out inputs", () => {
    const score = calculateUserRating({
      ...baseUserRatingInput(),
      profileLikes: 100000,
      recentProfileLikes: 100000,
      profileCompleteness: 1,
      projectCount: 100,
      recentProjectCount: 100,
      mediaCount: 1000,
      recentMediaCount: 1000,
      technologyCount: 1000,
      bestProjectRating: 100,
      averageProjectRating: 100,
      newestProjectCreatedAt: new Date().toISOString(),
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("handles a creator with no projects gracefully", () => {
    const score = calculateUserRating({
      ...baseUserRatingInput(),
      profileCompleteness: 0.6,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
