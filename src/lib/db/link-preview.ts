import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { getCreatorRatings, getProjectRatings } from "@/lib/db/leaderboards";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { LinkPreview, LinkPreviewTarget } from "@/lib/link-preview";
import { isPublicModerationStatus } from "@/lib/moderation";
import { toPlainText } from "@/lib/plain-text";
import {
  getProjectKindLabel,
  normalizeProjectKind,
  parseProjectPath,
} from "@/lib/projects";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";

/**
 * Data source for internal-link hover previews.
 *
 * Every read goes through the anonymous read-only client, so a preview can
 * only ever expose what a logged-out visitor already sees on the target page:
 * there is no viewer context to leak, and the response stays cacheable. The
 * explicit `status`/`moderation_status` gates mirror the page loaders in
 * `db/public.ts`, `db/articles.ts` and `db/polls.ts` — a draft or removed item
 * must not surface a card either.
 *
 * Each preview costs at most two round-trips (the row, then its author or
 * skills) and selects only the columns the card renders.
 */

/** Longest snippet we ship to the card; it is clamped to 3 lines anyway. */
const DESCRIPTION_LIMIT = 220;
const MAX_CHIPS = 3;

type LocalizedContentRow = {
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content_locale: string | null;
  translations: Record<
    string,
    {
      title?: string | null;
      excerpt?: string | null;
      cover_image_url?: string | null;
    }
  > | null;
};

function clampDescription(value: string | null | undefined): string | null {
  const text = toPlainText(value);
  if (!text) {
    return null;
  }

  return text.length > DESCRIPTION_LIMIT
    ? `${text.slice(0, DESCRIPTION_LIMIT).trimEnd()}…`
    : text;
}

function relationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null,
): string | null {
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }

  return relation?.name || null;
}

/**
 * Picks the localized title/excerpt/cover for an article or poll.
 *
 * Mirrors the fuller `pickLocalizedVersion` used by the detail loaders: fall
 * back to the primary language field by field, so a translation that only
 * carries a title still shows the original excerpt instead of a blank card.
 */
function pickLocalized(row: LocalizedContentRow, locale: Locale) {
  const primaryLocale = row.content_locale || "uk";
  const alt = locale === primaryLocale ? null : row.translations?.[locale];

  return {
    title: alt?.title?.trim() ? alt.title : row.title,
    excerpt: alt?.excerpt?.trim() ? alt.excerpt : row.excerpt,
    coverUrl: alt?.cover_image_url || row.cover_image_url,
  };
}

/**
 * The rating pill.
 *
 * The persisted `score` columns are Wilson-only (net votes), so cards across
 * the site show the composite leaderboard rating instead and fall back to the
 * column only for content the current snapshot has not picked up yet. A hover
 * card that quoted the raw column would contradict the page it previews.
 */
function scoreBadge(
  rating: number | null | undefined,
  fallbackScore: number | null | undefined,
  dictionary: Dictionary,
): string | null {
  const score = rating ?? fallbackScore;

  return typeof score === "number"
    ? `${score} ${dictionary.common.scoreSuffix}`
    : null;
}

function byLine(
  name: string | null,
  username: string | null,
  dictionary: Dictionary,
): string | null {
  const label = name || (username ? `@${username}` : null);
  return label ? `${dictionary.common.by} ${label}` : null;
}

