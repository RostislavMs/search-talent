export const themeCookieName = "theme";

function buildClientCookieAttributes(maxAge: number) {
  if (typeof window === "undefined") {
    return `path=/; max-age=${maxAge}; samesite=lax`;
  }

  return [
    "path=/",
    `max-age=${maxAge}`,
    "samesite=lax",
    window.location.protocol === "https:" ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Colour the browser paints its own toolbar with (`<meta name="theme-color">`,
 * honoured by Chrome on Android). Each theme's `--surface`, the sticky
 * header's background, so the bar and the header read as one strip.
 */
export const themeChromeColors = {
  light: "#ffffff",
  dark: "#0d1726",
} as const;

export function applyThemeToDocument(theme: "light" | "dark") {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", themeChromeColors[theme]);
}

export function persistThemePreference(theme: "light" | "dark") {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${themeCookieName}=${encodeURIComponent(
    theme,
  )}; ${buildClientCookieAttributes(31536000)}`;
}

export function clearThemePreferencePersistence() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${themeCookieName}=; ${buildClientCookieAttributes(0)}`;
}

export function getThemeFromDocument() {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
