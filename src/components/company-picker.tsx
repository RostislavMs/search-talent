"use client";

import { useEffect, useId, useRef, useState } from "react";
import CompanyLogo from "@/components/company-logo";
import { apiFetch } from "@/lib/api-client";

export type CompanyOption = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  /** Set for links that already exist; new picks have none yet. */
  status?: "approved" | "pending";
  confirmed?: boolean;
};

type Labels = {
  input: string;
  placeholder: string;
  searching: string;
  noResults: string;
  limitReached: string;
  remove: string;
  statusShown: string;
  statusPending: string;
  statusConfirmed: string;
};

/**
 * Search-and-chip picker for company pages (the project form). Backed by
 * /api/companies/search; the server decides what happens to each pick.
 */
export default function CompanyPicker({
  value,
  onChange,
  max,
  labels,
}: {
  value: CompanyOption[];
  onChange: (next: CompanyOption[]) => void;
  max: number;
  labels: Labels;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const atMax = value.length >= max;
  const chosen = new Set(value.map((company) => company.id));
  const visible = results.filter((company) => !chosen.has(company.id));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every keystroke; a reply for an older query is dropped.
  const requestRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function search(next: string) {
    setQuery(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    const request = ++requestRef.current;
    const trimmed = next.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const result = await apiFetch<{ companies?: CompanyOption[] }>(
        `/api/companies/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (request !== requestRef.current) return;
      setResults(result.ok ? (result.data.companies ?? []) : []);
      setLoading(false);
      setOpen(true);
    }, 250);
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(company: CompanyOption) {
    if (atMax || chosen.has(company.id)) return;
    onChange([...value, company]);
    search("");
    setOpen(false);
  }

  function statusLabel(company: CompanyOption): string | null {
    if (company.confirmed) return labels.statusConfirmed;
    if (company.status === "approved") return labels.statusShown;
    if (company.status === "pending") return labels.statusPending;
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((company) => {
            const status = statusLabel(company);
            return (
              <li
                key={company.id}
                className="inline-flex items-center gap-2 rounded-full app-panel py-1 pl-1 pr-2 text-sm"
              >
                <CompanyLogo name={company.name} logoUrl={company.logoUrl} alt="" size="sm" />
                <span className="font-medium text-[color:var(--foreground)]">{company.name}</span>
                {status ? <span className="text-xs app-soft">· {status}</span> : null}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((item) => item.id !== company.id))}
                  aria-label={`${labels.remove}: ${company.name}`}
                  className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-base leading-none app-muted transition hover:text-[color:var(--foreground)]"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <label htmlFor={inputId} className="sr-only">
        {labels.input}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="app-input"
        value={query}
        disabled={atMax}
        placeholder={atMax ? labels.limitReached : labels.placeholder}
        onChange={(event) => search(event.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />

      {open && query.trim().length >= 2 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border app-border bg-[color:var(--surface)] py-1 shadow-xl"
        >
          {loading ? (
            <li className="px-4 py-2 text-sm app-muted">{labels.searching}</li>
          ) : visible.length === 0 ? (
            <li className="px-4 py-2 text-sm app-muted">{labels.noResults}</li>
          ) : (
            visible.map((company) => (
              <li key={company.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => pick(company)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-[color:var(--surface-muted)]"
                >
                  <CompanyLogo name={company.name} logoUrl={company.logoUrl} alt="" size="sm" />
                  <span className="min-w-0 truncate font-medium text-[color:var(--foreground)]">
                    {company.name}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
