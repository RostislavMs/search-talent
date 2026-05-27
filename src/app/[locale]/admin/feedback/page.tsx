import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminFeedbackEntry from "@/components/admin-feedback-entry";
import { getFeedbackEntries } from "@/lib/db/feedback";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

type SearchParamValue = string | string[] | undefined;
type Category = "idea" | "bug" | "feedback" | "complaint";

function firstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin/feedback",
    title: `${dictionary.admin.feedback.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.feedback.description,
    noindex: true,
  });
}

export default async function AdminFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const locale = await resolveLocale(params);
  const resolved = await searchParams;
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.feedback;

  const categoryParam = firstValue(resolved.category);
  const selectedCategory: "all" | Category =
    categoryParam === "idea" ||
    categoryParam === "bug" ||
    categoryParam === "feedback" ||
    categoryParam === "complaint"
      ? (categoryParam as Category)
      : "all";

  const entries = (await getFeedbackEntries(200)) || [];
  const filtered =
    selectedCategory === "all"
      ? entries
      : entries.filter((entry) => entry.category === selectedCategory);

  const feedbackUiCopy =
    locale === "uk"
      ? {
          anonymous: "Анонім",
          from: "Від",
          email: "Email",
          submittedAt: "Надіслано",
          openProfile: "Відкрити профіль",
          dismiss: copy.dismiss,
          dismissing: "Видалення...",
          confirmTitle: "Прибрати відгук?",
          confirmMessage:
            "Запис буде видалений з системи. Дію не можна скасувати.",
          confirmButton: "Прибрати",
          cancel: "Скасувати",
          errorFallback: "Не вдалося прибрати відгук.",
        }
      : {
          anonymous: "Anonymous",
          from: "From",
          email: "Email",
          submittedAt: "Submitted",
          openProfile: "Open profile",
          dismiss: copy.dismiss,
          dismissing: "Removing...",
          confirmTitle: "Dismiss feedback?",
          confirmMessage:
            "This entry will be removed from the system. This action cannot be undone.",
          confirmButton: "Dismiss",
          cancel: "Cancel",
          errorFallback: "Could not dismiss the feedback entry.",
        };

  function buildFilterHref(next: "all" | Category) {
    const qs = new URLSearchParams();
    if (next !== "all") qs.set("category", next);
    const query = qs.toString();
    const path = createLocalePath(locale, "/admin/feedback");
    return query ? `${path}?${query}` : path;
  }

  const chips: Array<{ value: "all" | Category; label: string }> = [
    { value: "all", label: copy.filterAll },
    { value: "idea", label: copy.categoryLabels.idea },
    { value: "bug", label: copy.categoryLabels.bug },
    { value: "feedback", label: copy.categoryLabels.feedback },
    { value: "complaint", label: copy.categoryLabels.complaint },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{copy.description}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center text-sm app-muted">
            {copy.filterCategory}:
          </span>
          {chips.map((chip) => {
            const active = chip.value === selectedCategory;
            return (
              <Link
                key={chip.value}
                href={buildFilterHref(chip.value)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)]",
                ].join(" ")}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="rounded-hero app-panel-dashed p-8 text-center">
          <p className="text-sm app-muted">{copy.empty}</p>
        </section>
      ) : (
        <section className="space-y-4">
          {filtered.map((entry) => (
            <AdminFeedbackEntry
              key={entry.id}
              id={entry.id}
              category={entry.category}
              categoryLabel={
                (copy.categoryLabels as Record<string, string>)[
                  entry.category
                ] || entry.category
              }
              message={entry.message}
              createdAtLabel={formatDateTime(entry.createdAt, locale)}
              name={entry.name}
              email={entry.email}
              authorUsername={entry.authorUsername}
              authorDisplayName={entry.authorDisplayName}
              profileHref={
                entry.authorUsername
                  ? createLocalePath(locale, `/u/${entry.authorUsername}`)
                  : null
              }
              copy={{
                anonymous: feedbackUiCopy.anonymous,
                from: feedbackUiCopy.from,
                email: feedbackUiCopy.email,
                category:
                  (copy.categoryLabels as Record<string, string>)[
                    entry.category
                  ] || entry.category,
                submittedAt: feedbackUiCopy.submittedAt,
                openProfile: feedbackUiCopy.openProfile,
                dismiss: feedbackUiCopy.dismiss,
                dismissing: feedbackUiCopy.dismissing,
                confirmTitle: feedbackUiCopy.confirmTitle,
                confirmMessage: feedbackUiCopy.confirmMessage,
                confirmButton: feedbackUiCopy.confirmButton,
                cancel: feedbackUiCopy.cancel,
                errorFallback: feedbackUiCopy.errorFallback,
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}
