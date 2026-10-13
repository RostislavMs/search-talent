import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/config";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";

export const ACTIVE_POPUP_CACHE_TAG = "active-popup";
const ACTIVE_POPUP_REVALIDATE_SECONDS = 300;

export type PopupKind = "message" | "feedback";

/** Raw row shape as stored in the `site_popups` table. */
export type SitePopupRecord = {
  id: string;
  kind: PopupKind;
  is_active: boolean;
  title_en: string | null;
  title_uk: string | null;
  body_en: string | null;
  body_uk: string | null;
  cta_label_en: string | null;
  cta_label_uk: string | null;
  cta_href: string | null;
  delay_seconds: number;
  created_at: string;
  updated_at: string;
};

/** Locale-resolved popup handed to the client component. */
export type ActivePopup = {
  id: string;
  kind: PopupKind;
  title: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  delaySeconds: number;
};

const POPUP_COLUMNS =
  "id, kind, is_active, title_en, title_uk, body_en, body_uk, cta_label_en, cta_label_uk, cta_href, delay_seconds, created_at, updated_at";

function pickLocalized(
  en: string | null,
  uk: string | null,
  locale: Locale,
): string | null {
  const primary = locale === "uk" ? uk : en;
  const fallback = locale === "uk" ? en : uk;
  const value = (primary ?? fallback ?? "").trim();
  return value.length > 0 ? value : null;
}

function toActivePopup(row: SitePopupRecord, locale: Locale): ActivePopup {
  const ctaLabel = pickLocalized(row.cta_label_en, row.cta_label_uk, locale);
  const ctaHref = (row.cta_href ?? "").trim();

  return {
    id: row.id,
    kind: row.kind,
    title: pickLocalized(row.title_en, row.title_uk, locale),
    body: pickLocalized(row.body_en, row.body_uk, locale),
    // A CTA needs both a label and a destination to be actionable.
    ctaLabel: ctaLabel && ctaHref ? ctaLabel : null,
    ctaHref: ctaLabel && ctaHref ? ctaHref : null,
    delaySeconds: row.delay_seconds,
  };
}

async function readActivePopupRow(): Promise<SitePopupRecord | null> {
  // RLS exposes only the active row to anonymous readers, which is all we need.
  const supabase = createPublicReadOnlyClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("site_popups")
    .select(POPUP_COLUMNS)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // Thrown, not returned as "no popup", so a failed read is never cached.
  if (error) {
    throw new Error(error.message);
  }

  return (data as SitePopupRecord | null) ?? null;
}

// The active popup is the same for every visitor and every page, so it is read
// once per window instead of on each request; admin changes flush it at once.
const getActivePopupRow = unstable_cache(readActivePopupRow, ["active-popup-v1"], {
  revalidate: ACTIVE_POPUP_REVALIDATE_SECONDS,
  tags: [ACTIVE_POPUP_CACHE_TAG],
});

/**
 * The single active popup, resolved for the given locale; `null` when nothing
 * is active.
 */
export async function getActivePopup(locale: Locale): Promise<ActivePopup | null> {
  try {
    const row = await getActivePopupRow();
    return row ? toActivePopup(row, locale) : null;
  } catch {
    return null;
  }
}

/** After an admin change, so the very next page shows the new state. */
export function invalidateActivePopup() {
  revalidateTag(ACTIVE_POPUP_CACHE_TAG, { expire: 0 });
}

/**
 * Lists every popup (active and drafts) for the admin console. Relies on RLS
 * to restrict this to admins.
 */
export async function listPopups(
  supabase: SupabaseClient,
): Promise<SitePopupRecord[]> {
  const { data, error } = await supabase
    .from("site_popups")
    .select(POPUP_COLUMNS)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as SitePopupRecord[];
}
