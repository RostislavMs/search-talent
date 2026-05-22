import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationItem,
  type NotificationMetadata,
  type NotificationTargetType,
  type NotificationType,
} from "@/lib/constants/notifications";

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: NotificationType;
  target_type: NotificationTargetType | null;
  target_id: string | null;
  metadata: NotificationMetadata | null;
  read_at: string | null;
  created_at: string;
};

function mapRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export type CreateNotificationInput = {
  recipientUserId: string;
  actorUserId: string | null;
  type: NotificationType;
  targetType?: NotificationTargetType | null;
  targetId?: string | null;
  metadata?: NotificationMetadata;
};

/**
 * Inserts notifications, deduplicating self-notifications (actor ===
 * recipient). Uses the supplied client — pass the admin/service-role
 * client when called from a route that mutates on behalf of another
 * user.
 *
 * Errors are logged but never thrown: notifications must never block
 * the source mutation that produced them.
 */
export async function createNotifications(
  supabase: SupabaseClient,
  input: CreateNotificationInput | CreateNotificationInput[],
): Promise<void> {
  const list = Array.isArray(input) ? input : [input];

  const rows = list
    .filter((entry) => entry.recipientUserId !== entry.actorUserId)
    .map((entry) => ({
      recipient_user_id: entry.recipientUserId,
      actor_user_id: entry.actorUserId,
      type: entry.type,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(rows);

  if (error) {
    console.error("[notifications] insert failed", error);
  }
}

export async function listNotifications(
  supabase: SupabaseClient,
  params: {
    recipientUserId: string;
    limit?: number;
    before?: string | null;
  },
): Promise<NotificationItem[]> {
  const { recipientUserId, before } = params;
  const limit = Math.min(params.limit ?? NOTIFICATIONS_PAGE_SIZE, 100);

  let query = supabase
    .from("notifications")
    .select(
      "id, recipient_user_id, actor_user_id, type, target_type, target_id, metadata, read_at, created_at",
    )
    .eq("recipient_user_id", recipientUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return (data as NotificationRow[]).map(mapRow);
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  recipientUserId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", recipientUserId)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationsAsRead(
  supabase: SupabaseClient,
  params: {
    recipientUserId: string;
    ids?: string[];
    all?: boolean;
  },
): Promise<number> {
  const { recipientUserId, ids, all } = params;
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("notifications")
    .update({ read_at: nowIso }, { count: "exact" })
    .eq("recipient_user_id", recipientUserId)
    .is("read_at", null);

  if (!all) {
    if (!ids || ids.length === 0) return 0;
    query = query.in("id", ids);
  }

  const { error, count } = await query;

  if (error) return 0;
  return count ?? 0;
}

export async function deleteNotification(
  supabase: SupabaseClient,
  params: { recipientUserId: string; id: string },
): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("recipient_user_id", params.recipientUserId)
    .eq("id", params.id);

  return !error;
}

/**
 * Hydrates actor profile info (name, username, avatar) for a list of
 * notifications. Profile lookup is cheap (one query) and lets clients
 * render the feed without N+1 fetches.
 */
export async function hydrateNotificationActors(
  supabase: SupabaseClient,
  notifications: NotificationItem[],
): Promise<NotificationItem[]> {
  const actorIds = Array.from(
    new Set(
      notifications
        .map((entry) => entry.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (actorIds.length === 0) return notifications;

  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, username, avatar_url")
    .in("user_id", actorIds);

  const map = new Map<
    string,
    { name: string | null; username: string | null; avatar_url: string | null }
  >();

  if (data) {
    for (const row of data) {
      if (!row.user_id) continue;
      map.set(row.user_id, {
        name: row.name ?? null,
        username: row.username ?? null,
        avatar_url: row.avatar_url ?? null,
      });
    }
  }

  return notifications.map((entry) => {
    if (!entry.actorUserId) return entry;
    const profile = map.get(entry.actorUserId);
    if (!profile) return entry;

    return {
      ...entry,
      metadata: {
        ...entry.metadata,
        actorName: profile.name ?? entry.metadata.actorName,
        actorUsername: profile.username ?? entry.metadata.actorUsername,
        actorAvatarUrl:
          profile.avatar_url ?? entry.metadata.actorAvatarUrl ?? null,
      },
    };
  });
}
