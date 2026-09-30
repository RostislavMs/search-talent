import { NextResponse } from "next/server";
import { screenContentForModeration } from "@/lib/auto-moderation";
import {
  companyPayloadToRow,
  companyWriteErrorCode,
  holdCompanyForReview,
} from "@/lib/db/companies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { dbRateLimit } from "@/lib/rate-limit";
import { companyPayloadSchema } from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

const WRITE_ERROR_STATUS = {
  slug_taken: 409,
  limit: 409,
  membership_limit: 409,
  email_unconfirmed: 403,
  invalid: 400,
} as const;

/**
 * POST /api/companies — create a company page. The creator becomes its owner
 * (a database trigger adds the membership). The page starts unverified; text
 * that trips auto-moderation keeps it visible to the team only until an admin
 * looks at it.
 */
export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The insert policy checks this too; asking here gives a clear answer.
  if (!context.user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Confirm your email first", code: "email_unconfirmed" },
      { status: 403 },
    );
  }

  const limited = await dbRateLimit(`create-company:${context.user.id}`, 5, 60 * 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, companyPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const payload = parsed.data;

  // A logo needs the page's id for its storage key, so the form uploads it
  // right after the page exists (PUT /api/companies/:id/logo).
  const { data, error } = await context.supabase
    .from("companies")
    .insert({
      ...companyPayloadToRow(payload),
      created_by: context.user.id,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    const code = companyWriteErrorCode(error) ?? "invalid";
    return NextResponse.json(
      { error: error?.message || "Could not create the company", code },
      { status: WRITE_ERROR_STATUS[code] },
    );
  }

  const screen = screenContentForModeration([payload.name, payload.description, payload.city]);
  const heldForReview = screen.flagged
    ? await holdCompanyForReview(data.id as string, screen.note)
    : false;

  return NextResponse.json({ company: data, heldForReview }, { status: 201 });
}
