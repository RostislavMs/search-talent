import { describe, expect, it } from "vitest";
import { summarizePrivateDetails } from "@/lib/profile-private";

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

  it("is empty without a row (nothing on file, or the table is not there yet)", () => {
    expect(summarizePrivateDetails(null, { isOwner: false })).toEqual({
      contact: { hasEmail: false, hasPhone: false, email: null, phone: null },
      salary: null,
    });
  });
});
