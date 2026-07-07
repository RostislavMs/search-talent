import { NextResponse } from "next/server";
import {
  getVideoEmbedThumbnail,
  normalizeProjectMediaItem,
} from "@/lib/project-media";
import { deleteStorageObject } from "@/lib/storage/provider";
import { createClient } from "@/lib/supabase/server";
import {
  createProjectMediaSchema,
  reorderProjectMediaSchema,
  updateProjectMediaSchema,
} from "@/lib/validation/project-media";
import { parseJsonRequest } from "@/lib/validation/request";

type CoverCandidateRow = {
  url: string;
  media_kind: string | null;
};

// The project cover is the first uploaded image; failing that, the poster of
// the first video link we can derive one from without a network call
// (YouTube). This keeps video-only projects — a YouTube/Shorts link and
// nothing else — from rendering as a blank card. Rows must be passed already
// ordered (sort_index, then created_at).
function resolveCoverFromRows(rows: CoverCandidateRow[]): string | null {
  const firstImage = rows.find((row) => row.media_kind === "image");
  if (firstImage) {
    return firstImage.url;
  }
  for (const row of rows) {
    if (row.media_kind === "video") {
      const thumbnail = getVideoEmbedThumbnail(row.url);
      if (thumbnail) {
        return thumbnail;
      }
    }
  }
  return null;
}

