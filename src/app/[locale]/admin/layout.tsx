import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/admin-sidebar";
import { buttonStyles } from "@/components/ui/button-styles";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireAdmin } from "@/lib/moderation-server";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;

  await requireAdmin(locale);

  const dictionary = getDictionary(locale);
  const copy = dictionary.admin;

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] app-soft">
            {copy.shell.subtitle}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.shell.title}
          </h1>
        </div>
        <Link
          href={createLocalePath(locale, "/dashboard")}
          className={buttonStyles({ variant: "secondary" })}
        >
          {copy.shell.backToSite}
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.5rem] app-panel p-3">
            <AdminSidebar
              locale={locale}
              labels={copy.nav}
              contentLabels={copy.contentNav}
              groupLabels={copy.navGroups}
              feedbackLabel={copy.feedback.title}
            />
          </div>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
