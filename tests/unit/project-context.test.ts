import { describe, expect, it } from "vitest";
import {
  describeProjectClient,
  formatProjectBudget,
  normalizeProjectOrigin,
  originHasBudget,
  originHasClient,
  PROJECT_ORIGINS,
  toProjectBudget,
} from "@/lib/project-context";
import { projectPayloadSchema } from "@/lib/validation/project";

const templates = { fixed: "{amount} {currency}", hourly: "{amount} {currency} per hour" };

describe("project origin", () => {
  it("knows the five origins and nothing else", () => {
    expect(PROJECT_ORIGINS).toEqual(["personal", "client", "job", "study", "open_source"]);
    expect(normalizeProjectOrigin("client")).toBe("client");
    expect(normalizeProjectOrigin("charity")).toBeNull();
    expect(normalizeProjectOrigin(null)).toBeNull();
  });

  it("gives a client to client and job work, a budget to client work only", () => {
    expect(PROJECT_ORIGINS.filter(originHasClient)).toEqual(["client", "job"]);
    expect(PROJECT_ORIGINS.filter(originHasBudget)).toEqual(["client"]);
    expect(originHasClient(null)).toBe(false);
  });
});

describe("budgets", () => {
  it("accepts only a whole amount in range with a known currency and type", () => {
    expect(toProjectBudget({ amount: 8000, currency: "uah", type: "fixed" })).toEqual({
      amount: 8000,
      currency: "uah",
      type: "fixed",
    });
    for (const bad of [
      { amount: 0, currency: "uah", type: "fixed" },
      { amount: 1.5, currency: "uah", type: "fixed" },
      { amount: 100_000_001, currency: "uah", type: "fixed" },
      { amount: 10, currency: "btc", type: "fixed" },
      { amount: 10, currency: "usd", type: "monthly" },
    ]) {
      expect(toProjectBudget(bad)).toBeNull();
    }
    expect(toProjectBudget(null)).toBeNull();
  });

  it("formats fixed and hourly budgets in the reader's locale", () => {
    expect(formatProjectBudget({ amount: 8000, currency: "uah", type: "fixed" }, templates, "en")).toBe("8,000 UAH");
    expect(formatProjectBudget({ amount: 20, currency: "usd", type: "hourly" }, templates, "en")).toBe(
      "20 USD per hour",
    );
    expect(formatProjectBudget({ amount: 8000, currency: "uah", type: "fixed" }, templates, "uk")).toMatch(
      /^8\s000 UAH$/,
    );
  });
});

describe("describeProjectClient", () => {
  it("names the client, hides it under NDA, and says nothing for personal work", () => {
    expect(describeProjectClient({ origin: "client", clientName: " Acme ", clientNda: false }, "NDA")).toBe("Acme");
    expect(describeProjectClient({ origin: "job", clientName: "Acme", clientNda: true }, "NDA")).toBe("NDA");
    expect(describeProjectClient({ origin: "personal", clientName: "Acme", clientNda: false }, "NDA")).toBeNull();
    expect(describeProjectClient({ origin: "client", clientName: null, clientNda: false }, "NDA")).toBeNull();
  });
});

describe("project payload: for whom and for how much", () => {
  const base = { title: "Landing page", kind: "design" };
  const companyId = "22222222-2222-4222-8222-222222222222";

  it("keeps the client, the budget and the companies for client work", () => {
    const parsed = projectPayloadSchema.parse({
      ...base,
      origin: "client",
      clientName: " Кафе Ромашка ",
      clientNda: false,
      budget: { amount: 8000, currency: "uah", type: "fixed", isPublic: true },
      companyIds: [companyId, companyId],
    });
    expect(parsed).toMatchObject({
      origin: "client",
      clientName: "Кафе Ромашка",
      clientNda: false,
      budget: { amount: 8000, currency: "uah", type: "fixed", isPublic: true },
      companyIds: [companyId],
    });
    // The form sends the parsed output; it must pass again.
    expect(projectPayloadSchema.safeParse(parsed).success).toBe(true);
  });

  it("does not store the client's name under an NDA", () => {
    // Project columns are publicly readable, so hiding it on the page is not enough.
    const parsed = projectPayloadSchema.parse({
      ...base,
      origin: "client",
      clientName: "Кафе Ромашка",
      clientNda: true,
    });
    expect(parsed).toMatchObject({ clientName: null, clientNda: true });
  });

  it("drops the budget for job work, and the client and budget for personal work", () => {
    const job = projectPayloadSchema.parse({
      ...base,
      origin: "job",
      clientName: "Acme",
      budget: { amount: 100, currency: "usd", type: "hourly" },
      companyIds: [companyId],
    });
    expect(job).toMatchObject({ clientName: "Acme", budget: null, companyIds: [companyId] });

    const personal = projectPayloadSchema.parse({
      ...base,
      origin: "personal",
      clientName: "Acme",
      clientNda: true,
      budget: { amount: 100, currency: "usd", type: "hourly" },
      companyIds: [companyId],
    });
    // Company pages stay: a team member may show any of their projects there.
    expect(personal).toMatchObject({
      clientName: null,
      clientNda: false,
      budget: null,
      companyIds: [companyId],
    });
  });

  it("defaults to nothing and hides the budget unless asked", () => {
    const parsed = projectPayloadSchema.parse({
      ...base,
      origin: "client",
      budget: { amount: 50, currency: "eur", type: "fixed" },
    });
    expect(parsed.budget).toEqual({ amount: 50, currency: "eur", type: "fixed", isPublic: false });
    expect(projectPayloadSchema.parse(base)).toMatchObject({
      origin: null,
      clientName: null,
      clientNda: false,
      budget: null,
      companyIds: [],
    });
  });

  it.each([
    [{ origin: "charity" }],
    [{ origin: "client", clientName: "x".repeat(121) }],
    [{ origin: "client", budget: { amount: 0, currency: "usd", type: "fixed" } }],
    [{ origin: "client", budget: { amount: 10, currency: "btc", type: "fixed" } }],
    [{ origin: "client", budget: { amount: 10, currency: "usd", type: "monthly" } }],
    [{ origin: "client", companyIds: ["a", "b"] }],
    [{ origin: "client", companyIds: [1, 2, 3, 4].map((n) => `2222222${n}-2222-4222-8222-222222222222`) }],
  ])("rejects %o", (patch) => {
    expect(projectPayloadSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});
