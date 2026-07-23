import { NextResponse, type NextRequest } from "next/server";
import {
  createLocalePath,
  detectPreferredLocale,
  getLocaleFromPathname,
  isLocale,
  localeCookieName,
} from "@/lib/i18n/config";
import { applySecurityHeaders } from "@/lib/security/headers";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, maybeLocale] = pathname.split("/");

  if (pathname.startsWith("/api") || pathname === "/project-media") {
    return applySecurityHeaders(await updateSession(request));
  }

  if (!isLocale(maybeLocale || "")) {
    const cookieLocale = request.cookies.get(localeCookieName)?.value || null;
    const preferredLocale =
      cookieLocale && isLocale(cookieLocale)
        ? cookieLocale
        : detectPreferredLocale(request.headers.get("accept-language"));
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = createLocalePath(
      getLocaleFromPathname(`/${preferredLocale}`),
      pathname,
    );

    // This redirect is content-negotiated: its target depends on the
    // `Accept-Language` header and the `locale` cookie. Next.js otherwise labels
    // middleware redirects `Cache-Control: public`, which lets a shared cache
    // (CDN/proxy/browser) store one locale's redirect for `/` and replay it for
    // every visitor — the "everyone lands on /uk" bug. Keep it out of shared
    // caches and declare what it varies on.
    const redirect = NextResponse.redirect(redirectUrl);
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Vary", "Accept-Language, Cookie");

    return applySecurityHeaders(redirect);
  }

  const response = await updateSession(request);
  response.cookies.set(localeCookieName, maybeLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|llms.txt|sitemap.xml|sitemap.xsl|sitemap/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp)$).*)",
  ],
};
