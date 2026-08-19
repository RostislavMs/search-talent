import { NextResponse } from "next/server";
import {
  isProviderIntegrationId,
  type ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";
import {
  deleteProviderIntegration,
  getProviderIntegration,
  toProviderIntegrationSummary,
} from "@/lib/db/provider-integrations";
import { isProviderConfigured } from "@/lib/integrations/provider-registry";
import { createClient } from "@/lib/supabase/server";

/**
 * Generic per-provider integration status. GitHub keeps its own richer route
 * at /api/integrations/github — a static segment wins over this dynamic one.
 */
async function resolveProvider(
  params: Promise<{ provider: string }>,
): Promise<ProviderIntegrationId | null> {
  const { provider } = await params;
  return isProviderIntegrationId(provider) ? provider : null;
}

/**
 * GET /api/integrations/:provider
 * Returns the viewer's integration summary (never the token) plus whether the
 * deployment has OAuth credentials for this provider at all.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const provider = await resolveProvider(params);

  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const configured = isProviderConfigured(provider);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ integration: null, configured });
  }

  const row = await getProviderIntegration(supabase, user.id, provider);

  return NextResponse.json({
    integration: row ? toProviderIntegrationSummary(row) : null,
    configured,
  });
}

/**
 * DELETE /api/integrations/:provider — drops the stored token. Provider-side
 * revocation needs the OAuth app credentials; removing our row is what stops
 * further calls.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const provider = await resolveProvider(params);

  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await deleteProviderIntegration(supabase, user.id, provider);

  if (!ok) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