async function fetchAuthor(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<{ name: string | null; username: string | null }> {
  if (!userId) {
    return { name: null, username: null };
  }

  const { data } = await supabase
    .from("profiles")
    .select("name, username")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as { name: string | null; username: string | null } | null;

  return { name: row?.name ?? null, username: row?.username ?? null };
}

/**
 * Counts a user's publicly visible rows in a content table.
 *
 * `head: true` asks PostgREST for the count only — no rows cross the wire. The
 * filters spell out `isPublicModerationStatus` (null counts as public, which
 * pre-moderation rows still are), so the number on the card matches what a
 * visitor finds after clicking through.
 */
async function countPublished(
  supabase: SupabaseClient,
  table: "projects" | "articles",
  ownerColumn: "owner_id" | "author_user_id",
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(ownerColumn, userId)
    .eq("status", "published")
    .or("moderation_status.is.null,moderation_status.eq.approved");

  return count ?? 0;
}

async function getProfilePreview(
  supabase: SupabaseClient,
  username: string,
  dictionary: Dictionary,
): Promise<LinkPreview | null> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, user_id, username, name, headline, avatar_url, score, city, moderation_status, countries ( name )",
    )
    // Exact match, exactly like the profile page loader — a card must never
    // appear for a username that would 404 when clicked.
    .eq("username", username)
    .maybeSingle();

  const profile = data as {
    id: string;
    user_id: string;
    username: string | null;
    name: string | null;
    headline: string | null;
    avatar_url: string | null;
    score: number | null;
    city: string | null;
    moderation_status: string | null;
    countries: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;

  if (
    !profile ||
    !profile.username ||
    !isPublicModerationStatus(profile.moderation_status)
  ) {
    return null;
  }

  // What this person has published says more on a hover card than a couple of
  // truncated skill names — and it is the same question the profile page
  // answers with its tab counts.
  const [projectCount, articleCount, creatorRatings] = await Promise.all([
    countPublished(supabase, "projects", "owner_id", profile.user_id),
    countPublished(supabase, "articles", "author_user_id", profile.user_id),
    getCreatorRatings(),
  ]);

  const location = [profile.city, relationName(profile.countries)]
    .filter(Boolean)
    .join(", ");

  return {
    kind: "profile",
    eyebrow: dictionary.linkPreview.profile,
    title: profile.name || profile.username,
    subtitle: `@${profile.username}`,
    description: profile.headline || null,
    imageUrl: profile.avatar_url,
    imageShape: "avatar",
    // Creator ratings are keyed by profile id, not user id.
    badge: scoreBadge(creatorRatings[profile.id], profile.score, dictionary),
    chips: [
      location,
      projectCount > 0
        ? `${projectCount} ${dictionary.linkPreview.projects}`
        : "",
      articleCount > 0
        ? `${articleCount} ${dictionary.linkPreview.articles}`
        : "",
    ]
      .filter(Boolean)
      .slice(0, MAX_CHIPS),
  };
}

async function getProjectPreview(
  supabase: SupabaseClient,
  key: string,
  dictionary: Dictionary,
): Promise<LinkPreview | null> {
  // `/projects/{slug}` is canonical, but the legacy `{id}-{slug}` and bare-id
  // forms still exist in older content — resolve all three.
  const route = parseProjectPath(key);
  const column = route.id ? "id" : "slug";
  const value = route.id ?? route.slug;

  if (!value) {
    return null;
  }

  const { data } = await supabase
    .from("projects")
    .select(
      "id, owner_id, title, slug, description, cover_url, score, kind, status, moderation_status",
    )
    .eq(column, value)
    .maybeSingle();

  const project = data as {
    id: string;
    owner_id: string | null;
    title: string;
    slug: string | null;
    description: string | null;
    cover_url: string | null;
    score: number | null;
    kind: string | null;
    status: string | null;
    moderation_status: string | null;
  } | null;

  if (
    !project ||
    project.status !== "published" ||
    !isPublicModerationStatus(project.moderation_status)
  ) {
    return null;
  }

  const [owner, projectRatings] = await Promise.all([
    fetchAuthor(supabase, project.owner_id),
    getProjectRatings(),
  ]);
  const projectKind = normalizeProjectKind(project.kind);

  return {
    kind: "project",
    eyebrow: projectKind
      ? getProjectKindLabel(projectKind, dictionary)
      : dictionary.linkPreview.project,
    title: project.title,
    subtitle: byLine(owner.name, owner.username, dictionary),
    description: clampDescription(project.description),
    imageUrl: project.cover_url,
    imageShape: "cover",
    badge: scoreBadge(projectRatings[project.id], project.score, dictionary),
    chips: [],
  };
}

