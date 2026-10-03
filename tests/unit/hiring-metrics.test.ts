import { describe, expect, it } from "vitest";
import {
  buildHiringMetrics,
  type HiringApplicationRow,
  type HiringVacancyRow,
} from "@/lib/hiring-metrics";

const NOW = new Date("2026-10-03T12:00:00Z");

function vacancy(patch: Partial<HiringVacancyRow> = {}): HiringVacancyRow {
  return {
    vacancy_id: "v",
    company_id: "c1",
    status: "published",
    moderation_status: "approved",
    company_visible: true,
    published_at: "2026-09-01T10:00:00Z",
    expires_at: "2026-10-31T10:00:00Z",
    first_application_at: null,
    applications: 0,
    ...patch,
  };
}

function application(patch: Partial<HiringApplicationRow> = {}): HiringApplicationRow {
  return { created_at: "2026-09-20T10:00:00Z", viewed_at: null, status: "new", ...patch };
}

describe("buildHiringMetrics", () => {
  it("is all zeros and dashes on an empty platform", () => {
    const metrics = buildHiringMetrics({ vacancies: [], applications: [], signals: null, now: NOW });

    expect(metrics.openVacancies).toBe(0);
    expect(metrics.openCompanies).toBe(0);
    expect(metrics.weeks).toHaveLength(8);
    expect(metrics.weeks.every((week) => week.applications === 0)).toBe(true);
    expect(metrics.replyWithin14Days).toEqual({ part: 0, whole: 0 });
    expect(metrics.viewedWithin7Days).toEqual({ part: 0, whole: 0 });
    expect(metrics.medianHoursToFirstApplication).toBeNull();
    expect(metrics.alerts).toEqual({
      alerts: 0,
      emailAlerts: 0,
      people: 0,
      profileAlerts: 0,
      delivered30Days: 0,
      emailed30Days: 0,
    });
    expect(metrics.companyContactOpens).toEqual({ opens30Days: 0, companies30Days: 0 });
  });

  it("counts open vacancies and the companies behind them", () => {
    const metrics = buildHiringMetrics({
      now: NOW,
      signals: null,
      applications: [],
      vacancies: [
        vacancy({ vacancy_id: "a", company_id: "c1" }),
        vacancy({ vacancy_id: "b", company_id: "c1" }),
        vacancy({ vacancy_id: "c", company_id: "c2" }),
        vacancy({ vacancy_id: "closed", status: "closed" }),
        vacancy({ vacancy_id: "lapsed", expires_at: "2026-10-01T00:00:00Z" }),
        vacancy({ vacancy_id: "no-date", expires_at: null }),
        vacancy({ vacancy_id: "hidden", moderation_status: "restricted" }),
        vacancy({ vacancy_id: "hidden-company", company_id: "c9", company_visible: false }),
      ],
    });

    expect(metrics.openVacancies).toBe(3);
    expect(metrics.openCompanies).toBe(2);
  });

  it("measures replies within 14 days among vacancies old enough to tell", () => {
    const metrics = buildHiringMetrics({
      now: NOW,
      signals: null,
      applications: [],
      vacancies: [
        // Old, replied on day 2: counts, in time.
        vacancy({ vacancy_id: "a", first_application_at: "2026-09-03T10:00:00Z" }),
        // Old, replied on day 20: counts, late.
        vacancy({ vacancy_id: "b", first_application_at: "2026-09-21T10:00:00Z" }),
        // Old, never replied: counts, no.
        vacancy({ vacancy_id: "c" }),
        // Young, already replied: counts, in time.
        vacancy({ vacancy_id: "d", published_at: "2026-10-01T10:00:00Z", first_application_at: "2026-10-01T16:00:00Z" }),
        // Young, nothing yet: too early to tell.
        vacancy({ vacancy_id: "e", published_at: "2026-10-01T10:00:00Z" }),
        // Hidden ones and ones with no date are left out.
        vacancy({ vacancy_id: "f", moderation_status: "removed", first_application_at: "2026-09-02T10:00:00Z" }),
        vacancy({ vacancy_id: "g", published_at: null }),
      ],
    });

    expect(metrics.replyWithin14Days).toEqual({ part: 2, whole: 4 });
    // 6 h, 48 h, 480 h → the median is 48 h.
    expect(metrics.medianHoursToFirstApplication).toBe(48);
  });

  it("buckets applications by week and measures views within 7 days", () => {
    const metrics = buildHiringMetrics({
      now: NOW,
      signals: null,
      vacancies: [],
      applications: [
        // Viewed after a day: in time.
        application({ created_at: "2026-09-20T10:00:00Z", viewed_at: "2026-09-21T10:00:00Z", status: "viewed" }),
        // Viewed after ten days: late.
        application({ created_at: "2026-09-10T10:00:00Z", viewed_at: "2026-09-20T10:00:00Z", status: "rejected" }),
        // Never viewed, old enough: no.
        application({ created_at: "2026-09-15T10:00:00Z" }),
        // Fresh and unseen: too early to tell.
        application({ created_at: "2026-10-02T10:00:00Z" }),
        // Fresh and already seen: in time.
        application({ created_at: "2026-10-02T10:00:00Z", viewed_at: "2026-10-02T12:00:00Z", status: "shortlisted" }),
        // Withdrawn before anyone looked: nothing to read.
        application({ created_at: "2026-09-12T10:00:00Z", status: "withdrawn" }),
        // Withdrawn after a look still counts.
        application({ created_at: "2026-09-12T10:00:00Z", viewed_at: "2026-09-13T10:00:00Z", status: "withdrawn" }),
        // Before the chart's 8 weeks: not in a week, still in the share (the
        // database sends only the window anyway). A garbage date is skipped.
        application({ created_at: "2026-01-01T10:00:00Z", viewed_at: "2026-01-02T10:00:00Z", status: "viewed" }),
        application({ created_at: "nope" }),
      ],
    });

    expect(metrics.applicationsInWindow).toBe(7);
    expect(metrics.weeks.at(-1)).toEqual({ start: "2026-09-28", applications: 2 });
    expect(metrics.weeks.reduce((sum, week) => sum + week.applications, 0)).toBe(7);
    expect(metrics.viewedWithin7Days).toEqual({ part: 4, whole: 6 });
  });

  it("reads the signals, bigint strings included", () => {
    const metrics = buildHiringMetrics({
      now: NOW,
      vacancies: [],
      applications: [],
      signals: {
        alerts: "12",
        email_alerts: 9,
        alert_people: "7",
        profile_alerts: 3,
        delivered_30d: "40",
        emailed_30d: null,
        company_opens_30d: "5",
        opening_companies_30d: "nope",
      },
    });

    expect(metrics.alerts).toEqual({
      alerts: 12,
      emailAlerts: 9,
      people: 7,
      profileAlerts: 3,
      delivered30Days: 40,
      emailed30Days: 0,
    });
    expect(metrics.companyContactOpens).toEqual({ opens30Days: 5, companies30Days: 0 });
  });
});
