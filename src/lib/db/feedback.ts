import { createClient } from "@/lib/supabase/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";

export type FeedbackCategory = "idea" | "bug" | "feedback" | "complaint";

export type FeedbackAttachment = {
  url: string;
  contentType: string;
  name: string;
};

export type FeedbackEntry = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  attachments: FeedbackAttachment[];
};

function normalizeAttachments(value: unknown): FeedbackAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      url: typeof item.url === "string" ? item.url : "",
      contentType: typeof item.contentType === "string" ? item.contentType : "",
      name: typeof item.name === "string" ? item.name : "",
    }))
    .filter((item) => item.url.length > 0);
}

function normalizeCategory(value: string | null): FeedbackCategory {
  switch (value) {
    case "idea":
    case "bug":
    case "complaint":
      return value;
    default:
      return "feedback";
  }
}

export async function getFeedbackEntries(limit = 50): Promise<FeedbackEntry[] | null> {
  const { user, isAdmin } = await getCurrentViewerRole();

  if (!user || !isAdmin) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("id, user_id, name, email, category, message, created_at, attachments")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  const rows = (data || []) as Array<{
    id: string;
    user_id: string | null;
    name: string | null;
    email: string | null;
    category: string | null;
    message: string;
    created_at: string;
    attachments: unknown;
  }>;

  const authorIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id)),
  );

  let profileMap = new Map<
    string,
    { username: string | null; name: string | null }
  >();

  if (authorIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, username, name")
      .in("user_id", authorIds);

    const profiles = (profilesData || []) as Array<{
      user_id: string;
      username: string | null;
      name: string | null;
    }>;

    profileMap = new Map(
      profiles.map((profile) => [
        profile.user_id,
        { username: profile.username, name: profile.name },
      ]),
    );
  }

  return rows.map((row) => {
    const author = row.user_id ? profileMap.get(row.user_id) : null;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      category: normalizeCategory(row.category),
      message: row.message,
      createdAt: row.created_at,
      authorUsername: author?.username || null,
      authorDisplayName: author?.name || null,
      attachments: normalizeAttachments(row.attachments),
    };
  });
}
