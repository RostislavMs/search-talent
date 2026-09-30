import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getLegalDocument } from "@/lib/legal-content";
import { COMPANY_INVITE_ROLES, COMPANY_ROLES, COMPANY_SIZES } from "@/lib/companies";
import { buildCompanyVerificationEmail } from "@/lib/email/templates";
import { PROJECT_BUDGET_TYPES, PROJECT_ORIGINS } from "@/lib/project-context";

/** Every nested key path of a value; arrays keep their length. */
function shapeOf(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => shapeOf(child, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, child]) => shapeOf(child, path ? `${path}.${key}` : key));
  }
  return [path];
}

function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(leaves);
  }
  return [];
}

function placeholders(text: string): string[] {
  return (text.match(/\{[a-z]+\}/gi) ?? []).sort();
}

describe("company copy parity (uk/en)", () => {
  const en = dictionaries.en.companies;
  const uk = dictionaries.uk.companies;

  it("has the same shape in both locales", () => {
    expect(shapeOf(uk)).toEqual(shapeOf(en));
  });

  it("uses the same placeholders in both locales", () => {
    const english = leaves(en);
    const ukrainian = leaves(uk);
    english.forEach((text, index) => {
      expect(placeholders(ukrainian[index]), ukrainian[index]).toEqual(placeholders(text));
    });
  });

  it("names every size, role and invite role", () => {
    for (const locale of [en, uk]) {
      for (const size of COMPANY_SIZES) expect(locale.sizes[size]).toBeTruthy();
      for (const role of COMPANY_ROLES) expect(locale.roles[role]).toBeTruthy();
      for (const role of COMPANY_INVITE_ROLES) expect(locale.roleHints[role]).toBeTruthy();
    }
  });

  it("keeps the landing's meta description within a search snippet", () => {
    for (const locale of [en, uk]) {
      expect(locale.meta.forCompaniesDescription.length).toBeLessThanOrEqual(160);
      expect(locale.meta.forCompaniesTitle.length).toBeLessThanOrEqual(60);
    }
  });

  it("adds the menu and admin labels in both locales", () => {
    expect(dictionaries.uk.nav.myCompanies).toBe("Компанії");
    expect(dictionaries.en.nav.myCompanies).toBe("Companies");
    expect(dictionaries.uk.admin.nav.companies).toBeTruthy();
    expect(dictionaries.en.admin.nav.companies).toBeTruthy();
  });
});

describe("project context copy parity (uk/en)", () => {
  it("has the same shape and placeholders in both locales", () => {
    const en = dictionaries.en.projectContext;
    const uk = dictionaries.uk.projectContext;
    expect(shapeOf(uk)).toEqual(shapeOf(en));
    leaves(en).forEach((text, index) => {
      expect(placeholders(leaves(uk)[index])).toEqual(placeholders(text));
    });
  });

  it("names every origin and budget type", () => {
    for (const locale of ["en", "uk"] as const) {
      const copy = dictionaries[locale].projectContext;
      for (const origin of PROJECT_ORIGINS) expect(copy.origins[origin]).toBeTruthy();
      for (const type of PROJECT_BUDGET_TYPES) expect(copy.budgetTypes[type]).toBeTruthy();
    }
  });
});

describe("the verification code email", () => {
  it("has the same copy in both locales", () => {
    expect(shapeOf(dictionaries.uk.emails.companyVerification)).toEqual(
      shapeOf(dictionaries.en.emails.companyVerification),
    );
  });

  it("puts the code and the site in, and escapes the company name", () => {
    const email = buildCompanyVerificationEmail({
      companyName: "<b>Acme</b>",
      host: "acme.com",
      code: "123456",
      locale: "uk",
    });
    expect(email.subject).toBe("Ваш код для <b>Acme</b>: 123456");
    expect(email.html).toContain("123456");
    expect(email.html).toContain("acme.com");
    expect(email.html).not.toContain("<b>Acme</b>");
    expect(email.html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
    expect(email.text).toContain("123456");
    // No link: the code is typed on the page that asked for it.
    expect(email.html).not.toMatch(/<a\s/);
  });
});

describe("legal copy after the hiring change", () => {
  it("no longer says there are no vacancies", () => {
    for (const locale of ["uk", "en"] as const) {
      const text = JSON.stringify(getLegalDocument(locale, "terms"));
      expect(text).not.toMatch(/not a job board|не сайт вакансій/i);
      expect(JSON.stringify(dictionaries[locale].faqPage)).not.toMatch(/job board|сайт вакансій/i);
    }
  });

  it("has the company rules and the same sections in both locales", () => {
    const enTerms = getLegalDocument("en", "terms");
    const ukTerms = getLegalDocument("uk", "terms");
    expect(ukTerms.sections).toHaveLength(enTerms.sections.length);
    expect(enTerms.sections.map((section) => section.title)).toContain("Company pages and hiring");
    expect(ukTerms.sections.map((section) => section.title)).toContain("Сторінки компаній і найм");

    const enPrivacy = getLegalDocument("en", "privacy");
    const ukPrivacy = getLegalDocument("uk", "privacy");
    expect(shapeOf(ukPrivacy.sections.map((s) => s.bullets?.length ?? 0))).toEqual(
      shapeOf(enPrivacy.sections.map((s) => s.bullets?.length ?? 0)),
    );
    expect(ukPrivacy.sections.map((s) => s.paragraphs.length)).toEqual(
      enPrivacy.sections.map((s) => s.paragraphs.length),
    );
  });
});
