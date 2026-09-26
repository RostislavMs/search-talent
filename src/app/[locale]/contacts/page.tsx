import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import LocalizedLink from "@/components/ui/localized-link";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildMetadata,
  buildWebPageSchema,
  getMetadataBase,
  toBcp47,
} from "@/lib/seo";

const CONTACT_EMAIL = "support.searchtalent@gmail.com";
const TELEGRAM_URL = "https://t.me/search_talent";

const iconClass =
  "mt-0.5 h-5 w-5 shrink-0 text-[color:var(--soft-foreground)]";

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={iconClass}>
    <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
    <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={iconClass}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

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
    pathname: "/contacts",
    title: dictionary.metadata.contacts.title,
    description: dictionary.metadata.contacts.description,
  });
}

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);
  const t = dictionary.contactsPage;

  const channels: {
    title: string;
    text: string;
    href: string;
    value: string;
    external: boolean;
    icon: ReactNode;
  }[] = [
    {
      title: t.emailTitle,
      text: t.emailText,
      href: `mailto:${CONTACT_EMAIL}`,
      value: CONTACT_EMAIL,
      external: false,
      icon: <EmailIcon />,
    },
    {
      title: t.telegramTitle,
      text: t.telegramText,
      href: TELEGRAM_URL,
      value: "@search_talent",
      external: true,
      icon: <TelegramIcon />,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <JsonLd
        data={buildWebPageSchema({
          type: "ContactPage",
          url: new URL(`/${locale}/contacts`, getMetadataBase()).toString(),
          name: dictionary.metadata.contacts.title,
          description: dictionary.metadata.contacts.description,
          inLanguage: toBcp47(locale),
        })}
      />
      <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
        {t.eyebrow}
      </p>
      <h1 className="font-display mt-3 text-4xl font-medium tracking-tight text-[color:var(--foreground)]">
        {t.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-8 app-muted">
        {t.description}
      </p>

      <ul className="mt-12 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
        {channels.map((channel) => (
          <li key={channel.title} className="flex items-start gap-4 py-6">
            {channel.icon}
            <div className="min-w-0">
              <a
                href={channel.href}
                aria-label={`${channel.title}: ${channel.value}`}
                {...(channel.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="break-words text-base font-medium text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
              >
                {channel.value}
              </a>
              <p className="mt-1 text-sm leading-6 app-muted">{channel.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-base leading-8 app-muted">
        {t.feedbackText}{" "}
        <LocalizedLink
          href="/feedback"
          className="font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
        >
          {t.feedbackCta} →
        </LocalizedLink>
      </p>

      <LocalizedLink
        href="/"
        className="mt-12 inline-block text-sm app-soft transition-colors hover:text-[color:var(--foreground)]"
      >
        ← {t.backToHome}
      </LocalizedLink>
    </main>
  );
}
