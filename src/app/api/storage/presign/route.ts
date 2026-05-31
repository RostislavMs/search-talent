import { NextResponse } from "next/server";
import { z } from "zod";

import { sanitizeStorageFileName } from "@/lib/project-media";
import { dbRateLimit } from "@/lib/rate-limit";
import {
  createPresignedUploadUrl,
  getR2PublicUrl,
  isR2Configured,
} from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";

const SCOPES = [
  "project-media",
  "article-image",
  "certificate",
  "profile-background",
  "avatar",
  "profile-cover",
] as const;

type Scope = (typeof SCOPES)[number];

// Server-side enforced ceilings. For `project-media` the effective cap
// depends on the project kind (photo = 25 MB images, video = 400 MB videos;
// everything else = 5 MB images, 100 MB videos). Resolved further down
// once the project row is fetched. The number below is the absolute outer
// bound — anything larger is rejected before we even hit the DB.
const ABSOLUTE_MAX_BYTES = 500 * 1024 * 1024;
const MAX_PROJECT_IMAGE_BYTES_PHOTO = 25 * 1024 * 1024;
const MAX_PROJECT_IMAGE_BYTES_DEFAULT = 5 * 1024 * 1024;
const MAX_PROJECT_VIDEO_BYTES_VIDEO_KIND = 400 * 1024 * 1024;
const MAX_PROJECT_VIDEO_BYTES_DEFAULT = 100 * 1024 * 1024;

const MAX_BYTES: Record<Scope, number> = {
  "project-media": ABSOLUTE_MAX_BYTES,
  "article-image": 10 * 1024 * 1024,
  certificate: 25 * 1024 * 1024,
  "profile-background": 25 * 1024 * 1024,
  avatar: 10 * 1024 * 1024,
  "profile-cover": 15 * 1024 * 1024,
};

const ALLOWED_MIME_PREFIX: Record<Scope, string[]> = {
  "project-media": ["image/", "video/"],
  "article-image": ["image/"],
  certificate: ["image/", "application/pdf"],
  "profile-background": ["image/", "video/"],
  avatar: ["image/"],
  "profile-cover": ["image/"],
};

const requestSchema = z.object({
  scope: z.enum(SCOPES),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  fileSize: z
    .number()
    .int()
    .min(1, "File size must be positive")
    .max(500 * 1024 * 1024, "File size is too large"),
  projectId: z.string().uuid().optional().nullable(),
});

function isMimeAllowed(scope: Scope, mime: string) {
  const lower = mime.toLowerCase();
  return ALLOWED_MIME_PREFIX[scope].some((prefix) => lower.startsWith(prefix));
}

function buildKey(scope: Scope, ownerId: string, fileName: string, projectId?: string | null) {
  const safeName = sanitizeStorageFileName(fileName) || "file";
  const stamp = `${Date.now()}-${crypto.randomUUID()}`;

  switch (scope) {
    case "project-media":
      // Mirror the existing Supabase storage layout: <projectId>/<stamp>-<file>.
      // Existing reads (Image components, deletions keyed by storage_path)
      // keep working without translation.
      return `${projectId}/${stamp}-${safeName}`;
    case "article-image":
      return `articles/${ownerId}/${stamp}-${safeName}`;
    case "certificate":
      return `certificates/${ownerId}/${stamp}-${safeName}`;
    case "profile-background":
      return `profile-backgrounds/${ownerId}/${stamp}-${safeName}`;
    // Avatar / cover use a STABLE key per user (no stamp): re-uploading
    // overwrites the same object, so there is never a stale copy to clean up.
    // The client appends a `?v=` query to bust the CDN cache.
    case "avatar":
      return `avatars/${ownerId}/avatar`;
    case "profile-cover":
      return `covers/${ownerId}/cover`;
  }
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Storage is not configured" },
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

  const limited = await dbRateLimit(supabase, `presign:${user.id}`, 60, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, requestSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { scope, fileName, contentType, fileSize, projectId } = parsed.data;

  if (fileSize > MAX_BYTES[scope]) {
    return NextResponse.json({ error: "File is too large" }, { status: 413 });
  }

  if (!isMimeAllowed(scope, contentType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 },
    );
  }

  if (scope === "project-media") {
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const { data: project, error } = await supabase
      .from("projects")
      .select("owner_id, kind")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Per-kind size enforcement. Photo kind keeps full-resolution originals,
    // everything else gets a tight image cap because the client compresses
    // before upload anyway.
    const isImage = contentType.toLowerCase().startsWith("image/");
    const isVideo = contentType.toLowerCase().startsWith("video/");
    let kindLimit = ABSOLUTE_MAX_BYTES;

    if (isImage) {
      kindLimit =
        project.kind === "photo"
          ? MAX_PROJECT_IMAGE_BYTES_PHOTO
          : MAX_PROJECT_IMAGE_BYTES_DEFAULT;
    } else if (isVideo) {
      kindLimit =
        project.kind === "video"
          ? MAX_PROJECT_VIDEO_BYTES_VIDEO_KIND
          : MAX_PROJECT_VIDEO_BYTES_DEFAULT;
    }

    if (fileSize > kindLimit) {
      return NextResponse.json(
        { error: "File is too large for this project type" },
        { status: 413 },
      );
    }
  }

  const key = buildKey(scope, user.id, fileName, projectId ?? undefined);

  let uploadUrl: string;
  try {
    uploadUrl = await createPresignedUploadUrl({
      key,
      contentType,
      contentLength: fileSize,
      expiresIn: 300,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sign upload URL",
      },
      { status: 500 },
    );
  }

  const publicUrl = getR2PublicUrl(key);
  if (!publicUrl) {
    return NextResponse.json(
      { error: "R2_PUBLIC_BASE_URL is not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    uploadUrl,
    publicUrl,
    storagePath: key,
  });
}
