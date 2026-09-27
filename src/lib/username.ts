import { transliterateCyrillic } from "@/lib/slug";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
/** Same rule as the profile payload schema (`src/lib/validation/profile.ts`). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/i;

// A new account gets `user-` plus six random characters until the person picks
// their own nick. Deriving it from the email (the old behaviour) put part of a
// private address on a public URL.
const TEMPORARY_PREFIX = "user-";
const TEMPORARY_SUFFIX_LENGTH = 6;
const TEMPORARY_PATTERN = /^user-[a-z0-9]{6}$/;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateTemporaryUsername(
  randomBytes: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
) {
  const bytes = randomBytes(TEMPORARY_SUFFIX_LENGTH);
  let suffix = "";

  for (let index = 0; index < TEMPORARY_SUFFIX_LENGTH; index += 1) {
    suffix += ALPHABET[(bytes[index] ?? 0) % ALPHABET.length];
  }

  return `${TEMPORARY_PREFIX}${suffix}`;
}

export function isTemporaryUsername(username: string | null | undefined) {
  return Boolean(username && TEMPORARY_PATTERN.test(username.toLowerCase()));
}

/** Lowercase, `[a-z0-9._-]` only, no leading/trailing or repeated dashes. */
export function normalizeUsernameCandidate(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || ""
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when the nick is the email's local part (or that plus the `-2`, `-3`…
 * suffix the old generator added on collisions). Such accounts are asked to
 * pick their own nick; it is never changed for them, so links keep working.
 */
export function isEmailDerivedUsername(
  username: string | null | undefined,
  email: string | null | undefined,
) {
  if (!username || !email || !email.includes("@")) {
    return false;
  }

  const base = normalizeUsernameCandidate(email.split("@")[0]);

  if (!base) {
    return false;
  }

  const normalized = username.toLowerCase();
  return (
    normalized === base ||
    new RegExp(`^${escapeRegExp(base)}-\\d+$`).test(normalized)
  );
}

/** Nick the person should be nudged to replace: temporary or from the email. */
export function needsOwnUsername(
  username: string | null | undefined,
  email: string | null | undefined,
) {
  return (
    !username || isTemporaryUsername(username) || isEmailDerivedUsername(username, email)
  );
}

/**
 * A readable nick suggested from the person's name: "Олена Коваль" becomes
 * "olena.koval". Null when the name leaves nothing valid to work with.
 */
export function suggestUsernameFromName(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  const candidate = normalizeUsernameCandidate(
    transliterateCyrillic(name.trim().toLowerCase())
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "."),
  )
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/[._-]+$/g, "");

  return USERNAME_PATTERN.test(candidate) ? candidate : null;
}
