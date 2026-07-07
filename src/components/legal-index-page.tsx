import LocalizedLink from "@/components/ui/localized-link";

type LegalIndexCard = {
  href: string;
  title: string;
  description: string;
};

type LegalIndexPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  cards: LegalIndexCard[];
};

export default function LegalIndexPage({
  eyebrow,
  title,
  description,
  cards,
}: LegalIndexPageProps) {
  return (
    <main className="mx-auto max-w-5xl px-0 py-12 sm:px-6">
      <section className="rounded-none app-card p-8 sm:rounded-hero sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
          {eyebrow}
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 app-muted">
          {description}
        </p>
      </section>

      <section className="mt-8 grid gap-5 px-4 sm:grid-cols-2 sm:px-0 md:grid-cols-3">
        {cards.map((card) => (
          <LocalizedLink
            key={card.href}
            href={card.href}
            className="rounded-hero app-card p-6 transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl"
          >
            <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {card.title}
            </h2>
            <p className="mt-3 text-sm leading-7 app-muted">{card.description}</p>
          </LocalizedLink>
        ))}
      </section>
    </main>
  );
}
