import { safeJsonLd } from "@/lib/seo";

/**
 * Renders a single JSON-LD `<script>` block. `safeJsonLd` escapes `</script>`
 * and the JSON-in-HTML hazards, so user-controlled fields (names, titles) are
 * safe to embed. Use for structured data emitted from server components; the
 * detail pages that pre-date this component still inline the same markup.
 */
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
