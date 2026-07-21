"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const headerRef = useRef<HTMLElement>(null);
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDetailsElement>(null);
  const communityMenuRef = useRef<HTMLDetailsElement>(null);
  // The mobile navigation is a full-height right-side drawer that starts below
  // the header. It is portalled to the body (the header's backdrop-blur creates
  // a containing block that would otherwise trap a fixed-position child), so we
  // track the header height to offset the drawer's top edge.
  const [navOpen, setNavOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const closeProfileMenu = () => {
    if (profileMenuRef.current) {
      profileMenuRef.current.open = false;
    }
  };

  const closeMobileProfileMenu = () => {
    if (mobileProfileMenuRef.current) {
      mobileProfileMenuRef.current.open = false;
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
        mobileProfileMenuRef.current?.open &&
        !mobileProfileMenuRef.current.contains(target)
      ) {
        mobileProfileMenuRef.current.open = false;
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
      if (mobileProfileMenuRef.current?.open) {
        mobileProfileMenuRef.current.open = false;
      }
      if (communityMenuRef.current?.open) {
        communityMenuRef.current.open = false;
      }
      setNavOpen(false);
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
    closeMobileProfileMenu();
    closeCommunityMenu();
    // Deferred off the effect tick to avoid the set-state-in-effect lint rule
    // (same pattern as notifications-bell). Still runs on every route change.
    queueMicrotask(() => setNavOpen(false));
  }, [pathname]);

  // Track the header height so the portalled nav drawer can start exactly below
  // it, and keep it fresh as the sticky bar re-flows (e.g. breakpoint changes).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // While the full-height nav drawer is open: lock background scroll, and close
  // it if the viewport grows to the desktop layout (where the drawer is hidden)
  // so the scroll lock cannot get stranded.
  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mq = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => {
      document.body.style.overflow = previous;
      mq.removeEventListener("change", handleChange);
    };
  }, [navOpen]);

  const articlesLabel =
    dictionary.nav.search === "Search" ? "Articles" : "Статті";
  const talentsLabel =
    dictionary.nav.search === "Search" ? "Talents" : "Таланти";
  const primaryLinks = [
    { href: "/", label: dictionary.nav.home },
    { href: "/talents", label: talentsLabel },
    { href: "/projects", label: dictionary.nav.projects },
  ];
  // Community groups the content types (articles, polls, news) under one
  // dropdown.
  const communityLinks = [
    { href: "/articles", label: articlesLabel },
    { href: "/polls", label: dictionary.nav.polls },
    { href: "/news", label: dictionary.nav.news },
  ];
  const communityActive =
    pathname.startsWith("/articles") ||
    pathname.startsWith("/polls") ||
    pathname.startsWith("/news");

  // The profile dropdown is split into groups: the account essentials
  // (public profile, edit profile, my space, analytics) come first, then a
  // "Content" group for the viewer's own projects/articles/polls, then admin.
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
        { href: "/profile/edit", label: dictionary.mySpace.editProfile },
        { href: "/my-space", label: dictionary.nav.mySpace },
        { href: "/analytics", label: dictionary.nav.analytics },
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
    pathname === "/my-space" ||
    pathname.startsWith("/my-space/") ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/");
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
  // The two mobile triggers (navigation + profile) share one pill style so they
  // line up with the notifications bell. Below 640px they collapse to a square
  // icon-only button (no label); from 640px up the label appears alongside.
  const mobileTriggerClasses = (active: boolean) =>
    [
      "inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors duration-200 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] sm:w-auto sm:px-3",
      active
        ? "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
    ].join(" ");

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur"
    >
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

        {/* Below lg the bar collapses to: logo · notifications · profile ·
            menu. Profile stays a compact dropdown; navigation opens as a
            full-height right-side drawer. Below 640px both triggers drop their
            label and show only the icon. */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {viewer ? <NotificationsBell mode="link" /> : null}

          {viewer ? (
            <details ref={mobileProfileMenuRef} className="relative">
              <summary
                className={mobileTriggerClasses(profileActive)}
                aria-label={dictionary.nav.profile}
              >
                <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[color:var(--surface-muted)] text-xs font-semibold text-[color:var(--foreground)]">
                  {viewer.avatarUrl ? (
                    <OptimizedImage
                      src={viewer.avatarUrl}
                      alt={dictionary.nav.profile}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  ) : (
                    <span>{viewerInitial}</span>
                  )}
                </span>
                <span className="hidden sm:inline">
                  {dictionary.nav.profile}
                </span>
              </summary>

              <div className="absolute right-0 mt-3 w-[min(17rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain rounded-panel border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-2xl">
                <LocalizedLink
                  href={signedInAsHref}
                  onClick={closeMobileProfileMenu}
                  className="flex items-center gap-2.5 rounded-2xl bg-[color:var(--surface-muted)] px-3 py-2.5 transition hover:ring-1 hover:ring-inset hover:ring-[color:var(--border)]"
                >
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-base font-semibold text-[color:var(--foreground)]">
                    {viewer.avatarUrl ? (
                      <OptimizedImage
                        src={viewer.avatarUrl}
                        alt={dictionary.nav.profile}
                        fill
                        sizes="44px"
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

                <div className="mt-2 space-y-1">
                  {accountLinks.map((link) => (
                    <LocalizedLink
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileProfileMenu}
                      className={menuLinkClasses(
                        link.href === activeProfileMenuHref,
                      )}
                    >
                      {link.label}
                    </LocalizedLink>
                  ))}
                </div>

                {contentLinks.length > 0 ? (
                  <div className="mt-2">
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-eyebrow app-soft">
                      {dictionary.nav.content}
                    </p>
                    <div className="space-y-1">
                      {contentLinks.map((link) => (
                        <LocalizedLink
                          key={link.href}
                          href={link.href}
                          onClick={closeMobileProfileMenu}
                          className={menuLinkClasses(
                            link.href === activeProfileMenuHref,
                          )}
                        >
                          {link.label}
                        </LocalizedLink>
                      ))}
                    </div>
                  </div>
                ) : null}

                {adminLinks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {adminLinks.map((link) => (
                      <LocalizedLink
                        key={link.href}
                        href={link.href}
                        onClick={closeMobileProfileMenu}
                        className={menuLinkClasses(
                          link.href === activeProfileMenuHref,
                        )}
                      >
                        {link.label}
                      </LocalizedLink>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3">
                  <LogoutButton className="w-full justify-center" />
                </div>
              </div>
            </details>
          ) : null}

          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            className={mobileTriggerClasses(navOpen)}
            aria-label={dictionary.nav.menu}
            aria-expanded={navOpen}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">{dictionary.nav.menu}</span>
          </button>
        </div>

        {navOpen && typeof document !== "undefined"
          ? createPortal(
              <div className="lg:hidden">
                <div
                  className="fixed inset-x-0 bottom-0 z-40 bg-[color:var(--background)]/50 backdrop-blur-sm"
                  style={{ top: headerHeight }}
                  aria-hidden="true"
                  onClick={() => setNavOpen(false)}
                />

                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={dictionary.nav.menu}
                  className="fixed bottom-0 right-0 z-50 flex w-[min(16rem,80vw)] flex-col border-l border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl"
                  style={{ top: headerHeight }}
                >
                  <div className="flex-1 overflow-y-auto overscroll-contain p-3">
                    <div className="space-y-1">
                      {primaryLinks.map((link) => (
                        <NavLink
                          key={link.href}
                          href={link.href}
                          label={link.label}
                          mobile
                          onClick={() => setNavOpen(false)}
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
                            onClick={() => setNavOpen(false)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-[color:var(--border)] p-3">
                    <div className="grid grid-cols-2 gap-2">
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
                        <ThemeToggle
                          initialTheme={initialTheme}
                          initialCanPersist={initialCanPersistTheme}
                        />
                      </div>
                    </div>

                    {viewer ? null : (
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <LocalizedLink
                          href="/signup"
                          onClick={() => setNavOpen(false)}
                          className={buttonStyles({
                            className: "w-full justify-center whitespace-nowrap",
                          })}
                        >
                          {dictionary.nav.signup}
                        </LocalizedLink>

                        <LocalizedLink
                          href="/login"
                          onClick={() => setNavOpen(false)}
                          className={buttonStyles({
                            variant: "secondary",
                            className: "w-full justify-center whitespace-nowrap",
                          })}
                        >
                          {dictionary.nav.login}
                        </LocalizedLink>
                      </div>
                    )}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </header>
  );
}
