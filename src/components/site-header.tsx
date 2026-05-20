"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import logoImage from "../../public/logo.webp";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import NavLink from "@/components/nav-link";
import LogoutButton from "@/components/logout-button";
import LanguageSwitcher from "@/components/language-switcher";
import ThemeToggle from "@/components/theme-toggle";
import { buttonStyles } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import { stripLocaleFromPathname } from "@/lib/i18n/config";
import type { Theme } from "@/lib/theme";

type Viewer = {
  displayName: string | null;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
} | null;

type SiteHeaderProps = {
  dictionary: Dictionary;
  viewer: Viewer;
  initialTheme: Theme;
};

export default function SiteHeader({
  dictionary,
  viewer,
  initialTheme,
}: SiteHeaderProps) {
  const pathname = stripLocaleFromPathname(usePathname() || "/");
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);

  const closeProfileMenu = () => {
    if (profileMenuRef.current) {
      profileMenuRef.current.open = false;
    }
  };

  const closeMobileMenu = () => {
    if (mobileMenuRef.current) {
      mobileMenuRef.current.open = false;
    }
  };

  // Close menus when clicking outside or pressing ESC.
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        profileMenuRef.current?.open &&
        !profileMenuRef.current.contains(target)
      ) {
        profileMenuRef.current.open = false;
      }
      if (
        mobileMenuRef.current?.open &&
        !mobileMenuRef.current.contains(target)
      ) {
        mobileMenuRef.current.open = false;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (profileMenuRef.current?.open) {
        profileMenuRef.current.open = false;
      }
      if (mobileMenuRef.current?.open) {
        mobileMenuRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close both menus when the route changes (e.g. after navigation).
  useEffect(() => {
    closeProfileMenu();
    closeMobileMenu();
  }, [pathname]);
  const articlesLabel =
    dictionary.nav.search === "Search" ? "Articles" : "Статті";
  const talentsLabel =
    dictionary.nav.search === "Search" ? "Talents" : "Таланти";
  const primaryLinks = [
    { href: "/", label: dictionary.nav.home },
    { href: "/projects", label: dictionary.nav.projects },
    { href: "/talents", label: talentsLabel },
    { href: "/articles", label: articlesLabel },
  ];

  const wideExtraLinks = viewer
    ? [
        { href: "/dashboard", label: dictionary.nav.dashboard },
        ...(viewer.isAdmin
          ? [{ href: "/admin", label: dictionary.nav.adminConsole }]
          : []),
      ]
    : [];

  const dashboardLinks = viewer
    ? [
        { href: "/dashboard", label: dictionary.nav.dashboard },
        ...(viewer.username
          ? [
              {
                href: `/u/${viewer.username}/projects`,
                label: dictionary.nav.myProjects,
              },
              {
                href: `/u/${viewer.username}/articles`,
                label: dictionary.nav.myArticles,
              },
            ]
          : []),
        ...(viewer.isAdmin
          ? [{ href: "/admin", label: dictionary.nav.adminConsole }]
          : []),
      ]
    : [];
  const profileLinks = viewer
    ? viewer.username
      ? [
          {
            href: `/u/${viewer.username}`,
            label: dictionary.nav.publicProfile,
          },
          { href: "/profile/edit", label: dictionary.dashboard.editProfile },
        ]
      : [{ href: "/profile/edit", label: dictionary.dashboard.editProfile }]
    : [];
  const dashboardActive =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const profileActive =
    dashboardActive ||
    pathname.startsWith("/u/") ||
    pathname === "/profile/edit" ||
    pathname.startsWith("/profile/edit/");
  const viewerInitial = (
    viewer?.displayName ||
    viewer?.email ||
    dictionary.nav.profile
  )
    .slice(0, 1)
    .toUpperCase();
  const menuTriggerClasses = (active: boolean) =>
    buttonStyles({
      size: "sm",
      variant: active ? "primary" : "secondary",
      className:
        "gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden",
    });
  const menuLinkClasses = (active: boolean) =>
    [
      "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
      active
        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3 sm:px-6">
        <LocalizedLink
          href="/"
          className="relative block h-10 w-[124px] shrink-0"
        >
          <OptimizedImage
            src={logoImage}
            alt={dictionary.site.name}
            fill
            priority
            sizes="124px"
            className="object-contain object-left"
          />
        </LocalizedLink>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {primaryLinks.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
          {wideExtraLinks.length > 0 ? (
            <span
              aria-hidden="true"
              className="mx-1 hidden h-5 w-px bg-[color:var(--border)] xl:inline-block"
            />
          ) : null}
          {wideExtraLinks.map((link) => (
            <span key={link.href} className="hidden xl:inline-flex">
              <NavLink href={link.href} label={link.label} />
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center lg:ml-0">
          <LanguageSwitcher />
        </div>

        {viewer ? (
          <div className="hidden xl:flex">
            <ThemeToggle initialTheme={initialTheme} />
          </div>
        ) : null}

        <div className="hidden items-center gap-2 lg:flex">
          {viewer ? (
            <>
              <details ref={profileMenuRef} className="relative">
                <summary className={menuTriggerClasses(profileActive)}>
                  <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[color:var(--surface-muted)] text-xs font-semibold text-[color:var(--foreground)]">
                    {viewer.avatarUrl ? (
                      <OptimizedImage
                        src={viewer.avatarUrl}
                        alt={dictionary.nav.profile}
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    ) : (
                      <span>{viewerInitial}</span>
                    )}
                  </span>
                  <span>{dictionary.nav.profile}</span>
                </summary>

                <div className="absolute right-0 mt-3 w-80 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-2xl">
                  <div className="rounded-2xl bg-[color:var(--surface-muted)] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                      {dictionary.nav.signedInAs}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-[color:var(--foreground)]">
                      {viewer.displayName ||
                        viewer.email ||
                        dictionary.nav.profile}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1">
                    {dashboardLinks.map((link) => (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeProfileMenu}
                        className={menuLinkClasses(
                          pathname === link.href ||
                            pathname.startsWith(`${link.href}/`),
                        )}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                    {profileLinks.map((link) => (
                      <LocalizedLink
                        key={`${link.href}-${link.label}`}
                        href={link.href}
                        onClick={closeProfileMenu}
                        className={menuLinkClasses(
                          pathname === link.href ||
                            pathname.startsWith(`${link.href}/`),
                        )}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-[color:var(--border)] p-4 xl:hidden">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                      {dictionary.theme.toggleLabel}
                    </p>
                    <ThemeToggle initialTheme={initialTheme} />
                  </div>

                  <div className="mt-4">
                    <LogoutButton className="w-full justify-center" />
                  </div>
                </div>
              </details>
            </>
          ) : (
            <>
              <ThemeToggle initialTheme={initialTheme} />

              <LocalizedLink
                href="/login"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                {dictionary.nav.login}
              </LocalizedLink>

              <LocalizedLink
                href="/signup"
                className={buttonStyles({ size: "sm" })}
              >
                {dictionary.nav.signup}
              </LocalizedLink>
            </>
          )}
        </div>

        <details ref={mobileMenuRef} className="relative lg:hidden">
          <summary
            className={`${buttonStyles({
              size: "sm",
              variant: "secondary",
            })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
          >
            {dictionary.nav.menu}
          </summary>

          <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-2xl">
            <div className="space-y-1">
              {primaryLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  mobile
                  onClick={closeMobileMenu}
                />
              ))}
            </div>

            {viewer ? (
              <>
                <div className="mt-3 rounded-2xl bg-[color:var(--surface-muted)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-sm font-semibold text-[color:var(--foreground)]">
                      {viewer.avatarUrl ? (
                        <OptimizedImage
                          src={viewer.avatarUrl}
                          alt={dictionary.nav.profile}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <span>{viewerInitial}</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                        {dictionary.nav.signedInAs}
                      </p>
                      <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                        {viewer.displayName ||
                          viewer.email ||
                          dictionary.nav.profile}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                    {dictionary.nav.profile}
                  </p>
                  <div className="space-y-1">
                    {dashboardLinks.map((link) => (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeMobileMenu}
                        className={menuLinkClasses(
                          pathname === link.href ||
                            pathname.startsWith(`${link.href}/`),
                        )}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                    {profileLinks.map((link) => (
                      <LocalizedLink
                        key={`${link.href}-${link.label}`}
                        href={link.href}
                        onClick={closeMobileMenu}
                        className={menuLinkClasses(
                          pathname === link.href ||
                            pathname.startsWith(`${link.href}/`),
                        )}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-[color:var(--border)] p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                    {dictionary.theme.toggleLabel}
                  </p>
                  <ThemeToggle initialTheme={initialTheme} />
                </div>

                <div className="mt-3">
                  <LogoutButton className="w-full justify-center" />
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 rounded-2xl border border-[color:var(--border)] p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] app-soft">
                    {dictionary.theme.toggleLabel}
                  </p>
                  <ThemeToggle initialTheme={initialTheme} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <LocalizedLink
                    href="/login"
                    onClick={closeMobileMenu}
                    className={buttonStyles({
                      variant: "secondary",
                      className: "justify-center",
                    })}
                  >
                    {dictionary.nav.login}
                  </LocalizedLink>

                  <LocalizedLink
                    href="/signup"
                    onClick={closeMobileMenu}
                    className={buttonStyles({ className: "justify-center" })}
                  >
                    {dictionary.nav.signup}
                  </LocalizedLink>
                </div>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
