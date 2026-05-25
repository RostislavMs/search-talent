import type { ReactNode } from "react";
import CookieConsentBanner from "@/components/cookie-consent-banner";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { ToastProvider } from "@/components/ui/toast";
import { getAppShellData } from "@/lib/app-shell";
import type { Locale } from "@/lib/i18n/config";

export default async function AppShell({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const {
    dictionary,
    initialConsent,
    initialTheme,
    initialCanPersistTheme,
    isSignedIn,
    viewer,
  } = await getAppShellData(locale);

  return (
    <ToastProvider>
      <SiteHeader
        dictionary={dictionary}
        viewer={viewer}
        initialTheme={initialTheme}
        initialCanPersistTheme={initialCanPersistTheme}
      />
      <div className="flex-1">{children}</div>
      <SiteFooter dictionary={dictionary} isSignedIn={isSignedIn} />
      <CookieConsentBanner initialConsent={initialConsent} />
    </ToastProvider>
  );
}
