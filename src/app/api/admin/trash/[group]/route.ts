import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { eraseTrashGroup, restoreTrashGroup, type TrashActionResult } from "@/lib/db/trash";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const routeSchema = z.object({ group: z.string().uuid("Invalid trash item") });

const FAILURE_STATUS: Record<Exclude<TrashActionResult, { ok: true }>["code"], number> = {
  conflict: 409,
  missing_parent: 409,
  not_found: 404,
  forbidden: 403,
  failed: 500,
};

type Authorized =
  | { ok: true; group: string; supabase: SupabaseClient }
  | { ok: false; response: NextResponse };

async function authorize(params: Promise<{ group: string }>): Promise<Authorized> {
  const route = routeSchema.safeParse(await params);
  if (!route.success) {
    return { ok: false, response: NextResponse.json({ error: "Invalid trash item" }, { status: 400 }) };
  }

  const context = await getCurrentViewerRole();
  if (!context.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!context.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, group: route.data.group, supabase: context.supabase };
}

function respond(result: TrashActionResult) {
  if (result.ok) {
    return NextResponse.json({ success: true, restored: result.restored ?? null, accountUserId: result.accountUserId });
  }
  return NextResponse.json(
    { error: result.code, code: result.code, table: result.table },
    { status: FAILURE_STATUS[result.code] },
  );
}

/** Restore a deleted item (and whatever was deleted together with it). */
export async function POST(_request: Request, { params }: { params: Promise<{ group: string }> }) {
  const auth = await authorize(params);
  if (!auth.ok) return auth.response;
  return respond(await restoreTrashGroup(auth.supabase, auth.group));
}

/** Erase a deleted item now instead of waiting out the 60 days. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ group: string }> }) {
  const auth = await authorize(params);
  if (!auth.ok) return auth.response;
  return respond(await eraseTrashGroup(auth.supabase, auth.group));
}
