import { getMetadataBase } from "@/lib/seo";

// Served from a route handler rather than the `robots.ts` metadata convention:
// the typed `MetadataRoute.Robots` API cannot emit comments, and we want a
// human-visible pointer to /llms.txt at the top of the file. Fully static
// (env-derived only, no request data), so it is prerendered at build.
export const dynamic = "force-static";

// Kept identical to the previous robots.ts rule set. Anything that resolves to
// noindex, is auth-gated, or is a filter/pagination variant stays disallowed.
const DISALLOW = [
  "/api/",
  "/admin",
  "/admin/",
  "/dashboard",
  "/dashboard/",
  "/login",
  "/signup",
  "/verify",
  "/forgot-password",
  "/reset-password",
  "/profile",
  "/profile/",
  "/feedback",
  "/search",
  "/*/admin",
  "/*/admin/",
  "/*/dashboard",
  "/*/dashboard/",
  "/*/login",
  "/*/signup",
  "/*/verify",
  "/*/forgot-password",
  "/*/reset-password",
  "/*/profile",
  "/*/profile/",
  "/*/feedback",
  "/*/search",
  "/*/projects/new",
  "/*/projects/edit/",
  "/*/articles/new",
  "/*/articles/edit/",
  "/*?*filter=",
  "/*?*sort=",
  "/*?*page=",
  "/*?*query=",
  "/*?*tag=",
];

export function GET() {
  const base = getMetadataBase();

  const body = [
    "# SearchTalent — robots.txt",
    "",
    "User-Agent: *",
    "Allow: /",
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Host: ${base.toString()}`,
    `Sitemap: ${new URL("/sitemap.xml", base).toString()}`,
    `# AI/LLMs: ${new URL("/llms.txt", base).toString()}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
