import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { onboardingUsernameSchema } from "@/lib/validation/onboarding";

/**
 * GET /api/onboarding/username?value=… — live check while the person types a
 * nick. Nicks are public anyway (every profile lives at /u/<nick>), so the
 * answer reveals nothing new; the rate limit keeps it from being a cheap
 * scraping endpoint.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`onboarding-username:${user.id}`, 60, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = onboardingUsernameSchema.safeParse(
    new URL(request.url).searchParams.get("value") ?? "",
  );

  if (!parsed.success) {
    return NextResponse.json({ valid: false, available: false });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", parsed.data)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not check username" }, { status: 500 });
  }

  const owner = (data as { user_id: string } | null)?.user_id ?? null;

  return NextResponse.json({ valid: true, available: owner === null || owner === user.id });
}
