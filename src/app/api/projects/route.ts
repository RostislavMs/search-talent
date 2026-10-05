import { NextResponse } from "next/server";
import { generateUniqueProjectSlug } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { dbRateLimit } from "@/lib/rate-limit";
import { projectPayloadSchema } from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { mapRepoToProjectColumns } from "@/lib/db/github-sync";
import { buildProjectSourceColumns } from "@/lib/db/provider-sync";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  CLEAN_MODERATION_RESULT,
  collectProjectModerationText,
  describeModerationResult,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { getRequestLocale } from "@/lib/i18n/server";
import { sanitizeCoAuthorIds } from "@/lib/co-authors";
import { buildProjectRow, notifyProjectSaved, saveProject } from "@/lib/db/save-project";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttle content creation (shared across projects/articles/polls) to stop a
  // single account from flooding the public feeds and follower notifications.
  const limited = await dbRateLimit(
    `create-content:${user.id}`,
    5,
    60_000,
  );
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, projectPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;

  // Co-authors invited at creation: the work is held as a draft until every
  // invitee accepts, then auto-published (see respondToCoAuthorInvitation).
  const coAuthorIds = sanitizeCoAuthorIds(payload.coAuthorUserIds, user.id);
  const holdForCoAuthors = payload.status === "published" && coAuthorIds.length > 0;

  const uniqueSlug = await generateUniqueProjectSlug(supabase, payload.slug);

  // Auto-moderation runs only on publish. A flagged project is auto-removed
  // (hidden by RLS) right after insert and the author is notified; clean
  // content keeps the previous auto-approve behaviour.
  const screen =
    payload.status === "published"
      ? screenContentForModeration(collectProjectModerationText(payload))
      : CLEAN_MODERATION_RESULT;

  // If the form supplied a GitHub repo, snapshot it server-side so the
  // denormalized columns (stats, languages, sync timestamp) are filled
  // on create. Failure to reach GitHub is non-fatal: the project still
  // saves with whatever fields the user filled manually.
  let githubColumns: Record<string, unknown> = {};
  if (payload.githubFullName) {
    const integration = await getIntegrationForUser(supabase, user.id);
    if (integration) {
      const detail = await fetchRepoFullDetail(
        integration.access_token,
        payload.githubFullName,
      );
      if (detail) {
        githubColumns = mapRepoToProjectColumns(detail, {
          description: payload.description,
          project_status: payload.projectStatus,
          team_size: payload.teamSize,
          started_on: payload.startedOn,
        });
      }
    }
  }

  // Same snapshot-on-create for the generic providers (GitLab).
  let sourceColumns: Record<string, unknown> = {};
  if (payload.sourceIntegration) {
    sourceColumns =
      (await buildProjectSourceColumns(
        supabase,
        user.id,
        payload.sourceIntegration,
        {
          description: payload.description,
          repository_url: payload.repositoryUrl,
          project_status: payload.projectStatus,
          team_size: payload.teamSize,
          started_on: payload.startedOn,
        },
      )) ?? {};
  }

  // The project, its skills, budget, co-authors and company pages in one
  // transaction: a failure leaves nothing half-made behind. A flagged project
  // gets no co-authors or company pages — there is nothing to share yet.
  const { project, error } = await saveProject(supabase, {
    id: null,
    row: {
      ...buildProjectRow(payload),
      slug: uniqueSlug,
      status: holdForCoAuthors ? "draft" : payload.status,
      publish_on_confirm: holdForCoAuthors,
      ...githubColumns,
      ...sourceColumns,
    },
    skillIds: payload.skillIds,
    budget: payload.budget,
    coAuthorIds: screen.flagged ? [] : coAuthorIds,
    companyIds: screen.flagged ? [] : payload.companyIds,
  });

  if (!project) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (screen.flagged) {
    await autoRemoveContent({ table: "projects", id: project.id, note: screen.note });
  }

  await notifyProjectSaved({ project, title: payload.title, creatorUserId: user.id });

  // Notify followers only when the project is actually public (published AND
  // not auto-removed). A draft held for co-authors notifies on auto-publish.
  if (project.status === "published" && !screen.flagged) {
    void dispatchPublishSideEffects({
      contentType: "project",
      contentId: project.id,
      authorUserId: user.id,
      title: payload.title,
    });
  }

  return NextResponse.json({
    success: true,
    projectId: project.id,
    slug: project.slug,
    status: project.status,
    autoRemoved: screen.flagged,
    moderationReason: screen.flagged
      ? describeModerationResult(screen, await getRequestLocale())
      : null,
    awaitingCoAuthors: holdForCoAuthors,
  });
}
