// How a vacancy reads on cards and pages: the same facts, in the same order,
// everywhere. Pure, so server pages and client components share it.

import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  formatVacancyPay,
  formatVacancyPlace,
  vacancyKindHasHours,
  type VacancySummary,
} from "@/lib/vacancies";

type VacancyCopy = Dictionary["vacancies"];

/**
 * Where the work is: "Київ, Україна", or "Віддалено" when it is remote only
 * and no place is given. Null when nothing is known.
 */
export function vacancyPlaceLabel(
  vacancy: Pick<VacancySummary, "city" | "countryName" | "workFormats">,
  copy: VacancyCopy,
): string | null {
  const place = formatVacancyPlace(vacancy.city, vacancy.countryName);
  if (place) {
    return place;
  }
  return vacancy.workFormats.length === 1 && vacancy.workFormats[0] === "remote"
    ? copy.formats.remote
    : null;
}

/** "Стажування · Часткова зайнятість · Віддалено, гібрид · Київ" for a card. */
export function vacancyFactsLine(vacancy: VacancySummary, copy: VacancyCopy): string {
  const formats = vacancy.workFormats.map((format) => copy.formats[format]);
  const place = formatVacancyPlace(vacancy.city, vacancy.countryName);

  return [
    copy.kinds[vacancy.kind],
    vacancy.hours && vacancyKindHasHours(vacancy.kind) ? copy.hours[vacancy.hours] : null,
    formats.length > 0 ? formats.join(", ").toLowerCase().replace(/^./, (char) => char.toUpperCase()) : null,
    place,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function vacancyPayLabel(
  vacancy: Pick<VacancySummary, "pay">,
  copy: VacancyCopy,
  locale: string,
): string | null {
  return vacancy.pay ? formatVacancyPay(vacancy.pay, copy.pay, locale) : null;
}

export function formatVacancyDate(value: string | null, locale: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
