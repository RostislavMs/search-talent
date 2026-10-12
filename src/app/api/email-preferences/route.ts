import { after, NextResponse } from "next/server";
import { getNotificationPreferences, saveNotificationPreferences } from "@/lib/db/email-preferences";
import { cancelMessageEmails } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";
import { notificationPreferencesSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** GET /api/email-preferences — the message emails (at once, daily, none) and the follower emails. */
export async function GET() {
  const { supabase, user } = await signedIn();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ preferences: await getNotificationPreferences(supabase) });
}

/**
 * PATCH /api/email-preferences — either or both; the rest stays. Leaving "at
 * once" cancels the message emails still waiting.
 */
export async function PATCH(request: Request) {
  const { supabase, user } = await signedIn();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, notificationPreferencesSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const saved = await saveNotificationPreferences(supabase, parsed.data);

  if (!saved) {
    return NextResponse.json({ error: "Could not save the settings", code: "failed" }, { status: 500 });
  }

  if (saved.cancelEmailIds.length > 0) {
    after(() => cancelMessageEmails(saved.cancelEmailIds));
  }

  return NextResponse.json({ preferences: saved.preferences });
}
