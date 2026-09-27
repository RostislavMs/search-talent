import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getMyProfile } from "@/lib/db/profile";
import { getOnboardingChecklist, type OnboardingChecklist } from "@/lib/onboarding";
import {
  getEditableProfileCompleteness,
  type ProfileCompletenessBreakdown,
} from "@/lib/profile-completeness";
import { createClient } from "@/lib/supabase/server";

/**
 * Onboarding state lives in its own owner-only table (`user_onboarding`, see
 * `database/2026-09-27-onboarding.sql`) rather than on `profiles`, which anyone
 * can read.
 *
 * Until that migration is applied every read fails. The callers then treat the
 * state as unknown: nobody is sent to the onboarding automatically, and the
 * "shared the link" checkbox stays unticked.
 */
export type OnboardingRecord = {
  completedAt: string | null;
  linkSharedAt: string | null;
};

/** Null = unknown (table missing or the read failed). No row = a newcomer. */
export async function getOnboardingRecord(
  supabase: SupabaseClient,
  userId: string,
): Promise<OnboardingRecord | null> {
  const { data, error } = await supabase
    .from("user_onboarding")
    .select("completed_at, link_shared_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  const row = data as { completed_at: string | null; link_shared_at: string | null } | null;

  return {
    completedAt: row?.completed_at ?? null,
    linkSharedAt: row?.link_shared_at ?? null,
  };
}

/** Send the person to the onboarding after sign-in? Only when known to be new. */
export function needsOnboarding(record: OnboardingRecord | null) {
  return record !== null && !record.completedAt;
}

export type OnboardingMark = "completed" | "link_shared";

const MARK_COLUMN: Record<OnboardingMark, "completed_at" | "link_shared_at"> = {
  completed: "completed_at",
  link_shared: "link_shared_at",
};

/**
 * Records a milestone once: the first time is kept, so the timestamps can later
 * show how long the onboarding took. Returns false when the write failed.
 */
export async function markOnboarding(
  supabase: SupabaseClient,
  userId: string,
  mark: OnboardingMark,
): Promise<boolean> {
  const column = MARK_COLUMN[mark];
  const ensureRow = await supabase
    .from("user_onboarding")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (ensureRow.error) {
    return false;
  }

  const { error } = await supabase
    .from("user_onboarding")
    .update({ [column]: new Date().toISOString() })
    .eq("user_id", userId)
    .is(column, null);

  return !error;
}

export async function countPublishedProjects(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("status", "published");

  return error ? 0 : (count ?? 0);
}

export type MetaOption = { id: number; name: string };

/** Directions and skills for the "who you are" step. */
export async function getProfileMeta(supabase: SupabaseClient) {
  const [{ data: categories }, { data: skills }] = await Promise.all([
    supabase.from("profile_categories").select("id, name").order("name"),
    supabase.from("skills").select("id, name").order("name"),
  ]);

  return {
    categories: (categories || []) as MetaOption[],
    skills: (skills || []) as MetaOption[],
  };
}

export type OnboardingSnapshot = {
  user: User;
  profile: NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;
  publishedProjectsCount: number;
  record: OnboardingRecord | null;
  completeness: ProfileCompletenessBreakdown;
  checklist: OnboardingChecklist;
};

/**
 * Everything the onboarding page and the newcomer checklist in "My Space"
 * need about the signed-in person. Null when nobody is signed in.
 */
export async function getOnboardingSnapshot(): Promise<OnboardingSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [profile, publishedProjectsCount, record] = await Promise.all([
    getMyProfile(),
    countPublishedProjects(supabase, user.id),
    getOnboardingRecord(supabase, user.id),
  ]);

  if (!profile) {
    return null;
  }

  return {
    user,
    profile,
    publishedProjectsCount,
    record,
    completeness: getEditableProfileCompleteness(profile),
    checklist: getOnboardingChecklist({
      username: profile.username ?? null,
      email: user.email ?? null,
      name: profile.name ?? null,
      categoryId: profile.category_id,
      skillsCount: profile.skill_ids.length,
      publishedProjectsCount,
      linkShared: record ? Boolean(record.linkSharedAt) : null,
    }),
  };
}
