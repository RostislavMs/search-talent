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

// Plerdy click/heatmap bootstrap. Sets the site globals, then appends the main
// Plerdy script (removing any previous instance first). Loaded only with
// analytics consent, alongside the other measurement tools below.
const PLERDY_SNIPPET = `
  var _protocol="https:"==document.location.protocol?"https://":"http://";
  _site_hash_code = "44699a62bfe84558e64b152325ac1489",_suid=74681, plerdyScript=document.createElement("script");
  plerdyScript.setAttribute("defer",""),plerdyScript.dataset.plerdymainscript="plerdymainscript",
  plerdyScript.src="https://a.plerdy.com/public/js/click/main.js?v="+Math.random();
  var plerdymainscript=document.querySelector("[data-plerdymainscript='plerdymainscript']");
  plerdymainscript&&plerdymainscript.parentNode.removeChild(plerdymainscript);
  try{document.head.appendChild(plerdyScript)}catch(t){console.log(t,"unable add script tag")}
`;

/**
 * Renders Vercel Web Analytics + Speed Insights and Ahrefs Web Analytics only
 * when the visitor has allowed the "analytics" cookie category. Reacts live to
 * consent changes via the shared cookie-consent event, so enabling or revoking
 * analytics takes effect without a full page reload. Ahrefs is cookieless, but
 * we still gate it here to honour the consent UI's "analytics stays off unless
 * you allow it" promise and keep all measurement tools in one place.
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
      <Script id="plerdy-code" strategy="afterInteractive" data-plerdy_code="1">
        {PLERDY_SNIPPET}
      </Script>
    </>
  );
}
