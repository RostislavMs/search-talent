import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";

const requestSchema = z.object({ profileId: z.string().uuid() }).strict();

type OpenContactsResult =
  | { status: "ok"; email: string | null; phone: string | null }
  | { status: "unauthorized" | "not_found" | "rate_limited" };

let warnedAboutRpc = false;

/**
 * POST /api/profile-contacts — the email and phone behind «Зв'язатися».
 *
 * Only for signed-in visitors: `open_profile_contacts()` checks the session,
 * records the opening (the owner sees how many people opened their contacts)
 * and caps how many new profiles one account can open (20 an hour, 60 a day),
 * so the addresses can't be harvested. See database/2026-09-28-open-to.sql.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  // The database cap counts new profiles; this one only stops a script from
  // hammering the endpoint with the same one.
  const limited = rateLimit(`profile-contacts:${user.id}`, 30, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, requestSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("open_profile_contacts", {
    p_profile_id: parsed.data.profileId,
  });

  if (error || !data) {
    if (!warnedAboutRpc) {
      warnedAboutRpc = true;
      console.warn("[profile-contacts] not available:", error?.message);
    }

    return NextResponse.json({ error: "Unavailable", code: "unavailable" }, { status: 503 });
  }

  const result = data as OpenContactsResult;

  switch (result.status) {
    case "ok":
      return NextResponse.json({
        email: typeof result.email === "string" ? result.email : null,
        phone: typeof result.phone === "string" ? result.phone : null,
      });
    case "rate_limited":
      return NextResponse.json(
        { error: "Too many contacts opened", code: "rate_limited" },
        { status: 429 },
      );
    case "not_found":
      return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
    default:
      return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }
}
