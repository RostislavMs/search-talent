import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyCompanyProjectRequest } from "@/lib/db/companies";
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

/**
 * Brings a project's company pages in line with the form: links the author
 * removed go, new ones are added. The database decides whether a new link is
 * shown at once (the author is in that company's team) or waits for the
 * company; for a waiting one on a published project the company is told.
 * Failures are logged, never thrown: the project itself is already saved.
 */
export async function syncProjectCompanies({
  supabase,
  projectId,
  userId,
  desiredCompanyIds,
  published,
}: {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
  desiredCompanyIds: string[];
  published: boolean;
}): Promise<void> {
  const { data } = await supabase
    .from("company_projects")
    .select("company_id")
    .eq("project_id", projectId);

  const current = new Set(((data ?? []) as Array<{ company_id: string }>).map((row) => row.company_id));
  const desired = new Set(desiredCompanyIds);

  const removed = [...current].filter((id) => !desired.has(id));
  if (removed.length > 0) {
    const { error } = await supabase
      .from("company_projects")
      .delete()
      .eq("project_id", projectId)
      .in("company_id", removed);
    if (error) {
      console.error("[project-companies] remove failed", error.message);
    }
  }

  for (const companyId of desiredCompanyIds) {
    if (current.has(companyId)) continue;

    const { data: inserted, error } = await supabase
      .from("company_projects")
      .insert({ company_id: companyId, project_id: projectId, added_by: userId })
      .select("status")
      .maybeSingle();

    if (error) {
      console.error("[project-companies] add failed", { companyId, error: error.message });
      continue;
    }

    if (published && (inserted as { status?: string } | null)?.status === "pending") {
      await notifyCompanyProjectRequest({ companyId, projectId, actorUserId: userId });
    }
  }
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

/** Saves the budget, or removes it when the form sends none. */
export async function saveProjectBudget(
  supabase: SupabaseClient,
  projectId: string,
  budget: EditorProjectBudget | null,
): Promise<boolean> {
  if (!budget) {
    const { error } = await supabase.from("project_private_details").delete().eq("project_id", projectId);
    return !error;
  }

  const { error } = await supabase.from("project_private_details").upsert(
    {
      project_id: projectId,
      budget_amount: budget.amount,
      budget_currency: budget.currency,
      budget_type: budget.type,
      budget_public: budget.isPublic,
    },
    { onConflict: "project_id" },
  );

  if (error) {
    console.error("[project-companies] budget save failed", error.message);
  }
  return !error;
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
