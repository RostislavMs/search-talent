"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import LocalizedLink from "@/components/ui/localized-link";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { buildProjectPath } from "@/lib/projects";

export type ManagedCompanyProject = {
  id: string;
  title: string;
  slug: string;
  ownerId: string;
  ownerName: string | null;
  ownerUsername: string | null;
  status: "approved" | "pending";
  confirmed: boolean;
};

/**
 * "Company projects" in the editor: what is on the page, requests from
 * outside authors, confirming work, and adding one of your own published
 * projects. Authors take their projects off; owners and admins take off any,
 * confirm others' work and answer requests. The database enforces all of it;
 * this component only hides buttons that would be refused.
 */
export default function CompanyProjectsManager({
  companyId,
  viewerUserId,
  canManage,
  isMember,
  projects,
  attachable,
}: {
  companyId: string;
  viewerUserId: string;
  /** Owner or admin of the company. */
  canManage: boolean;
  /** Only team members add projects from here. */
  isMember: boolean;
  projects: ManagedCompanyProject[];
  attachable: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const ui = useDictionary().companies.projects;
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const shown = projects.filter((project) => project.status === "approved");
  const requests = canManage ? projects.filter((project) => project.status === "pending") : [];

  function failure(code: string | undefined) {
    return code && code in ui.errors ? ui.errors[code as keyof typeof ui.errors] : ui.errors.generic;
  }

  async function run(key: string, request: () => ReturnType<typeof apiFetch>, success: string) {
    setBusy(key);
    const result = await request();
    setBusy(null);

    if (!result.ok) {
      toast.error(failure(result.code));
      return false;
    }

    toast.success(success);
    router.refresh();
    return true;
  }

  const projectUrl = (projectId: string) => `/api/companies/${companyId}/projects/${projectId}`;

  async function add() {
    if (!selected || busy) return;
    const done = await run(
      "add",
      () => apiFetch(`/api/companies/${companyId}/projects`, { method: "POST", body: { projectId: selected } }),
      ui.added,
    );
    if (done) setSelected("");
  }

  const author = (project: ManagedCompanyProject) =>
    project.ownerName || (project.ownerUsername ? `@${project.ownerUsername}` : null);

  const projectLink = (project: ManagedCompanyProject) => (
    <div className="min-w-0">
      <LocalizedLink
        href={buildProjectPath(project.id, project.slug || undefined)}
        className="block truncate text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
      >
        {project.title}
      </LocalizedLink>
      {author(project) ? (
        <p className="truncate text-xs app-muted">{ui.by.replace("{name}", author(project)!)}</p>
      ) : null}
    </div>
  );

  return (
    <section
      className="rounded-none app-card p-5 sm:rounded-hero sm:p-6"
      aria-labelledby="company-projects-title"
    >
      <h2
        id="company-projects-title"
        className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
      >
        {ui.title}
      </h2>
      <p className="mt-1 text-sm leading-6 app-muted">{ui.description}</p>

      {requests.length > 0 ? (
        <div className="mt-5 rounded-2xl app-panel p-4">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{ui.requests}</h3>
          <p className="mt-1 text-xs leading-5 app-muted">{ui.requestsHint}</p>
          <ul className="mt-3 space-y-3">
            {requests.map((project) => (
              <li key={project.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {projectLink(project)}
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(project.id, () => apiFetch(projectUrl(project.id), { method: "POST" }), ui.confirmedToast)
                    }
                  >
                    {ui.accept}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(project.id, () => apiFetch(projectUrl(project.id), { method: "DELETE" }), ui.declinedToast)
                    }
                  >
                    {ui.decline}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-5 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
          {shown.map((project) => {
            const own = project.ownerId === viewerUserId;
            const removable = canManage || own;
            const confirmable = canManage && !own && !project.confirmed;

            return (
              <li key={project.id} className="flex items-center justify-between gap-3 py-3">
                {projectLink(project)}
                <div className="flex shrink-0 items-center gap-2">
                  {project.confirmed ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ {ui.confirmed}
                    </span>
                  ) : confirmable ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      title={ui.confirmHint}
                      disabled={busy !== null}
                      onClick={() =>
                        void run(project.id, () => apiFetch(projectUrl(project.id), { method: "POST" }), ui.confirmedToast)
                      }
                    >
                      {ui.confirm}
                    </Button>
                  ) : null}
                  {removable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(project.id, () => apiFetch(projectUrl(project.id), { method: "DELETE" }), ui.removed)
                      }
                    >
                      {ui.remove}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl app-panel-dashed p-4 text-sm app-muted">{ui.empty}</p>
      )}

      {canManage && shown.some((project) => !project.confirmed && project.ownerId !== viewerUserId) ? (
        <p className="mt-2 text-xs leading-5 app-soft">{ui.confirmHint}</p>
      ) : null}

      {isMember ? (
        attachable.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div role="group" aria-label={ui.pick}>
              <FormSelect
                options={attachable.map((project) => ({ value: project.id, label: project.title }))}
                value={selected}
                placeholder={ui.pick}
                searchable={attachable.length > 8}
                onChange={setSelected}
              />
            </div>
            <Button onClick={() => void add()} disabled={!selected || busy !== null}>
              {busy === "add" ? ui.adding : ui.add}
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-sm app-muted">{ui.noneToAdd}</p>
            <ButtonLink href="/projects/new" variant="secondary" size="sm">
              {ui.newProject}
            </ButtonLink>
          </div>
        )
      ) : null}
    </section>
  );
}
