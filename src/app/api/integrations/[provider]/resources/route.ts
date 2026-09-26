import { NextResponse } from "next/server";
import { isProviderIntegrationId } from "@/lib/constants/provider-integrations";
import { getUsableAccessToken } from "@/lib/db/provider-integrations";
import { getProviderAdapter } from "@/lib/integrations/provider-registry";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/integrations/:provider/resources
 *
 * Lists what the viewer can import from the connected account. The token stays
 * server-side — only metadata is returned.
 */
export async function GET(
  _request: Request,
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

  return NextResponse.json({
    resources: await getProviderAdapter(provider).listResources(accessToken),
  });
}
