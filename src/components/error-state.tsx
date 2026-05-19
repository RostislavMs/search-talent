"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonStyles } from "@/components/ui/button-styles";
import { useCurrentLocale } from "@/lib/i18n/client";
import { createLocalePath, type Locale } from "@/lib/i18n/config";

const errorCopy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    retryLabel: string;
    homeLabel: string;
  }
> = {
  en: {
    eyebrow: "Error",
    title: "Something went wrong on our side.",
    description:
      "We could not finish loading this page. The issue has been logged — please try again, or return home.",
    retryLabel: "Try again",
    homeLabel: "Home page",
  },
  uk: {
    eyebrow: "Помилка",
    title: "Щось пішло не так з нашого боку.",
    description:
      "Не вдалося завантажити сторінку. Інцидент зафіксовано — спробуйте ще раз або поверніться на головну.",
    retryLabel: "Спробувати знову",
    homeLabel: "На головну",
  },
};

export default function ErrorState({
  error,
  reset,
  locale: localeProp,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  locale?: Locale;
}) {
  const currentLocale = useCurrentLocale();
  const locale = localeProp ?? currentLocale;
  const copy = errorCopy[locale];
  const homeHref = createLocalePath(locale, "/");

  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-1 items-center px-4 py-10 sm:px-6 sm:py-14">
      <section className="w-full rounded-[2.5rem] border border-[color:var(--border)] bg-[linear-gradient(145deg,_rgba(15,23,42,0.97),_rgba(190,18,60,0.85)_58%,_rgba(245,158,11,0.76))] px-6 py-10 text-white shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
          {copy.description}
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-white/60">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className={buttonStyles({
              size: "lg",
              className:
                "bg-white text-slate-950 hover:bg-white/90 focus-visible:ring-white",
            })}
          >
            {copy.retryLabel}
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
        </div>
      </section>
    </main>
  );
}
