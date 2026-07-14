"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import logoImage from "../../public/logo.webp";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import HeaderNav from "@/components/header-nav";
import NavLink from "@/components/nav-link";
import LogoutButton from "@/components/logout-button";
import LanguageSwitcher from "@/components/language-switcher";
import NotificationsBell from "@/components/notifications-bell";
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
  initialCanPersistTheme: boolean;
};

export default function SiteHeader({
  dictionary,
  viewer,
  initialTheme,
  initialCanPersistTheme,
}: SiteHeaderProps) {
  const pathname = stripLocaleFromPathname(usePathname() || "/");
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const communityMenuRef = useRef<HTMLDetailsElement>(null);

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

  const closeCommunityMenu = () => {
    if (communityMenuRef.current) {
      communityMenuRef.current.open = false;
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
      if (
        communityMenuRef.current?.open &&
        !communityMenuRef.current.contains(target)
      ) {
        communityMenuRef.current.open = false;
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
      if (communityMenuRef.current?.open) {
        communityMenuRef.current.open = false;
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

  // Close all menus when the route changes (e.g. after navigation).
  useEffect(() => {
    closeProfileMenu();
    closeMobileMenu();
    closeCommunityMenu();
  }, [pathname]);
  const articlesLabel =
    dictionary.nav.search === "Search" ? "Articles" : "Статті";
  const talentsLabel =
    dictionary.nav.search === "Search" ? "Talents" : "Таланти";
  const primaryLinks = [
    { href: "/", label: dictionary.nav.home },
    { href: "/talents", label: talentsLabel },
    { href: "/projects", label: dictionary.nav.projects },
  ];
  // Community groups the content types (articles, polls) under one dropdown.
  const communityLinks = [
    { href: "/articles", label: articlesLabel },
    { href: "/polls", label: dictionary.nav.polls },
  ];
  const communityActive =
    pathname.startsWith("/articles") || pathname.startsWith("/polls");

  // The profile dropdown is split into groups: the account essentials
  // (public profile, edit profile, dashboard) come first, then a "Content"
  // group for the viewer's own projects/articles/polls, then admin.
  const accountLinks = viewer
    ? [
        ...(viewer.username
          ? [
              {
                href: `/u/${viewer.username}`,
                label: dictionary.nav.publicProfile,
              },
            ]
          : []),
        { href: "/profile/edit", label: dictionary.dashboard.editProfile },
        { href: "/dashboard", label: dictionary.nav.dashboard },
      ]
    : [];

  const contentLinks = viewer?.username
    ? [
        {
          href: `/u/${viewer.username}/projects`,
          label: dictionary.nav.myProjects,
        },
        {
          href: `/u/${viewer.username}/articles`,
          label: dictionary.nav.myArticles,
        },
        {
          href: `/u/${viewer.username}/polls`,
          label: dictionary.nav.myPolls,
        },
      ]
    : [];

  const adminLinks = viewer?.isAdmin
    ? [{ href: "/admin", label: dictionary.nav.adminConsole }]
    : [];

  // The "signed in as" card links to the viewer's own space — public profile
  // when they have a username, otherwise the profile editor.
  const signedInAsHref = viewer?.username
    ? `/u/${viewer.username}`
    : "/profile/edit";

  const profileActive =
    pathname.startsWith("/u/") ||
    pathname === "/profile/edit" ||
    pathname.startsWith("/profile/edit/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");
  const allProfileMenuLinks = [...accountLinks, ...contentLinks, ...adminLinks];
  const activeProfileMenuHref = allProfileMenuLinks
    .filter(
      (link) =>
        pathname === link.href || pathname.startsWith(`${link.href}/`),
    )
    .reduce<string | null>(
      (best, link) =>
        best === null || link.href.length > best.length ? link.href : best,
      null,
    );
  const viewerInitial = (
    viewer?.displayName ||
    viewer?.email ||
    dictionary.nav.profile
  )
    .slice(0, 1)
    .toUpperCase();
  // Active dropdown triggers use the same white/black (foreground) highlight as
  // every other selected state in the header (nav pills, language/theme
  // toggles, dropdown links) — orange stays reserved for the signup CTA only.
  // A transparent border on the active state keeps the box the same size as the
  // bordered inactive state (no 1px shift on toggle).
  const menuTriggerClasses = (active: boolean) =>
    [
      "inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors duration-200 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
      active
        ? "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
    ].join(" ");
  const menuLinkClasses = (active: boolean) =>
    [
      "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:rounded-2xl lg:px-4 lg:py-3",
      active
        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
    ].join(" ");
  // The desktop Community trigger lives inside HeaderNav's sliding indicator, so
  // it is borderless and transparent like the nav pills — the indicator paints
  // the active background and the text flips to the background colour.
  const communityTriggerClasses = (active: boolean) =>
    [
      "relative z-10 inline-flex cursor-pointer list-none items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
      active
        ? "text-[color:var(--background)]"
        : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-2 sm:px-6 sm:py-3">
        <LocalizedLink
          href="/"
          className="relative block h-9 w-[112px] shrink-0 sm:h-10 sm:w-[124px]"
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

        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <HeaderNav
            links={primaryLinks}
            trailingActive={communityActive}
            trailing={
              <details ref={communityMenuRef} className="relative">
                <summary className={communityTriggerClasses(communityActive)}>
                  <span>{dictionary.nav.community}</span>
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="transition-transform duration-300 ease-out in-[[open]]:rotate-180"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>

                <div className="absolute left-0 mt-3 w-60 rounded-panel border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-2xl">
                  {communityLinks.map((link) => {
                    const active =
                      pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                    return (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeCommunityMenu}
                        className={menuLinkClasses(active)}
                      >
                        {link.label}
                      </LocalizedLink>
                    );
                  })}
                </div>
              </details>
            }
          />
        </nav>

        {/* Language and theme sit together as one control row on desktop; on
            mobile both move into the menu (below) to keep the bar clean. */}
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle
            initialTheme={initialTheme}
            initialCanPersist={initialCanPersistTheme}
          />
        </div>

        {viewer ? (
          <div className="hidden lg:flex">
            <NotificationsBell />
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

                <div className="absolute right-0 mt-3 w-80 rounded-panel border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-2xl">
                  <LocalizedLink
                    href={signedInAsHref}
                    onClick={closeProfileMenu}
                    className="block rounded-2xl bg-[color:var(--surface-muted)] px-4 py-3 transition hover:ring-1 hover:ring-inset hover:ring-[color:var(--border)]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.nav.signedInAs}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-[color:var(--foreground)]">
                      {viewer.displayName ||
                        viewer.email ||
                        dictionary.nav.profile}
                    </p>
                  </LocalizedLink>

                  <div className="mt-3 space-y-1">
                    {accountLinks.map((link) => (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeProfileMenu}
                        className={menuLinkClasses(link.href === activeProfileMenuHref)}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                  </div>

                  {contentLinks.length > 0 ? (
                    <div className="mt-3">
                      <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                        {dictionary.nav.content}
                      </p>
                      <div className="space-y-1">
                        {contentLinks.map((link) => (
                          <LocalizedLink
                            key={link.href}
                            href={link.href}
                            onClick={closeProfileMenu}
                            className={menuLinkClasses(link.href === activeProfileMenuHref)}
                          >
                            {link.label}
                          </LocalizedLink>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {adminLinks.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {adminLinks.map((link) => (
                        <LocalizedLink
                          key={link.href}
                          href={link.href}
                          onClick={closeProfileMenu}
                          className={menuLinkClasses(link.href === activeProfileMenuHref)}
                        >
                          {link.label}
                        </LocalizedLink>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <LogoutButton className="w-full justify-center" />
                  </div>
                </div>
              </details>
            </>
          ) : (
            <>
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

        {viewer ? (
          <NotificationsBell mode="link" className="ml-auto lg:hidden" />
        ) : null}

        <details
          ref={mobileMenuRef}
          className={viewer ? "relative lg:hidden" : "relative ml-auto lg:hidden"}
        >
          <summary
            className={`${buttonStyles({
              size: "sm",
              variant: "secondary",
            })} cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden`}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {dictionary.nav.menu}
          </summary>

          <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain rounded-panel border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-2xl">
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

            <div className="mt-3">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                {dictionary.nav.community}
              </p>
              <div className="space-y-1">
                {communityLinks.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    mobile
                    onClick={closeMobileMenu}
                  />
                ))}
              </div>
            </div>

            {viewer ? (
              <>
                <LocalizedLink
                  href={signedInAsHref}
                  onClick={closeMobileMenu}
                  className="mt-3 flex items-center gap-3 rounded-2xl bg-[color:var(--surface-muted)] px-4 py-3 transition hover:ring-1 hover:ring-inset hover:ring-[color:var(--border)]"
                >
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
                    <p className="text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.nav.signedInAs}
                    </p>
                    <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                      {viewer.displayName ||
                        viewer.email ||
                        dictionary.nav.profile}
                    </p>
                  </div>
                </LocalizedLink>

                <div className="mt-3">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                    {dictionary.nav.profile}
                  </p>
                  <div className="space-y-1">
                    {accountLinks.map((link) => (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeMobileMenu}
                        className={menuLinkClasses(link.href === activeProfileMenuHref)}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                  </div>
                </div>

                {contentLinks.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.nav.content}
                    </p>
                    <div className="space-y-1">
                      {contentLinks.map((link) => (
                        <LocalizedLink
                          key={link.href}
                          href={link.href}
                          onClick={closeMobileMenu}
                          className={menuLinkClasses(link.href === activeProfileMenuHref)}
                        >
                          {link.label}
                        </LocalizedLink>
                      ))}
                    </div>
                  </div>
                ) : null}

                {adminLinks.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {adminLinks.map((link) => (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeMobileMenu}
                        className={menuLinkClasses(link.href === activeProfileMenuHref)}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-[color:var(--border)] p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.language.switchLabel}
                    </p>
                    <LanguageSwitcher />
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.theme.toggleLabel}
                    </p>
                    <ThemeToggle initialTheme={initialTheme} initialCanPersist={initialCanPersistTheme} />
                  </div>
                </div>

                <div className="mt-3">
                  <LogoutButton className="w-full justify-center" />
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-[color:var(--border)] p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.language.switchLabel}
                    </p>
                    <LanguageSwitcher />
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.theme.toggleLabel}
                    </p>
                    <ThemeToggle initialTheme={initialTheme} initialCanPersist={initialCanPersistTheme} />
                  </div>
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
