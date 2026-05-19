import type { Dictionary } from "@/lib/i18n/dictionaries";
import CookieSettingsButton from "@/components/cookie-settings-button";
import LocalizedLink from "@/components/ui/localized-link";
import Image from "next/image";
import logoImage from "../../public/logo.webp";

type SiteFooterProps = {
  dictionary: Dictionary;
  isSignedIn: boolean;
};

export default function SiteFooter({
  dictionary,
  isSignedIn,
}: SiteFooterProps) {
  const isEnglish = dictionary.nav.search === "Search";

  const talentsLabel = isEnglish ? "Browse Talent" : "Таланти";

  const articlesLabel = isEnglish ? "Tech Articles" : "Статті";

  const projectsLabel = isEnglish
    ? "Freelance Portfolios"
    : "Портфоліо проєктів";

  const navLabel = isEnglish ? "Explore" : "Навігація";

  const accountLabel = isEnglish ? "Account" : "Акаунт";

  const infoLabel = isEnglish ? "Info" : "Інформація";

  const aboutLabel = isEnglish ? "About" : "Про нас";
  const faqLabel = isEnglish ? "FAQ" : "FAQ";
  const feedbackLabel = isEnglish ? "Feedback" : "Зворотний зв'язок";

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <LocalizedLink
              href="/"
              className="relative block h-9 w-[112px] shrink-0"
            >
              <Image
                src={logoImage}
                alt={dictionary.site.name}
                fill
                sizes="112px"
                className="object-contain object-left"
              />
            </LocalizedLink>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[color:var(--muted-foreground)]">
              {dictionary.footer.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--soft-foreground)]">
              {navLabel}
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--muted-foreground)]">
              <LocalizedLink
                href="/"
                className="hover:text-[color:var(--foreground)]"
              >
                {dictionary.nav.home}
              </LocalizedLink>
              <LocalizedLink
                href="/projects"
                className="hover:text-[color:var(--foreground)]"
              >
                {projectsLabel}
              </LocalizedLink>
              <LocalizedLink
                href="/talents"
                className="hover:text-[color:var(--foreground)]"
              >
                {talentsLabel}
              </LocalizedLink>
              <LocalizedLink
                href="/articles"
                className="hover:text-[color:var(--foreground)]"
              >
                {articlesLabel}
              </LocalizedLink>
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--soft-foreground)]">
              {accountLabel}
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--muted-foreground)]">
              <LocalizedLink
                href={isSignedIn ? "/dashboard" : "/login"}
                className="hover:text-[color:var(--foreground)]"
              >
                {isSignedIn ? dictionary.nav.dashboard : dictionary.nav.login}
              </LocalizedLink>
              {!isSignedIn && (
                <LocalizedLink
                  href="/signup"
                  className="hover:text-[color:var(--foreground)]"
                >
                  {dictionary.nav.signup}
                </LocalizedLink>
              )}
              {isSignedIn && (
                <LocalizedLink
                  href="/profile/edit"
                  className="hover:text-[color:var(--foreground)]"
                >
                  {dictionary.dashboard.editProfile}
                </LocalizedLink>
              )}
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--soft-foreground)]">
              {infoLabel}
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--muted-foreground)]">
              <LocalizedLink
                href="/about"
                className="hover:text-[color:var(--foreground)]"
              >
                {aboutLabel}
              </LocalizedLink>
              <LocalizedLink
                href="/faq"
                className="hover:text-[color:var(--foreground)]"
              >
                {faqLabel}
              </LocalizedLink>
              <LocalizedLink
                href="/feedback"
                className="hover:text-[color:var(--foreground)]"
              >
                {feedbackLabel}
              </LocalizedLink>
            </nav>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} SearchTalent</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LocalizedLink
              href="/terms"
              className="hover:text-[color:var(--foreground)]"
            >
              {dictionary.footer.terms}
            </LocalizedLink>
            <LocalizedLink
              href="/privacy"
              className="hover:text-[color:var(--foreground)]"
            >
              {dictionary.footer.privacy}
            </LocalizedLink>
            <LocalizedLink
              href="/cookies"
              className="hover:text-[color:var(--foreground)]"
            >
              {dictionary.footer.cookies}
            </LocalizedLink>
            <CookieSettingsButton
              label={dictionary.footer.manageCookies}
              className="hover:text-[color:var(--foreground)]"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
