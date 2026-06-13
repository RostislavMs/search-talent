"use client";

import { useEffect, useState } from "react";
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

/**
 * Renders Vercel Web Analytics and Speed Insights only when the visitor has
 * allowed the "analytics" cookie category. Reacts live to consent changes via
 * the shared cookie-consent event, so enabling or revoking analytics takes
 * effect without a full page reload.
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
    </>
  );
}
