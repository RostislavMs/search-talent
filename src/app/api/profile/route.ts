import { NextResponse } from "next/server";
import { buildSaveMyProfilePayload, isUsernameTakenError } from "@/lib/db/save-profile";
import { createClient } from "@/lib/supabase/server";
import { profilePayloadSchema } from "@/lib/validation/profile";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * PUT /api/profile — the whole editor in one database call
 * (`save_my_profile`): the profile row, the owner-only contacts and pay, and
 * every section. It either all saves or nothing does — one bad date no longer
 * leaves a profile with its skills or experience wiped.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, profilePayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error } = await supabase.rpc("save_my_profile", {
    p: buildSaveMyProfilePayload(parsed.data),
  });

  if (error) {
    if (isUsernameTakenError(error)) {
      return NextResponse.json({ error: "This username is already taken." }, { status: 409 });
    }

    if (error.code === "P0002") {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || "Could not save profile" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
