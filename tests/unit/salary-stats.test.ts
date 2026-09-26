import { describe, expect, it } from "vitest";
import {
  bucketSalary,
  parseSalaryNumeric,
  summarizeSalaryStats,
  type SalaryInput,
} from "@/lib/salary-stats";

function usd(salary: string, country = "Ukraine", category = "Design"): SalaryInput {
  return { salary, currency: "USD", country, category };
}

describe("parseSalaryNumeric / bucketSalary", () => {
  it("reads the first number, ignoring separators", () => {
    expect(parseSalaryNumeric("1 500 USD")).toBe(1500);
    expect(parseSalaryNumeric("від 2,000")).toBe(2000);
    expect(parseSalaryNumeric("negotiable")).toBeNull();
  });

  it("buckets numbers and keeps free text as custom", () => {
    expect(bucketSalary("450")).toBe("under_500");
    expect(bucketSalary("1200")).toBe("1000_2000");
    expect(bucketSalary("6000")).toBe("5000_plus");
    expect(bucketSalary("за домовленістю")).toBe("custom");
    expect(bucketSalary(null)).toBeNull();
  });
});

describe("summarizeSalaryStats", () => {
  it("never mixes currencies into the dollar figures", () => {
    const inputs: SalaryInput[] = [
      ...Array.from({ length: 3 }, () => usd("1000")),
      { salary: "40000", currency: "UAH", country: "Ukraine", category: "Design" },
      { salary: "1000", currency: "EUR", country: "Ukraine", category: "Design" },
    ];
    const stats = summarizeSalaryStats(inputs, 3);
    expect(stats.byCountry).toEqual([{ label: "Ukraine", avgSalary: 1000, count: 3 }]);
    expect(stats.breakdown).toEqual([{ key: "1000_2000", label: "1000_2000", value: 3 }]);
  });

  it("hides groups and the distribution below the minimum size", () => {
    const inputs = [usd("900", "Ukraine"), usd("1100", "Poland")];
    const stats = summarizeSalaryStats(inputs, 10);
    expect(stats.breakdown).toEqual([]);
    expect(stats.byCountry).toEqual([]);
    expect(stats.byCategory).toEqual([]);
  });

  it("keeps large groups and drops small ones side by side", () => {
    const inputs = [
      ...Array.from({ length: 10 }, () => usd("2000", "Ukraine")),
      usd("5000", "Poland"),
    ];
    const stats = summarizeSalaryStats(inputs, 10);
    expect(stats.byCountry.map((group) => group.label)).toEqual(["Ukraine"]);
    expect(stats.byCountry[0].avgSalary).toBe(2000);
  });

  it("accepts currency codes in any case", () => {
    const inputs = Array.from({ length: 2 }, () => ({
      salary: "1000",
      currency: " usd ",
      country: "Ukraine",
      category: null,
    }));
    expect(summarizeSalaryStats(inputs, 2).byCountry).toHaveLength(1);
  });
});
