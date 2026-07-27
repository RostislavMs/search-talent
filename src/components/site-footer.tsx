import type { Dictionary } from "@/lib/i18n/dictionaries";
import CookieSettingsButton from "@/components/cookie-settings-button";
import LocalizedLink from "@/components/ui/localized-link";
import Image from "next/image";
import logoImage from "../../public/logo.webp";

type SiteFooterProps = {
  dictionary: Dictionary;
};

export default function SiteFooter({ dictionary }: SiteFooterProps) {
  const isEnglish = dictionary.nav.search === "Search";

  const talentsLabel = isEnglish ? "Browse Talent" : "Таланти";

  const articlesLabel = isEnglish ? "Tech Articles" : "Статті";

  const newsLabel = isEnglish ? "News" : "Новини";

  const projectsLabel = isEnglish
    ? "Creator Portfolios"
    : "Портфоліо авторів";

  const navLabel = isEnglish ? "Explore" : "Навігація";

  const sitemapLabel = isEnglish ? "Sitemap" : "Карта сайту";

  const infoLabel = isEnglish ? "Info" : "Інформація";
  const legalLabel = isEnglish ? "Legal" : "Правова інформація";

  const aboutLabel = isEnglish ? "About" : "Про нас";
  const ratingGuideLabel = isEnglish ? "Rating guide" : "Гайд по рейтингу";
  const faqLabel = isEnglish ? "FAQ" : "FAQ";
  const feedbackLabel = isEnglish ? "Feedback" : "Зворотний зв'язок";
  const contactsLabel = isEnglish ? "Contacts" : "Контакти";

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 sm:py-10">
        {/*
          Three link columns remain after the account block was dropped, so the
          tablet grid is 3-up (brand spans the full first row) — a 2-up grid
          would leave a hole in the last row.
        */}
        <div className="grid gap-8 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="sm:col-span-3 lg:col-span-1">
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
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--soft-foreground)]">
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
              <LocalizedLink
                href="/news"
                className="hover:text-[color:var(--foreground)]"
              >
                {newsLabel}
              </LocalizedLink>
              {/*
                Plain anchor, not LocalizedLink: /sitemap.xml is a root route
                handler outside the [locale] segment, so a locale prefix would
                404. It renders as a human-readable page via /sitemap.xsl.
              */}
              <a
                href="/sitemap.xml"
                className="hover:text-[color:var(--foreground)]"
              >
                {sitemapLabel}
              </a>
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--soft-foreground)]">
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
                href="/rating-guide"
                className="hover:text-[color:var(--foreground)]"
              >
                {ratingGuideLabel}
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
              <LocalizedLink
                href="/contacts"
                className="hover:text-[color:var(--foreground)]"
              >
                {contactsLabel}
              </LocalizedLink>
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--soft-foreground)]">
              {legalLabel}
            </p>
            <nav className="mt-3 flex flex-col items-start gap-2 text-sm text-[color:var(--muted-foreground)]">
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
                className="text-left hover:text-[color:var(--foreground)]"
              />
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted-foreground)]">
          <p>&copy; {new Date().getFullYear()} SearchTalent</p>
        </div>
      </div>
    </footer>
  );
}
