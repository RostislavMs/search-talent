import type { CSSProperties } from "react";
import {
  getProfileFontStack,
  getProfileHeroBackground,
  getProfileHeroOverlay,
  getProfileSectionCardStyle,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import { normalizeProjectKind, type ProjectKind } from "@/lib/projects";

// ---------------------------------------------------------------------------
// The portfolio the home hero holds up as an example. Pure: the candidates come
// from the leaderboard snapshot and the projects from one query in
// lib/db/marketing, so the choice is unit-tested without a database.
//
// The preview is a miniature of the real profile page in the author's own
// colours, font and background, and it shows project covers, so a strong
// example is one with enough of them to fill it. Platform admins come last: the
// founder's own profile is the most complete one today, but "look at the site
// owner" is not the example a visitor needs.
// ---------------------------------------------------------------------------

/** Covers the preview shows in its projects row. */
export const EXAMPLE_MIN_COVERS = 3;

/**
 * The author's page styling, resolved to plain values so the preview renders
 * it without knowing the presentation model — and so it survives the cache's
 * JSON round trip.
 */
export type ExampleTheme = {
  fontFamily: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  heroBackground: string;
  /** A photo behind the hero, with the wash that keeps text readable on it. */
  heroImageUrl: string | null;
  heroOverlay: string | null;
  sectionCard: CSSProperties;
};

export type ExampleCandidate = {
  profileId: string;
  userId: string;
  username: string;
  name: string | null;
  headline: string | null;
  avatarUrl: string | null;
  categoryName: string | null;
  rating: number;
  projectCount: number;
  theme: ExampleTheme;
};

/** Published, public projects, pinned first and then newest first. */
export type ExampleProject = {
  id: string;
  ownerId: string;
  title: string;
  slug: string | null;
  coverUrl: string | null;
  kind: string | null;
};

export type ExampleCover = {
  id: string;
  title: string;
  coverUrl: string;
  kind: ProjectKind | null;
};

export type HeroExamplePortfolio = {
  username: string;
  name: string | null;
  headline: string | null;
  avatarUrl: string | null;
  categoryName: string | null;
  rating: number;
  projectCount: number;
  theme: ExampleTheme;
  covers: ExampleCover[];
};

export function toExampleTheme(presentation: ProfilePresentation): ExampleTheme {
  const hasPhoto =
    presentation.backgroundMode === "image" && Boolean(presentation.backgroundUrl);

  return {
    fontFamily: getProfileFontStack(presentation.fontPreset),
    surface: presentation.surfaceColor,
    text: presentation.textColor,
    muted: presentation.mutedColor,
    accent: presentation.accentColor,
    // A background video is not worth autoplaying in a thumbnail; its base
    // colour under the same wash stands in for it.
    heroBackground: getProfileHeroBackground(presentation),
    heroImageUrl: hasPhoto ? presentation.backgroundUrl : null,
    heroOverlay:
      hasPhoto || (presentation.backgroundMode === "video" && presentation.backgroundUrl)
        ? getProfileHeroOverlay(presentation)
        : null,
    sectionCard: getProfileSectionCardStyle(presentation),
  };
}

function tierOf(covers: number, isAdmin: boolean): number {
  if (covers >= EXAMPLE_MIN_COVERS) {
    return isAdmin ? 1 : 0;
  }
  return covers > 0 ? 2 : 3;
}

/**
 * Best candidate by tier — a non-admin with a full set of covers, then an admin
 * with one, then anyone with a cover, then anyone — keeping the leaderboard
 * order inside a tier.
 */
export function pickHeroExample({
  candidates,
  projects,
  adminUserIds,
}: {
  candidates: ExampleCandidate[];
  projects: ExampleProject[];
  adminUserIds: ReadonlySet<string>;
}): HeroExamplePortfolio | null {
  const projectsByOwner = new Map<string, ExampleProject[]>();
  for (const project of projects) {
    const list = projectsByOwner.get(project.ownerId) ?? [];
    list.push(project);
    projectsByOwner.set(project.ownerId, list);
  }

  let best: { candidate: ExampleCandidate; tier: number } | null = null;

  for (const candidate of candidates) {
    const owned = projectsByOwner.get(candidate.userId) ?? [];
    const covers = owned.filter((project) => project.coverUrl).length;
    const tier = tierOf(covers, adminUserIds.has(candidate.userId));

    if (!best || tier < best.tier) {
      best = { candidate, tier };
    }
    if (tier === 0) {
      break;
    }
  }

  if (!best) {
    return null;
  }

  const { candidate } = best;
  const owned = projectsByOwner.get(candidate.userId) ?? [];

  return {
    username: candidate.username,
    name: candidate.name,
    headline: candidate.headline,
    avatarUrl: candidate.avatarUrl,
    categoryName: candidate.categoryName,
    rating: candidate.rating,
    projectCount: Math.max(candidate.projectCount, owned.length),
    theme: candidate.theme,
    covers: owned
      .filter((project): project is ExampleProject & { coverUrl: string } =>
        Boolean(project.coverUrl),
      )
      .slice(0, EXAMPLE_MIN_COVERS)
      .map(({ id, title, coverUrl, kind }) => ({
        id,
        title,
        coverUrl,
        kind: normalizeProjectKind(kind),
      })),
  };
}
