import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeMentionQuery } from "@/lib/constants/mentions";

const MAX_SUGGESTIONS = 8;
const MIN_QUERY_LENGTH = 1;

/**
 * GET /api/mentions/suggest?q=<query>
 * Returns up to 8 profiles matching the query (prefix match on
 * username or name). Used by the @-autocomplete in comment inputs.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ suggestions: [] });
  }

  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") || "").trim();
  if (raw.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  // Strip PostgREST/ilike-structural characters but keep Unicode letters, so
  // Cyrillic (and other non-Latin) names are searchable. See sanitizeMentionQuery.
  const sanitized = sanitizeMentionQuery(raw);
  if (!sanitized) {
    return NextResponse.json({ suggestions: [] });
  }
  const pattern = `${sanitized}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url")
    .or(`username.ilike.${pattern},name.ilike.${pattern}`)
    .not("username", "is", null)
    .limit(MAX_SUGGESTIONS);

  if (error || !data) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = data
    .filter(
      (row): row is { user_id: string; username: string; name: string | null; avatar_url: string | null } =>
        Boolean(row.user_id && row.username),
    )
    .map((row) => ({
      userId: row.user_id,
      username: row.username,
      name: row.name,
      avatarUrl: row.avatar_url,
    }));

  return NextResponse.json({ suggestions });
}
