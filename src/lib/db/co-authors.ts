import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/db/notifications";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  CO_AUTHOR_CONTENT_COLUMN,
  CO_AUTHOR_TABLE,
  sanitizeCoAuthorIds,
  type CoAuthorContentType,
  type CoAuthorInvitation,
  type ContentAuthor,
} from "@/lib/co-authors";

export type EditorCoAuthor = {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
};

const CONTENT_TABLE: Record<CoAuthorContentType, string> = {
  project: "projects",
  article: "articles",
  poll: "polls",
};

type ProfileLite = {
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
};

async function hydrateProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url")
    .in("user_id", unique);

  for (const row of (data ?? []) as ProfileLite[]) {
    if (row.user_id) map.set(row.user_id, row);
  }
  return map;
}

/** A pending invitation `sync_co_authors` / `save_project` just created. */
export type NewCoAuthorInvite = { id: string; userId: string };

/** The `invited` list of a save function's result, checked. */
export function parseNewCoAuthorInvites(value: unknown): NewCoAuthorInvite[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item as { id?: unknown; userId?: unknown } | null;
    return row && typeof row.id === "string" && typeof row.userId === "string"
      ? [{ id: row.id, userId: row.userId }]
      : [];
  });
}

/**
 * `co_author_invite` notifications for invitations the database just created,
 * through the service-role client. A failure is logged, never thrown: the
 * work is already saved.
 */
export async function notifyCoAuthorInvites(params: {
  contentType: CoAuthorContentType;
  contentId: string;
  contentTitle: string;
  contentSlug: string;
  creatorUserId: string;
  invited: NewCoAuthorInvite[];
}): Promise<void> {
  const { contentType, contentId, contentTitle, contentSlug, creatorUserId, invited } = params;
  if (invited.length === 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  await createNotifications(
    admin,
    invited.map((row) => ({
      recipientUserId: row.userId,
      actorUserId: creatorUserId,
      type: "co_author_invite" as const,
      targetType: contentType,
      targetId: contentId,
      metadata: {
        invitationId: row.id,
        coAuthorContentType: contentType,
        coAuthorContentSlug: contentSlug,
        coAuthorContentTitle: contentTitle,
      },
    })),
  );
}

/**
 * Invites co-authors to a freshly created piece of content: pending rows in
 * one database call (`sync_co_authors` — not the creator, real profiles only,
 * at most 4), then the notifications. Returns how many were invited.
 */
export async function inviteCoAuthors(params: {
  supabase: SupabaseClient;
  contentType: CoAuthorContentType;
  contentId: string;
  contentTitle: string;
  contentSlug: string;
  creatorUserId: string;
  coAuthorUserIds: string[];
}): Promise<number> {
  if (params.coAuthorUserIds.length === 0) return 0;

  return syncCoAuthors({ ...params, desiredUserIds: params.coAuthorUserIds });
}

type RespondResult = {
  ok: boolean;
  /** New invitation status, or null when the invite was not actionable. */
  status: "accepted" | "declined" | null;
  /** True when this response was the one that published the held content. */
  published: boolean;
};

type RespondRow = {
  ok?: boolean;
  status?: "accepted" | "declined";
  published?: boolean;
  contentId?: string;
  ownerId?: string;
  title?: string | null;
  slug?: string | null;
};

/**
 * Accept or decline a co-author invitation. The database does the whole
 * answer in one transaction (`respond_co_author_invite`): checks the
 * invitation is the caller's and pending, records the answer, and — once no
 * invite is left pending on a work held for its co-authors — publishes it,
 * exactly once even when two people answer at the same moment. Whether the
 * last answer was an accept or a decline, the work goes live with whoever
 * accepted. The notifications follow here.
 */
export async function respondToCoAuthorInvitation(params: {
  supabase: SupabaseClient;
  contentType: CoAuthorContentType;
  invitationId: string;
  userId: string;
  accept: boolean;
}): Promise<RespondResult> {
  const { supabase, contentType, invitationId, userId, accept } = params;

  const { data, error } = await supabase.rpc("respond_co_author_invite", {
    p_content_type: contentType,
    p_invitation_id: invitationId,
    p_accept: accept,
  });

  const row = data as RespondRow | null;

  if (error || !row?.ok || !row.status || !row.contentId || !row.ownerId) {
    if (error) console.error("[co-authors] respond failed", error);
    return { ok: false, status: null, published: false };
  }

  const contentId = row.contentId;
  const ownerId = row.ownerId;
  const contentTitle = row.title ?? "";
  const contentSlug = row.slug ?? "";
  const published = row.published === true;
  const admin = createAdminClient();

  if (admin) {
    // Always tell the creator how the invitee responded.
    await createNotifications(admin, {
      recipientUserId: ownerId,
      actorUserId: userId,
      type: accept ? "co_author_accepted" : "co_author_declined",
      targetType: contentType,
      targetId: contentId,
      metadata: {
        coAuthorContentType: contentType,
        coAuthorContentSlug: contentSlug,
        coAuthorContentTitle: contentTitle,
      },
    });
  }

  if (published) {
    void dispatchPublishSideEffects({
      contentType,
      contentId,
      authorUserId: ownerId,
      title: contentTitle,
      articleSlug: contentType === "article" ? contentSlug : undefined,
      pollSlug: contentType === "poll" ? contentSlug : undefined,
    });
    if (admin) {
      await notifyCoAuthorsPublished({
        admin,
        contentType,
        contentId,
        contentTitle,
        contentSlug,
        ownerId,
      });
    }
  }

  return { ok: true, status: row.status, published };
}

async function notifyCoAuthorsPublished(params: {
  admin: SupabaseClient;
  contentType: CoAuthorContentType;
  contentId: string;
  contentTitle: string;
  contentSlug: string;
  ownerId: string;
}): Promise<void> {
  const { admin, contentType, contentId, contentTitle, contentSlug, ownerId } =
    params;
  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];

  const { data: accepted } = await admin
    .from(table)
    .select("user_id")
    .eq(contentColumn, contentId)
    .eq("status", "accepted");

  const recipients = Array.from(
    new Set(
      (accepted ?? [])
        .map((row) => (row as { user_id: string }).user_id)
        .filter((id): id is string => Boolean(id) && id !== ownerId),
    ),
  );
  if (recipients.length === 0) return;

  await createNotifications(
    admin,
    recipients.map((recipientUserId) => ({
      recipientUserId,
      actorUserId: ownerId,
      type: "co_author_published" as const,
      targetType: contentType,
      targetId: contentId,
      metadata: {
        coAuthorContentType: contentType,
        coAuthorContentSlug: contentSlug,
        coAuthorContentTitle: contentTitle,
      },
    })),
  );
}

