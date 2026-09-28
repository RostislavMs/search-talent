// ---------------------------------------------------------------------------
// Project covers for the OG images (plan part 6: a shared portfolio link should
// show the work, not just a name).
//
// next/og cannot decode WebP, and uploaded covers are WebP. So each cover goes
// through the site's own image optimizer with an Accept header that leaves WebP
// and AVIF out, which makes it answer with a JPEG (checked on Vercel). The bytes
// are sniffed before use: anything that is not a PNG or a JPEG is dropped, so a
// cover can only go missing — it can never break the whole card.
// ---------------------------------------------------------------------------

export const OG_MAX_COVERS = 3;

// One of the default `images.deviceSizes`, and the default (only allowed)
// quality: the optimizer rejects anything else.
const OPTIMIZER_WIDTH = 640;
const OPTIMIZER_QUALITY = 75;
const FETCH_TIMEOUT_MS = 3000;
const MAX_BYTES = 1_500_000;

type CoverCandidate = { cover_url: string | null };

/** The first covers in the order the profile shows its projects (pinned first). */
export function pickOgCovers(projects: CoverCandidate[], max = OG_MAX_COVERS): string[] {
  const covers: string[] = [];

  for (const project of projects) {
    const url = project.cover_url?.trim();
    if (url && /^https?:\/\//i.test(url) && !covers.includes(url)) {
      covers.push(url);
    }
    if (covers.length >= max) {
      break;
    }
  }

  return covers;
}

export function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export function buildOptimizerUrl(siteUrl: string, imageUrl: string): string {
  const url = new URL("/_next/image", siteUrl);
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("w", String(OPTIMIZER_WIDTH));
  url.searchParams.set("q", String(OPTIMIZER_QUALITY));
  return url.toString();
}

/** A cover as a data URI next/og can draw, or null when it cannot be had in time. */
export async function loadOgCover(
  imageUrl: string,
  siteUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetcher(buildOptimizerUrl(siteUrl, imageUrl), {
      headers: { Accept: "image/jpeg,image/png;q=0.9" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = bytes.length <= MAX_BYTES ? sniffImageType(bytes) : null;

    return type ? `data:${type};base64,${Buffer.from(bytes).toString("base64")}` : null;
  } catch {
    return null;
  }
}

export async function loadOgCovers(
  imageUrls: string[],
  siteUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const loaded = await Promise.all(imageUrls.map((url) => loadOgCover(url, siteUrl, fetcher)));
  return loaded.filter((cover): cover is string => cover !== null);
}
