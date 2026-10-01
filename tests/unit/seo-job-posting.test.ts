import { describe, expect, it } from "vitest";
import { buildJobPostingSchema } from "@/lib/seo";
import { vacancyEmploymentTypes } from "@/lib/vacancies";

type Input = Parameters<typeof buildJobPostingSchema>[0];

const base: Input = {
  title: "Junior frontend developer",
  descriptionHtml: "<p>Build interfaces.</p>",
  pageUrl: "https://searchtalent.test/en/jobs/junior-frontend-developer-abc123",
  datePosted: "2026-09-30T12:00:00Z",
  validThrough: "2026-11-29T12:00:00Z",
  employmentTypes: ["FULL_TIME"],
  company: {
    name: "Acme",
    pageUrl: "https://searchtalent.test/en/companies/acme",
    website: "https://acme.com",
    logoUrl: "https://cdn.example/companies/c1/logo",
  },
  city: "Kyiv",
  countryName: "Ukraine",
  remoteOnly: false,
  pay: null,
  inLanguage: "en-US",
  skills: ["React", "TypeScript"],
};

const schema = (patch: Partial<Input> = {}) =>
  buildJobPostingSchema({ ...base, ...patch }) as Record<string, unknown>;

describe("buildJobPostingSchema", () => {
  it("describes the job for Google for Jobs", () => {
    expect(schema()).toEqual({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Junior frontend developer",
      description: "<p>Build interfaces.</p>",
      url: base.pageUrl,
      datePosted: "2026-09-30T12:00:00Z",
      validThrough: "2026-11-29T12:00:00Z",
      employmentType: "FULL_TIME",
      hiringOrganization: {
        "@type": "Organization",
        name: "Acme",
        sameAs: "https://acme.com",
        logo: "https://cdn.example/companies/c1/logo",
      },
      jobLocation: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: "Kyiv", addressCountry: "Ukraine" },
      },
      skills: "React, TypeScript",
      inLanguage: "en-US",
      directApply: false,
    });
  });

  it("puts an hourly amount in as an exact value", () => {
    expect(schema({ pay: { min: 15, max: 15, currency: "usd", period: "hour" } }).baseSalary).toEqual({
      "@type": "MonetaryAmount",
      currency: "USD",
      value: { "@type": "QuantitativeValue", value: 15, unitText: "HOUR" },
    });
  });

  it("puts a monthly range in as min and max", () => {
    expect(schema({ pay: { min: 20_000, max: 30_000, currency: "uah", period: "month" } }).baseSalary).toEqual({
      "@type": "MonetaryAmount",
      currency: "UAH",
      value: { "@type": "QuantitativeValue", minValue: 20_000, maxValue: 30_000, unitText: "MONTH" },
    });
  });

  it("leaves pay out for a project budget or no pay", () => {
    expect(schema({ pay: { min: 800, max: 800, currency: "eur", period: "project" } })).not.toHaveProperty(
      "baseSalary",
    );
    expect(schema({ pay: null })).not.toHaveProperty("baseSalary");
  });

  it("marks remote-only work as telecommute, limited to the country", () => {
    const remote = schema({ remoteOnly: true });
    expect(remote.jobLocationType).toBe("TELECOMMUTE");
    expect(remote.applicantLocationRequirements).toEqual({ "@type": "Country", name: "Ukraine" });
    expect(remote).not.toHaveProperty("jobLocation");

    const anywhere = schema({ remoteOnly: true, city: null, countryName: null });
    expect(anywhere.jobLocationType).toBe("TELECOMMUTE");
    expect(anywhere).not.toHaveProperty("applicantLocationRequirements");
  });

  it("gives an office or hybrid job whatever place it has", () => {
    expect(schema({ city: null }).jobLocation).toEqual({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressCountry: "Ukraine" },
    });
    expect(schema({ countryName: null }).jobLocation).toEqual({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "Kyiv" },
    });
    const nowhere = schema({ city: null, countryName: null });
    expect(nowhere).not.toHaveProperty("jobLocation");
    expect(nowhere).not.toHaveProperty("jobLocationType");
  });

  it("uses one employment type as a value and several as a list", () => {
    expect(schema({ employmentTypes: vacancyEmploymentTypes("internship", null) }).employmentType).toBe("INTERN");
    expect(
      schema({ employmentTypes: vacancyEmploymentTypes("internship", "part_time") }).employmentType,
    ).toEqual(["INTERN", "PART_TIME"]);
  });

  it("falls back to the company page and leaves out what is missing", () => {
    const bare = schema({ company: { ...base.company, website: null, logoUrl: null }, skills: [] });
    expect(bare.hiringOrganization).toEqual({
      "@type": "Organization",
      name: "Acme",
      sameAs: "https://searchtalent.test/en/companies/acme",
    });
    expect(bare).not.toHaveProperty("skills");
  });
});
