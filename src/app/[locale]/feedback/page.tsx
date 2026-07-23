import { notFound } from "next/navigation";
import FeedbackForm from "@/components/feedback-form";
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

  // Media uploads require authentication, so the form only offers the image
  // uploader to signed-in visitors.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <FeedbackForm isSignedIn={Boolean(user)} />;
}
