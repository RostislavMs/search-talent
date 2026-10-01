import CompanyLogo from "@/components/company-logo";
import CompanyVerifiedBadge from "@/components/company-verified-badge";
import LocalizedLink from "@/components/ui/localized-link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { buildVacancyPath, type VacancySummary } from "@/lib/vacancies";
import { formatVacancyDate, vacancyFactsLine, vacancyPayLabel } from "@/lib/vacancy-presentation";

/**
 * One vacancy in a list: who, what, how it is paid, when it was posted. The
 * whole card opens the vacancy; the company is named, not linked, so there is
 * one target per card.
 */
export default function VacancyCard({
  vacancy,
  dictionary,
  locale,
  showCompany = true,
}: {
  vacancy: VacancySummary;
  dictionary: Dictionary;
  locale: string;
  /** Off on the company's own page, where the company is the page. */
  showCompany?: boolean;
}) {
  const copy = dictionary.vacancies;
  const pay = vacancyPayLabel(vacancy, copy, locale);
  const posted = formatVacancyDate(vacancy.publishedAt, locale);

  return (
    <LocalizedLink
      href={buildVacancyPath(vacancy.slug)}
      className="flex h-full flex-col rounded-2xl app-panel p-5 transition-colors hover:border-[color:var(--foreground)]"
    >
      {showCompany ? (
        <span className="flex min-w-0 items-center gap-3">
          <CompanyLogo
            name={vacancy.company.name}
            logoUrl={vacancy.company.logoUrl}
            alt=""
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[color:var(--foreground)]">
              {vacancy.company.name}
            </span>
            {vacancy.company.verified ? (
              <span className="mt-1 block">
                <CompanyVerifiedBadge
                  label={dictionary.companies.verified}
                  hint={dictionary.companies.verifiedHint}
                />
              </span>
            ) : null}
          </span>
        </span>
      ) : null}

      <span
        className={`font-display block break-words text-lg font-semibold tracking-tight text-[color:var(--foreground)] ${showCompany ? "mt-4" : ""}`}
      >
        {vacancy.title}
      </span>
      <span className="mt-2 block text-sm leading-6 app-muted">{vacancyFactsLine(vacancy, copy)}</span>

      <span className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-1 pt-5">
        <span className="text-sm font-semibold text-[color:var(--foreground)]">
          {pay ?? copy.card.payNotSet}
        </span>
        {posted ? <span className="text-xs app-soft">{posted}</span> : null}
      </span>
    </LocalizedLink>
  );
}
