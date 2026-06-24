"use client";

import Script from "next/script";

// Plerdy click/heatmap bootstrap. Sets the site globals, then appends Plerdy's
// main script (removing any previous instance first).
//
// Loaded on EVERY page independently of cookie consent — Plerdy's own
// installation check runs without accepting cookies, so a consent-gated tag
// would always report "code not found". Keep this separate from
// ConsentedAnalytics, which only renders its tools after analytics consent.
const PLERDY_SNIPPET = `
    var _protocol="https:"==document.location.protocol?"https://":"http://";
    _site_hash_code = "06c5fbb8be148e578d8bc2e5553a57c5",_suid=77911, plerdyScript=document.createElement("script");
    plerdyScript.setAttribute("defer",""),plerdyScript.dataset.plerdymainscript="plerdymainscript",
    plerdyScript.src="https://a.plerdy.com/public/js/click/main.js?v="+Math.random();
    var plerdymainscript=document.querySelector("[data-plerdymainscript='plerdymainscript']");
    plerdymainscript&&plerdymainscript.parentNode.removeChild(plerdymainscript);
    try{document.head.appendChild(plerdyScript)}catch(t){console.log(t,"unable add script tag")}
`;

export default function PlerdyScript() {
  return (
    <Script id="plerdy-code" strategy="afterInteractive" data-plerdy_code="1">
      {PLERDY_SNIPPET}
    </Script>
  );
}
