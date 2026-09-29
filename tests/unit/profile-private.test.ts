import { describe, expect, it } from "vitest";
import { formatHourlyRate, summarizePrivateDetails } from "@/lib/profile-private";

const row = {
  contact_email: "olena@example.com",
  phone: "+380501112233",
  salary_expectations: "3000",
  salary_currency: "usd",
  salary_public: false,
};

describe("summarizePrivateDetails", () => {
  it("tells a visitor only whether email and phone exist", () => {
    const { contact } = summarizePrivateDetails(row, { isOwner: false });

    expect(contact).toEqual({ hasEmail: true, hasPhone: true, email: null, phone: null });
  });

  it("gives the owner their own values (their page and PDF)", () => {
    const { contact } = summarizePrivateDetails(row, { isOwner: true });

    expect(contact.email).toBe("olena@example.com");
    expect(contact.phone).toBe("+380501112233");
  });

  it("hides salary unless the owner shows it, for the owner too", () => {
    expect(summarizePrivateDetails(row, { isOwner: false }).salary).toBeNull();
    expect(summarizePrivateDetails(row, { isOwner: true }).salary).toBeNull();

    const shown = { ...row, salary_public: true };
    expect(summarizePrivateDetails(shown, { isOwner: false }).salary).toEqual({
      amount: "3000",
      currency: "usd",
    });
  });

  it("drops an unknown currency and blank values", () => {
    const result = summarizePrivateDetails(
      { ...row, contact_email: "  ", salary_public: true, salary_currency: "btc" },
      { isOwner: true },
    );

    expect(result.contact.hasEmail).toBe(false);
    expect(result.contact.email).toBeNull();
    expect(result.salary).toEqual({ amount: "3000", currency: null });
  });

  it("hides the hourly rate unless the owner shows it, for the owner too", () => {
    const withRate = { ...row, hourly_rate: 20, hourly_rate_currency: "usd", hourly_rate_public: false };
    expect(summarizePrivateDetails(withRate, { isOwner: false }).hourlyRate).toBeNull();
    expect(summarizePrivateDetails(withRate, { isOwner: true }).hourlyRate).toBeNull();

    const shown = { ...withRate, hourly_rate_public: true };
    expect(summarizePrivateDetails(shown, { isOwner: false }).hourlyRate).toEqual({
      amount: 20,
      currency: "usd",
    });
    // Salary and the rate have separate switches.
    expect(summarizePrivateDetails(shown, { isOwner: false }).salary).toBeNull();
  });

  it("drops a rate that is not a whole number in range, and an unknown currency", () => {
    for (const hourly_rate of [0, -5, 12.5, 100_001, Number.NaN, null]) {
      const result = summarizePrivateDetails(
        { ...row, hourly_rate, hourly_rate_public: true },
        { isOwner: false },
      );
      expect(result.hourlyRate).toBeNull();
    }

    expect(
      summarizePrivateDetails(
        { ...row, hourly_rate: 15, hourly_rate_currency: "btc", hourly_rate_public: true },
        { isOwner: false },
      ).hourlyRate,
    ).toEqual({ amount: 15, currency: null });
  });

  it("reads a row saved before the rate columns existed", () => {
    expect(summarizePrivateDetails(row, { isOwner: false }).hourlyRate).toBeNull();
  });

  it("is empty without a row (nothing on file, or the table is not there yet)", () => {
    expect(summarizePrivateDetails(null, { isOwner: false })).toEqual({
      contact: { hasEmail: false, hasPhone: false, email: null, phone: null },
      salary: null,
      hourlyRate: null,
    });
  });
});

describe("formatHourlyRate", () => {
  it("fills the template for each locale", () => {
    expect(
      formatHourlyRate({ amount: 20, currency: "usd" }, "from {amount} {currency} per hour", "en"),
    ).toBe("from 20 USD per hour");
    expect(
      formatHourlyRate({ amount: 450, currency: "uah" }, "від {amount} {currency} за годину", "uk"),
    ).toBe("від 450 UAH за годину");
  });

  it("groups thousands the way each locale writes them", () => {
    expect(
      formatHourlyRate({ amount: 1500, currency: "uah" }, "from {amount} {currency} per hour", "en"),
    ).toBe("from 1,500 UAH per hour");
    // uk-UA groups with a (narrow) no-break space.
    expect(
      formatHourlyRate({ amount: 1500, currency: "uah" }, "від {amount} {currency} за годину", "uk"),
    ).toMatch(/^від 1\s500 UAH за годину$/u);
  });

  it("leaves no double space when the currency is unknown", () => {
    expect(
      formatHourlyRate({ amount: 20, currency: null }, "from {amount} {currency} per hour", "en"),
    ).toBe("from 20 per hour");
  });
});
