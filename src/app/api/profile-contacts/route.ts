import { NextResponse } from "next/server";
import { z } from "zod";
import { listContactCompanies, notifyCompanyContactOpened } from "@/lib/db/open-to";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";

const requestSchema = z
  .object({
    profileId: z.string().uuid(),
    /** Open them on behalf of this company (the visitor is in its team). */
    companyId: z.string().uuid().nullish(),
  })
  .strict();

type OpenContactsResult =
  | {
      status: "ok";
      email: string | null;
      phone: string | null;
      as_company?: boolean;
      company_first_open?: boolean;
      owner_user_id?: string;
    }
  | {
      status: "unauthorized" | "not_found" | "rate_limited" | "company_not_allowed" | "company_rate_limited";
    };

let warnedAboutRpc = false;

/**
 * POST /api/profile-contacts — the email and phone behind «Зв'язатися».
 *
 * Only for signed-in visitors: `open_profile_contacts()` checks the session,
 * records the opening (the owner sees how many people opened their contacts)
 * and caps how many new profiles one account can open (20 an hour, 60 a day),
 * so the addresses can't be harvested.
 *
 * A member of a verified company may open them on behalf of it (`companyId`):
 * the owner then sees which companies did, and hears about it the first time.
 * The company has its own cap (30 new profiles an hour, 100 a day). The answer
 * lists the companies the visitor may speak for, so the dialog can offer them.
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

  const companyId = parsed.data.companyId ?? null;
  const [{ data, error }, companies] = await Promise.all([
    supabase.rpc(
      "open_profile_contacts",
      companyId
        ? { p_profile_id: parsed.data.profileId, p_company_id: companyId }
        : { p_profile_id: parsed.data.profileId },
    ),
    listContactCompanies(supabase, user.id),
  ]);

  if (error || !data) {
    if (!warnedAboutRpc) {
      warnedAboutRpc = true;
      console.warn("[profile-contacts] not available:", error?.message);
    }

    return NextResponse.json({ error: "Unavailable", code: "unavailable" }, { status: 503 });
  }

  const result = data as OpenContactsResult;

  switch (result.status) {
    case "ok": {
      const asCompany = Boolean(companyId && result.as_company);

      if (asCompany && result.company_first_open && result.owner_user_id) {
        await notifyCompanyContactOpened({
          ownerUserId: result.owner_user_id,
          companyId: companyId!,
          actorUserId: user.id,
        });
      }

      return NextResponse.json({
        email: typeof result.email === "string" ? result.email : null,
        phone: typeof result.phone === "string" ? result.phone : null,
        asCompanyId: asCompany ? companyId : null,
        companies,
      });
    }
    case "rate_limited":
      return NextResponse.json(
        { error: "Too many contacts opened", code: "rate_limited" },
        { status: 429 },
      );
    case "company_rate_limited":
      return NextResponse.json(
        { error: "The company opened too many contacts", code: "company_rate_limited", companies },
        { status: 429 },
      );
    case "company_not_allowed":
      return NextResponse.json(
        { error: "Not allowed for this company", code: "company_not_allowed", companies },
        { status: 403 },
      );
    case "not_found":
      return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
    default:
      return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }
}
