import type { ReactNode } from "react";
import CookieConsentBanner from "@/components/cookie-consent-banner";
import LinkPreviewProvider from "@/components/link-preview-provider";
import RevealObserver from "@/components/motion/reveal-observer";
import SiteFooter from "@/components/site-footer";
import SiteFooterSlot from "@/components/site-footer-slot";
import SiteHeader from "@/components/site-header";
import SitePopup from "@/components/site-popup";
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
    viewer,
    activePopup,
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
      <SiteFooterSlot>
        <SiteFooter dictionary={dictionary} />
      </SiteFooterSlot>
      <CookieConsentBanner initialConsent={initialConsent} />
      <SitePopup popup={activePopup} />
      {/* Renders nothing until a previewable link is hovered; the card copy
          itself arrives already localized from /api/link-preview, so only the
          loading label crosses into the client bundle. */}
      <LinkPreviewProvider labels={{ loading: dictionary.linkPreview.loading }} />
      {/* Renders nothing; watches for `.app-reveal` / `.app-cascade` anywhere in
          the document and plays their entrance as they reach the viewport. One
          observer for the whole site, so no page needs a client boundary of its
          own to animate. */}
      <RevealObserver />
    </ToastProvider>
  );
}
