export function isValidPublicUrl(value: string) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > 2048) {
    return false;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (!url.hostname || !url.hostname.includes(".")) {
      return false;
    }

    if (url.hostname.startsWith(".") || url.hostname.endsWith(".")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
