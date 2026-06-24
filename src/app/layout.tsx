import type { Metadata } from "next";
import { cookies } from "next/headers";
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
        <ConsentedAnalytics
          initialAllowed={allowsCookieCategory(consent, "analytics")}
        />
        <!-- BEGIN PLERDY CODE -->
<script type="text/javascript" defer data-plerdy_code='1'>
    var _protocol="https:"==document.location.protocol?"https://":"http://";
    _site_hash_code = "44699a62bfe84558e64b152325ac1489",_suid=74681, plerdyScript=document.createElement("script");
    plerdyScript.setAttribute("defer",""),plerdyScript.dataset.plerdymainscript="plerdymainscript",
    plerdyScript.src="https://a.plerdy.com/public/js/click/main.js?v="+Math.random();
    var plerdymainscript=document.querySelector("[data-plerdymainscript='plerdymainscript']");
    plerdymainscript&&plerdymainscript.parentNode.removeChild(plerdymainscript);
    try{document.head.appendChild(plerdyScript)}catch(t){console.log(t,"unable add script tag")}
</script>
<!-- END PLERDY CODE -->
      </body>
    </html>
  );
}
