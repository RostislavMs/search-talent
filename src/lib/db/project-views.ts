import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Reads the denormalized project view count. Returns 0 if the column is not
// there yet (migration 2026-07-20-project-views.sql not applied) so the project
// page keeps rendering rather than 500-ing on a missing column.
export async function getProjectViewsCount(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("projects")
    .select("views_count")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    return 0;
  }

  const value = (data as { views_count?: number | null }).views_count;
  return typeof value === "number" ? value : 0;
}
