import { describe, expect, it } from "vitest";
import {
  activatedAt,
  buildProductMetrics,
  labelReferrerHost,
  lastWeekStarts,
  median,
  portfolioSignupChannel,
  startOfUtcWeek,
  toIsoDate,
  type MetricsUserRow,
  type MetricsViewRollupRow,
} from "@/lib/product-metrics";

// Saturday. The current week starts on Monday 2026-09-21; the 8-week window on
// Monday 2026-08-03.
const NOW = new Date("2026-09-26T12:00:00Z");

function user(overrides: Partial<MetricsUserRow>): MetricsUserRow {
  return {
    account_id: "id",
    signed_up_at: "2026-09-22T10:00:00Z",
    email_confirmed: true,
    last_active_at: null,
    first_project_at: null,
    first_external_view_at: null,
    signup_source_recorded: false,
    signup_referrer_host: null,
    signup_utm_source: null,
    is_admin: false,
    ...overrides,
  };
}

describe("week helpers", () => {
  it("starts weeks on Monday in UTC", () => {
    expect(toIsoDate(startOfUtcWeek(NOW))).toBe("2026-09-21");
    expect(toIsoDate(startOfUtcWeek(new Date("2026-09-27T23:59:00Z")))).toBe("2026-09-21");
    expect(toIsoDate(startOfUtcWeek(new Date("2026-09-21T00:00:00Z")))).toBe("2026-09-21");
  });

  it("lists the last weeks oldest first", () => {
    expect(lastWeekStarts(NOW, 3)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(lastWeekStarts(NOW, 8)[0]).toBe("2026-08-03");
  });
});

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("activatedAt", () => {
  it("is the later of the first project and the first outside view", () => {
    expect(
      activatedAt(
        user({
          first_project_at: "2026-09-10T00:00:00Z",
          first_external_view_at: "2026-09-12T00:00:00Z",
        }),
      ),
    ).toBe(Date.parse("2026-09-12T00:00:00Z"));
  });

  it("is null until both have happened", () => {
    expect(activatedAt(user({ first_project_at: "2026-09-10T00:00:00Z" }))).toBeNull();
    expect(activatedAt(user({ first_external_view_at: "2026-09-10T00:00:00Z" }))).toBeNull();
  });
});

describe("labelReferrerHost", () => {
  it.each([
    ["lnkd.in", "LinkedIn"],
    ["linkedin.com", "LinkedIn"],
    ["l.facebook.com", "Facebook"],
    ["org.telegram.messenger", "Telegram"],
    ["t.me", "Telegram"],
    ["www.google.com.ua", "Google"],
    ["com.google.android.gm", "Google"],
    ["gemini.google.com", "Gemini"],
    ["example.org", "example.org"],
  ])("%s → %s", (host, label) => {
    expect(labelReferrerHost(host)).toBe(label);
  });
});

describe("buildProductMetrics", () => {
  const users: MetricsUserRow[] = [
    // Left out: platform admin.
    user({
      account_id: "admin",
      is_admin: true,
      first_project_at: "2026-09-22T11:00:00Z",
      first_external_view_at: "2026-09-23T11:00:00Z",
    }),
    // This week: first project in 3 h, outside view two days later.
    user({
      account_id: "a",
      signed_up_at: "2026-09-22T10:00:00Z",
      first_project_at: "2026-09-22T13:00:00Z",
      first_external_view_at: "2026-09-24T09:00:00Z",
      signup_source_recorded: true,
      signup_utm_source: "linkedin",
      signup_referrer_host: "lnkd.in",
    }),
    // Week of Aug 31: unconfirmed, no project, came back after 9 days.
    user({
      account_id: "b",
      signed_up_at: "2026-09-01T00:00:00Z",
      email_confirmed: false,
      last_active_at: "2026-09-10T00:00:00Z",
    }),
    // Week of Aug 3: project after 48 h, activated in the week of Aug 17,
    // never came back.
    user({
      account_id: "c",
      signed_up_at: "2026-08-04T00:00:00Z",
      last_active_at: "2026-08-05T00:00:00Z",
      first_project_at: "2026-08-06T00:00:00Z",
      first_external_view_at: "2026-08-20T00:00:00Z",
      signup_source_recorded: true,
    }),
    // Before the window: counts toward the total, not toward any week.
    user({
      account_id: "d",
      signed_up_at: "2026-05-01T00:00:00Z",
      first_project_at: "2026-06-01T00:00:00Z",
      first_external_view_at: "2026-06-02T00:00:00Z",
    }),
  ];

  const views: MetricsViewRollupRow[] = [
    { week_start: "2026-09-21", target_type: "profile", source: "external", referrer_host: "lnkd.in", owner_is_admin: false, views: "3" },
    { week_start: "2026-09-21", target_type: "project", source: "external", referrer_host: "linkedin.com", owner_is_admin: false, views: 2 },
    { week_start: "2026-09-21", target_type: "project", source: "direct", referrer_host: null, owner_is_admin: false, views: 4 },
    { week_start: "2026-09-14", target_type: "profile", source: "internal", referrer_host: null, owner_is_admin: false, views: 5 },
    // Left out: an admin's portfolio, an article, a week outside the window.
    { week_start: "2026-09-21", target_type: "profile", source: "external", referrer_host: "google.com", owner_is_admin: true, views: 10 },
    { week_start: "2026-09-21", target_type: "article", source: "external", referrer_host: "google.com", owner_is_admin: false, views: 7 },
    { week_start: "2026-07-27", target_type: "profile", source: "external", referrer_host: "t.me", owner_is_admin: false, views: 1 },
  ];

  const metrics = buildProductMetrics({ users, views, now: NOW });

  it("covers eight weeks ending with the current one", () => {
    expect(metrics.weeks.map((week) => week.start)).toEqual(lastWeekStarts(NOW, 8));
  });

  it("counts sign-ups per week without admins", () => {
    expect(metrics.weeks[7]).toMatchObject({ signups: 1, confirmedSignups: 1 });
    expect(metrics.weeks[4]).toMatchObject({ signups: 1, confirmedSignups: 0 });
    expect(metrics.weeks[0]).toMatchObject({ signups: 1, confirmedSignups: 1 });
    expect(metrics.weeks.reduce((sum, week) => sum + week.signups, 0)).toBe(3);
    expect(metrics.excludedAdmins).toBe(1);
  });

  it("places each activation in the week it happened", () => {
    expect(metrics.activation).toEqual({ total: 3, thisWeek: 1 });
    expect(metrics.weeks[2].newActivated).toBe(1);
    expect(metrics.weeks[7].newActivated).toBe(1);
  });

  it("measures the first-project funnel over every account", () => {
    expect(metrics.funnel).toEqual({
      accounts: 4,
      withFirstProject: 3,
      // 3 h, 48 h and 744 h.
      medianHoursToFirstProject: 48,
    });
  });

  it("only judges retention for accounts old enough", () => {
    expect(metrics.cohorts[0]).toMatchObject({
      start: "2026-08-03",
      size: 1,
      withFirstProject: 1,
      medianHoursToFirstProject: 48,
      returnedAfter7: { returned: 0, eligible: 1 },
      returnedAfter30: { returned: 0, eligible: 1 },
    });
    expect(metrics.cohorts[4]).toMatchObject({
      size: 1,
      withFirstProject: 0,
      medianHoursToFirstProject: null,
      returnedAfter7: { returned: 1, eligible: 1 },
      returnedAfter30: null,
    });
    expect(metrics.cohorts[7].returnedAfter7).toBeNull();
    expect(metrics.cohorts[1]).toMatchObject({ size: 0, returnedAfter7: null });
  });

  it("splits portfolio views into outside and internal, portfolio only", () => {
    expect(metrics.weeks[7]).toMatchObject({ outsideViews: 9, internalViews: 0 });
    expect(metrics.weeks[6]).toMatchObject({ outsideViews: 0, internalViews: 5 });
  });

  it("groups referrers by channel and keeps direct views apart", () => {
    expect(metrics.referrers).toEqual([{ label: "LinkedIn", count: 5 }]);
    expect(metrics.directViews).toBe(4);
  });

  it("separates recorded, direct and unknown sign-up sources", () => {
    expect(metrics.signupSources).toEqual([{ label: "linkedin", count: 1 }]);
    expect(metrics.directSignups).toBe(1);
    expect(metrics.unattributedSignups).toBe(1);
  });

  it("returns an all-zero window for an empty platform", () => {
    const empty = buildProductMetrics({ users: [], views: [], now: NOW });
    expect(empty.activation).toEqual({ total: 0, thisWeek: 0 });
    expect(empty.funnel).toEqual({
      accounts: 0,
      withFirstProject: 0,
      medianHoursToFirstProject: null,
    });
    expect(empty.weeks).toHaveLength(8);
    expect(empty.referrers).toEqual([]);
  });
});

describe("sign-ups through a portfolio", () => {
  const recorded = { signup_source_recorded: true };

  it("recognises the share loop's tagged links wherever they landed", () => {
    expect(
      portfolioSignupChannel(
        user({ ...recorded, signup_utm_source: "badge", signup_utm_medium: "portfolio" }),
      ),
    ).toBe("tag:badge");
    expect(
      portfolioSignupChannel(
        user({
          ...recorded,
          signup_utm_source: "qr",
          signup_utm_medium: "portfolio",
          signup_landing_path: "/uk",
        }),
      ),
    ).toBe("tag:qr");
  });

  it("counts a portfolio page opened from outside, by where the link was", () => {
    const landing = { ...recorded, signup_landing_path: "/uk/u/olena" };
    expect(
      portfolioSignupChannel(user({ ...landing, signup_referrer_host: "www.linkedin.com" })),
    ).toBe("LinkedIn");
    expect(portfolioSignupChannel(user(landing))).toBe("direct");
    expect(
      portfolioSignupChannel(
        user({ ...landing, signup_utm_source: "dou", signup_referrer_host: "t.co" }),
      ),
    ).toBe("dou");
    expect(
      portfolioSignupChannel(
        user({ ...recorded, signup_landing_path: "/projects/landing-redesign" }),
      ),
    ).toBe("direct");
  });

  it("leaves out other landings, unknown sources and the old function's rows", () => {
    expect(portfolioSignupChannel(user({ ...recorded, signup_landing_path: "/uk" }))).toBeNull();
    expect(
      portfolioSignupChannel(
        user({ ...recorded, signup_utm_source: "badge", signup_utm_medium: "newsletter" }),
      ),
    ).toBeNull();
    // No consent: nothing is known about the visit.
    expect(
      portfolioSignupChannel(user({ signup_landing_path: "/u/olena", signup_utm_source: "qr" })),
    ).toBeNull();
    // Before 2026-09-28-share-loop.sql the two columns are not returned at all.
    expect(
      portfolioSignupChannel(user({ ...recorded, signup_referrer_host: "linkedin.com" })),
    ).toBeNull();
  });

  it("totals them for the window and ranks the channels", () => {
    const inWindow = "2026-09-22T10:00:00Z";
    const metrics = buildProductMetrics({
      users: [
        user({ ...recorded, signed_up_at: inWindow, signup_landing_path: "/u/a" }),
        user({ ...recorded, signed_up_at: inWindow, signup_landing_path: "/en/u/b" }),
        user({
          ...recorded,
          signed_up_at: inWindow,
          signup_utm_source: "qr",
          signup_utm_medium: "portfolio",
        }),
        user({ ...recorded, signed_up_at: inWindow, signup_landing_path: "/talents" }),
        // Outside the 8-week window.
        user({ ...recorded, signed_up_at: "2026-06-01T10:00:00Z", signup_landing_path: "/u/c" }),
        // Admins are never counted.
        user({ ...recorded, signed_up_at: inWindow, signup_landing_path: "/u/d", is_admin: true }),
      ],
      views: [],
      now: NOW,
    });

    expect(metrics.portfolioSignups).toEqual({
      total: 3,
      channels: [
        { label: "direct", count: 2 },
        { label: "tag:qr", count: 1 },
      ],
    });
    // The tag also shows as a source in the general ranking.
    expect(metrics.signupSources).toContainEqual({ label: "qr", count: 1 });
  });
});
