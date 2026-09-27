import { NextResponse } from "next/server";
import { markOnboarding } from "@/lib/db/onboarding";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  onboardingMarkSchema,
  onboardingProfileSchema,
} from "@/lib/validation/onboarding";
import { parseJsonRequest } from "@/lib/validation/request";

function isDuplicateUsernameError(message: string | undefined) {
  return Boolean(
    message &&
      (message.includes("profiles_username_key") || message.includes("duplicate key value")),
  );
}

/**
 * PATCH /api/onboarding — saves the "who you are" step: name, nick, direction
 * and skills. Unlike `PUT /api/profile` it touches only these fields, so the
 * rest of an existing profile stays as it is.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`onboarding-profile:${user.id}`, 20, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, onboardingProfileSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      name: payload.name,
      username: payload.username,
      category_id: payload.category_id,
    })
    .eq("user_id", user.id);

  if (updateError) {
    const taken = isDuplicateUsernameError(updateError.message);

    return NextResponse.json(
      {
        error: taken ? "This username is already taken." : "Could not save profile",
        code: taken ? "username_taken" : "save_failed",
      },
      { status: taken ? 409 : 400 },
    );
  }

  const { error: deleteError } = await supabase
    .from("profile_skills")
    .delete()
    .eq("profile_id", profile.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Could not update skills", code: "save_failed" },
      { status: 400 },
    );
  }

  if (payload.skill_ids.length > 0) {
    const { error: insertError } = await supabase.from("profile_skills").insert(
      payload.skill_ids.map((skillId) => ({ profile_id: profile.id, skill_id: skillId })),
    );

    if (insertError) {
      return NextResponse.json(
        { error: "Could not update skills", code: "save_failed" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ success: true, username: payload.username });
}

/**
 * POST /api/onboarding — records a milestone: the onboarding was finished or
 * skipped (`completed`), or the portfolio link was copied or shared
 * (`link_shared`). Before the onboarding migration is applied the write fails
 * quietly; the page carries on either way.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`onboarding-mark:${user.id}`, 30, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, onboardingMarkSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const saved = await markOnboarding(supabase, user.id, parsed.data.action);

  return NextResponse.json({ success: true, saved });
}
