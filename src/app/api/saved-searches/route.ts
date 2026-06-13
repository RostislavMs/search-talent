import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/validation/request";

const createSearchPayloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  mode: z.enum(["projects", "creators"]),
  params: z.record(z.string(), z.unknown()),
});

/**
 * GET /api/saved-searches — list saved searches for the current user.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous visitors simply have no saved searches. Return an empty list
  // (200) instead of 401 so the discovery pages' background load doesn't log a
  // console error on every public/SEO visit. Mutations (POST/DELETE) below
  // still require auth.
  if (!user) {
    return NextResponse.json({ searches: [] });
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, mode, params, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ searches: data || [] });
}

/**
 * POST /api/saved-searches — save current search.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`saved-search:${user.id}`, 20, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, createSearchPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, mode, params } = parsed.data;

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      name,
      mode,
      params,
    })
    .select("id, name, mode, params, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ search: data });
}

/**
 * DELETE /api/saved-searches — remove a saved search by id (passed as query param).
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ deleted: true });
}