/**
 * Loads accepted co-authors (excluding the owner) for a batch of content ids.
 * Returns a Map keyed by content id, each value ordered by `position`. Safe to
 * call with the public read-only client — RLS exposes accepted rows publicly.
 */
export async function loadAcceptedCoAuthorsMap(
  supabase: SupabaseClient,
  contentType: CoAuthorContentType,
  contentIds: string[],
): Promise<Map<string, ContentAuthor[]>> {
  const result = new Map<string, ContentAuthor[]>();
  const unique = Array.from(new Set(contentIds.filter(Boolean)));
  if (unique.length === 0) return result;

  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];

  const { data } = await supabase
    .from(table)
    .select(`${contentColumn}, user_id, position`)
    .in(contentColumn, unique)
    .eq("status", "accepted")
    .order("position", { ascending: true });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const profiles = await hydrateProfiles(
    supabase,
    rows.map((r) => r.user_id as string),
  );

  for (const row of rows) {
    const cid = row[contentColumn] as string;
    const userId = row.user_id as string;
    const profile = profiles.get(userId);
    const author: ContentAuthor = {
      userId,
      username: profile?.username ?? null,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      isOwner: false,
    };
    const list = result.get(cid);
    if (list) list.push(author);
    else result.set(cid, [author]);
  }

  return result;
}

/**
 * Content ids on which `userId` is an accepted co-author. Used by profile
 * listings to surface collaborative work alongside the user's own content.
 */
export async function loadCoAuthoredContentIds(
  supabase: SupabaseClient,
  contentType: CoAuthorContentType,
  userId: string,
): Promise<string[]> {
  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];

  const { data } = await supabase
    .from(table)
    .select(contentColumn)
    .eq("user_id", userId)
    .eq("status", "accepted");

  return Array.from(
    new Set(
      ((data ?? []) as unknown as Record<string, unknown>[])
        .map((row) => row[contentColumn] as string)
        .filter(Boolean),
    ),
  );
}

