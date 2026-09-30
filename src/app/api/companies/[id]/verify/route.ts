import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkCompanyEmailDomain,
  COMPANY_VERIFICATION,
  emailDomainCoversHost,
  getCompanyWebsiteHost,
} from "@/lib/companies";
import {
  companyVerificationCodeMatches,
  markCompanyVerifiedByEmail,
  notifyCompanyVerified,
} from "@/lib/db/companies";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVerifyContext } from "./shared";

const bodySchema = z
  .object({ code: z.string().trim().regex(/^\d{6}$/, "Invalid code").optional() })
  .default({});

type CodeRow = {
  email_domain: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
};

/**
 * POST /api/companies/:id/verify — give the page its check mark.
 *
 * Without a body: the signed-in person's own account email must be on the
 * website's domain (one click). With `{ code }`: the code sent to a work
 * address by /verify/code. Either way the mark is written with the service
 * key, because members cannot set it themselves (guard_company_columns).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveVerifyContext(params, { key: "company-verify", max: 20 });
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, company } = resolved;

  if (company.verified) {
    return NextResponse.json({ verified: true });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code", code: "wrong_code" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Verification is unavailable" }, { status: 503 });
  }

  const website = company.website ?? "";

  if (!parsed.data.code) {
    const check = checkCompanyEmailDomain({
      type: company.type,
      website: company.website,
      email: user.email,
      emailConfirmed: Boolean(user.email_confirmed_at),
    });

    if (!check.ok) {
      return NextResponse.json(
        { error: "The email does not match the website", code: check.reason },
        { status: 400 },
      );
    }
  } else {
    const { data } = await admin
      .from("company_verification_codes")
      .select("email_domain, code_hash, attempts, expires_at")
      .eq("company_id", company.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const row = data as CodeRow | null;
    const drop = () =>
      admin
        .from("company_verification_codes")
        .delete()
        .eq("company_id", company.id)
        .eq("user_id", user.id);

    if (!row) {
      return NextResponse.json({ error: "No code was sent", code: "code_missing" }, { status: 400 });
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await drop();
      return NextResponse.json({ error: "The code expired", code: "code_expired" }, { status: 400 });
    }

    if (row.attempts >= COMPANY_VERIFICATION.maxAttempts) {
      await drop();
      return NextResponse.json({ error: "Too many attempts", code: "too_many_attempts" }, { status: 400 });
    }

    if (!companyVerificationCodeMatches(parsed.data.code, company.id, user.id, row.code_hash)) {
      await admin
        .from("company_verification_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("company_id", company.id)
        .eq("user_id", user.id);
      return NextResponse.json({ error: "Wrong code", code: "wrong_code" }, { status: 400 });
    }

    // The code was sent for this domain; the site may have changed since.
    if (company.type === "school" || !emailDomainCoversHost(row.email_domain, getCompanyWebsiteHost(website))) {
      await drop();
      return NextResponse.json({ error: "The page changed", code: "mismatch" }, { status: 409 });
    }

    await drop();
  }

  const written = await markCompanyVerifiedByEmail(admin, {
    companyId: company.id,
    website,
    userId: user.id,
  });

  if (!written) {
    return NextResponse.json({ error: "The page changed, try again" }, { status: 409 });
  }

  await notifyCompanyVerified({ companyId: company.id, excludeUserId: user.id });

  return NextResponse.json({ verified: true });
}
