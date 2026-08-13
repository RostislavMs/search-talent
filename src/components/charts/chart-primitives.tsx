import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Chart primitives. Server-rendered SVG/HTML, no client JS.
//
// Colour comes from two categorical slots (--chart-series-1/2) assigned in a
// fixed order and never cycled: a chart that would need a third series gets
// split instead. Every mark is direct-labelled, so identity and magnitude are
// never carried by colour alone.
// ---------------------------------------------------------------------------

export type ChartTone = 1 | 2;

export function toneColor(tone: ChartTone) {
  return tone === 2 ? "var(--chart-series-2)" : "var(--chart-series-1)";
}

export type LegendItem = { name: string; tone: ChartTone };

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5 text-xs app-muted">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: toneColor(item.tone) }}
            aria-hidden="true"
          />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

export function ChartFigure({
  title,
  note,
  legend,
  surface = "panel",
  hideTitle = false,
  children,
}: {
  title: string;
  note?: string;
  legend?: LegendItem[];
  /** "bare" when the figure already sits inside a card — panels don't nest. */
  surface?: "panel" | "bare";
  /** Keep the title for assistive tech when the surrounding card already shows it. */
  hideTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <figure className={surface === "panel" ? "rounded-2xl app-panel p-4 sm:p-5" : ""}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span
          className={
            hideTitle ? "sr-only" : "text-sm font-semibold text-[color:var(--foreground)]"
          }
        >
          {title}
        </span>
        {legend && legend.length > 1 ? <ChartLegend items={legend} /> : null}
      </figcaption>
      <div className="mt-4">{children}</div>
      {note ? <p className="mt-3 text-xs leading-5 app-muted">{note}</p> : null}
    </figure>
  );
}

// ---- horizontal bars -------------------------------------------------------

export type BarRow = { label: string; values: number[] };

/**
 * Ranked horizontal bars, one group per row. Reads as a labelled list, so it
 * stays legible to a screen reader without a separate table view.
 */
export function BarRows({
  rows,
  series,
  max,
  unit = "",
}: {
  rows: BarRow[];
  series: LegendItem[];
  max: number;
  unit?: string;
}) {
  return (
    <ul className="space-y-3.5">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid gap-1.5 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-center sm:gap-4"
        >
          <span className="text-sm leading-5 text-[color:var(--foreground)]">{row.label}</span>
          <span className="flex flex-col gap-[2px]">
            {row.values.map((value, index) => {
              const tone = series[index]?.tone ?? 1;
              const isZero = value <= 0;
              return (
                <span key={series[index]?.name ?? index} className="flex items-center gap-2">
                  <span className="relative h-2 flex-1">
                    <span
                      className="absolute inset-y-0 left-0 rounded-r-[4px]"
                      style={{
                        width: isZero ? "3px" : `${(value / max) * 100}%`,
                        background: isZero ? "var(--chart-grid)" : toneColor(tone),
                      }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums app-muted">
                    {value}
                    {unit}
                  </span>
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---- vertical grouped columns ---------------------------------------------

export type ColumnGroup = { label: string; values: number[] };

export function ColumnGroups({
  groups,
  series,
  max,
  format,
}: {
  groups: ColumnGroup[];
  series: LegendItem[];
  max: number;
  format: (value: number) => string;
}) {
  return (
    <ul className="flex items-end justify-around gap-4">
      {groups.map((group) => (
        <li key={group.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="flex h-24 items-end gap-[2px]" aria-hidden="true">
            {group.values.map((value, index) => (
              <span
                key={series[index]?.name ?? index}
                className="w-5 rounded-t-[4px]"
                style={{
                  height: `${Math.max((value / max) * 100, 1.5)}%`,
                  background: toneColor(series[index]?.tone ?? 1),
                }}
              />
            ))}
          </span>
          <span className="border-t app-border pt-2 text-center text-[11px] leading-4 app-muted">
            {group.label}
          </span>
          <span className="flex flex-wrap justify-center gap-x-2 text-[11px] tabular-nums text-[color:var(--foreground)]">
            {group.values.map((value, index) => (
              <span key={series[index]?.name ?? index}>
                <span className="sr-only">{series[index]?.name}: </span>
                {format(value)}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---- curves ----------------------------------------------------------------

export type CurveSeries = {
  name: string;
  tone: ChartTone;
  /** Points in data space, ascending by x. */
  points: Array<[number, number]>;
  fill?: boolean;
};

const VIEW = { width: 320, height: 128, padX: 4, padTop: 10, padBottom: 20 };

/**
 * Small explanatory line chart. `guide` draws the one reference line worth
 * naming (a half-life, a saturation point) instead of a full grid.
 */
export function CurveChart({
  series,
  xMax,
  yMax = 1,
  xTicks,
  guide,
  description,
}: {
  series: CurveSeries[];
  xMax: number;
  yMax?: number;
  xTicks: Array<{ value: number; label: string }>;
  guide?: { y: number; label: string };
  description: string;
}) {
  const plotWidth = VIEW.width - VIEW.padX * 2;
  const plotHeight = VIEW.height - VIEW.padTop - VIEW.padBottom;
  const toX = (x: number) => VIEW.padX + (x / xMax) * plotWidth;
  const toY = (y: number) => VIEW.padTop + (1 - y / yMax) * plotHeight;
  const baseline = toY(0);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="h-auto w-full"
      role="img"
      aria-label={description}
    >
      <line
        x1={VIEW.padX}
        y1={baseline}
        x2={VIEW.width - VIEW.padX}
        y2={baseline}
        stroke="var(--chart-grid)"
        strokeWidth="1"
      />
      {guide ? (
        <>
          <line
            x1={VIEW.padX}
            y1={toY(guide.y)}
            x2={VIEW.width - VIEW.padX}
            y2={toY(guide.y)}
            stroke="var(--chart-grid)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text
            x={VIEW.width - VIEW.padX}
            y={toY(guide.y) - 4}
            textAnchor="end"
            fontSize="9"
            fill="var(--chart-axis)"
          >
            {guide.label}
          </text>
        </>
      ) : null}
      {series.map((line) => {
        const path = line.points.map(([x, y]) => `${toX(x)},${toY(y)}`).join(" ");
        return (
          <g key={line.name}>
            {line.fill ? (
              <polygon
                points={`${toX(line.points[0][0])},${baseline} ${path} ${toX(
                  line.points[line.points.length - 1][0],
                )},${baseline}`}
                fill={toneColor(line.tone)}
                opacity="0.12"
              />
            ) : null}
            <polyline
              points={path}
              fill="none"
              stroke={toneColor(line.tone)}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
      {xTicks.map((tick, index) => (
        <text
          key={tick.label}
          x={toX(tick.value)}
          y={VIEW.height - 6}
          textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
          fontSize="9"
          fill="var(--chart-axis)"
        >
          {tick.label}
        </text>
      ))}
    </svg>
  );
}
