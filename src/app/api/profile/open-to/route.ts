import { NextResponse } from "next/server";
import { normalizeOpenTo } from "@/lib/open-to";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { openToUpdateSchema } from "@/lib/validation/profile";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * PATCH /api/profile/open-to — the «Відкрито до…» card in My Space and the
 * onboarding. `{ open_to: [...] }` sets the status (an empty list turns it
 * off); `{ confirm: true }` says it still holds. Either way the database stamps
 * open_to_updated_at with its own clock, so the date sent here is only a
 * signal to write.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each chip click saves, so a person clicking around stays well under this.
  const limited = rateLimit(`open-to:${user.id}`, 40, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, openToUpdateSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const update =
    "confirm" in parsed.data
      ? { open_to_updated_at: new Date().toISOString() }
      : { open_to: parsed.data.open_to };

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("user_id", user.id)
    .select("open_to, open_to_updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not save" }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const row = data as { open_to: unknown; open_to_updated_at: string | null };

  return NextResponse.json({
    openTo: normalizeOpenTo(row.open_to),
    updatedAt: row.open_to_updated_at,
  });
}
