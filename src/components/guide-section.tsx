import { ButtonLink } from "@/components/ui/Button";

export type GuideBlock = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

/**
 * Longer explainer under a discovery listing: a titled card of short blocks
 * (a heading with a paragraph or a list) and an optional call to action.
 * Same card as BrowseFacets and SeoFaqSection, so a landing page reads as one
 * family of sections.
 */
export default function GuideSection({
  title,
  blocks,
  action,
}: {
  title: string;
  blocks: GuideBlock[];
  action?: { label: string; href: string };
}) {
  return (
    <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-7">
      <div className="max-w-3xl">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {title}
        </h2>

        <div className="mt-5 space-y-6">
          {blocks.map((block) => (
            <div key={block.heading}>
              <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                {block.heading}
              </h3>
              {block.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-2 text-sm leading-7 app-muted sm:text-base"
                >
                  {paragraph}
                </p>
              ))}
              {block.items && block.items.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7 app-muted sm:text-base">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        {action ? (
          <div className="mt-6">
            <ButtonLink href={action.href} variant="secondary">
              {action.label}
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}
