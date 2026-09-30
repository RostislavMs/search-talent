import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FaqAccordion from "@/components/faq-accordion";
import JsonLd from "@/components/json-ld";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { buildSignupHref } from "@/lib/auth/redirect";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { beat } from "@/lib/motion";
import {
  buildFaqSchema,
  buildMetadata,
  buildWebPageSchema,
  getMetadataBase,
  toBcp47,
} from "@/lib/seo";
import { getCurrentUser } from "@/lib/supabase/current-user";

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
  const copy = getDictionary(locale).companies.meta;

  return buildMetadata({
    locale,
    pathname: "/for-companies",
    // The title already names the site; the layout's "| SearchTalent" would repeat it.
    title: copy.forCompaniesTitle,
    absoluteTitle: true,
    description: copy.forCompaniesDescription,
  });
}

// Same section shell as /about and /rating-guide.
const SECTION = "mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal";
const HEADING =
  "font-display app-heading-rule text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl";
const BODY = "text-sm leading-7 app-muted sm:text-base sm:leading-8";
const ORDINAL = "text-xs font-semibold tracking-eyebrow text-[color:var(--brand-ink)]";

function ordinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

export default async function ForCompaniesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const copy = dictionary.companies;
  const landing = copy.landing;
  const isSignedIn = Boolean(await getCurrentUser());

  // A guest signs up first and lands straight on the form afterwards.
  const primaryCta = isSignedIn
    ? { href: "/companies/new", label: landing.ctaCreate }
    : { href: buildSignupHref(locale, "/companies/new"), label: landing.ctaSignup };

  const faqItems = landing.faq.map((item) => ({ question: item.q, answer: item.a }));

  return (
    <main className="mx-auto max-w-[88rem] px-0 py-10 sm:px-6">
      <JsonLd
        data={buildWebPageSchema({
          type: "AboutPage",
          url: new URL(`/${locale}/for-companies`, getMetadataBase()).toString(),
          name: copy.meta.forCompaniesTitle,
          description: copy.meta.forCompaniesDescription,
          inLanguage: toBcp47(locale),
        })}
      />
      <JsonLd data={buildFaqSchema(faqItems)} />

      <section className="bg-brand-hero relative overflow-hidden rounded-none border app-border p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:rounded-hero sm:p-10">
        <div className="app-enter max-w-3xl">
          <p style={beat(0)} className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm">
            {landing.eyebrow}
          </p>
          <h1
            style={beat(1)}
            className="font-display mt-4 text-3xl font-medium leading-[1.1] tracking-tight sm:text-4xl md:text-5xl"
          >
            {landing.title}
          </h1>
          <p style={beat(2)} className="mt-4 text-sm leading-7 text-white/82 sm:text-base sm:leading-8">
            {landing.intro}
          </p>
          <div style={beat(3)} className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href={primaryCta.href}>{primaryCta.label}</ButtonLink>
            <ButtonLink
              href="/talents"
              variant="ghost"
              className="border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
            >
              {landing.ctaBrowse}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="for-companies-why">
        <h2 id="for-companies-why" className={HEADING}>
          {landing.whyTitle}
        </h2>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {landing.why.map((item) => (
            <li key={item.title} className="rounded-2xl app-panel p-5">
              <h3 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-7 app-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={SECTION} aria-labelledby="for-companies-steps">
        <h2 id="for-companies-steps" className={HEADING}>
          {landing.stepsTitle}
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {landing.steps.map((step, index) => (
            <li key={step.title}>
              <p className={ORDINAL}>{ordinal(index)}</p>
              <h3 className="font-display mt-2 text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-7 app-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-0 sm:gap-8 lg:grid-cols-2">
        <section className={SECTION} aria-labelledby="for-companies-internships">
          <h2 id="for-companies-internships" className={HEADING}>
            {landing.internshipsTitle}
          </h2>
          <p className={`mt-5 ${BODY}`}>{landing.internshipsText}</p>
        </section>

        <section className={SECTION} aria-labelledby="for-companies-rules">
          <h2 id="for-companies-rules" className={HEADING}>
            {landing.rulesTitle}
          </h2>
          <ul className={`mt-5 list-disc space-y-2 pl-5 ${BODY}`}>
            {landing.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <LocalizedLink
            href="/terms"
            className="mt-5 inline-block text-sm font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
          >
            {landing.rulesLink} →
          </LocalizedLink>
        </section>
      </div>

      <section className={SECTION} aria-labelledby="for-companies-faq">
        <h2 id="for-companies-faq" className={HEADING}>
          {landing.faqTitle}
        </h2>
        <div className="mt-6">
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      <section className={`${SECTION} text-center`} aria-labelledby="for-companies-start">
        <h2
          id="for-companies-start"
          className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl"
        >
          {landing.bottomTitle}
        </h2>
        <p className={`mx-auto mt-3 max-w-xl ${BODY}`}>{landing.bottomText}</p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href={primaryCta.href}>{primaryCta.label}</ButtonLink>
        </div>
      </section>
    </main>
  );
}
