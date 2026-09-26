import { SALARY_STATS_MIN_GROUP_SIZE } from "@/lib/constants/visibility";

/**
 * Salary aggregates for the platform analytics page.
 *
 * The page labels every figure in dollars, and profiles state salaries in
 * UAH, EUR or USD. Averaging those together produced numbers in no currency at
 * all, so only USD salaries are aggregated — there is no exchange-rate source
 * to convert the rest honestly. Groups smaller than the minimum size are left
 * out: an "average" over two people is noise and can identify them.
 */
export const SALARY_STATS_CURRENCY = "USD";

const GROUP_LIMIT = 10;

export type SalaryInput = {
  salary: string | null;
  currency: string | null;
  country: string | null;
  category: string | null;
};

export type SalaryBucket = {
  key: string;
  label: string;
  value: number;
};

export type SalaryGroup = {
  label: string;
  avgSalary: number;
  count: number;
};

export type SalaryStats = {
  breakdown: SalaryBucket[];
  byCountry: SalaryGroup[];
  byCategory: SalaryGroup[];
};

export function parseSalaryNumeric(raw: string | null): number | null {
  if (!raw) return null;
  const numericMatch = raw.match(/\d[\d\s.,]*/);
  if (!numericMatch) return null;
  const cleaned = numericMatch[0].replace(/[\s,]/g, "").replace(/\.+$/, "");
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function bucketSalary(raw: string | null): string | null {
  const numeric = parseSalaryNumeric(raw);
  if (numeric === null) return raw ? "custom" : null;
  if (numeric < 500) return "under_500";
  if (numeric < 1000) return "500_1000";
  if (numeric < 2000) return "1000_2000";
  if (numeric < 3500) return "2000_3500";
  if (numeric < 5000) return "3500_5000";
  return "5000_plus";
}

function isAggregatedCurrency(currency: string | null): boolean {
  return (currency || "").trim().toUpperCase() === SALARY_STATS_CURRENCY;
}

function toGroups(
  acc: Map<string, { total: number; count: number }>,
  minGroupSize: number,
): SalaryGroup[] {
  return [...acc.entries()]
    .filter(([, data]) => data.count >= minGroupSize)
    .map(([label, data]) => ({
      label,
      avgSalary: Math.round(data.total / data.count),
      count: data.count,
    }))
    .sort((left, right) => right.avgSalary - left.avgSalary)
    .slice(0, GROUP_LIMIT);
}

export function summarizeSalaryStats(
  inputs: readonly SalaryInput[],
  minGroupSize: number = SALARY_STATS_MIN_GROUP_SIZE,
): SalaryStats {
  const bucketCounts = new Map<string, number>();
  const byCountry = new Map<string, { total: number; count: number }>();
  const byCategory = new Map<string, { total: number; count: number }>();
  let stated = 0;

  for (const input of inputs) {
    if (!input.salary || !isAggregatedCurrency(input.currency)) continue;

    const bucket = bucketSalary(input.salary);
    if (bucket) {
      stated += 1;
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
    }

    const numeric = parseSalaryNumeric(input.salary);
    if (numeric === null) continue;

    for (const [label, acc] of [
      [input.country, byCountry],
      [input.category, byCategory],
    ] as const) {
      if (!label) continue;
      const prev = acc.get(label) || { total: 0, count: 0 };
      acc.set(label, { total: prev.total + numeric, count: prev.count + 1 });
    }
  }

  // The distribution is one group too: with fewer stated salaries than the
  // minimum, its bars would point at individual people.
  const breakdown =
    stated >= minGroupSize
      ? [...bucketCounts.entries()]
          .map(([key, value]) => ({ key, label: key, value }))
          .sort((left, right) => right.value - left.value)
      : [];

  return {
    breakdown,
    byCountry: toGroups(byCountry, minGroupSize),
    byCategory: toGroups(byCategory, minGroupSize),
  };
}
