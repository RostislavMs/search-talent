import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/config";

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

/**
 * Fetches the single active popup, resolved for the given locale. Returns
 * `null` when nothing is active. Safe to call for anonymous visitors — RLS
 * exposes only the active row to non-admins.
 */
export async function getActivePopup(
  supabase: SupabaseClient,
  locale: Locale,
): Promise<ActivePopup | null> {
  const { data, error } = await supabase
    .from("site_popups")
    .select(POPUP_COLUMNS)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toActivePopup(data as SitePopupRecord, locale);
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
