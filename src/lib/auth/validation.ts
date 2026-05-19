import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export const AUTH_LIMITS = {
  emailMaxLength: 254,
  passwordMinLength: 8,
  passwordMaxLength: 72,
} as const;

const emailSchema = z
  .string()
  .trim()
  .min(1, "email_required")
  .max(AUTH_LIMITS.emailMaxLength, "email_invalid")
  .email("email_invalid")
  .transform((value) => value.toLowerCase());

const loginPasswordSchema = z
  .string()
  .min(1, "password_required")
  .max(AUTH_LIMITS.passwordMaxLength, "password_too_long");

const signupPasswordSchema = z
  .string()
  .min(AUTH_LIMITS.passwordMinLength, "password_too_short")
  .max(AUTH_LIMITS.passwordMaxLength, "password_too_long")
  .refine((value) => value === value.trim(), {
    message: "password_edge_spaces",
  })
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: "password_too_weak",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: signupPasswordSchema,
    confirmPassword: z.string().min(1, "confirm_password_required"),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "passwords_do_not_match",
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: signupPasswordSchema,
    confirmPassword: z.string().min(1, "confirm_password_required"),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "passwords_do_not_match",
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AuthFieldName = "email" | "password" | "confirmPassword";
export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export function getAuthFieldErrors(error: z.ZodError): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !fieldErrors[field as AuthFieldName]) {
      fieldErrors[field as AuthFieldName] = issue.message;
    }
  }

  return fieldErrors;
}

export function getAuthErrorMessage(
  code: string,
  dictionary: Dictionary,
) {
  switch (code) {
    case "email_required":
      return dictionary.auth.errors.emailRequired;
    case "email_invalid":
      return dictionary.auth.errors.emailInvalid;
    case "password_required":
      return dictionary.auth.errors.passwordRequired;
    case "password_too_short":
      return dictionary.auth.errors.passwordTooShort;
    case "password_too_long":
      return dictionary.auth.errors.passwordTooLong;
    case "password_too_weak":
      return dictionary.auth.errors.passwordTooWeak;
    case "password_edge_spaces":
      return dictionary.auth.errors.passwordEdgeSpaces;
    case "confirm_password_required":
      return dictionary.auth.errors.confirmPasswordRequired;
    case "passwords_do_not_match":
      return dictionary.auth.errors.passwordsDoNotMatch;
    default:
      return dictionary.auth.errors.generic;
  }
}

export function getPublicAuthErrorMessage(
  mode: "login" | "signup" | "oauth",
  dictionary: Dictionary,
) {
  switch (mode) {
    case "login":
      return dictionary.auth.errors.invalidCredentials;
    case "signup":
      return dictionary.auth.errors.signupFailed;
    case "oauth":
      return dictionary.auth.errors.oauthFailed;
    default:
      return dictionary.auth.errors.generic;
  }
}

export function buildAuthRedirectUrl(
  locale: string,
  pathname: string,
  explicitBaseUrl?: string,
) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const baseUrl =
    explicitBaseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");

  if (!baseUrl) {
    return `/${locale}${normalizedPath}`;
  }

  return new URL(`/${locale}${normalizedPath}`, baseUrl).toString();
}
