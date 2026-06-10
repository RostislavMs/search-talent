import { NextResponse } from "next/server";
import { awardSqlBadgesForUser } from "@/lib/db/badges";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/email-verification
 *
 * Checks whether the current user's Supabase Auth email is confirmed.
 * If confirmed, marks the profile as `email_verified = true`.
 *
 * Supabase Auth already handles the email confirmation flow (magic link
 * or OTP sent on signup). This endpoint simply syncs that status to the
 * `profiles` table so it can be displayed as a badge.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`email-verify:${user.id}`, 5, 60_000);

  if (limited) {
    return limited;
  }

  // Supabase Auth sets email_confirmed_at when the user verifies via link/OTP.
  const isConfirmed = Boolean(user.email_confirmed_at);

  if (!isConfirmed) {
    return NextResponse.json(
      { verified: false, message: "Email not yet confirmed in auth provider." },
      { status: 200 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      email_verified: true,
      email_verified_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Re-evaluate badges so the `verified_email` badge is awarded immediately
  // rather than waiting for an unrelated trigger (project/comment/etc.). Errors
  // are swallowed inside the helper — they must not fail the verification.
  await awardSqlBadgesForUser(supabase, user.id);

  return NextResponse.json({ verified: true });
}
