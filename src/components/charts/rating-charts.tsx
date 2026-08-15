import {
  BarRows,
  ChartFigure,
  ColumnGroups,
  CurveChart,
  type BarRow,
  type LegendItem,
} from "@/components/charts/chart-primitives";
import type { Locale } from "@/lib/i18n/config";
import {
  HALF_LIFE_DAYS,
  PROFILE_WEIGHTS,
  PROJECT_WEIGHTS,
  SATURATION,
  decayByAge,
  diminishing,
  getWilsonScore,
} from "@/lib/leaderboards";

// ---------------------------------------------------------------------------
// Charts for the rating guide. Every series is computed from the same weight
// tables and helpers the leaderboard runs on, so a scoring change moves the
// charts too — none of these numbers is transcribed by hand.
// ---------------------------------------------------------------------------

type Copy = {
  allTime: string;
  month: string;
  profileTitle: string;
  projectTitle: string;
  weightsNote: string;
  profileRows: Record<keyof typeof PROFILE_WEIGHTS.all, string>;
  projectRows: Record<keyof typeof PROJECT_WEIGHTS.all, string>;
  saturationTitle: string;
  saturationNote: string;
  saturationDescription: string;
  saturationX: (count: number) => string;
  decayTitle: string;
  decayNote: string;
  decayDescription: string;
  decayX: (days: number) => string;
  half: string;
  trustTitle: string;
  trustNote: string;
  rawRatio: string;
  confidence: string;
  trustGroups: [string, string];
};

const COPY: Record<Locale, Copy> = {
  uk: {
    allTime: "All-time",
    month: "30 днів",
    profileTitle: "Ваги факторів профілю",
    projectTitle: "Ваги факторів проєкту",
    weightsNote:
      "Кожна колонка сумується у 100. Видно, що саме змінюється між таблицями: у 30-денній свіжість і довіра важать більше, а заповненість — менше.",
    profileRows: {
      portfolio: "Якість портфоліо",
      completeness: "Заповненість профілю",
      communityTrust: "Довіра спільноти",
      production: "Продуктивність",
      freshness: "Свіжість",
    },
    projectRows: {
      communityTrust: "Довіра спільноти",
      contentQuality: "Якість контенту",
      mediaRichness: "Медіа",
      technologyBreadth: "Стек технологій",
      freshness: "Свіжість",
    },
    saturationTitle: "Криві насичення",
    saturationNote: `Внесок кількості проєктів у бал. На ${SATURATION.projects} проєктах ви вже забираєте половину цього фактора, після ~20 крива майже пласка.`,
    saturationDescription: `Крива внеску проєктів: різко зростає до ${SATURATION.projects} проєктів, де досягає 50%, далі виположується і майже не росте після 20.`,
    saturationX: (count) => (count === 0 ? "0" : `${count} проєктів`),
    decayTitle: "Згасання у часі",
    decayNote: `Вага свіжості за віком. Період напіврозпаду — ${HALF_LIFE_DAYS.all} днів у all-time і ${HALF_LIFE_DAYS.month} днів у 30-денній таблиці.`,
    decayDescription: `Дві криві згасання свіжості: у all-time вага падає вдвічі за ${HALF_LIFE_DAYS.all} днів, у 30-денній таблиці — за ${HALF_LIFE_DAYS.month} днів.`,
    decayX: (days) => (days === 0 ? "0" : `${days} днів`),
    half: "50%",
    trustTitle: "Довіра, а не сире співвідношення",
    trustNote:
      "Сире співвідношення каже, що 3 з 3 — це 100%. Формула довіри бачить, що трьох голосів замало, і дає менше половини. Двісті голосів із кількома проти дають майже максимум.",
    rawRatio: "Сире співвідношення",
    confidence: "Оцінка довіри",
    trustGroups: ["3 за / 0 проти", "100 за / 5 проти"],
  },
  en: {
    allTime: "All-time",
    month: "Last 30 days",
    profileTitle: "Profile factor weights",
    projectTitle: "Project factor weights",
    weightsNote:
      "Each column sums to 100. You can see exactly what shifts between boards: the 30-day one leans harder on freshness and trust, and lighter on completeness.",
    profileRows: {
      portfolio: "Portfolio quality",
      completeness: "Profile completeness",
      communityTrust: "Community trust",
      production: "Production output",
      freshness: "Freshness",
    },
    projectRows: {
      communityTrust: "Community trust",
      contentQuality: "Content quality",
      mediaRichness: "Media richness",
      technologyBreadth: "Tech stack",
      freshness: "Freshness",
    },
    saturationTitle: "Saturation curves",
    saturationNote: `How project count feeds the score. At ${SATURATION.projects} projects you already collect half of this factor; past ~20 the curve is nearly flat.`,
    saturationDescription: `Project-count contribution curve: rises steeply to 50% at ${SATURATION.projects} projects, then flattens and barely moves past 20.`,
    saturationX: (count) => (count === 0 ? "0" : `${count} projects`),
    decayTitle: "Time decay",
    decayNote: `Freshness weight by age. The half-life is ${HALF_LIFE_DAYS.all} days on the all-time board and ${HALF_LIFE_DAYS.month} days on the 30-day one.`,
    decayDescription: `Two freshness decay curves: all-time halves after ${HALF_LIFE_DAYS.all} days, the 30-day board halves after ${HALF_LIFE_DAYS.month} days.`,
    decayX: (days) => (days === 0 ? "0" : `${days} days`),
    half: "50%",
    trustTitle: "Trust, not raw ratio",
    trustNote:
      "A raw ratio calls 3 out of 3 a perfect 100%. The trust score sees that three votes aren't enough and returns less than half. Two hundred votes with a few against land near the top.",
    rawRatio: "Raw ratio",
    confidence: "Trust score",
    trustGroups: ["3 up / 0 down", "100 up / 5 down"],
  },
};

