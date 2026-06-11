import FaqAccordion from "@/components/faq-accordion";
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

      <FaqAccordion items={items} />
    </section>
  );
}
