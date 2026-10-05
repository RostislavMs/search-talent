import { describe, expect, it } from "vitest";
import {
  hasPortfolioViews,
  normalizePortfolioViews,
  sumPortfolioViews,
} from "@/lib/portfolio-views";

const payload = {
  today: "2026-10-05",
  days: [
    { day: "2026-10-05", profile: 2, projects: 0 },
    { day: "2026-10-04", profile: 0, projects: 1 },
    { day: "2026-09-29", profile: 1, projects: 3 },
    { day: "2026-09-28", profile: 5, projects: "2" },
    { day: "2026-09-06", profile: 1, projects: 0 },
    { day: "2026-09-05", profile: 100, projects: 0 }, // before the window
    { day: "not a day", profile: 9, projects: 9 },
  ],
  sources: { external: 4, direct: "3", internal: -1 },
  referrers: [{ host: "linkedin.com", views: 3 }, { host: "", views: 1 }, null],
  projects: [
    { id: "p1", title: "Night city", slug: "night-city", views: 6, viewsWeek: 4 },
    { id: "p2", title: "No slug", slug: null, views: 1, viewsWeek: 0 },
    { title: "no id" },
  ],
};

describe("normalizePortfolioViews", () => {
  it("is null for anything that isn't the RPC payload", () => {
    expect(normalizePortfolioViews(null)).toBeNull();
    expect(normalizePortfolioViews([])).toBeNull();
    expect(normalizePortfolioViews({ days: [] })).toBeNull();
  });

  it("always spans 30 days ending today, zeros where nothing came", () => {
    const views = normalizePortfolioViews(payload)!;
    expect(views.days).toHaveLength(30);
    expect(views.days[0]).toEqual({ day: "2026-09-06", profile: 1, projects: 0 });
    expect(views.days[29]).toEqual({ day: "2026-10-05", profile: 2, projects: 0 });
    expect(views.days[28]).toEqual({ day: "2026-10-04", profile: 0, projects: 1 });
    expect(views.days[27]).toEqual({ day: "2026-10-03", profile: 0, projects: 0 });
  });

  it("crosses a month boundary without gaps", () => {
    const views = normalizePortfolioViews({ today: "2026-03-01" })!;
    expect(views.days.map((day) => day.day).slice(-3)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });

  it("keeps only well-formed counts, referrers and projects", () => {
    const views = normalizePortfolioViews(payload)!;
    expect(views.sources).toEqual({ external: 4, direct: 3, internal: 0 });
    expect(views.referrers).toEqual([
      { host: "linkedin.com", views: 3 },
    ]);
    expect(views.projects).toEqual([
      { id: "p1", title: "Night city", slug: "night-city", views: 6, viewsWeek: 4 },
      { id: "p2", title: "No slug", slug: null, views: 1, viewsWeek: 0 },
    ]);
  });
});

describe("sumPortfolioViews", () => {
  const views = normalizePortfolioViews(payload)!;

  it("sums the last 7 days, today included", () => {
    // 05.10, 04.10 and 29.09 are inside; 28.09 is the eighth day back.
    expect(sumPortfolioViews(views, 7)).toEqual({ profile: 3, projects: 4, total: 7 });
  });

  it("sums the whole month", () => {
    expect(sumPortfolioViews(views, 30)).toEqual({ profile: 9, projects: 6, total: 15 });
    expect(hasPortfolioViews(views)).toBe(true);
    expect(hasPortfolioViews(normalizePortfolioViews({ today: "2026-10-05" })!)).toBe(false);
  });
});
