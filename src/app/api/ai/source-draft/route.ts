import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseJsonRequest } from "@/lib/validation/request";
import { sourceDraftPayloadSchema } from "@/lib/validation/ai";
import {
  getProviderIntegration,
  getUsableAccessToken,
} from "@/lib/db/provider-integrations";
import { getProviderAdapter } from "@/lib/integrations/provider-registry";
import { generateSourceDraft } from "@/lib/ai/source-draft";
import { logAiUsage } from "@/lib/ai/usage";
import {
  isGeminiConfigured,
  GeminiNotConfiguredError,
} from "@/lib/ai/gemini-client";
import { AI_PER_USER_LIMIT, AI_PER_USER_WINDOW_MS } from "@/lib/constants/ai";

/**
 * POST /api/ai/source-draft
 * Body: { provider, ref, locale?, existing? }
 *
 * Drafts the project narrative from a resource imported through a provider
 * integration (GitLab, Figma, Vimeo, Sketchfab, Notion). Every returned field
 * is a suggestion — the form only applies it where the author left a blank.
 */
export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "AI features are not configured on this server." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(
    `ai-source-draft:${user.id}`,
    AI_PER_USER_LIMIT,
    AI_PER_USER_WINDOW_MS,
  );
  if (limited) {
    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: "n/a",
      feature: "source_draft",
      status: "rate_limited",
    });
    return limited;
  }

  const parsed = await parseJsonRequest(request, sourceDraftPayloadSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { provider, ref, locale, existing } = parsed.data;
  const adapter = getProviderAdapter(provider);

  if (!adapter.refPattern.test(ref)) {
    return NextResponse.json({ error: "Invalid resource ref" }, { status: 400 });
  }

  const accessToken = await getUsableAccessToken(supabase, user.id, provider);
  if (!accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  const resource = await adapter.fetchResource(accessToken, ref);
  if (!resource) {
    return NextResponse.json(
      { error: "Resource not found or unreachable." },
      { status: 404 },
    );
  }

  const integration = await getProviderIntegration(supabase, user.id, provider);
  const metadata = { provider, ref };

  try {
    const result = await generateSourceDraft({
      provider,
      resource,
      authorLogin: integration?.external_login ?? null,
      locale,
      existing,
    });

    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: result.model,
      feature: "source_draft",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: result.durationMs,
      status: "ok",
      metadata,
    });

    return NextResponse.json({ draft: result.data });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI features are not configured." },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[ai/source-draft] generation failed", error);

    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: "unknown",
      feature: "source_draft",
      status: "error",
      errorMessage: message.slice(0, 500),
      metadata,
    });

    // Development surfaces the cause to make debugging fast; production keeps
    // the message generic.
    const exposeDetails = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: "AI generation failed. Please try again.",
        ...(exposeDetails ? { details: message } : {}),
      },
      { status: 502 },
    );
  }
}
