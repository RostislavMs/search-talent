import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import ConsentedAnalytics from "@/components/consented-analytics";
import HydrationCleanupScript from "@/components/hydration-cleanup-script";
import ThemeScript from "@/components/theme-script";
import {
  allowsCookieCategory,
  cookieConsentCookieName,
  parseCookieConsentValue,
} from "@/lib/cookie-consent";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/i18n/config";
import { getMetadataBase } from "@/lib/seo";
import { getThemeFromCookies, isTheme, themeCookieName } from "@/lib/theme";
import { themeChromeColors } from "@/lib/theme-client";
import "./globals.css";

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemeFromCookies();

  return {
    // Same theme the page renders with; `applyThemeToDocument` keeps it in
    // step when the reader flips the toggle.
    themeColor: themeChromeColors[theme],
    // Android otherwise lays the keyboard over the page without resizing it,
    // so the 100dvh messages layout keeps its height and the composer ends up
    // behind the keyboard.
    interactiveWidget: "resizes-content",
  };
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "SearchTalent — Specialist Profiles & Creative Portfolios",
    template: "%s | SearchTalent",
  },
  description:
    "Community platform where developers, designers, and IT specialists publish portfolios, projects, and articles. Discover talent and showcase your work.",
  // No `keywords`: Google has ignored the meta keywords tag since 2009, and a
  // single site-wide list shipped on every page said nothing about any of them.
  icons: {
    icon: [{ url: "/favicon.webp", type: "image/webp" }],
    shortcut: "/favicon.webp",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  // Prefer the URL locale forwarded by middleware (x-locale): the root layout
  // sits above the [locale] segment and cannot read the route param, and a
  // cookieless first request (e.g. Googlebot) would otherwise fall back to the
  // default and mislabel every /en/ page as lang="uk".
  const headerLocale = (await headers()).get("x-locale");
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale =
    (headerLocale && isLocale(headerLocale) && headerLocale) ||
    (cookieLocale && isLocale(cookieLocale) && cookieLocale) ||
    defaultLocale;
  const consent = parseCookieConsentValue(
    cookieStore.get(cookieConsentCookieName)?.value,
  );
  const storedTheme = cookieStore.get(themeCookieName)?.value;
  const theme =
    allowsCookieCategory(consent, "preferences") &&
    storedTheme &&
    isTheme(storedTheme)
      ? storedTheme
      : "light";

  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HydrationCleanupScript />
        <meta
          name="google-site-verification"
          content="-W2K0yXTapxiAm15YJGOXbyi0Wm0CQP1ktEJjDFXYaY"
        />
      </head>
      {/* `svh`, not `vh`: on a phone 100vh is the height with the browser bar
          collapsed, so a full-height page came out one toolbar taller than the
          screen — the messages view scrolled as a whole. */}
      <body className="min-h-svh" suppressHydrationWarning>
        {/* The animated web background lives only on the sign-in screens and
            the 404 and error pages — see components/interactive-background. */}
        <div className="relative flex min-h-svh flex-col">{children}</div>
        {/* Plerdy now renders inside ConsentedAnalytics, behind the same
            analytics-consent gate as the other measurement tools. */}
        <ConsentedAnalytics
          initialAllowed={allowsCookieCategory(consent, "analytics")}
        />
      </body>
    </html>
  );
}
