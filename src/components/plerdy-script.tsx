"use client";

import Script from "next/script";

// Plerdy click/heatmap bootstrap. Sets the site globals, then appends Plerdy's
// main script (removing any previous instance first).
//
// Rendered ONLY from ConsentedAnalytics, i.e. after the visitor allows the
// "analytics" cookie category. Plerdy records clicks and behaviour and sets its
// own storage, so loading it before consent would contradict both ePrivacy and
// our published Cookie Policy.
//
// Consequence for setup: Plerdy's "verify installation" check crawls the site
// without a consent cookie and will report "code not found". To verify, open the
// site in a browser, accept analytics in the consent banner, and confirm the
// request to a.plerdy.com in the network tab — do not un-gate this to make the
// dashboard check pass.
//
// Plerdy's stock snippet appends `?v=Math.random()`, which made the browser
// download main.js again on every page load. The date keeps it cached for a day
// while still picking up Plerdy's updates.
const PLERDY_SNIPPET = `
    var _protocol="https:"==document.location.protocol?"https://":"http://";
    _site_hash_code = "06c5fbb8be148e578d8bc2e5553a57c5",_suid=77911, plerdyScript=document.createElement("script");
    plerdyScript.setAttribute("defer",""),plerdyScript.dataset.plerdymainscript="plerdymainscript",
    plerdyScript.src="https://a.plerdy.com/public/js/click/main.js?v="+new Date().toISOString().slice(0,10);
    var plerdymainscript=document.querySelector("[data-plerdymainscript='plerdymainscript']");
    plerdymainscript&&plerdymainscript.parentNode.removeChild(plerdymainscript);
    try{document.head.appendChild(plerdyScript)}catch(t){console.log(t,"unable add script tag")}
`;

export default function PlerdyScript() {
  return (
    <Script id="plerdy-code" strategy="lazyOnload" data-plerdy_code="1">
      {PLERDY_SNIPPET}
    </Script>
  );
}
