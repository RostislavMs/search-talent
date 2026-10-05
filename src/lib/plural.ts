/** Plural forms from the dictionary; English uses one and other. */
export type CountForms = { one: string; few: string; many: string; other: string };

/** "1 вакансія", "3 вакансії", "5 вакансій" / "1 vacancy", "5 vacancies". */
export function formatCount(count: number, forms: CountForms, locale: string): string {
  const rule = new Intl.PluralRules(locale === "uk" ? "uk" : "en").select(count);
  const template =
    rule === "one" ? forms.one : rule === "few" ? forms.few : rule === "many" ? forms.many : forms.other;
  return template.replace("{count}", new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US").format(count));
}

/** "31 бал", "34 бали", "25 балів" / "1 point", "34 points". */
export function formatScore(
  score: number,
  common: { scoreCount: CountForms; pluralLocale: string },
): string {
  return formatCount(score, common.scoreCount, common.pluralLocale);
}
