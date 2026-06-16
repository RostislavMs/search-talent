import type { NextResponse } from "next/server";

/**
 * Derives the Supabase host from the public env var so we can whitelist it
 * in the Content Security Policy without hardcoding a project ref.
 */
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function r2PublicOrigin(): string | null {
  const url = process.env.R2_PUBLIC_BASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function r2UploadOrigin(): string | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) return null;
  // AWS SDK signs PUTs to <bucket>.<account>.r2.cloudflarestorage.com
  // (virtual-hosted style). A wildcard host covers every bucket without
  // hardcoding the bucket name into the CSP.
  return `https://*.${accountId}.r2.cloudflarestorage.com`;
}

// Third-party players we embed in project pages. Each entry is the
// exact origin browsers see in the iframe `src`, so CSP `frame-src`
// allows it without opening the door to arbitrary hosts.
const embedFrameHosts = [
  // Video
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  // Audio
  "https://w.soundcloud.com",
  "https://open.spotify.com",
  // 3D
  "https://sketchfab.com",
  "https://my.spline.design",
  "https://app.spline.design",
];

function buildContentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  const supabaseHosts = supabase ? [supabase] : [];
  // Supabase Realtime uses a wss: endpoint derived from the REST URL.
  const supabaseWs = supabase ? [supabase.replace(/^https?:/, "wss:")] : [];
  const r2Public = r2PublicOrigin();
  const r2Upload = r2UploadOrigin();
  const r2ConnectHosts = [r2Upload, r2Public].filter(
    (value): value is string => Boolean(value),
  );
  const r2ImgHosts = r2Public ? [r2Public] : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      // Next.js injects inline bootstrap scripts and relies on eval()
      // in a few dev surfaces. 'unsafe-inline' is needed because we do
      // not currently route a per-request nonce through the middleware.
      "'unsafe-inline'",
      "'unsafe-eval'",
      // Ahrefs Web Analytics (analytics.js, consent-gated) bootstraps its
      // tracker from a blob: URL, so blob: must be allowed for scripts here —
      // worker-src already allows it for workers. Next.js dev also serves
      // some blob: scripts.
      "blob:",
      "https://va.vercel-scripts.com",
      "https://vitals.vercel-insights.com",
      "https://analytics.ahrefs.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https:",
      ...supabaseHosts,
      ...r2ImgHosts,
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://api.resend.com",
      "https://vitals.vercel-insights.com",
      "https://analytics.ahrefs.com",
      ...supabaseHosts,
      ...supabaseWs,
      ...r2ConnectHosts,
    ],
    "media-src": ["'self'", "blob:", "https:", ...supabaseHosts, ...r2ImgHosts],
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'self'", ...embedFrameHosts],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };

  // Only force HTTPS upgrades in production. On localhost the dev server
  // serves plain HTTP, so the upgrade directive would rewrite same-origin
  // fetches to https:// and break them with ERR_SSL_PROTOCOL_ERROR.
  if (process.env.NODE_ENV === "production") {
    directives["upgrade-insecure-requests"] = [];
  }

  return Object.entries(directives)
    .map(([key, values]) =>
      values.length > 0 ? `${key} ${values.join(" ")}` : key,
    )
    .join("; ");
}

export function applySecurityHeaders(response: NextResponse) {
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // HSTS is only meaningful over HTTPS. We enable it in production so local
  // development and previews are not forced into HTTPS pinning.
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());

  return response;
}
