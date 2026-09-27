import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { buildLoginHref } from "@/lib/auth/redirect";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/verify",
    title: dictionary.metadata.verify.title,
    description: dictionary.metadata.verify.description,
    noindex: true,
  });
}

type VerifyStatus = "sent" | "confirmed" | "expired";

function readStatus(value: string | string[] | undefined): VerifyStatus {
  return value === "confirmed" || value === "expired" ? value : "sent";
}

/**
 * - sent (default): right after sign-up, "open the link in the email".
 * - confirmed: the link was opened in another browser, so the email is
 *   confirmed but there is no session yet (see /api/auth/callback).
 * - expired: the link was already used or is too old.
 */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const locale = await getLocaleValue(params);
  const status = readStatus((await searchParams).status);
  const copy = getDictionary(locale).auth.verify;
  const title =
    status === "confirmed"
      ? copy.confirmedTitle
      : status === "expired"
        ? copy.expiredTitle
        : copy.title;
  const description =
    status === "confirmed"
      ? copy.confirmedDescription
      : status === "expired"
        ? copy.expiredDescription
        : copy.description;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-0 py-0 sm:min-h-[calc(100svh-4.5rem)] sm:px-4 sm:py-6">
      <section className="w-full rounded-none sm:rounded-hero app-card px-4 py-6 sm:px-7 sm:py-6">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 app-muted">{description}</p>

        {status === "sent" ? (
          <p className="mt-4 text-sm leading-6 app-muted">{copy.hint}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {status === "sent" ? (
            <ButtonLink href="/" variant="secondary">
              {copy.backHome}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href={buildLoginHref(locale, "/onboarding")}>{copy.login}</ButtonLink>
              {status === "expired" ? (
                <ButtonLink href="/signup" variant="secondary">
                  {copy.signup}
                </ButtonLink>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
