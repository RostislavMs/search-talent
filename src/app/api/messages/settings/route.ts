import { NextResponse } from "next/server";
import { getMessagingSettings, saveMessagingSettings } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";
import { messagingSettingsSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** GET /api/messages/settings — who may write, the emails, read receipts. */
export async function GET() {
  const { supabase, user } = await signedIn();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ settings: await getMessagingSettings(supabase) });
}

/** PATCH /api/messages/settings — any of the three; the rest stays. */
export async function PATCH(request: Request) {
  const { supabase, user } = await signedIn();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, messagingSettingsSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const settings = await saveMessagingSettings(supabase, parsed.data);

  if (!settings) {
    return NextResponse.json({ error: "Could not save the settings", code: "failed" }, { status: 500 });
  }

  return NextResponse.json({ settings });
}
