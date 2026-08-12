import { notFound } from "next/navigation";
import FeedbackForm from "@/components/feedback-form";
import { normalizeViewerAvatarUrl } from "@/lib/app-shell";
import { ensureProfileForUser } from "@/lib/db/profile";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  // Signed-in visitors submit as themselves: the form drops the name/email
  // fields (the admin queue resolves the author from user_id) and only they get
  // the image uploader, since media uploads require authentication.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await ensureProfileForUser(supabase, user) : null;

  return (
    <FeedbackForm
      viewer={
        user
          ? {
              displayName: profile?.name || null,
              username: profile?.username || null,
              avatarUrl: normalizeViewerAvatarUrl(profile?.avatar_url),
              email: user.email || null,
            }
          : null
      }
    />
  );
}
