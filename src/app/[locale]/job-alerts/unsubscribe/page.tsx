import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobAlertUnsubscribe from "@/components/job-alert-unsubscribe";
import { ButtonLink } from "@/components/ui/Button";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isValidJobAlertUnsubscribeToken } from "@/lib/job-alert-token";
import { JOB_ALERTS_PATH, JOB_ALERTS_UNSUBSCRIBE_PATH } from "@/lib/job-alerts";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).jobAlerts.unsubscribe;

  return buildMetadata({
    locale,
    pathname: JOB_ALERTS_UNSUBSCRIBE_PATH,
    title: copy.title,
    description: copy.text,
    noindex: true,
  });
}

/** Opened from the footer of a job alert email; works without signing in. */
export default async function JobAlertUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).jobAlerts.unsubscribe;
  const query = await searchParams;
  const userId = typeof query.u === "string" ? query.u : null;
  const token = typeof query.t === "string" ? query.t : null;
  const valid = isValidJobAlertUnsubscribeToken(userId, token);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <section className="rounded-hero app-card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h1>
        <div className="mt-4">
          {valid && userId && token ? (
            <JobAlertUnsubscribe userId={userId} token={token} />
          ) : (
            <>
              <p className="text-base leading-7 app-muted">{copy.invalid}</p>
              <div className="mt-5">
                <ButtonLink href={JOB_ALERTS_PATH} variant="secondary">
                  {copy.manage}
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
