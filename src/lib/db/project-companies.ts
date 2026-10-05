import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toProjectBudget,
  type EditorProjectBudget,
  type ProjectBudget,
} from "@/lib/project-context";

/** A company page a project is on, or asked to be on. */
export type ProjectCompanyLink = {
  companyId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  /** The company page itself carries the check mark. */
  verified: boolean;
  /** 'pending' waits for the company to accept (outside authors). */
  status: "approved" | "pending";
  /** The company vouched for the work. */
  confirmed: boolean;
};

type LinkRow = {
  company_id: string;
  status: string;
  confirmed_at: string | null;
  company:
    | { id: string; slug: string; name: string; logo_url: string | null; verified_at: string | null }
    | Array<{ id: string; slug: string; name: string; logo_url: string | null; verified_at: string | null }>
    | null;
};

/**
 * The companies of a project as the caller may see them: visitors get the
 * shown ones, the author also their open requests (RLS decides).
 */
export async function loadProjectCompanyLinks(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectCompanyLink[]> {
  const { data, error } = await supabase
    .from("company_projects")
    .select("company_id, status, confirmed_at, company:company_id ( id, slug, name, logo_url, verified_at )")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error || !data) {
    return [];
  }

  const links: ProjectCompanyLink[] = [];
  for (const row of data as unknown as LinkRow[]) {
    const company = Array.isArray(row.company) ? row.company[0] : row.company;
    if (!company) continue;
    links.push({
      companyId: company.id,
      slug: company.slug,
      name: company.name,
      logoUrl: company.logo_url,
      verified: Boolean(company.verified_at),
      status: row.status === "pending" ? "pending" : "approved",
      confirmed: Boolean(row.confirmed_at),
    });
  }
  return links;
}

/** The author's own budget for the editor (owner-only table). */
export async function loadProjectBudget(
  supabase: SupabaseClient,
  projectId: string,
): Promise<EditorProjectBudget | null> {
  const { data, error } = await supabase
    .from("project_private_details")
    .select("budget_amount, budget_currency, budget_type, budget_public")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    budget_amount: number | null;
    budget_currency: string | null;
    budget_type: string | null;
    budget_public: boolean | null;
  };
  const budget = toProjectBudget({ amount: row.budget_amount, currency: row.budget_currency, type: row.budget_type });
  return budget ? { ...budget, isPublic: Boolean(row.budget_public) } : null;
}

/** The budget as the project page may show it: only when the author chose to. */
export async function getPublicProjectBudget(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectBudget | null> {
  const { data, error } = await supabase.rpc("project_public_budget", { p_project_id: projectId });

  if (error || !data) {
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { amount?: unknown; currency?: unknown; type?: unknown }
    | undefined;
  return toProjectBudget(row ?? null);
}
