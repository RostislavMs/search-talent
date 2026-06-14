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

const OWNER_COLUMN: Record<CoAuthorContentType, string> = {
  project: "owner_id",
  article: "author_user_id",
  poll: "author_user_id",
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

/**
 * Invites co-authors to a freshly created piece of content. Inserts pending
 * junction rows (RLS lets the creator do this) and fires `co_author_invite`
 * notifications via the service-role client.
 *
 * Returns the number of valid invitations actually created. Invalid ids
 * (non-existent profiles, the creator, duplicates) are silently dropped — the
 * caller is expected to have sanitized with `sanitizeCoAuthorIds` first.
 *
 * Fire-and-forget for notifications: a notification failure is logged, never
 * thrown, so it cannot break content creation.
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
  const {
    supabase,
    contentType,
    contentId,
    contentTitle,
    contentSlug,
    creatorUserId,
    coAuthorUserIds,
  } = params;

  if (coAuthorUserIds.length === 0) return 0;

  // Keep only ids that resolve to a real profile (and never the creator).
  const profiles = await hydrateProfiles(supabase, coAuthorUserIds);
  const validIds = coAuthorUserIds.filter(
    (id) => id !== creatorUserId && profiles.has(id),
  );
  if (validIds.length === 0) return 0;

  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];

  const { data: inserted, error } = await supabase
    .from(table)
    .insert(
      validIds.map((userId, index) => ({
        [contentColumn]: contentId,
        user_id: userId,
        invited_by: creatorUserId,
        status: "pending",
        position: index,
      })),
    )
    .select("id, user_id");

  if (error || !inserted) {
    console.error("[co-authors] invite insert failed", error);
    return 0;
  }

  const admin = createAdminClient();
  if (admin) {
    await createNotifications(
      admin,
      (inserted as { id: string; user_id: string }[]).map((row) => ({
        recipientUserId: row.user_id,
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

  return inserted.length;
}

type RespondResult = {
  ok: boolean;
  /** New invitation status, or null when the invite was not actionable. */
  status: "accepted" | "declined" | null;
  /** True when this response was the one that published the held content. */
  published: boolean;
};

/**
 * Accept or decline a co-author invitation. Runs entirely through the
 * service-role client after verifying the invitation belongs to `userId` and is
 * still pending — this lets a non-owner flip the content to published (the
 * publish-on-confirm flow) without granting them write RLS on the content.
 */
export async function respondToCoAuthorInvitation(params: {
  contentType: CoAuthorContentType;
  invitationId: string;
  userId: string;
  accept: boolean;
}): Promise<RespondResult> {
  const { contentType, invitationId, userId, accept } = params;
  const admin = createAdminClient();
  if (!admin) return { ok: false, status: null, published: false };

  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];

  const { data: invite } = await admin
    .from(table)
    .select(`id, user_id, status, ${contentColumn}`)
    .eq("id", invitationId)
    .maybeSingle();

  // Dynamic `.select()` strings defeat the typed PostgREST parser, so we read
  // these rows through `unknown` and access columns by name.
  const inviteRow = invite as unknown as
    | { user_id?: string; status?: string; [key: string]: unknown }
    | null;

  // Only the invited user can respond, and only while pending.
  if (
    !inviteRow ||
    inviteRow.user_id !== userId ||
    inviteRow.status !== "pending"
  ) {
    return { ok: false, status: null, published: false };
  }

  const contentId = inviteRow[contentColumn] as string;
  const newStatus = accept ? "accepted" : "declined";

  const { error: updateError } = await admin
    .from(table)
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (updateError) {
    console.error("[co-authors] respond update failed", updateError);
    return { ok: false, status: null, published: false };
  }

  const contentTable = CONTENT_TABLE[contentType];
  const ownerColumn = OWNER_COLUMN[contentType];

  const { data: content } = await admin
    .from(contentTable)
    .select(
      `id, title, slug, status, publish_on_confirm, ${ownerColumn}`,
    )
    .eq("id", contentId)
    .maybeSingle();

  const contentRow = content as unknown as
    | {
        title?: string;
        slug?: string;
        status?: string;
        publish_on_confirm?: boolean;
        [key: string]: unknown;
      }
    | null;

  if (!contentRow) return { ok: true, status: newStatus, published: false };

  const ownerId = contentRow[ownerColumn] as string;
  const contentTitle = contentRow.title ?? "";
  const contentSlug = contentRow.slug ?? "";

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

  // Publish-on-confirm: once no invite is left pending — whether the last one
  // ACCEPTED or DECLINED — flip the held draft live with whoever accepted (the
  // creator alone if everyone declined). This keeps a decline from stranding
  // the draft forever; declined co-authors simply aren't attributed.
  let published = false;
  if (contentRow.publish_on_confirm && contentRow.status === "draft") {
    const { count: pendingCount } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(contentColumn, contentId)
      .eq("status", "pending");

    if ((pendingCount ?? 0) === 0) {
      const patch: Record<string, unknown> = {
        status: "published",
        publish_on_confirm: false,
      };
      if (contentType !== "project") {
        patch.published_at = new Date().toISOString();
      }

      const { error: publishError } = await admin
        .from(contentTable)
        .update(patch)
        .eq("id", contentId)
        .eq("status", "draft");

      if (!publishError) {
        published = true;
        void dispatchPublishSideEffects({
          contentType,
          contentId,
          authorUserId: ownerId,
          title: contentTitle,
          articleSlug: contentType === "article" ? contentSlug : undefined,
          pollSlug: contentType === "poll" ? contentSlug : undefined,
        });
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
  }

  return { ok: true, status: newStatus, published };
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
 * Reconciles a content's co-authors to `desiredUserIds` when editing: removes
 * dropped ones (any status) and invites newly added ones (pending + notify).
 * The owner must already own the content (RLS enforces insert/delete). Existing
 * accepted co-authors that remain are left untouched, so re-saving never
 * re-notifies or resets anyone.
 */
export async function syncCoAuthors(params: {
  supabase: SupabaseClient;
  contentType: CoAuthorContentType;
  contentId: string;
  contentTitle: string;
  contentSlug: string;
  creatorUserId: string;
  desiredUserIds: string[];
}): Promise<void> {
  const {
    supabase,
    contentType,
    contentId,
    contentTitle,
    contentSlug,
    creatorUserId,
    desiredUserIds,
  } = params;

  const table = CO_AUTHOR_TABLE[contentType];
  const contentColumn = CO_AUTHOR_CONTENT_COLUMN[contentType];
  const desired = sanitizeCoAuthorIds(desiredUserIds, creatorUserId);

  const { data } = await supabase
    .from(table)
    .select("id, user_id")
    .eq(contentColumn, contentId);

  const current = (data ?? []) as unknown as { id: string; user_id: string }[];
  const desiredSet = new Set(desired);
  const currentIds = new Set(current.map((row) => row.user_id));

  const removeIds = current
    .filter((row) => !desiredSet.has(row.user_id))
    .map((row) => row.id);
  if (removeIds.length > 0) {
    await supabase.from(table).delete().in("id", removeIds);
  }

  const addIds = desired.filter((id) => !currentIds.has(id));
  if (addIds.length > 0) {
    await inviteCoAuthors({
      supabase,
      contentType,
      contentId,
      contentTitle,
      contentSlug,
      creatorUserId,
      coAuthorUserIds: addIds,
    });
  }
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
