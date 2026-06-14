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
    <section className="rounded-hero app-card p-4 sm:p-7">
      <div className="max-w-3xl">
        <h2 className="font-display text-xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-7 app-muted sm:mt-3 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
        {items.map((item) => (
          <ButtonLink
            key={item.href}
            href={item.href}
            variant="secondary"
            size="sm"
            // Compact on mobile (sm size + smaller label); restored to the
            // regular chip size from the `sm:` breakpoint up.
            className="rounded-full sm:px-4 sm:py-2.5"
          >
            <span className="text-xs sm:text-sm">{item.label}</span>
            <span className="ml-1.5 rounded-full bg-black/8 px-1.5 py-0.5 text-[11px] sm:ml-2 sm:px-2 sm:text-xs">
              {item.count}
            </span>
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}
