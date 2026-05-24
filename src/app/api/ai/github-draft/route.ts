import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseJsonRequest } from "@/lib/validation/request";
import { githubDraftPayloadSchema } from "@/lib/validation/ai";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { generateGithubDraft } from "@/lib/ai/github-draft";
import { logAiUsage } from "@/lib/ai/usage";
import {
  isGeminiConfigured,
  GeminiNotConfiguredError,
} from "@/lib/ai/gemini-client";
import {
  AI_PER_USER_LIMIT,
  AI_PER_USER_WINDOW_MS,
} from "@/lib/constants/ai";

/**
 * POST /api/ai/github-draft
 * Body: { fullName: "owner/repo", locale?: "uk"|"en", existing?: {...} }
 *
 * Returns AI-generated drafts for the GitHub narrative fields on the
 * project form. The user keeps full control — every returned field is
 * a suggestion they can edit, accept, or reject.
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
    `ai-github-draft:${user.id}`,
    AI_PER_USER_LIMIT,
    AI_PER_USER_WINDOW_MS,
  );
  if (limited) {
    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: "n/a",
      feature: "github_draft",
      status: "rate_limited",
    });
    return limited;
  }

  const parsed = await parseJsonRequest(request, githubDraftPayloadSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const integration = await getIntegrationForUser(supabase, user.id);
  if (!integration) {
    return NextResponse.json(
      { error: "GitHub is not connected." },
      { status: 409 },
    );
  }

  const repo = await fetchRepoFullDetail(
    integration.access_token,
    parsed.data.fullName,
  );
  if (!repo) {
    return NextResponse.json(
      { error: "Repository not found or unreachable." },
      { status: 404 },
    );
  }

  try {
    const result = await generateGithubDraft({
      repo,
      authorLogin: integration.github_login,
      locale: parsed.data.locale,
      existing: parsed.data.existing,
    });

    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: result.model,
      feature: "github_draft",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: result.durationMs,
      status: "ok",
      metadata: { fullName: parsed.data.fullName },
    });

    return NextResponse.json({ draft: result.data });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI features are not configured." },
        { status: 503 },
      );
    }

    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[ai/github-draft] generation failed", error);

    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: "unknown",
      feature: "github_draft",
      status: "error",
      errorMessage: message.slice(0, 500),
      metadata: { fullName: parsed.data.fullName },
    });

    // In development surface the underlying error to the client to
    // make debugging fast; in production keep the message generic.
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
