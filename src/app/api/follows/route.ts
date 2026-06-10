import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/validation/request";
import { sendEmail } from "@/lib/email/resend";
import { buildNewFollowerEmail } from "@/lib/email/templates";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo";
import { createNotifications } from "@/lib/db/notifications";

const followPayloadSchema = z.object({
  followingUserId: z.string().uuid(),
});

/**
 * POST /api/follows — toggle follow (add if not following, remove if following).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`follow:${user.id}`, 30, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, followPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { followingUserId } = parsed.data;

  if (followingUserId === user.id) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_user_id", user.id)
    .eq("following_user_id", followingUserId)
    .maybeSingle();

  if (existing) {
    await supabase.from("follows").delete().eq("id", existing.id);
    return NextResponse.json({ following: false });
  }

  const { error } = await supabase.from("follows").insert({
    follower_user_id: user.id,
    following_user_id: followingUserId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fire-and-forget: notify the followed user by email. Never block the
  // response or surface errors to the follower.
  void notifyNewFollower({
    followerUserId: user.id,
    followingUserId,
  }).catch((err) => {
    console.error("[follows] notify failed", err);
  });

  // In-app notification (separate from the email channel).
  void (async () => {
    const admin = createAdminClient();
    if (!admin) return;
    await createNotifications(admin, {
      recipientUserId: followingUserId,
      actorUserId: user.id,
      type: "new_follower",
      targetType: "profile",
      targetId: null,
    });
  })().catch((err) => {
    console.error("[follows] in-app notify failed", err);
  });

  return NextResponse.json({ following: true });
}

async function notifyNewFollower({
  followerUserId,
  followingUserId,
}: {
  followerUserId: string;
  followingUserId: string;
}) {
  // Paused: follower emails need an email-preference toggle + unsubscribe link
  // before they can be sent at scale. The in-app notification is created
  // separately and is unaffected. Flip FOLLOWER_EMAILS_ENABLED=true to re-enable.
  if (process.env.FOLLOWER_EMAILS_ENABLED !== "true") {
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    // No service role configured — skip notifications silently.
    return;
  }

  const [{ data: followerProfile }, { data: followingProfile }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("name, username, headline")
        .eq("user_id", followerUserId)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("name, username")
        .eq("user_id", followingUserId)
        .maybeSingle(),
    ]);

  const { data: followingAuth } =
    await admin.auth.admin.getUserById(followingUserId);

  const recipientEmail = followingAuth?.user?.email;
  if (!recipientEmail) {
    return;
  }

  const rawLocale =
    (followingAuth?.user?.user_metadata?.locale as string | undefined) ||
    defaultLocale;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const followerName =
    followerProfile?.name?.trim() ||
    followerProfile?.username ||
    "Someone";
  const recipientName =
    followingProfile?.name?.trim() || followingProfile?.username || "";

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const profilePath = followerProfile?.username
    ? `/${locale}/u/${followerProfile.username}`
    : `/${locale}/talents`;
  const profileUrl = `${siteUrl}${profilePath}`;

  const { subject, html, text } = buildNewFollowerEmail({
    recipientName,
    followerName,
    followerUsername: followerProfile?.username ?? null,
    followerHeadline: followerProfile?.headline ?? null,
    profileUrl,
    locale,
  });

  await sendEmail({ to: recipientEmail, subject, html, text });
}
