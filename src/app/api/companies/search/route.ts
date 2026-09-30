import { NextResponse } from "next/server";
import { sanitizeMentionQuery } from "@/lib/constants/mentions";
import { createClient } from "@/lib/supabase/server";

const MAX_RESULTS = 8;

/**
 * GET /api/companies/search?q=<name> — company pages to show a project on,
 * for the project form. Signed-in only, prefix/substring match on the name,
 * approved pages only (RLS), verified ones first.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ companies: [] });
  }

  const raw = (new URL(request.url).searchParams.get("q") || "").trim();
  // Strips PostgREST/ilike-structural characters, keeps Cyrillic.
  const query = sanitizeMentionQuery(raw);

  if (!query) {
    return NextResponse.json({ companies: [] });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name, logo_url, verified_at")
    .eq("moderation_status", "approved")
    .ilike("name", `%${query}%`)
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(MAX_RESULTS);

  if (error || !data) {
    return NextResponse.json({ companies: [] });
  }

  return NextResponse.json({
    companies: (data as Array<{ id: string; slug: string; name: string; logo_url: string | null; verified_at: string | null }>).map(
      (company) => ({
        id: company.id,
        slug: company.slug,
        name: company.name,
        logoUrl: company.logo_url,
        verified: Boolean(company.verified_at),
      }),
    ),
  });
}
