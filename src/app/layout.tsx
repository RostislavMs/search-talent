import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import HydrationCleanupScript from "@/components/hydration-cleanup-script";
import InteractiveBackground from "@/components/interactive-background";
import ThemeScript from "@/components/theme-script";
import {
  allowsCookieCategory,
  cookieConsentCookieName,
  parseCookieConsentValue,
} from "@/lib/cookie-consent";
import { defaultLocale, localeCookieName } from "@/lib/i18n/config";
import { getMetadataBase } from "@/lib/seo";
import { isTheme, themeCookieName } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "SearchTalent — Discover IT Talent & Creative Portfolios",
    template: "%s | SearchTalent",
  },
  description:
    "SearchTalent — community platform where developers, designers, and IT specialists publish portfolios, projects, and articles. Discover talent, follow creators, and showcase your work.",
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
  const locale = cookieStore.get(localeCookieName)?.value || defaultLocale;
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
      <body className="min-h-screen" suppressHydrationWarning>
        <InteractiveBackground />
        <div className="relative flex min-h-screen flex-col">{children}</div>
        <SpeedInsights />
      </body>
    </html>
  );
}
