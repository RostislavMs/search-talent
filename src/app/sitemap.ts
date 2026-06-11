import type { MetadataRoute } from "next";
import { SITEMAP_IDS, getSitemapEntries } from "@/lib/sitemap-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = (
    await Promise.all(SITEMAP_IDS.map((id) => getSitemapEntries(id)))
  ).flat();

  return entries.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    alternates: {
      languages: Object.fromEntries(
        entry.alternates.map((alt) => [alt.locale, alt.href]),
      ),
    },
  }));
}