/**
 * Current co-authors of a piece of content (pending + accepted, declined
 * excluded) with profile info, ordered by position. Used to pre-fill the
 * co-author picker when editing.
 */
export async function loadCoAuthorsForEditor(
  supabase: SupabaseClient,
  contentType: CoAuthorContentType,
  contentId: string,
): Promise<EditorCoAuthor[]> {
  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];

  const { data } = await supabase
    .from(table)
    .select("user_id, position")
    .eq(contentColumn, contentId)
    .neq("status", "declined")
    .order("position", { ascending: true });

  const rows = (data ?? []) as unknown as { user_id: string }[];
  const profiles = await hydrateProfiles(
    supabase,
    rows.map((row) => row.user_id),
  );

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      userId: row.user_id,
      username: profile?.username ?? null,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

/**
 * Reconciles a content's co-authors to `desiredUserIds`: removes dropped ones
 * (any status) and invites newly added ones (pending + notify), in one
 * database call (`sync_co_authors`). Co-authors that stay are left untouched,
 * so re-saving never re-notifies or resets anyone. Returns how many were
 * invited; a failure is logged, never thrown (the work itself is saved).
 */
export async function syncCoAuthors(params: {
  supabase: SupabaseClient;
  contentType: CoAuthorContentType;
  contentId: string;
  contentTitle: string;
  contentSlug: string;
  creatorUserId: string;
  desiredUserIds: string[];
}): Promise<number> {
  const { supabase, contentType, contentId, creatorUserId, desiredUserIds } = params;

  const { data, error } = await supabase.rpc("sync_co_authors", {
    p_content_type: contentType,
    p_content_id: contentId,
    p_user_ids: sanitizeCoAuthorIds(desiredUserIds, creatorUserId),
  });

  if (error) {
    console.error("[co-authors] sync failed", error);
    return 0;
  }

  const invited = parseNewCoAuthorInvites(data);
  await notifyCoAuthorInvites({ ...params, invited });
  return invited.length;
}

/**
 * Pending invitations addressed to `userId`, across all content types, newest
 * first. Each entry carries the content title/slug and inviter profile so the
 * UI can render an actionable card without extra fetches.
 */
export async function listPendingInvitationsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoAuthorInvitation[]> {
  const types: CoAuthorContentType[] = ["project", "article", "poll"];
  const invitations: CoAuthorInvitation[] = [];
  const inviterIds: string[] = [];

  for (const contentType of types) {
    const table = CO_AUTHOR_TABLE[contentType];
    const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];
    const contentTable = CONTENT_TABLE[contentType];

    const { data } = await supabase
      .from(table)
      .select(
        `id, status, invited_by, invited_at, ${contentColumn}, ${contentTable}:${contentColumn} ( title, slug )`,
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("invited_at", { ascending: false });

    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const joined = row[contentTable] as
        | { title?: string; slug?: string }
        | { title?: string; slug?: string }[]
        | null;
      const content = Array.isArray(joined) ? joined[0] : joined;
      const invitedBy = (row.invited_by as string | null) ?? null;
      if (invitedBy) inviterIds.push(invitedBy);

      invitations.push({
        id: row.id as string,
        contentType,
        contentId: row[contentColumn] as string,
        contentTitle: content?.title ?? "",
        contentSlug: content?.slug ?? "",
        status: "pending",
        invitedAt: row.invited_at as string,
        inviter: {
          userId: invitedBy,
          username: null,
          name: null,
          avatarUrl: null,
        },
      });
    }
  }

  const profiles = await hydrateProfiles(supabase, inviterIds);
  for (const invite of invitations) {
    if (!invite.inviter.userId) continue;
    const profile = profiles.get(invite.inviter.userId);
    if (profile) {
      invite.inviter.username = profile.username;
      invite.inviter.name = profile.name;
      invite.inviter.avatarUrl = profile.avatar_url;
    }
  }

  invitations.sort((a, b) => (a.invitedAt < b.invitedAt ? 1 : -1));
  return invitations;
}
