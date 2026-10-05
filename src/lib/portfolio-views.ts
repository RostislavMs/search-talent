// ---------------------------------------------------------------------------
// Portfolio views for the author (My Space): the payload of
// `my_portfolio_views()` made safe to render, and the sums the page shows.
// One view = one visitor on one page on one UTC day; the author's own visits
// are never counted (see record_content_view).
// ---------------------------------------------------------------------------

export const PORTFOLIO_VIEWS_DAYS = 30;
export const PORTFOLIO_VIEWS_WEEK = 7;

export type PortfolioViewsDay = { day: string; profile: number; projects: number };

export type PortfolioViewsSources = { external: number; direct: number; internal: number };

export type PortfolioViewsProject = {
  id: string;
  title: string;
  slug: string | null;
  views: number;
  viewsWeek: number;
};

export type PortfolioViews = {
  /** Oldest first; always PORTFOLIO_VIEWS_DAYS entries, today last. */
  days: PortfolioViewsDay[];
  sources: PortfolioViewsSources;
  referrers: Array<{ host: string; views: number }>;
  projects: PortfolioViewsProject[];
};

export type PortfolioViewsTotals = { profile: number; projects: number; total: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCount(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0
    ? Math.floor(number)
    : 0;
}

function isIsoDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The RPC result, checked field by field. Null when it isn't one (no
 * migration yet, signed out): the block then stays hidden. Days missing from
 * the payload are filled with zeros, so the chart always spans 30 days.
 */
export function normalizePortfolioViews(value: unknown): PortfolioViews | null {
  if (!isRecord(value) || !isIsoDay(value.today)) {
    return null;
  }

  const today = value.today;
  const byDay = new Map<string, PortfolioViewsDay>();

  if (Array.isArray(value.days)) {
    for (const item of value.days) {
      if (isRecord(item) && isIsoDay(item.day)) {
        byDay.set(item.day, {
          day: item.day,
          profile: toCount(item.profile),
          projects: toCount(item.projects),
        });
      }
    }
  }

  const days = Array.from({ length: PORTFOLIO_VIEWS_DAYS }, (_, index) => {
    const day = addDays(today, index - (PORTFOLIO_VIEWS_DAYS - 1));
    return byDay.get(day) ?? { day, profile: 0, projects: 0 };
  });

  const sources = isRecord(value.sources) ? value.sources : {};
  const referrers = Array.isArray(value.referrers)
    ? value.referrers.flatMap((item) =>
        isRecord(item) && typeof item.host === "string" && item.host
          ? [{ host: item.host, views: toCount(item.views) }]
          : [],
      )
    : [];
  const projects = Array.isArray(value.projects)
    ? value.projects.flatMap((item) =>
        isRecord(item) && typeof item.id === "string" && typeof item.title === "string"
          ? [
              {
                id: item.id,
                title: item.title,
                slug: typeof item.slug === "string" && item.slug ? item.slug : null,
                views: toCount(item.views),
                viewsWeek: toCount(item.viewsWeek),
              },
            ]
          : [],
      )
    : [];

  return {
    days,
    sources: {
      external: toCount(sources.external),
      direct: toCount(sources.direct),
      internal: toCount(sources.internal),
    },
    referrers,
    projects,
  };
}

/** Views over the last `days` days, today included. */
export function sumPortfolioViews(views: PortfolioViews, days: number): PortfolioViewsTotals {
  const recent = views.days.slice(-days);
  const profile = recent.reduce((sum, day) => sum + day.profile, 0);
  const projects = recent.reduce((sum, day) => sum + day.projects, 0);
  return { profile, projects, total: profile + projects };
}

export function hasPortfolioViews(views: PortfolioViews): boolean {
  return sumPortfolioViews(views, PORTFOLIO_VIEWS_DAYS).total > 0;
}