async function getArticlePreview(
  supabase: SupabaseClient,
  slug: string,
  locale: Locale,
  dictionary: Dictionary,
): Promise<LinkPreview | null> {
  const { data } = await supabase
    .from("articles")
    .select(
      "author_user_id, title, excerpt, cover_image_url, content_locale, translations, published_at, views_count, status, moderation_status",
    )
    .eq("slug", slug)
    .maybeSingle();

  const article = data as
    | (LocalizedContentRow & {
        author_user_id: string | null;
        published_at: string | null;
        views_count: number | null;
        status: string | null;
        moderation_status: string | null;
      })
    | null;

  if (
    !article ||
    article.status !== "published" ||
    !isPublicModerationStatus(article.moderation_status)
  ) {
    return null;
  }

  const localized = pickLocalized(article, locale);
  const author = await fetchAuthor(supabase, article.author_user_id);

  return {
    kind: "article",
    eyebrow: dictionary.linkPreview.article,
    title: localized.title,
    subtitle: byLine(author.name, author.username, dictionary),
    description: clampDescription(localized.excerpt),
    imageUrl: localized.coverUrl,
    imageShape: "cover",
    badge: null,
    chips: [
      article.published_at
        ? formatRelativeTime(article.published_at, locale)
        : "",
      typeof article.views_count === "number" && article.views_count > 0
        ? `${article.views_count} ${dictionary.linkPreview.views}`
        : "",
    ]
      .filter(Boolean)
      .slice(0, MAX_CHIPS),
  };
}

async function getPollPreview(
  supabase: SupabaseClient,
  slug: string,
  locale: Locale,
  dictionary: Dictionary,
): Promise<LinkPreview | null> {
  const { data } = await supabase
    .from("polls")
    .select(
      "author_user_id, title, excerpt, cover_image_url, content_locale, translations, published_at, responses_count, status, moderation_status",
    )
    .eq("slug", slug)
    .maybeSingle();

  const poll = data as
    | (LocalizedContentRow & {
        author_user_id: string | null;
        published_at: string | null;
        responses_count: number | null;
        status: string | null;
        moderation_status: string | null;
      })
    | null;

  if (
    !poll ||
    poll.status !== "published" ||
    !isPublicModerationStatus(poll.moderation_status)
  ) {
    return null;
  }

  const localized = pickLocalized(poll, locale);
  const author = await fetchAuthor(supabase, poll.author_user_id);

  return {
    kind: "poll",
    eyebrow: dictionary.linkPreview.poll,
    title: localized.title,
    subtitle: byLine(author.name, author.username, dictionary),
    description: clampDescription(localized.excerpt),
    imageUrl: localized.coverUrl,
    imageShape: "cover",
    badge: null,
    chips: [
      typeof poll.responses_count === "number" && poll.responses_count > 0
        ? `${poll.responses_count} ${dictionary.linkPreview.responses}`
        : "",
    ]
      .filter(Boolean)
      .slice(0, MAX_CHIPS),
  };
}

/**
 * Resolves a parsed target into a display-ready card, or `null` when the
 * target does not exist or is not publicly visible. Never throws: a preview
 * is a nice-to-have, so a failed lookup degrades to "no card".
 */
export async function getLinkPreview(
  target: LinkPreviewTarget,
  locale: Locale,
): Promise<LinkPreview | null> {
  const supabase = createPublicReadOnlyClient() as SupabaseClient | null;

  if (!supabase) {
    return null;
  }

  const dictionary = getDictionary(locale);

  try {
    switch (target.kind) {
      case "profile":
        return await getProfilePreview(supabase, target.key, dictionary);
      case "project":
        return await getProjectPreview(supabase, target.key, dictionary);
      case "article":
        return await getArticlePreview(supabase, target.key, locale, dictionary);
      case "poll":
        return await getPollPreview(supabase, target.key, locale, dictionary);
      default:
        return null;
    }
  } catch (error) {
    console.error("[link-preview] lookup failed", error);
    return null;
  }
}
