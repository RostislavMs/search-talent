import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkCompanyEmailDomain,
  COMPANY_VERIFICATION,
  getCompanyWebsiteHost,
} from "@/lib/companies";
import {
  generateCompanyVerificationCode,
  hashCompanyVerificationCode,
} from "@/lib/db/companies";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { buildCompanyVerificationEmail } from "@/lib/email/templates";
import { getRequestLocale } from "@/lib/i18n/server";
import { dbRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveVerifyContext } from "../shared";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email").max(320),
});

/**
 * POST /api/companies/:id/verify/code — send a one-time code to a work address
 * on the website's domain. The address only has to be on the domain; it does
 * not have to be the one the person signs in with. It is not stored: the
 * table keeps the domain, a hash of the code and an attempt counter.
 *
 * Sending is capped per person and per page, so a page cannot be used to
 * flood a company's inboxes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveVerifyContext(params, { key: "company-verify-code", max: 5 });
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, company } = resolved;

  if (company.verified) {
    return NextResponse.json({ verified: true });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email", code: "invalid_email" }, { status: 400 });
  }

  const check = checkCompanyEmailDomain({
    type: company.type,
    website: company.website,
    email: parsed.data.email,
    // The code itself proves the address; nothing to confirm beforehand.
    emailConfirmed: true,
  });

  if (!check.ok) {
    return NextResponse.json(
      { error: "The address does not match the website", code: check.reason },
      { status: 400 },
    );
  }

  const perCompany = await dbRateLimit(`company-verify-code-page:${company.id}`, 10, 24 * 60 * 60_000);
  if (perCompany) {
    return perCompany;
  }

  const admin = createAdminClient();
  if (!admin || !isEmailConfigured()) {
    return NextResponse.json({ error: "Email is unavailable", code: "email_unavailable" }, { status: 503 });
  }

  // Expired codes are useless; clear them on the way so none lingers.
  await admin
    .from("company_verification_codes")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const code = generateCompanyVerificationCode();
  const { error } = await admin.from("company_verification_codes").upsert(
    {
      company_id: company.id,
      user_id: user.id,
      email_domain: check.domain,
      code_hash: hashCompanyVerificationCode(code, company.id, user.id),
      attempts: 0,
      expires_at: new Date(Date.now() + COMPANY_VERIFICATION.ttlMinutes * 60_000).toISOString(),
      created_at: new Date().toISOString(),
    },
    { onConflict: "company_id,user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const message = buildCompanyVerificationEmail({
    companyName: company.name,
    host: getCompanyWebsiteHost(company.website) ?? check.domain,
    code,
    locale: await getRequestLocale(),
  });
  const sent = await sendEmail({ to: parsed.data.email, ...message });

  if (!sent.sent) {
    await admin
      .from("company_verification_codes")
      .delete()
      .eq("company_id", company.id)
      .eq("user_id", user.id);
    return NextResponse.json({ error: "Could not send the email", code: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true, domain: check.domain });
}
