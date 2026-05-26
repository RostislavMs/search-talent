"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui/button-styles";
import { useCurrentLocale } from "@/lib/i18n/client";
import { createLocalePath, type Locale } from "@/lib/i18n/config";

const notFoundCopy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    backLabel: string;
    homeLabel: string;
    browseLabel: string;
  }
> = {
  en: {
    eyebrow: "404",
    title: "We couldn't find that page.",
    description:
      "The address may be incorrect, or the page may have been moved or removed.",
    backLabel: "Go back",
    homeLabel: "Home page",
    browseLabel: "Browse projects",
  },
  uk: {
    eyebrow: "404",
    title: "Такої сторінки не знайдено.",
    description:
      "Можливо, адреса введена з помилкою, або сторінку перемістили чи видалили.",
    backLabel: "Повернутися назад",
    homeLabel: "На головну",
    browseLabel: "До проєктів",
  },
};

export default function NotFoundState({
  locale: localeProp,
}: {
  locale?: Locale;
}) {
  const router = useRouter();
  const currentLocale = useCurrentLocale();
  const locale = localeProp ?? currentLocale;
  const copy = notFoundCopy[locale];
  const homeHref = createLocalePath(locale, "/");

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-1 items-center px-4 py-10 sm:px-6 sm:py-14">
      <section className="bg-brand-hero w-full rounded-hero border border-[color:var(--border)] px-6 py-10 text-white shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/75">
          {copy.eyebrow}
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-3xl font-medium tracking-[-0.03em] sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
          {copy.description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
                return;
              }

              router.push(homeHref);
            }}
            className={buttonStyles({
              size: "lg",
              className:
                "bg-white text-slate-950 hover:bg-white/90 focus-visible:ring-white",
            })}
          >
            {copy.backLabel}
          </button>

          <Link
            href={homeHref}
            className={buttonStyles({
              variant: "secondary",
              size: "lg",
              className:
                "border-white/20 bg-white/10 text-white hover:bg-white/16 focus-visible:ring-white",
            })}
          >
            {copy.homeLabel}
          </Link>

          <Link
            href={createLocalePath(locale, "/projects")}
            className={buttonStyles({
              variant: "ghost",
              size: "lg",
              className:
                "text-white hover:bg-white/12 hover:text-white focus-visible:ring-white",
            })}
          >
            {copy.browseLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
