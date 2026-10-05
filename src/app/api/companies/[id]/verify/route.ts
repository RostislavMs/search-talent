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

/** `claim_company_verification_attempt`: the attempt is already counted. */
type ClaimResult = {
  status: "ok" | "missing" | "expired" | "too_many";
  codeHash?: string;
  emailDomain?: string;
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
    // The attempt is counted under a row lock before the code is compared, so
    // parallel guesses can't all slip past the limit; an expired code or one
    // out of attempts is removed there too.
    const { data, error } = await admin.rpc("claim_company_verification_attempt", {
      p_company_id: company.id,
      p_user_id: user.id,
      p_max_attempts: COMPANY_VERIFICATION.maxAttempts,
    });

    const claim = data as ClaimResult | null;
    const drop = () =>
      admin
        .from("company_verification_codes")
        .delete()
        .eq("company_id", company.id)
        .eq("user_id", user.id);

    if (error || !claim || claim.status === "missing") {
      return NextResponse.json({ error: "No code was sent", code: "code_missing" }, { status: 400 });
    }

    if (claim.status === "expired") {
      return NextResponse.json({ error: "The code expired", code: "code_expired" }, { status: 400 });
    }

    if (claim.status === "too_many" || !claim.codeHash || !claim.emailDomain) {
      return NextResponse.json({ error: "Too many attempts", code: "too_many_attempts" }, { status: 400 });
    }

    const row = { email_domain: claim.emailDomain };

    if (!companyVerificationCodeMatches(parsed.data.code, company.id, user.id, claim.codeHash)) {
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
