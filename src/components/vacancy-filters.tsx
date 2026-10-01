"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import SearchSelect from "@/components/ui/search-select";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import {
  VACANCY_KINDS,
  VACANCY_LEVELS,
  VACANCY_WORK_FORMATS,
  buildJobsHref,
  hasVacancyFilters,
  type VacancyFilters as Filters,
} from "@/lib/vacancies";

type Option = { id: number; name: string };

/**
 * The /jobs filters. They live in the address, so every result page is
 * rendered on the server (a list fetched only in the browser would look empty
 * to search engines) and can be shared as a link. Any change starts again from
 * the first page.
 */
export default function VacancyFilters({
  filters,
  countries,
  categories,
  skills,
}: {
  filters: Filters;
  /** Only what open vacancies have, so no filter leads to nothing. */
  countries: Option[];
  categories: Option[];
  skills: Option[];
}) {
  const router = useLocalizedRouter();
  const copy = useDictionary().vacancies;
  const ui = copy.list.filters;
  const [query, setQuery] = useState(filters.q);

  function apply(patch: Partial<Filters>) {
    router.push(buildJobsHref({ ...filters, ...patch, page: 1 }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ q: query.trim() });
  }

  const selectClass = "w-full";
  const triggerClass = "w-full text-sm";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="jobs-search" className="sr-only">
          {ui.search}
        </label>
        <input
          id="jobs-search"
          type="search"
          className="app-input min-w-0 flex-1"
          value={query}
          maxLength={80}
          placeholder={ui.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit">{ui.apply}</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div role="group" aria-label={ui.kind}>
          <FormSelect
            value={filters.kind ?? ""}
            placeholder={ui.anyKind}
            className={selectClass}
            triggerClassName={triggerClass}
            options={VACANCY_KINDS.map((kind) => ({ value: kind, label: copy.kinds[kind] }))}
            onChange={(value) => apply({ kind: (value || null) as Filters["kind"] })}
          />
        </div>
        <div role="group" aria-label={ui.format}>
          <FormSelect
            value={filters.format ?? ""}
            placeholder={ui.anyFormat}
            className={selectClass}
            triggerClassName={triggerClass}
            options={VACANCY_WORK_FORMATS.map((format) => ({
              value: format,
              label: copy.formats[format],
            }))}
            onChange={(value) => apply({ format: (value || null) as Filters["format"] })}
          />
        </div>
        <div role="group" aria-label={ui.level}>
          <FormSelect
            value={filters.level ?? ""}
            placeholder={ui.anyLevel}
            className={selectClass}
            triggerClassName={triggerClass}
            options={VACANCY_LEVELS.map((level) => ({ value: level, label: copy.levels[level] }))}
            onChange={(value) => apply({ level: (value || null) as Filters["level"] })}
          />
        </div>
        {categories.length > 0 ? (
          <div role="group" aria-label={ui.role}>
            <SearchSelect
              options={categories}
              value={filters.categoryId ?? undefined}
              placeholder={ui.anyRole}
              onChange={(value) => apply({ categoryId: value })}
            />
          </div>
        ) : null}
        {countries.length > 0 ? (
          <div role="group" aria-label={ui.country}>
            <SearchSelect
              options={countries}
              value={filters.countryId ?? undefined}
              placeholder={ui.anyCountry}
              onChange={(value) => apply({ countryId: value })}
            />
          </div>
        ) : null}
        {skills.length > 0 ? (
          <div role="group" aria-label={ui.skill}>
            <SearchSelect
              options={skills}
              value={filters.skillId ?? undefined}
              placeholder={ui.anySkill}
              onChange={(value) => apply({ skillId: value })}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[color:var(--foreground)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[color:var(--brand)]"
            checked={filters.paid}
            onChange={(event) => apply({ paid: event.target.checked })}
          />
          {ui.paid}
        </label>
        {hasVacancyFilters(filters) ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.push(buildJobsHref({}));
            }}
            className="text-sm font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
          >
            {ui.reset}
          </button>
        ) : null}
      </div>
    </div>
  );
}
