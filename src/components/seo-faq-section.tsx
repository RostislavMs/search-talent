import {
  buildFaqSchema,
  safeJsonLd,
} from "@/lib/seo";

export default function SeoFaqSection({
  title,
  items,
  description,
}: {
  title: string;
  items: Array<{ question: string; answer: string }>;
  description?: string;
}) {
  const schema = buildFaqSchema(items);

  return (
    <section className="rounded-hero app-card p-5 sm:p-7">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
      />
      <div className="max-w-3xl">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4">
        {items.map((item) => (
          <article key={item.question} className="rounded-3xl app-panel p-4 sm:p-5">
            <h3 className="text-base font-semibold text-[color:var(--foreground)]">
              {item.question}
            </h3>
            <p className="mt-3 text-sm leading-7 app-muted">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
