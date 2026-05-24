import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { rateLimit } from "@/lib/rate-limit";

const fullNameSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, "Invalid repository identifier");

/**
 * GET /api/integrations/github/repo?fullName=owner/repo
 * Returns repository metadata + languages + README for the import
 * preview in the create-project form.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`gh-repo:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = fullNameSchema.safeParse(url.searchParams.get("fullName"));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const integration = await getIntegrationForUser(supabase, user.id);
  if (!integration) {
    return NextResponse.json(
      { error: "GitHub is not connected" },
      { status: 409 },
    );
  }

  const detail = await fetchRepoFullDetail(integration.access_token, parsed.data);
  if (!detail) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  return NextResponse.json({ repo: detail });
}
