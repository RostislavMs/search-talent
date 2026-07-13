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

    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
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