type ChartProps = {
  locale: Locale;
  surface?: "panel" | "bare";
  hideTitle?: boolean;
};

const SERIES_TWO = (copy: Copy): LegendItem[] => [
  { name: copy.allTime, tone: 1 },
  { name: copy.month, tone: 2 },
];

function samples(count: number, xMax: number, fn: (x: number) => number) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const x = (index / count) * xMax;
    return [x, fn(x)] as [number, number];
  });
}

export function RatingWeightsChart({
  kind,
  locale,
}: {
  kind: "profile" | "project";
  locale: Locale;
}) {
  const copy = COPY[locale];
  const isProfile = kind === "profile";

  // Two explicit branches: the profile and project weight tables have different
  // keys, so a shared `labels` variable would narrow to only the common ones.
  const rows: BarRow[] = isProfile
    ? (Object.keys(copy.profileRows) as Array<keyof typeof copy.profileRows>).map((key) => ({
        label: copy.profileRows[key],
        values: [PROFILE_WEIGHTS.all[key], PROFILE_WEIGHTS.month[key]],
      }))
    : (Object.keys(copy.projectRows) as Array<keyof typeof copy.projectRows>).map((key) => ({
        label: copy.projectRows[key],
        values: [PROJECT_WEIGHTS.all[key], PROJECT_WEIGHTS.month[key]],
      }));
  const max = Math.max(...rows.flatMap((row) => row.values));

  return (
    <ChartFigure
      title={isProfile ? copy.profileTitle : copy.projectTitle}
      legend={SERIES_TWO(copy)}
      note={copy.weightsNote}
    >
      <BarRows rows={rows} series={SERIES_TWO(copy)} max={max} unit="%" />
    </ChartFigure>
  );
}

export function SaturationChart({ locale, surface, hideTitle }: ChartProps) {
  const copy = COPY[locale];
  // Wide enough that the plateau is visibly flat, not still climbing.
  const xMax = 40;
  return (
    <ChartFigure
      title={copy.saturationTitle}
      note={copy.saturationNote}
      surface={surface}
      hideTitle={hideTitle}
    >
      <CurveChart
        series={[
          {
            name: copy.saturationTitle,
            tone: 1,
            points: samples(48, xMax, (x) => diminishing(x, SATURATION.projects)),
          },
        ]}
        xMax={xMax}
        xTicks={[
          { value: 0, label: copy.saturationX(0) },
          { value: SATURATION.projects, label: String(SATURATION.projects) },
          { value: xMax, label: copy.saturationX(xMax) },
        ]}
        guide={{ y: 0.5, label: copy.half }}
        description={copy.saturationDescription}
      />
    </ChartFigure>
  );
}

export function DecayChart({ locale, surface, hideTitle }: ChartProps) {
  const copy = COPY[locale];
  const xMax = 90;
  return (
    <ChartFigure
      title={copy.decayTitle}
      legend={SERIES_TWO(copy)}
      note={copy.decayNote}
      surface={surface}
      hideTitle={hideTitle}
    >
      <CurveChart
        series={[
          {
            name: copy.allTime,
            tone: 1,
            points: samples(60, xMax, (x) => decayByAge(x, HALF_LIFE_DAYS.all)),
          },
          {
            name: copy.month,
            tone: 2,
            points: samples(60, xMax, (x) => decayByAge(x, HALF_LIFE_DAYS.month)),
          },
        ]}
        xMax={xMax}
        xTicks={[
          { value: 0, label: copy.decayX(0) },
          { value: HALF_LIFE_DAYS.month, label: String(HALF_LIFE_DAYS.month) },
          { value: HALF_LIFE_DAYS.all, label: String(HALF_LIFE_DAYS.all) },
          { value: xMax, label: copy.decayX(xMax) },
        ]}
        guide={{ y: 0.5, label: copy.half }}
        description={copy.decayDescription}
      />
    </ChartFigure>
  );
}

export function TrustChart({ locale, surface, hideTitle }: ChartProps) {
  const copy = COPY[locale];
  const scenarios: Array<[number, number]> = [
    [3, 0],
    [100, 5],
  ];
  const series: LegendItem[] = [
    { name: copy.rawRatio, tone: 1 },
    { name: copy.confidence, tone: 2 },
  ];

  return (
    <ChartFigure
      title={copy.trustTitle}
      legend={series}
      note={copy.trustNote}
      surface={surface}
      hideTitle={hideTitle}
    >
      <ColumnGroups
        groups={scenarios.map(([up, down], index) => ({
          label: copy.trustGroups[index],
          values: [up / (up + down), getWilsonScore(up, down)],
        }))}
        series={series}
        max={1}
        format={(value) => `${Math.round(value * 100)}%`}
      />
    </ChartFigure>
  );
}
