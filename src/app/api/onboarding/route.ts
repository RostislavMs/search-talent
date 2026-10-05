import { NextResponse } from "next/server";
import { markOnboarding } from "@/lib/db/onboarding";
import { isUsernameTakenError } from "@/lib/db/save-profile";
import { normalizeProfileSettings } from "@/lib/profile-presentation";
import {
  applyProfileTemplate,
  getProfileTemplate,
  templateBringsThemeByDefault,
} from "@/lib/profile-templates";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  onboardingMarkSchema,
  onboardingProfileSchema,
} from "@/lib/validation/onboarding";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * PATCH /api/onboarding — saves the "who you are" step: name, nick, direction,
 * skills and, when one was picked, a layout template. Unlike `PUT /api/profile`
 * it touches only these fields, so the rest of an existing profile stays as it
 * is; a template changes the look only (blocks, cards, theme), never content.
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
    .select("id, profile_visibility")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    name: payload.name,
    username: payload.username,
    category_id: payload.category_id,
  };

  if (payload.template) {
    const settings = normalizeProfileSettings(profile.profile_visibility);
    update.profile_visibility = {
      ...settings,
      presentation: applyProfileTemplate(
        settings.presentation,
        getProfileTemplate(payload.template),
        { withTheme: templateBringsThemeByDefault(settings.presentation) },
      ),
    };
  }

  // The row and the skills in one transaction: a taken nick no longer leaves
  // the skills half replaced.
  const { error: saveError } = await supabase.rpc("save_my_profile", {
    p: { profile: update, skills: payload.skill_ids },
  });

  if (saveError) {
    const taken = isUsernameTakenError(saveError);

    return NextResponse.json(
      {
        error: taken ? "This username is already taken." : "Could not save profile",
        code: taken ? "username_taken" : "save_failed",
      },
      { status: taken ? 409 : 400 },
    );
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
