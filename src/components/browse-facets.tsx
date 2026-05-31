import { ButtonLink } from "@/components/ui/Button";

export type BrowseFacetItem = {
  label: string;
  href: string;
  count: number;
};

/**
 * Titled block of pill links to programmatic landing pages (skill / role /
 * tag). Mirrors the "Popular technologies" chip section so skill and role
 * navigation stays visually consistent across the discovery pages, and gives
 * crawlers internal links into the top facet pages.
 */
export default function BrowseFacets({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: BrowseFacetItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-hero app-card p-5 sm:p-7">
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

      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((item) => (
          <ButtonLink
            key={item.href}
            href={item.href}
            variant="secondary"
            className="rounded-full"
          >
            <span>{item.label}</span>
            <span className="ml-2 rounded-full bg-black/8 px-2 py-0.5 text-xs">
              {item.count}
            </span>
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}
