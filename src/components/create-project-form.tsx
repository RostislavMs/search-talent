"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import TagSelect from "@/components/ui/tag-select";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { projectPayloadSchema } from "@/lib/validation/project";
import {
  buildProjectPath,
  projectStatuses,
  slugify,
  type ProjectStatus,
} from "@/lib/projects";

type MetaOption = {
  id: number;
  name: string;
};

export type EditableProject = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  role: string | null;
  project_status: ProjectStatus | null;
  team_size: number | null;
  project_url: string | null;
  repository_url: string | null;
  started_on: string | null;
  completed_on: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  technologies: { id: number; name: string }[];
};

type ProjectFormState = {
  title: string;
  description: string;
  role: string;
  projectStatus: ProjectStatus | "";
  teamSize: string;
  projectUrl: string;
  repositoryUrl: string;
  startedOn: string;
  completedOn: string;
  problem: string;
  solution: string;
  results: string;
};

function getStatusLabel(status: ProjectStatus, dictionary: Dictionary) {
  switch (status) {
    case "planning":
      return dictionary.forms.projectStatusPlanning;
    case "in_progress":
      return dictionary.forms.projectStatusInProgress;
    case "completed":
      return dictionary.forms.projectStatusCompleted;
    case "on_hold":
      return dictionary.forms.projectStatusOnHold;
    default:
      return status;
  }
}

function getInitialFormState(
  project?: EditableProject | null,
): ProjectFormState {
  return {
    title: project?.title || "",
    description: project?.description || "",
    role: project?.role || "",
    projectStatus: project?.project_status || "",
    teamSize: project?.team_size ? String(project.team_size) : "",
    projectUrl: project?.project_url || "",
    repositoryUrl: project?.repository_url || "",
    startedOn: project?.started_on || "",
    completedOn: project?.completed_on || "",
    problem: project?.problem || "",
    solution: project?.solution || "",
    results: project?.results || "",
  };
}

export default function CreateProjectForm({
  project,
}: {
  project?: EditableProject | null;
}) {
  const router = useLocalizedRouter();
  const dictionary = useDictionary();
  const isEditMode = Boolean(project);

  const [metaSkills, setMetaSkills] = useState<MetaOption[]>([]);
  const [skillIds, setSkillIds] = useState<number[]>(
    project?.technologies.map((technology) => technology.id) || [],
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(() =>
    getInitialFormState(project),
  );

  useEffect(() => {
    async function loadMeta() {
      const result = await apiFetch<{ skills?: MetaOption[] }>("/api/meta");
      if (result.ok) {
        setMetaSkills(result.data.skills || []);
      }
    }

    loadMeta();
  }, []);

  const update = <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = slugify(form.title);

    if (
      form.startedOn &&
      form.completedOn &&
      form.completedOn < form.startedOn
    ) {
      setErrorMessage(dictionary.forms.invalidProjectDateRange);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const payload = {
      title: form.title,
      slug,
      description: form.description,
      role: form.role,
      projectStatus: form.projectStatus || null,
      teamSize: form.teamSize ? Number(form.teamSize) : null,
      projectUrl: form.projectUrl,
      repositoryUrl: form.repositoryUrl,
      startedOn: form.startedOn,
      completedOn: form.completedOn,
      problem: form.problem,
      solution: form.solution,
      results: form.results,
      skillIds,
    };

    const parsedPayload = projectPayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      setErrorMessage(
        parsedPayload.error.issues[0]?.message ||
          dictionary.forms.errorCreatingProject,
      );
      setLoading(false);
      return;
    }

    const endpoint = isEditMode
      ? `/api/projects/${project?.id}`
      : "/api/projects";
    const method = isEditMode ? "PATCH" : "POST";
    const result = await apiFetch<{
      projectId?: string;
      slug?: string;
    }>(endpoint, {
      method,
      body: parsedPayload.data,
    });

    setLoading(false);

    if (!result.ok) {
      setErrorMessage(
        result.error ||
          (isEditMode
            ? dictionary.forms.errorUpdatingProject
            : dictionary.forms.errorCreatingProject),
      );
      return;
    }

    router.refresh();

    if (project?.id) {
      router.push(buildProjectPath(project.id, result.data.slug || slug));
      return;
    }

    if (result.data.projectId) {
      router.push(
        buildProjectPath(result.data.projectId, result.data.slug || slug),
      );
      return;
    }

    router.push(`/projects/${result.data.slug || slug}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.projectTitle}
          </label>
          <input
            type="text"
            placeholder={dictionary.forms.projectTitlePlaceholder}
            className="app-input"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.description}
          </label>
          <FormTextarea
            placeholder={dictionary.forms.projectDescriptionPlaceholder}
            className="min-h-28 p-4 text-[color:var(--foreground)]"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.projectRole}
          </label>
          <input
            type="text"
            placeholder={dictionary.forms.projectRolePlaceholder}
            className="app-input"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.projectStatus}
          </label>
          <FormSelect
            className="w-full"
            triggerClassName="w-full"
            value={form.projectStatus}
            placeholder={dictionary.forms.projectStatusPlaceholder}
            onChange={(value) =>
              update("projectStatus", value as ProjectStatus | "")
            }
            options={projectStatuses.map((status) => ({
              value: status,
              label: getStatusLabel(status, dictionary),
            }))}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.teamSize}
          </label>
          <input
            type="number"
            min="1"
            placeholder={dictionary.forms.teamSizePlaceholder}
            className="app-input"
            value={form.teamSize}
            onChange={(e) => update("teamSize", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.technologies}
          </label>
          <TagSelect
            options={metaSkills}
            value={skillIds}
            placeholder={dictionary.forms.searchProjectTechnologies}
            onChange={(values) => setSkillIds(values.map(Number))}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.startedOn}
          </label>
          <input
            type="date"
            className="app-input"
            value={form.startedOn}
            onChange={(e) => update("startedOn", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.completedOn}
          </label>
          <input
            type="date"
            className="app-input"
            value={form.completedOn}
            onChange={(e) => update("completedOn", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.projectUrl}
          </label>
          <input
            type="url"
            placeholder={dictionary.forms.projectUrlPlaceholder}
            className="app-input"
            value={form.projectUrl}
            onChange={(e) => update("projectUrl", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.repositoryUrl}
          </label>
          <input
            type="url"
            placeholder={dictionary.forms.repositoryUrlPlaceholder}
            className="app-input"
            value={form.repositoryUrl}
            onChange={(e) => update("repositoryUrl", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.problem}
          </label>
          <FormTextarea
            placeholder={dictionary.forms.problemPlaceholder}
            className="min-h-28 p-4 text-[color:var(--foreground)]"
            value={form.problem}
            onChange={(e) => update("problem", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.solution}
          </label>
          <FormTextarea
            placeholder={dictionary.forms.solutionPlaceholder}
            className="min-h-28 p-4 text-[color:var(--foreground)]"
            value={form.solution}
            onChange={(e) => update("solution", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.forms.results}
          </label>
          <FormTextarea
            placeholder={dictionary.forms.resultsPlaceholder}
            className="min-h-28 p-4 text-[color:var(--foreground)]"
            value={form.results}
            onChange={(e) => update("results", e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading
          ? isEditMode
            ? dictionary.forms.updatingProject
            : dictionary.forms.creating
          : isEditMode
            ? dictionary.forms.updateProject
            : dictionary.forms.createProject}
      </Button>

      {errorMessage && <p className="text-sm text-rose-500">{errorMessage}</p>}
    </form>
  );
}
