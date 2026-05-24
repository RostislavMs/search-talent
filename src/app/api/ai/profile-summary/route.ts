import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseJsonRequest } from "@/lib/validation/request";
import { isLocale } from "@/lib/i18n/config";
import { isPublicModerationStatus } from "@/lib/moderation";
import { generateProfileSummary } from "@/lib/ai/profile-summary";
import { logAiUsage } from "@/lib/ai/usage";
import {
  GeminiNotConfiguredError,
  isGeminiConfigured,
} from "@/lib/ai/gemini-client";
import {
  AI_PER_USER_LIMIT,
  AI_PER_USER_WINDOW_MS,
} from "@/lib/constants/ai";

/**
 * Per-target rate limit: even though the result is not persisted, we
 * still cap how often a single profile can be re-summarised to protect
 * the AI budget when a profile is shared widely.
 */
const PER_TARGET_LIMIT = 4;
const PER_TARGET_WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  locale: z
    .string()
    .optional()
    .transform((value) => (value && isLocale(value) ? value : "en")),
  /** Public username of the profile to summarise (required). */
  username: z.string().trim().min(1).max(64),
});

/**
 * POST /api/ai/profile-summary
 *
 * Generates a 2-sentence AI summary about the profile specified by
 * `username` and returns it in the response. The result is NEVER
 * persisted — it lives only in the caller's component state for the
 * current session.
 *
 * Any authenticated viewer can call this. The summary is a public
 * artefact of the target profile, not personal data of the viewer.
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

  const limitedViewer = rateLimit(
    `ai-profile-summary:${user.id}`,
    AI_PER_USER_LIMIT,
    AI_PER_USER_WINDOW_MS,
  );
  if (limitedViewer) {
    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: "n/a",
      feature: "profile_summary",
      status: "rate_limited",
    });
    return limitedViewer;
  }

  const parsed = await parseJsonRequest(request, bodySchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, user_id, username, name, headline, bio, additional_info, experience_level, experience_years, moderation_status",
    )
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Hide moderated-away profiles from non-owners.
  const isOwner = profile.user_id === user.id;
  if (!isOwner && !isPublicModerationStatus(profile.moderation_status)) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Per-target rate limit — protects AI quota when a profile is
  // visited heavily. Owners are exempt so they can always refresh
  // their own summary.
  if (!isOwner) {
    const limitedTarget = rateLimit(
      `ai-profile-summary-target:${profile.id}`,
      PER_TARGET_LIMIT,
      PER_TARGET_WINDOW_MS,
    );
    if (limitedTarget) {
      void logAiUsage(supabase, {
        userId: user.id,
        provider: "gemini",
        model: "n/a",
        feature: "profile_summary",
        status: "rate_limited",
        metadata: { targetUsername: profile.username },
      });
      return limitedTarget;
    }
  }

  // Profile skills ----------------------------------------------------
  const { data: skillRows } = await supabase
    .from("profile_skills")
    .select("skill_id, skills (name)")
    .eq("profile_id", profile.id);
  const skills = (
    (skillRows || []) as Array<{ skills?: { name?: string } | null }>
  )
    .map((row) => row.skills?.name)
    .filter((name): name is string => Boolean(name));

  // Recent published projects -----------------------------------------
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, title, description, tech_stack, created_at")
    .eq("owner_id", profile.user_id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);

  const projects = (projectRows || []).map((row) => ({
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    techStack: ((row.tech_stack as string[] | null) || []).slice(0, 8),
  }));

  // Recent published articles -----------------------------------------
  const { data: articleRows } = await supabase
    .from("articles")
    .select("id, title, excerpt, status, created_at")
    .eq("author_user_id", profile.user_id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(5);

  const articles = (articleRows || []).map((row) => ({
    title: row.title as string,
    excerpt: (row.excerpt as string | null) ?? null,
  }));

  try {
    const result = await generateProfileSummary({
      locale: parsed.data.locale,
      name: (profile.name as string | null) ?? null,
      username: (profile.username as string | null) ?? null,
      headline: (profile.headline as string | null) ?? null,
      bio: (profile.bio as string | null) ?? null,
      additionalInfo: (profile.additional_info as string | null) ?? null,
      experienceLevel: (profile.experience_level as string | null) ?? null,
      experienceYears: (profile.experience_years as number | null) ?? null,
      skills,
      projects,
      articles,
    });

    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: result.model,
      feature: "profile_summary",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: result.durationMs,
      status: "ok",
      metadata: { targetUsername: profile.username },
    });

    return NextResponse.json({ summary: result.data.summary });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI features are not configured." },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ai/profile-summary] generation failed", error);
    void logAiUsage(supabase, {
      userId: user.id,
      provider: "gemini",
      model: "unknown",
      feature: "profile_summary",
      status: "error",
      errorMessage: message.slice(0, 500),
      metadata: { targetUsername: profile.username },
    });

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
