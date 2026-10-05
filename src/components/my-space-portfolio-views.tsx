import { BarRows, ChartFigure, DailyColumns, type LegendItem } from "@/components/charts/chart-primitives";
import LocalizedLink from "@/components/ui/localized-link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatCount } from "@/lib/plural";
import {
  hasPortfolioViews,
  PORTFOLIO_VIEWS_DAYS,
  PORTFOLIO_VIEWS_WEEK,
  sumPortfolioViews,
  type PortfolioViews,
  type PortfolioViewsTotals,
} from "@/lib/portfolio-views";

/**
 * My Space: how many people looked at the portfolio — a week and a month,
 * day by day, where they came from and which projects. Server-rendered; the
 * numbers come from `my_portfolio_views()`, which only returns the caller's.
 */
export default function MySpacePortfolioViews({
  dictionary,
  locale,
  views,
}: {
  dictionary: Dictionary;
  locale: Locale;
  views: PortfolioViews;
}) {
  const copy = dictionary.mySpace.portfolioViews;
  const intlLocale = locale === "uk" ? "uk-UA" : "en-US";
  const number = new Intl.NumberFormat(intlLocale);
  const dayFormat = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const formatDay = (isoDay: string) => dayFormat.format(new Date(`${isoDay}T00:00:00Z`));
  const viewsLabel = (count: number) => formatCount(count, copy.views, locale);

  return (
    <section className="mb-8 rounded-hero app-card p-5 sm:p-6" aria-labelledby="my-space-portfolio-views">
      <h2
        id="my-space-portfolio-views"
        className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
      >
        {copy.title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm app-muted">{copy.hint}</p>

      {hasPortfolioViews(views) ? (
        <ViewsBody views={views} copy={copy} number={number} formatDay={formatDay} viewsLabel={viewsLabel} />
      ) : (
        <p className="mt-5 text-sm text-[color:var(--foreground)]">{copy.empty}</p>
      )}
    </section>
  );
}

type Copy = Dictionary["mySpace"]["portfolioViews"];

function ViewsBody({
  views,
  copy,
  number,
  formatDay,
  viewsLabel,
}: {
  views: PortfolioViews;
  copy: Copy;
  number: Intl.NumberFormat;
  formatDay: (isoDay: string) => string;
  viewsLabel: (count: number) => string;
}) {
  const week = sumPortfolioViews(views, PORTFOLIO_VIEWS_WEEK);
  const month = sumPortfolioViews(views, PORTFOLIO_VIEWS_DAYS);
  const series: LegendItem[] = [
    { name: copy.profile, tone: 1 },
    { name: copy.projects, tone: 2 },
  ];
  const busiest = views.days.reduce((best, day) =>
    day.profile + day.projects > best.profile + best.projects ? day : best,
  );
  const busiestCount = busiest.profile + busiest.projects;
  const sourceRows = (["external", "direct", "internal"] as const)
    .map((key) => ({ label: copy.sources[key], values: [views.sources[key]] }))
    .filter((row) => row.values[0] > 0);
  const sourceMax = Math.max(1, ...sourceRows.map((row) => row.values[0]));

  return (
    <div className="mt-5 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <TotalTile label={copy.week} totals={week} copy={copy} number={number} />
        <TotalTile label={copy.month} totals={month} copy={copy} number={number} />
      </div>

      <ChartFigure title={copy.byDay} legend={series}>
        <DailyColumns
          columns={views.days.map((day) => ({
            title: copy.dayTitle
              .replace("{day}", formatDay(day.day))
              .replace("{profile}", number.format(day.profile))
              .replace("{projects}", number.format(day.projects)),
            values: [day.profile, day.projects],
          }))}
          series={series}
          max={Math.max(1, busiestCount)}
          ticks={[formatDay(views.days[0].day), copy.today]}
          description={copy.chartDescription
            .replace("{total}", number.format(month.total))
            .replace("{day}", formatDay(busiest.day))
            .replace("{count}", number.format(busiestCount))}
        />
      </ChartFigure>

      <div className="grid gap-6 lg:grid-cols-2">
        {sourceRows.length > 0 ? (
          <ChartFigure
            title={copy.sourcesTitle}
            note={views.sources.direct > 0 ? copy.directHint : undefined}
          >
            <BarRows rows={sourceRows} series={[{ name: copy.sourcesTitle, tone: 1 }]} max={sourceMax} />
            {views.referrers.length > 0 ? (
              <div className="mt-4 border-t app-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.referrersTitle}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {views.referrers.map((referrer) => (
                    <li key={referrer.host} className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[color:var(--foreground)]">{referrer.host}</span>
                      <span className="shrink-0 tabular-nums app-muted">{number.format(referrer.views)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ChartFigure>
        ) : null}

        {views.projects.length > 0 ? (
          <div className="rounded-2xl app-panel p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{copy.topProjects}</h3>
            <ol className="mt-4 space-y-3">
              {views.projects.map((project) => (
                <li key={project.id} className="min-w-0">
                  {project.slug ? (
                    <LocalizedLink
                      href={`/projects/${project.slug}`}
                      className="block truncate text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 transition-colors hover:decoration-[color:var(--foreground)]"
                    >
                      {project.title}
                    </LocalizedLink>
                  ) : (
                    <span className="block truncate text-sm font-medium text-[color:var(--foreground)]">
                      {project.title}
                    </span>
                  )}
                  <span className="mt-0.5 block text-xs tabular-nums app-muted">
                    {copy.projectViews
                      .replace("{month}", viewsLabel(project.views))
                      .replace("{week}", number.format(project.viewsWeek))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TotalTile({
  label,
  totals,
  copy,
  number,
}: {
  label: string;
  totals: PortfolioViewsTotals;
  copy: Copy;
  number: Intl.NumberFormat;
}) {
  return (
    <div className="rounded-2xl border app-border bg-[color:var(--surface)] p-5">
      <p className="text-sm font-medium app-soft">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[color:var(--foreground)]">
        {number.format(totals.total)}
      </p>
      <p className="mt-1 text-xs tabular-nums app-muted">
        {copy.split
          .replace("{profile}", number.format(totals.profile))
          .replace("{projects}", number.format(totals.projects))}
      </p>
    </div>
  );
}
