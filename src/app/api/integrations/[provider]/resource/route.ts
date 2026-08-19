import { NextResponse } from "next/server";
import { isProviderIntegrationId } from "@/lib/constants/provider-integrations";
import { getUsableAccessToken } from "@/lib/db/provider-integrations";
import { getProviderAdapter } from "@/lib/integrations/provider-registry";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/integrations/:provider/resource?ref=<handle>
 *
 * Full detail for one resource: the import preview in the project wizard and
 * the sync job both read through this shape. `ref` is validated against the
 * adapter's pattern before it is ever interpolated into a provider URL.
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

  const limited = rateLimit(`pi-resource:${provider}:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const adapter = getProviderAdapter(provider);
  const ref = new URL(request.url).searchParams.get("ref")?.trim() || "";

  if (!ref || ref.length > 200 || !adapter.refPattern.test(ref)) {
    return NextResponse.json({ error: "Invalid resource ref" }, { status: 400 });
  }

  const accessToken = await getUsableAccessToken(supabase, user.id, provider);

  if (!accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  const resource = await adapter.fetchResource(accessToken, ref);

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ resource });
}