async function getOwnedProject(
  projectId: string,
  userId: string,
) {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id, cover_url")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return { supabase, project: null, error };
  }

  if (!project || project.owner_id !== userId) {
    return { supabase, project: null, error: new Error("Forbidden") };
  }

  return { supabase, project, error: null };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, createProjectMediaSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const {
    projectId,
    url,
    storagePath,
    fileName,
    mimeType,
    fileSize,
    mediaKind,
    sortIndex,
  } = parsed.data;

  const ownership = await getOwnedProject(projectId, user.id);

  if (ownership.error) {
    return NextResponse.json(
      { error: ownership.error.message },
      { status: ownership.error.message === "Forbidden" ? 403 : 400 },
    );
  }

  const { project } = ownership;

  let resolvedSortIndex = sortIndex;

  if (resolvedSortIndex === null) {
    const { data: maxRow } = await ownership.supabase
      .from("project_media")
      .select("sort_index")
      .eq("project_id", projectId)
      .order("sort_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedSortIndex = (maxRow?.sort_index ?? -1) + 1;
  }

  const { data: media, error: mediaError } = await ownership.supabase
    .from("project_media")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      url,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size: fileSize,
      media_kind: mediaKind,
      sort_index: resolvedSortIndex,
    })
    .select(
      "id, project_id, owner_id, url, storage_path, file_name, mime_type, file_size, media_kind, sort_index, created_at",
    )
    .single();

  if (mediaError || !media) {
    return NextResponse.json(
      { error: mediaError?.message || "Could not save project media" },
      { status: 400 },
    );
  }

  let nextCoverUrl = project.cover_url;

  if (!project.cover_url) {
    const coverCandidate =
      mediaKind === "image"
        ? url
        : mediaKind === "video"
          ? getVideoEmbedThumbnail(url)
          : null;

    if (coverCandidate) {
      const { error: coverError } = await ownership.supabase
        .from("projects")
        .update({
          cover_url: coverCandidate,
        })
        .eq("id", projectId)
        .eq("owner_id", user.id);

      if (!coverError) {
        nextCoverUrl = coverCandidate;
      }
    }
  }

  return NextResponse.json({
    success: true,
    coverUrl: nextCoverUrl,
    media: normalizeProjectMediaItem(media),
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, updateProjectMediaSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { projectId, mediaId } = parsed.data;

  const ownership = await getOwnedProject(projectId, user.id);

  if (ownership.error) {
    return NextResponse.json(
      { error: ownership.error.message },
      { status: ownership.error.message === "Forbidden" ? 403 : 400 },
    );
  }

  const { data: media, error: mediaError } = await ownership.supabase
    .from("project_media")
    .select("id, url, media_kind")
    .eq("id", mediaId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 400 });
  }

  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  if (media.media_kind !== "image") {
    return NextResponse.json(
      { error: "Only image files can be used as project preview" },
      { status: 400 },
    );
  }

  const { error: coverError } = await ownership.supabase
    .from("projects")
    .update({
      cover_url: media.url,
    })
    .eq("id", projectId)
    .eq("owner_id", user.id);

  if (coverError) {
    return NextResponse.json({ error: coverError.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    coverUrl: media.url,
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, reorderProjectMediaSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { projectId, mediaIds } = parsed.data;

  const ownership = await getOwnedProject(projectId, user.id);

  if (ownership.error) {
    return NextResponse.json(
      { error: ownership.error.message },
      { status: ownership.error.message === "Forbidden" ? 403 : 400 },
    );
  }

  const { data: existing, error: existingError } = await ownership.supabase
    .from("project_media")
    .select("id")
    .eq("project_id", projectId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const existingIds = new Set((existing || []).map((item) => item.id));
  const invalid = mediaIds.filter((id) => !existingIds.has(id));

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Some media items do not belong to this project" },
      { status: 400 },
    );
  }

  for (let index = 0; index < mediaIds.length; index += 1) {
    const { error: updateError } = await ownership.supabase
      .from("project_media")
      .update({ sort_index: index })
      .eq("id", mediaIds[index])
      .eq("project_id", projectId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  }

  const { data: orderedRows } = await ownership.supabase
    .from("project_media")
    .select("url, media_kind")
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });

  // The cover is explicit once set (uploaded image, captured frame, or the
  // first image auto-picked on the very first upload). Reordering must not
  // silently change it, so we only derive a cover here when none exists yet.
  const nextCoverUrl =
    ownership.project.cover_url ?? resolveCoverFromRows(orderedRows ?? []);

  if (nextCoverUrl !== ownership.project.cover_url) {
    await ownership.supabase
      .from("projects")
      .update({ cover_url: nextCoverUrl })
      .eq("id", projectId)
      .eq("owner_id", user.id);
  }

  return NextResponse.json({ success: true, coverUrl: nextCoverUrl });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, updateProjectMediaSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { projectId, mediaId } = parsed.data;

  const ownership = await getOwnedProject(projectId, user.id);

  if (ownership.error) {
    return NextResponse.json(
      { error: ownership.error.message },
      { status: ownership.error.message === "Forbidden" ? 403 : 400 },
    );
  }

  const { data: media, error: mediaError } = await ownership.supabase
    .from("project_media")
    .select("id, url, storage_path, media_kind")
    .eq("id", mediaId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 400 });
  }

  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const { error: deleteError } = await ownership.supabase
    .from("project_media")
    .delete()
    .eq("id", mediaId)
    .eq("project_id", projectId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  if (media.storage_path) {
    const { error: storageError } = await deleteStorageObject({
      supabase: ownership.supabase,
      bucket: "project-media",
      url: media.url,
      storagePath: media.storage_path,
    });

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 400 });
    }
  }

  let nextCoverUrl = ownership.project.cover_url;

  // The cover may be the deleted row's own url (an image) or the poster we
  // derived from a video link (thumbnail !== the stored url). Recompute in
  // both cases so removing the cover's source does not leave a dangling image.
  const deletedThumbnail = getVideoEmbedThumbnail(media.url);
  const coverCameFromDeleted =
    ownership.project.cover_url === media.url ||
    (deletedThumbnail !== null &&
      ownership.project.cover_url === deletedThumbnail);

  if (coverCameFromDeleted) {
    const { data: remainingRows } = await ownership.supabase
      .from("project_media")
      .select("url, media_kind")
      .eq("project_id", projectId)
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: true });

    nextCoverUrl = resolveCoverFromRows(remainingRows ?? []);

    await ownership.supabase
      .from("projects")
      .update({
        cover_url: nextCoverUrl,
      })
      .eq("id", projectId)
      .eq("owner_id", user.id);
  }

  return NextResponse.json({
    success: true,
    coverUrl: nextCoverUrl,
    mediaId,
  });
}
