import { NextResponse } from "next/server";
import { normalizeProjectMediaItem } from "@/lib/project-media";
import { createClient } from "@/lib/supabase/server";
import {
  createProjectMediaSchema,
  reorderProjectMediaSchema,
  updateProjectMediaSchema,
} from "@/lib/validation/project-media";
import { parseJsonRequest } from "@/lib/validation/request";

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

  if (!project.cover_url && mediaKind === "image") {
    const { error: coverError } = await ownership.supabase
      .from("projects")
      .update({
        cover_url: url,
      })
      .eq("id", projectId)
      .eq("owner_id", user.id);

    if (!coverError) {
      nextCoverUrl = url;
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

  const { data: firstImage } = await ownership.supabase
    .from("project_media")
    .select("url")
    .eq("project_id", projectId)
    .eq("media_kind", "image")
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextCoverUrl = firstImage?.url ?? null;

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
    const { error: storageError } = await ownership.supabase.storage
      .from("project-media")
      .remove([media.storage_path]);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 400 });
    }
  }

  let nextCoverUrl = ownership.project.cover_url;

  if (ownership.project.cover_url === media.url) {
    const { data: nextCoverCandidate } = await ownership.supabase
      .from("project_media")
      .select("url")
      .eq("project_id", projectId)
      .eq("media_kind", "image")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    nextCoverUrl = nextCoverCandidate?.url ?? null;

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
