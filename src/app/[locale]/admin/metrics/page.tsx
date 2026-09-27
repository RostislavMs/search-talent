import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BarRows,
  ChartFigure,
  ColumnGroups,
  type LegendItem,
} from "@/components/charts/chart-primitives";
import { getProductMetrics } from "@/lib/db/product-metrics";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import type { RankedCount, RetentionCell } from "@/lib/product-metrics";
import { buildMetadata, toBcp47 } from "@/lib/seo";

type MetricsCopy = Dictionary["admin"]["metrics"];

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin/metrics",
    title: `${dictionary.admin.metrics.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.metrics.description,
    noindex: true,
  });
}

function fill(template: string, values: Record<string, number | string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function formatHours(hours: number | null, units: MetricsCopy["units"]): string {
  if (hours === null) {
    return "—";
  }
  if (hours < 1) {
    return units.lessThanHour;
  }
  if (hours < 48) {
    return fill(units.hours, { count: Math.round(hours) });
  }
  return fill(units.days, { count: Math.round(hours / 24) });
}

function formatRetention(cell: RetentionCell | null): string {
  if (!cell) {
    return "—";
  }
  return `${cell.returned} / ${cell.eligible} · ${percent(cell.returned, cell.eligible)}`;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-2xl app-panel p-4 sm:p-5">
      <p className="text-sm app-soft">{label}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-[color:var(--foreground)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs app-muted">{hint}</p> : null}
    </article>
  );
}

function RankedList({
  title,
  note,
  items,
  extraRows,
  empty,
}: {
  title: string;
  note: string;
  items: RankedCount[];
  extraRows: Array<{ label: string; count: number }>;
  empty: string;
}) {
  const rows = [...items, ...extraRows.filter((row) => row.count > 0)].map((row) => ({
    label: row.label,
    values: [row.count],
  }));
  const max = Math.max(1, ...rows.map((row) => row.values[0]));
  const series: LegendItem[] = [{ name: title, tone: 1 }];

  return (
    <ChartFigure title={title} note={note}>
      {rows.length > 0 ? (
        <BarRows rows={rows} series={series} max={max} />
      ) : (
        <p className="text-sm app-muted">{empty}</p>
      )}
    </ChartFigure>
  );
}

export default async function AdminMetricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).admin.metrics;
  const result = await getProductMetrics();

  const header = (
    <>
      <h2 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
        {copy.title}
      </h2>
      <p className="mt-2 max-w-2xl app-muted">{copy.description}</p>
    </>
  );

  if (result.status !== "ok") {
    return (
      <section className="rounded-none sm:rounded-hero app-card p-5 sm:p-8">
        {header}
        <p className="mt-6 rounded-2xl app-panel p-4 text-sm text-[color:var(--foreground)]">
          {result.reason === "no-service-key"
            ? copy.unavailableNoKey
            : copy.unavailableNotMigrated}
        </p>
      </section>
    );
  }

  const metrics = result.metrics;
  const weekFormat = new Intl.DateTimeFormat(toBcp47(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const weekLabel = (start: string) => weekFormat.format(new Date(`${start}T00:00:00Z`));
  const formatCount = (value: number) => String(value);

  const signupsTotal = metrics.weeks.reduce((sum, week) => sum + week.signups, 0);
  const confirmedTotal = metrics.weeks.reduce(
    (sum, week) => sum + week.confirmedSignups,
    0,
  );

  const activatedSeries: LegendItem[] = [{ name: copy.charts.activated, tone: 1 }];
  const signupSeries: LegendItem[] = [
    { name: copy.charts.signupsAll, tone: 1 },
    { name: copy.charts.signupsConfirmed, tone: 2 },
  ];
  const viewSeries: LegendItem[] = [
    { name: copy.charts.viewsOutside, tone: 1 },
    { name: copy.charts.viewsInternal, tone: 2 },
  ];

  const activatedGroups = metrics.weeks.map((week) => ({
    label: weekLabel(week.start),
    values: [week.newActivated],
  }));
  const signupGroups = metrics.weeks.map((week) => ({
    label: weekLabel(week.start),
    values: [week.signups, week.confirmedSignups],
  }));
  const viewGroups = metrics.weeks.map((week) => ({
    label: weekLabel(week.start),
    values: [week.outsideViews, week.internalViews],
  }));
  const maxOf = (groups: Array<{ values: number[] }>) =>
    Math.max(1, ...groups.flatMap((group) => group.values));

  const cohortsNewestFirst = [...metrics.cohorts].reverse();

  return (
    <div className="space-y-6">
      <section className="rounded-none sm:rounded-hero app-card p-5 sm:p-8">
        {header}
        <p className="mt-2 max-w-2xl text-sm app-muted">
          {copy.dataNote}
          {metrics.excludedAdmins > 0
            ? ` ${fill(copy.excludedAdmins, { count: metrics.excludedAdmins })}`
            : null}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={copy.tiles.activated}
            value={String(metrics.activation.total)}
            hint={fill(copy.tiles.activatedHint, { count: metrics.activation.thisWeek })}
          />
          <StatTile
            label={copy.tiles.signups}
            value={String(signupsTotal)}
            hint={fill(copy.tiles.signupsHint, { count: confirmedTotal })}
          />
          <StatTile
            label={copy.tiles.firstProject}
            value={percent(metrics.funnel.withFirstProject, metrics.funnel.accounts)}
            hint={fill(copy.tiles.firstProjectHint, {
              count: metrics.funnel.withFirstProject,
              total: metrics.funnel.accounts,
            })}
          />
          <StatTile
            label={copy.tiles.medianTime}
            value={formatHours(metrics.funnel.medianHoursToFirstProject, copy.units)}
            hint={copy.tiles.medianTimeHint}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFigure title={copy.charts.activated} note={copy.charts.activatedNote}>
          <div className="overflow-x-auto">
            <div className="min-w-[26rem]">
              <ColumnGroups
                groups={activatedGroups}
                series={activatedSeries}
                max={maxOf(activatedGroups)}
                format={formatCount}
              />
            </div>
          </div>
        </ChartFigure>

        <ChartFigure title={copy.charts.signups} legend={signupSeries}>
          <div className="overflow-x-auto">
            <div className="min-w-[30rem]">
              <ColumnGroups
                groups={signupGroups}
                series={signupSeries}
                max={maxOf(signupGroups)}
                format={formatCount}
              />
            </div>
          </div>
        </ChartFigure>

        <ChartFigure
          title={copy.charts.views}
          legend={viewSeries}
          note={copy.charts.viewsNote}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[30rem]">
              <ColumnGroups
                groups={viewGroups}
                series={viewSeries}
                max={maxOf(viewGroups)}
                format={formatCount}
              />
            </div>
          </div>
        </ChartFigure>

        <RankedList
          title={copy.referrers.title}
          note={copy.referrers.note}
          items={metrics.referrers}
          extraRows={[{ label: copy.referrers.direct, count: metrics.directViews }]}
          empty={copy.referrers.empty}
        />
      </div>

      <section className="rounded-2xl app-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          {copy.cohorts.title}
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b app-border text-left text-xs app-soft">
                <th scope="col" className="px-3 py-2 font-medium">{copy.cohorts.week}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{copy.cohorts.size}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{copy.cohorts.firstProject}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{copy.cohorts.medianTime}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{copy.cohorts.returned7}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{copy.cohorts.returned30}</th>
              </tr>
            </thead>
            <tbody>
              {cohortsNewestFirst.map((cohort) => (
                <tr
                  key={cohort.start}
                  className="border-b app-border tabular-nums text-[color:var(--foreground)] last:border-b-0"
                >
                  <th scope="row" className="px-3 py-2.5 text-left font-medium">
                    {weekLabel(cohort.start)}
                  </th>
                  <td className="px-3 py-2.5 text-right">{cohort.size}</td>
                  <td className="px-3 py-2.5 text-right">
                    {cohort.size > 0
                      ? `${cohort.withFirstProject} · ${percent(cohort.withFirstProject, cohort.size)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatHours(cohort.medianHoursToFirstProject, copy.units)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatRetention(cohort.returnedAfter7)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatRetention(cohort.returnedAfter30)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 app-muted">{copy.cohorts.note}</p>
      </section>

      <RankedList
        title={copy.signupSources.title}
        note={copy.signupSources.note}
        items={metrics.signupSources}
        extraRows={[
          { label: copy.signupSources.direct, count: metrics.directSignups },
          { label: copy.signupSources.unattributed, count: metrics.unattributedSignups },
        ]}
        empty={copy.signupSources.empty}
      />
    </div>
  );
}
