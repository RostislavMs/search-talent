import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { JetBrains_Mono, Literata, Manrope } from "next/font/google";
import ConsentedAnalytics from "@/components/consented-analytics";
import HydrationCleanupScript from "@/components/hydration-cleanup-script";
import InteractiveBackground from "@/components/interactive-background";
import ThemeScript from "@/components/theme-script";

const fontDisplay = Literata({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const fontBody = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
import {
  allowsCookieCategory,
  cookieConsentCookieName,
  parseCookieConsentValue,
} from "@/lib/cookie-consent";
import { defaultLocale, isLocale, localeCookieName } from "@/lib/i18n/config";
import { getMetadataBase } from "@/lib/seo";
import { isTheme, themeCookieName } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "SearchTalent — Specialist Profiles & Creative Portfolios",
    template: "%s | SearchTalent",
  },
  description:
    "Community platform where developers, designers, and IT specialists publish portfolios, projects, and articles. Discover talent and showcase your work.",
  keywords: [
    "talent community",
    "creative portfolio",
    "IT projects",
    "developer profiles",
    "portfolio platform",
    "talent showcase",
    "portfolio online",
    "пошук талантів",
    "креативні портфоліо",
    "портфоліо онлайн",
    "IT проєкти",
    "профілі розробників",
  ],
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
    <html
      lang={locale}
      data-theme={theme}
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <HydrationCleanupScript />
        <meta
          name="google-site-verification"
          content="-W2K0yXTapxiAm15YJGOXbyi0Wm0CQP1ktEJjDFXYaY"
        />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <InteractiveBackground />
        <div className="relative flex min-h-screen flex-col">{children}</div>
        {/* Plerdy now renders inside ConsentedAnalytics, behind the same
            analytics-consent gate as the other measurement tools. */}
        <ConsentedAnalytics
          initialAllowed={allowsCookieCategory(consent, "analytics")}
        />
      </body>
    </html>
  );
}
