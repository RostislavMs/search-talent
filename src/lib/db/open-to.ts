import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How many signed-in people opened «Зв'язатися» on the signed-in owner's
 * profile, each counted once (`my_contact_opens()`, see
 * database/2026-09-28-open-to.sql). 0 when unknown: until the migration runs
 * the call fails, and the tile in My Space simply stays hidden.
 */
export async function getMyContactOpens(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("my_contact_opens");

  if (error) {
    return 0;
  }

  const row = (Array.isArray(data) ? data[0] : data) as { total?: number | string } | null;
  const total = Number(row?.total ?? 0);

  return Number.isFinite(total) && total > 0 ? total : 0;
}
