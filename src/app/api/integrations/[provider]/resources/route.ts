import { NextResponse } from "next/server";
import { z } from "zod";
import { isProviderIntegrationId } from "@/lib/constants/provider-integrations";
import { getUsableAccessToken } from "@/lib/db/provider-integrations";
import { getProviderAdapter } from "@/lib/integrations/provider-registry";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.string().trim().min(1).max(500);

/**
 * GET /api/integrations/:provider/resources[?q=<link>]
 *
 * Lists what the viewer can import. Providers with an account-wide listing
 * (GitLab) ignore `q`; providers without one (Figma) resolve the pasted link.
 * The token stays server-side — only metadata is returned.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isProviderIntegrationId(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`pi-resources:${provider}:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const accessToken = await getUsableAccessToken(supabase, user.id, provider);

  if (!accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  const adapter = getProviderAdapter(provider);
  const rawQuery = new URL(request.url).searchParams.get("q");

  if (rawQuery !== null && adapter.searchResources) {
    const parsed = querySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }
    return NextResponse.json({
      resources: await adapter.searchResources(accessToken, parsed.data),
    });
  }

  return NextResponse.json({
    resources: await adapter.listResources(accessToken),
  });
}
