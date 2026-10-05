import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/lib/db/trash";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/u, "Invalid code format"),
  mode: z.enum(["erase", "anonymize"]).default("erase"),
});

const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * POST /api/profile/delete/confirm
 *
 * Validates the 6-digit nonce received via Supabase reauthentication and, on
 * success, deletes the account the trash way: the database moves the profile
 * and everything the person owns into one trash group at once (gone from the
 * site), sign-in is blocked, and the daily cron deletes the auth user when
 * the 60 days are over. Until then an admin can restore it on request.
 *
 * The nonce is validated as a side-effect of `updateUser({ password, nonce })`.
 * We rotate to a throwaway random password — after a restore the person sets
 * a new one through "Forgot password".
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`account-delete-verify:${user.id}`, 5, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid code" },
      { status: 400 },
    );
  }

  const requestedAtRaw = (user.user_metadata as Record<string, unknown> | null)
    ?.delete_otp_requested_at;
  const requestedAt =
    typeof requestedAtRaw === "string" ? Date.parse(requestedAtRaw) : NaN;

  if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > OTP_TTL_MS) {
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }

  const throwawayPassword = `${crypto.randomUUID()}!Aa1`;

  const { error: verifyError } = await supabase.auth.updateUser({
    password: throwawayPassword,
    nonce: parsed.data.code,
  });

  if (verifyError) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 500 },
    );
  }

  // One SQL function does the whole removal (and the erase/anonymize choice)
  // in a single transaction.
  const result = await deleteAccount(adminClient, user.id, parsed.data.mode);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code === "already_deleted" ? "already_deleted" : "Could not delete the account" },
      { status: result.code === "already_deleted" ? 409 : 400 },
    );
  }

  // End every session, not only this browser's.
  await supabase.auth.signOut({ scope: "global" });

  return NextResponse.json({ success: true });
}
