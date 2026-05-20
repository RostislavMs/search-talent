import { describe, expect, it } from "vitest";
import {
  AUTH_LIMITS,
  buildAuthRedirectUrl,
  forgotPasswordSchema,
  getAuthFieldErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/auth/validation";

describe("loginSchema", () => {
  it("accepts a valid email/password pair and lowercases the email", () => {
    const result = loginSchema.safeParse({
      email: "  USER@Example.COM ",
      password: "anything",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects missing email and password", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getAuthFieldErrors(result.error);
      expect(errors.email).toBe("email_required");
      expect(errors.password).toBe("password_required");
    }
  });

  it("rejects malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const validPayload = {
    email: "user@example.com",
    password: "StrongPass1",
    confirmPassword: "StrongPass1",
  };

  it("accepts a strong password matching confirmation", () => {
    expect(signupSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects passwords shorter than the minimum", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      password: "Ab1",
      confirmPassword: "Ab1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getAuthFieldErrors(result.error);
      expect(errors.password).toBe("password_too_short");
    }
  });

  it("rejects passwords longer than the maximum", () => {
    const tooLong = "A1" + "a".repeat(AUTH_LIMITS.passwordMaxLength);
    const result = signupSchema.safeParse({
      ...validPayload,
      password: tooLong,
      confirmPassword: tooLong,
    });

    expect(result.success).toBe(false);
  });

  it("rejects passwords missing the required character classes", () => {
    const weakPasswords = ["alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"];

    for (const password of weakPasswords) {
      const result = signupSchema.safeParse({
        ...validPayload,
        password,
        confirmPassword: password,
      });

      expect(result.success, password).toBe(false);
      if (!result.success) {
        const errors = getAuthFieldErrors(result.error);
        expect(errors.password).toBe("password_too_weak");
      }
    }
  });

  it("rejects passwords with leading/trailing whitespace", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      password: " StrongPass1 ",
      confirmPassword: " StrongPass1 ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getAuthFieldErrors(result.error);
      expect(errors.password).toBe("password_edge_spaces");
    }
  });

  it("rejects non-matching confirmation password", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      confirmPassword: "DifferentPass1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getAuthFieldErrors(result.error);
      expect(errors.confirmPassword).toBe("passwords_do_not_match");
    }
  });
});

describe("forgotPasswordSchema / resetPasswordSchema", () => {
  it("forgotPasswordSchema requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success)
      .toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("resetPasswordSchema enforces strong password and confirmation match", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "StrongPass1",
        confirmPassword: "StrongPass1",
      }).success,
    ).toBe(true);

    expect(
      resetPasswordSchema.safeParse({
        password: "StrongPass1",
        confirmPassword: "OtherPass1",
      }).success,
    ).toBe(false);
  });
});

describe("getAuthFieldErrors", () => {
  it("keeps only the first error per field", () => {
    const result = signupSchema.safeParse({
      email: "",
      password: "weak",
      confirmPassword: "",
    });

    if (result.success) {
      throw new Error("expected schema to fail");
    }

    const errors = getAuthFieldErrors(result.error);
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(errors.confirmPassword).toBeDefined();
  });
});

describe("buildAuthRedirectUrl", () => {
  it("falls back to a relative path when no base URL is available", () => {
    expect(buildAuthRedirectUrl("uk", "/auth/callback")).toBe("/uk/auth/callback");
  });

  it("normalizes pathnames missing a leading slash", () => {
    expect(buildAuthRedirectUrl("en", "auth/callback")).toBe("/en/auth/callback");
  });

  it("uses an explicit base URL when provided", () => {
    expect(
      buildAuthRedirectUrl("uk", "/auth/callback", "https://example.com"),
    ).toBe("https://example.com/uk/auth/callback");
  });
});
