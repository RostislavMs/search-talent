import { stripLocaleFromPathname } from "@/lib/i18n/config";

// Sign-in, sign-up and account-recovery screens. They are single-purpose and
// must fit one viewport, so the site chrome (footer, cookie banner) steps aside
// there. Consent itself is unaffected: nothing optional runs before the visitor
// answers the banner, they just answer it on the next page they open.
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify",
];

export function isAuthRoute(pathname: string | null) {
  const route = stripLocaleFromPathname(pathname || "/");

  return AUTH_ROUTES.some(
    (authRoute) => route === authRoute || route.startsWith(`${authRoute}/`),
  );
}
