import { NextResponse } from "next/server";
import { z } from "zod";

import { dbRateLimit } from "@/lib/rate-limit";
import { deleteStorageObject } from "@/lib/storage/provider";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";

const ALLOWED_BUCKETS = new Set([
  "project-media",
  "profile-certificates",
  "profile-covers",
  "avatars",
]);

const requestSchema = z.object({
  bucket: z.string().min(1),
  storagePath: z.string().trim().min(1).max(500),
  url: z.string().trim().url().max(2048),
  projectId: z.string().uuid().optional().nullable(),
});

/**
 * Provider-aware client-initiated delete for legacy/orphaned files
 * (e.g. profile certificate replacement). Server checks the user can
 * delete the asset before dispatching to R2 or Supabase Storage.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await dbRateLimit(
    supabase,
    `storage-delete:${user.id}`,
    60,
    60_000,
  );
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, requestSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { bucket, storagePath, url, projectId } = parsed.data;

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket not allowed" }, { status: 400 });
  }

  // Authorisation guard: a user can only erase files that live under their
  // own user id (covers profile certificates and presentation backgrounds)
  // or under a project they own (covers project media).
  const userPrefixes = [
    `${user.id}/`,
    `articles/${user.id}/`,
    `certificates/${user.id}/`,
    `profile-backgrounds/${user.id}/`,
    `avatars/${user.id}/`,
    `covers/${user.id}/`,
  ];

  let authorised = userPrefixes.some((prefix) => storagePath.startsWith(prefix));

  if (!authorised && projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    authorised = Boolean(project && project.owner_id === user.id);

    if (
      authorised &&
      !storagePath.startsWith(`${projectId}/`)
    ) {
      authorised = false;
    }
  }

  if (!authorised) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await deleteStorageObject({
    supabase,
    bucket,
    url,
    storagePath,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
