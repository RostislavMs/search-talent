"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  allowsCookieCategory,
  cookieConsentUpdatedEvent,
  type CookieConsent,
} from "@/lib/cookie-consent";

type ConsentedAnalyticsProps = {
  initialAllowed: boolean;
};

const GA_MEASUREMENT_ID = "G-H24ZSXX8TG";

/**
 * Renders Vercel Web Analytics + Speed Insights, Ahrefs Web Analytics and
 * Google Analytics (gtag.js) only when the visitor has allowed the "analytics"
 * cookie category. Reacts live to consent changes via the shared cookie-consent
 * event, so enabling or revoking analytics takes effect without a full page
 * reload. Ahrefs is cookieless, but we still gate it here to honour the consent
 * UI's "analytics stays off unless you allow it" promise and keep all
 * measurement tools in one place. Google Analytics sets cookies, so gating it is
 * mandatory, not just tidy.
 */
export default function ConsentedAnalytics({
  initialAllowed,
}: ConsentedAnalyticsProps) {
  const [allowed, setAllowed] = useState(initialAllowed);

  useEffect(() => {
    const handleConsentUpdate = (event: Event) => {
      const consent = (event as CustomEvent<CookieConsent>).detail;
      setAllowed(allowsCookieCategory(consent, "analytics"));
    };

    window.addEventListener(cookieConsentUpdatedEvent, handleConsentUpdate);

    return () => {
      window.removeEventListener(cookieConsentUpdatedEvent, handleConsentUpdate);
    };
  }, []);

  if (!allowed) {
    return null;
  }

  return (
    <>
      <SpeedInsights />
      <Analytics />
      <Script
        src="https://analytics.ahrefs.com/analytics.js"
        data-key="SPXNhltKaN3KRW+jCF6zmw"
        strategy="afterInteractive"
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
