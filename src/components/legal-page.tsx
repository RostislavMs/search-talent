import LocalizedLink from "@/components/ui/localized-link";

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  hubLabel: string;
  sections: LegalSection[];
};

export default function LegalPage({
  eyebrow,
  title,
  intro,
  lastUpdatedLabel,
  lastUpdatedValue,
  hubLabel,
  sections,
}: LegalPageProps) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <section className="rounded-hero app-card p-8 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
          {eyebrow}
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 app-muted">{intro}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm app-muted">
          <span className="rounded-full app-panel px-4 py-2">
            {lastUpdatedLabel}: {lastUpdatedValue}
          </span>
          <LocalizedLink
            href="/legal"
            className="rounded-full border app-border px-4 py-2 hover:text-[color:var(--foreground)]"
          >
            {hubLabel}
          </LocalizedLink>
        </div>
      </section>

      <section className="mt-8 space-y-5">
        {sections.map((section) => (
          <article key={section.title} className="rounded-hero app-card p-6 sm:p-7">
            <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {section.title}
            </h2>

            <div className="mt-4 space-y-4">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 app-muted sm:text-base">
                  {paragraph}
                </p>
              ))}
            </div>

            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-4 space-y-3 text-sm leading-7 app-muted sm:text-base">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-[color:var(--foreground)]/45" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
