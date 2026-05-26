"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import GithubRepoImporter, {
  type GithubImportPayload,
} from "@/components/github-repo-importer";
import TagSelect from "@/components/ui/tag-select";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { compressImageFile } from "@/lib/image-compression";
import {
  buildProjectPath,
  projectStatuses,
  slugify,
  type ProjectStatus,
  type ProjectVisibilityStatus,
} from "@/lib/projects";
import {
  DEFAULT_GITHUB_DISPLAY_OPTIONS,
  GITHUB_FIELD_LIMITS,
  GITHUB_PROJECT_ROLES,
  type GithubDisplayOptions,
  type GithubProjectRole,
} from "@/lib/constants/github";
import {
  buildYouTubeEmbedUrl,
  getYouTubeVideoId,
  inferProjectMediaKind,
  sanitizeStorageFileName,
  type ProjectMediaItem,
  type ProjectMediaKind,
} from "@/lib/project-media";
import { projectPayloadSchema } from "@/lib/validation/project";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const BASE_TOTAL_STEPS = 4;
const DEFAULT_ASPECT_RATIO = 16 / 10;

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
  status?: ProjectVisibilityStatus | null;
  technologies: { id: number; name: string }[];
  media?: ProjectMediaItem[];
  github_full_name?: string | null;
  github_role?: GithubProjectRole | null;
  github_contribution?: string | null;
  github_motivation?: string | null;
  github_tech_decisions?: string | null;
  github_learnings?: string | null;
  github_showcase_notes?: string | null;
  github_production_usage?: string | null;
  github_display_options?: Partial<GithubDisplayOptions> | null;
  github_auto_sync?: boolean | null;
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
  githubRole: GithubProjectRole | "";
  githubContribution: string;
  githubMotivation: string;
  githubTechDecisions: string;
  githubLearnings: string;
  githubShowcaseNotes: string;
  githubProductionUsage: string;
  githubDisplayOptions: GithubDisplayOptions;
  githubAutoSync: boolean;
};

type SaveMode = "draft" | "publish";

type LocalMediaItem = {
  id: string;
  kind: "local";
  file: File;
  previewUrl: string;
  mediaKind: ProjectMediaKind;
  aspectRatio: number;
};

type RemoteMediaItem = {
  id: string;
  kind: "remote";
  remoteId: string;
  url: string;
  mediaKind: ProjectMediaKind;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  aspectRatio: number;
  youTubeId: string | null;
};

type YouTubeMediaItem = {
  id: string;
  kind: "youtube";
  url: string;
  videoId: string;
  mediaKind: "video";
  aspectRatio: number;
};

type WizardMediaItem = LocalMediaItem | RemoteMediaItem | YouTubeMediaItem;

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
  const role = project?.github_role;
  const isValidRole =
    role && (GITHUB_PROJECT_ROLES as readonly string[]).includes(role);

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
    githubRole: isValidRole ? (role as GithubProjectRole) : "",
    githubContribution: project?.github_contribution || "",
    githubMotivation: project?.github_motivation || "",
    githubTechDecisions: project?.github_tech_decisions || "",
    githubLearnings: project?.github_learnings || "",
    githubShowcaseNotes: project?.github_showcase_notes || "",
    githubProductionUsage: project?.github_production_usage || "",
    githubDisplayOptions: {
      ...DEFAULT_GITHUB_DISPLAY_OPTIONS,
      ...(project?.github_display_options || {}),
    },
    githubAutoSync:
      typeof project?.github_auto_sync === "boolean"
        ? project.github_auto_sync
        : true,
  };
}

function toRemoteMediaItem(item: ProjectMediaItem): RemoteMediaItem {
  const youTubeId = getYouTubeVideoId(item.url);
  const mediaKind = (item.media_kind ||
    inferProjectMediaKind(item.mime_type, item.file_name || item.url)) as ProjectMediaKind;

  return {
    id: `remote-${item.id}`,
    kind: "remote",
    remoteId: item.id,
    url: item.url,
    mediaKind,
    storagePath: item.storage_path,
    mimeType: item.mime_type,
    fileSize: item.file_size,
    aspectRatio: youTubeId ? 16 / 9 : DEFAULT_ASPECT_RATIO,
    youTubeId,
  };
}

export default function CreateProjectForm({
  project,
}: {
  project?: EditableProject | null;
}) {
  const router = useLocalizedRouter();
  const dictionary = useDictionary();
  const supabase = useMemo(() => createClient(), []);
  const isEditMode = Boolean(project);

  const [metaSkills, setMetaSkills] = useState<MetaOption[]>([]);
  const [skillIds, setSkillIds] = useState<number[]>(
    project?.technologies.map((technology) => technology.id) || [],
  );
  const [step, setStep] = useState<number>(1);
  const [pendingSaveMode, setPendingSaveMode] = useState<SaveMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(() =>
    getInitialFormState(project),
  );
  const [githubFullName, setGithubFullName] = useState<string | null>(
    project?.github_full_name || null,
  );

  const [mediaItems, setMediaItems] = useState<WizardMediaItem[]>(
    () => (project?.media || []).map(toRemoteMediaItem),
  );
  const [mediaWorking, setMediaWorking] = useState(false);
  const [isProjectOngoing, setIsProjectOngoing] = useState<boolean>(
    () => Boolean(project) && !project?.completed_on,
  );
  const [youTubeInput, setYouTubeInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const initialFormSnapshot = useMemo(
    () => JSON.stringify(getInitialFormState(project)),
    [project],
  );
  const initialSkillsSnapshot = useMemo(
    () =>
      JSON.stringify(
        [...(project?.technologies.map((t) => t.id) || [])].sort(),
      ),
    [project],
  );
  const initialRemoteMediaSnapshot = useMemo(
    () =>
      JSON.stringify((project?.media || []).map((item) => item.id)),
    [project],
  );

  const hasLocalOrYouTubeMedia = mediaItems.some(
    (item) => item.kind === "local" || item.kind === "youtube",
  );
  const currentRemoteMediaSnapshot = JSON.stringify(
    mediaItems
      .filter((item): item is RemoteMediaItem => item.kind === "remote")
      .map((item) => item.remoteId),
  );
  const isDirty =
    pendingSaveMode === null &&
    (JSON.stringify(form) !== initialFormSnapshot ||
      JSON.stringify([...skillIds].sort()) !== initialSkillsSnapshot ||
      currentRemoteMediaSnapshot !== initialRemoteMediaSnapshot ||
      hasLocalOrYouTubeMedia);

  const { isWarningOpen, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    const stored = objectUrlsRef.current;

    return () => {
      stored.forEach((url) => URL.revokeObjectURL(url));
      stored.clear();
    };
  }, []);

  useEffect(() => {
    async function loadMeta() {
      const result = await apiFetch<{ skills?: MetaOption[] }>("/api/meta");
      if (result.ok) {
        setMetaSkills(result.data.skills || []);
      }
    }

    loadMeta();
  }, []);

  const update = useCallback(
    <K extends keyof ProjectFormState>(field: K, value: ProjectFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const measureLocalAspectRatio = useCallback(
    async (file: File, mediaKind: ProjectMediaKind): Promise<number> => {
      const objectUrl = URL.createObjectURL(file);

      try {
        if (mediaKind === "image") {
          const aspect = await new Promise<number>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const ratio =
                img.naturalWidth && img.naturalHeight
                  ? img.naturalWidth / img.naturalHeight
                  : DEFAULT_ASPECT_RATIO;
              resolve(ratio);
            };
            img.onerror = () => resolve(DEFAULT_ASPECT_RATIO);
            img.src = objectUrl;
          });
          return aspect;
        }

        if (mediaKind === "video") {
          const aspect = await new Promise<number>((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => {
              const ratio =
                video.videoWidth && video.videoHeight
                  ? video.videoWidth / video.videoHeight
                  : DEFAULT_ASPECT_RATIO;
              resolve(ratio);
            };
            video.onerror = () => resolve(DEFAULT_ASPECT_RATIO);
            video.src = objectUrl;
          });
          return aspect;
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      return DEFAULT_ASPECT_RATIO;
    },
    [],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || mediaWorking) return;

      setErrorMessage(null);
      setSuccessMessage(null);
      setMediaWorking(true);

      const newItems: WizardMediaItem[] = [];

      try {
        for (const rawFile of files) {
          const initialKind = inferProjectMediaKind(rawFile.type, rawFile.name);

          if (initialKind !== "image" && initialKind !== "video") {
            setErrorMessage(dictionary.forms.mediaUnsupportedKind);
            continue;
          }

          const file =
            initialKind === "image"
              ? await compressImageFile(rawFile, "inline")
              : rawFile;
          const mediaKind = inferProjectMediaKind(file.type, file.name);

          if (mediaKind === "image" && file.size > MAX_IMAGE_BYTES) {
            setErrorMessage(dictionary.forms.mediaImageTooLarge);
            continue;
          }

          if (mediaKind === "video" && file.size > MAX_VIDEO_BYTES) {
            setErrorMessage(dictionary.forms.mediaVideoTooLarge);
            continue;
          }

          const previewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.add(previewUrl);
          const aspect = await measureLocalAspectRatio(file, mediaKind);

          newItems.push({
            id: `local-${crypto.randomUUID()}`,
            kind: "local",
            file,
            previewUrl,
            mediaKind,
            aspectRatio: aspect,
          });
        }

        if (newItems.length > 0) {
          setMediaItems((prev) => [...prev, ...newItems]);
        }
      } finally {
        setMediaWorking(false);
      }
    },
    [
      dictionary.forms.mediaUnsupportedKind,
      dictionary.forms.mediaImageTooLarge,
      dictionary.forms.mediaVideoTooLarge,
      measureLocalAspectRatio,
      mediaWorking,
    ],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";

      if (files.length > 0) {
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const handleFileDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files || []);

      if (files.length > 0) {
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const removeMediaItem = useCallback((itemId: string) => {
    setMediaItems((prev) => {
      const target = prev.find((item) => item.id === itemId);

      if (target?.kind === "local") {
        URL.revokeObjectURL(target.previewUrl);
        objectUrlsRef.current.delete(target.previewUrl);
      }

      return prev.filter((item) => item.id !== itemId);
    });
  }, []);

  const addYouTubeItem = useCallback(() => {
    const trimmed = youTubeInput.trim();
    if (!trimmed) return;

    const videoId = getYouTubeVideoId(trimmed);

    if (!videoId) {
      setErrorMessage(dictionary.forms.mediaYouTubeInvalid);
      return;
    }

    setMediaItems((prev) => {
      const exists = prev.some(
        (item) => item.kind === "youtube" && item.videoId === videoId,
      );
      if (exists) {
        return prev;
      }

      const next: YouTubeMediaItem = {
        id: `youtube-${crypto.randomUUID()}`,
        kind: "youtube",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        mediaKind: "video",
        aspectRatio: 16 / 9,
      };
      return [...prev, next];
    });

    setYouTubeInput("");
    setErrorMessage(null);
  }, [dictionary.forms.mediaYouTubeInvalid, youTubeInput]);

  const moveMediaItem = useCallback((fromIndex: number, toIndex: number) => {
    setMediaItems((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const reachedStep = useCallback(
    (target: number) => {
      if (target === 1) return true;

      const titleReady = form.title.trim().length > 0;

      if (target > 1 && !titleReady) {
        return false;
      }

      return true;
    },
    [form.title],
  );

  const goToStep = useCallback(
    (target: number) => {
      const dynamicTotal = githubFullName
        ? BASE_TOTAL_STEPS + 1
        : BASE_TOTAL_STEPS;
      const safe = Math.min(Math.max(target, 1), dynamicTotal);

      if (safe > step && !reachedStep(safe)) {
        setErrorMessage(dictionary.forms.mediaTitleRequired);
        return;
      }

      setErrorMessage(null);
      setSuccessMessage(null);
      setStep(safe);
    },
    [dictionary.forms.mediaTitleRequired, reachedStep, step, githubFullName],
  );

  const uploadLocalFile = useCallback(
    async (projectId: string, item: LocalMediaItem, sortIndex: number) => {
      const filePath = `${projectId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeStorageFileName(
        item.file.name,
      )}`;

      const { error: uploadError } = await supabase.storage
        .from("project-media")
        .upload(filePath, item.file, { contentType: item.file.type });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-media").getPublicUrl(filePath);

      const result = await apiFetch<{
        media?: ProjectMediaItem;
      }>("/project-media", {
        method: "POST",
        body: {
          projectId,
          url: publicUrl,
          storagePath: filePath,
          fileName: item.file.name,
          mimeType: item.file.type || null,
          fileSize: item.file.size,
          mediaKind: item.mediaKind,
          sortIndex,
        },
      });

      if (!result.ok || !result.data.media) {
        await supabase.storage.from("project-media").remove([filePath]);
        throw new Error(
          result.ok
            ? dictionary.dashboardProjects.uploadFailed
            : result.error || dictionary.dashboardProjects.uploadFailed,
        );
      }

      return result.data.media;
    },
    [dictionary.dashboardProjects.uploadFailed, supabase],
  );

  const uploadYouTubeItem = useCallback(
    async (
      projectId: string,
      item: YouTubeMediaItem,
      sortIndex: number,
    ): Promise<ProjectMediaItem> => {
      const result = await apiFetch<{
        media?: ProjectMediaItem;
      }>("/project-media", {
        method: "POST",
        body: {
          projectId,
          url: item.url,
          storagePath: null,
          fileName: null,
          mimeType: "video/youtube",
          fileSize: null,
          mediaKind: "video",
          sortIndex,
        },
      });

      if (!result.ok || !result.data.media) {
        throw new Error(
          result.ok
            ? dictionary.dashboardProjects.uploadFailed
            : result.error || dictionary.dashboardProjects.uploadFailed,
        );
      }

      return result.data.media;
    },
    [dictionary.dashboardProjects.uploadFailed],
  );

  const persistMediaOrder = useCallback(
    async (projectId: string, orderedRemoteIds: string[]) => {
      if (orderedRemoteIds.length === 0) return;

      await apiFetch("/project-media", {
        method: "PUT",
        body: { projectId, mediaIds: orderedRemoteIds },
      });
    },
    [],
  );

  const buildPayload = useCallback(
    (status: ProjectVisibilityStatus) => {
      const slug = slugify(form.title);

      return {
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
        githubFullName,
        githubRole: form.githubRole || null,
        githubContribution: form.githubContribution,
        githubMotivation: form.githubMotivation,
        githubTechDecisions: form.githubTechDecisions,
        githubLearnings: form.githubLearnings,
        githubShowcaseNotes: form.githubShowcaseNotes,
        githubProductionUsage: form.githubProductionUsage,
        githubDisplayOptions: form.githubDisplayOptions,
        githubAutoSync: form.githubAutoSync,
        status,
      };
    },
    [form, skillIds, githubFullName],
  );

  const applyGithubImport = useCallback(
    ({ repo }: GithubImportPayload) => {
      setGithubFullName(repo.fullName);

      const startedOn = repo.createdAt
        ? repo.createdAt.slice(0, 10)
        : "";
      const archivedStatus: ProjectStatus | "" = repo.isArchived
        ? "completed"
        : "";

      // README is intentionally NOT copied into `solution` — it lives
      // in its own `github_readme` column and renders as a collapsible
      // "Project README" card on the project page. Solution is for the
      // author's voice, set via the AI draft or manual edit.
      setForm((prev) => ({
        ...prev,
        title: prev.title || repo.name,
        description: prev.description || repo.description || "",
        projectUrl: prev.projectUrl || repo.homepage || "",
        repositoryUrl: prev.repositoryUrl || repo.htmlUrl,
        startedOn: prev.startedOn || startedOn,
        teamSize:
          prev.teamSize ||
          (repo.contributorsCount > 0
            ? String(repo.contributorsCount)
            : ""),
        projectStatus: prev.projectStatus || archivedStatus,
      }));

      // Merge GitHub topics into the technology tags (deduped, only if
      // the catalogue already contains a matching skill).
      if (repo.topics.length > 0 && metaSkills.length > 0) {
        const lookup = new Map(
          metaSkills.map((skill) => [skill.name.toLowerCase(), skill.id]),
        );
        const matched: number[] = [];
        for (const topic of repo.topics) {
          const id = lookup.get(topic.toLowerCase());
          if (id) matched.push(id);
        }
        if (matched.length > 0) {
          setSkillIds((prev) =>
            Array.from(new Set([...prev, ...matched])),
          );
        }
      }

      setSuccessMessage(dictionary.githubIntegration.importApplied);
      setErrorMessage(null);
    },
    [dictionary.githubIntegration.importApplied, metaSkills],
  );

  const updateGithubDisplayOption = useCallback(
    <K extends keyof GithubDisplayOptions>(
      key: K,
      value: GithubDisplayOptions[K],
    ) => {
      setForm((prev) => ({
        ...prev,
        githubDisplayOptions: {
          ...prev.githubDisplayOptions,
          [key]: value,
        },
      }));
    },
    [],
  );

  const handleGithubUnlink = useCallback(() => {
    setGithubFullName(null);
    setForm((prev) => ({
      ...prev,
      githubRole: "",
      githubContribution: "",
      githubMotivation: "",
      githubTechDecisions: "",
      githubLearnings: "",
      githubShowcaseNotes: "",
      githubProductionUsage: "",
      githubAutoSync: false,
      githubDisplayOptions: { ...DEFAULT_GITHUB_DISPLAY_OPTIONS },
    }));
    // Move user away from the now-gone "GitHub" step.
    setStep(1);
    setSuccessMessage(dictionary.githubIntegration.unlinkedMessage);
    setErrorMessage(null);
  }, [dictionary.githubIntegration.unlinkedMessage]);

  const handleSave = useCallback(
    async (mode: SaveMode) => {
      if (pendingSaveMode) return;

      if (!form.title.trim()) {
        setErrorMessage(dictionary.forms.mediaTitleRequired);
        setStep(1);
        return;
      }

      if (
        form.startedOn &&
        form.completedOn &&
        form.completedOn < form.startedOn
      ) {
        setErrorMessage(dictionary.forms.invalidProjectDateRange);
        setStep(2);
        return;
      }

      const status: ProjectVisibilityStatus =
        mode === "draft" ? "draft" : "published";
      const payload = buildPayload(status);

      const parsedPayload = projectPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        setErrorMessage(
          parsedPayload.error.issues[0]?.message ||
            dictionary.forms.errorCreatingProject,
        );
        return;
      }

      setPendingSaveMode(mode);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const endpoint = isEditMode
          ? `/api/projects/${project?.id}`
          : "/api/projects";
        const method = isEditMode ? "PATCH" : "POST";
        const projectResult = await apiFetch<{
          projectId?: string;
          slug?: string;
        }>(endpoint, {
          method,
          body: parsedPayload.data,
        });

        if (!projectResult.ok) {
          setErrorMessage(
            projectResult.error ||
              (isEditMode
                ? dictionary.forms.errorUpdatingProject
                : dictionary.forms.errorCreatingProject),
          );
          return;
        }

        const projectId =
          projectResult.data.projectId || project?.id || "";
        const projectSlug = projectResult.data.slug || parsedPayload.data.slug;

        if (!projectId) {
          setErrorMessage(dictionary.forms.errorCreatingProject);
          return;
        }

        const orderedRemoteIds: string[] = [];

        for (let index = 0; index < mediaItems.length; index += 1) {
          const item = mediaItems[index];

          if (item.kind === "local") {
            try {
              const uploaded = await uploadLocalFile(projectId, item, index);
              orderedRemoteIds.push(uploaded.id);
            } catch (error) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : dictionary.dashboardProjects.uploadFailed,
              );
              return;
            }
          } else if (item.kind === "youtube") {
            try {
              const uploaded = await uploadYouTubeItem(projectId, item, index);
              orderedRemoteIds.push(uploaded.id);
            } catch (error) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : dictionary.dashboardProjects.uploadFailed,
              );
              return;
            }
          } else {
            orderedRemoteIds.push(item.remoteId);
          }
        }

        if (isEditMode && orderedRemoteIds.length > 0) {
          await persistMediaOrder(projectId, orderedRemoteIds);
        }

        setSuccessMessage(
          mode === "draft"
            ? dictionary.forms.projectSavedAsDraft
            : dictionary.forms.projectPublished,
        );

        startTransition(() => {
          router.refresh();
        });

        const targetPath = buildProjectPath(projectId, projectSlug);

        if (mode === "publish") {
          router.push(targetPath);
        } else if (isEditMode) {
          router.push(targetPath);
        } else {
          router.push(`/projects/edit/${projectId}`);
        }
      } finally {
        setPendingSaveMode(null);
      }
    },
    [
      buildPayload,
      dictionary.dashboardProjects.uploadFailed,
      dictionary.forms.errorCreatingProject,
      dictionary.forms.errorUpdatingProject,
      dictionary.forms.invalidProjectDateRange,
      dictionary.forms.mediaTitleRequired,
      dictionary.forms.projectPublished,
      dictionary.forms.projectSavedAsDraft,
      form.completedOn,
      form.startedOn,
      form.title,
      isEditMode,
      mediaItems,
      pendingSaveMode,
      persistMediaOrder,
      project?.id,
      router,
      uploadLocalFile,
      uploadYouTubeItem,
    ],
  );

  // The "GitHub details" step is inserted between Basics and Details
  // only when the project is linked to a GitHub repository. This keeps
  // the wizard 4 steps for manual projects and 5 for imported ones.
  const hasGithubStep = Boolean(githubFullName);

  const stepDescriptors = useMemo(() => {
    const descriptors: Array<{
      key: string;
      title: string;
      description: string;
    }> = [
      {
        key: "basics",
        title: dictionary.forms.stepBasicsTitle,
        description: dictionary.forms.stepBasicsDescription,
      },
    ];
    if (hasGithubStep) {
      descriptors.push({
        key: "github",
        title: dictionary.forms.stepGithubTitle,
        description: dictionary.forms.stepGithubDescription,
      });
    }
    descriptors.push(
      {
        key: "details",
        title: dictionary.forms.stepDetailsTitle,
        description: dictionary.forms.stepDetailsDescription,
      },
      {
        key: "story",
        title: dictionary.forms.stepStoryTitle,
        description: dictionary.forms.stepStoryDescription,
      },
      {
        key: "media",
        title: dictionary.forms.stepMediaTitle,
        description: dictionary.forms.stepMediaDescription,
      },
    );
    return descriptors.map((entry, idx) => ({ ...entry, index: idx + 1 }));
  }, [dictionary.forms, hasGithubStep]);

  const totalSteps = stepDescriptors.length;
  const currentDescriptor = stepDescriptors[step - 1];
  const currentStepKey = currentDescriptor?.key;
  const submitting = pendingSaveMode !== null;
  const isLastStep = step === totalSteps;
  const draftLabel =
    pendingSaveMode === "draft"
      ? dictionary.forms.savingDraft
      : dictionary.forms.saveDraft;
  const publishLabel = isEditMode
    ? pendingSaveMode === "publish"
      ? dictionary.forms.updatingProject
      : dictionary.forms.updateProject
    : pendingSaveMode === "publish"
      ? dictionary.forms.publishing
      : dictionary.forms.publishProject;

  return (
    <div className="space-y-6">
      <StepHeader
        descriptors={stepDescriptors}
        current={step}
        onSelect={goToStep}
        dictionary={dictionary}
      />

      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
          {currentDescriptor.title}
        </h2>
        <p className="text-sm app-muted">{currentDescriptor.description}</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isLastStep) {
            void handleSave("publish");
          } else {
            goToStep(step + 1);
          }
        }}
        className="space-y-6"
      >
        {currentStepKey === "basics" && (
          <StepBasics
            dictionary={dictionary}
            form={form}
            update={update}
            metaSkills={metaSkills}
            skillIds={skillIds}
            onSkillsChange={setSkillIds}
            onGithubImport={isEditMode ? undefined : applyGithubImport}
          />
        )}

        {currentStepKey === "github" && githubFullName && (
          <StepGithub
            dictionary={dictionary}
            form={form}
            update={update}
            updateDisplayOption={updateGithubDisplayOption}
            githubFullName={githubFullName}
            projectId={project?.id || null}
            onUnlinked={handleGithubUnlink}
          />
        )}

        {currentStepKey === "details" && (
          <StepDetails
            dictionary={dictionary}
            form={form}
            update={update}
            isOngoing={isProjectOngoing}
            onOngoingChange={setIsProjectOngoing}
          />
        )}

        {currentStepKey === "story" && (
          <StepStory dictionary={dictionary} form={form} update={update} />
        )}

        {currentStepKey === "media" && (
          <StepMedia
            dictionary={dictionary}
            mediaItems={mediaItems}
            onPickFiles={() => fileInputRef.current?.click()}
            onDropFiles={handleFileDrop}
            onRemove={removeMediaItem}
            onMove={moveMediaItem}
            working={mediaWorking}
            youTubeInput={youTubeInput}
            onYouTubeInputChange={setYouTubeInput}
            onAddYouTube={addYouTubeItem}
          />
        )}

        {errorMessage && (
          <div
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-500"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {!errorMessage && successMessage && (
          <div
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-dashed app-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => goToStep(step - 1)}
              disabled={step === 1 || submitting}
            >
              {dictionary.forms.stepBack}
            </Button>
            {!isLastStep && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => goToStep(step + 1)}
                disabled={submitting}
              >
                {dictionary.forms.stepNext}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleSave("draft")}
              disabled={submitting}
            >
              {draftLabel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {isLastStep ? publishLabel : dictionary.forms.stepNext}
            </Button>
          </div>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="sr-only"
        aria-label={dictionary.forms.mediaBrowseFiles}
      />

      <ConfirmDialog
        open={isWarningOpen}
        title={dictionary.common.unsavedChangesTitle}
        description={dictionary.common.unsavedChangesDescription}
        confirmLabel={dictionary.common.unsavedChangesLeave}
        cancelLabel={dictionary.common.unsavedChangesStay}
        confirmVariant="primary"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}

type StepDescriptor = {
  index: number;
  title: string;
  description: string;
  key?: string;
};

function StepHeader({
  descriptors,
  current,
  onSelect,
  dictionary,
}: {
  descriptors: StepDescriptor[];
  current: number;
  onSelect: (target: number) => void;
  dictionary: Dictionary;
}) {
  const total = descriptors.length;
  return (
    <ol
      aria-label={dictionary.forms.stepLabel}
      className={`grid gap-3 ${
        total >= 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"
      }`}
    >
      {descriptors.map((descriptor) => {
        const isActive = current === descriptor.index;
        const isCompleted = current > descriptor.index;
        const isClickable = descriptor.index <= current || isCompleted;

        return (
          <li key={descriptor.index} className="contents">
            <button
              type="button"
              onClick={() => onSelect(descriptor.index)}
              disabled={!isClickable}
              className={`group flex w-full flex-col gap-1 rounded-2xl border p-3 text-left transition ${
                isActive
                  ? "border-[color:var(--accent)] bg-[color:var(--surface)] shadow-sm"
                  : isCompleted
                    ? "app-border bg-[color:var(--surface-muted)]"
                    : "app-border bg-transparent"
              } ${
                isClickable ? "cursor-pointer hover:bg-[color:var(--surface-muted)]" : "cursor-not-allowed opacity-60"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {dictionary.forms.stepLabel} {descriptor.index} / {total}
              </span>
              <span className="text-sm font-semibold text-[color:var(--foreground)]">
                {descriptor.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepBasics({
  dictionary,
  form,
  update,
  metaSkills,
  skillIds,
  onSkillsChange,
  onGithubImport,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  metaSkills: MetaOption[];
  skillIds: number[];
  onSkillsChange: (next: number[]) => void;
  onGithubImport?: (payload: GithubImportPayload) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {onGithubImport ? (
        <div className="md:col-span-2">
          <GithubRepoImporter onImport={onGithubImport} />
        </div>
      ) : null}
      <Field
        label={dictionary.forms.projectTitle}
        htmlFor="project-title"
        className="md:col-span-2"
      >
        <input
          id="project-title"
          type="text"
          placeholder={dictionary.forms.projectTitlePlaceholder}
          className="app-input"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />
      </Field>

      <Field
        label={dictionary.forms.description}
        htmlFor="project-description"
        className="md:col-span-2"
      >
        <FormTextarea
          id="project-description"
          placeholder={dictionary.forms.projectDescriptionPlaceholder}
          className="min-h-32 p-4 text-[color:var(--foreground)]"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.projectRole} htmlFor="project-role">
        <input
          id="project-role"
          type="text"
          placeholder={dictionary.forms.projectRolePlaceholder}
          className="app-input"
          value={form.role}
          onChange={(e) => update("role", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.technologies}>
        <TagSelect
          options={metaSkills}
          value={skillIds}
          placeholder={dictionary.forms.searchProjectTechnologies}
          onChange={(values) => onSkillsChange(values.map(Number))}
        />
      </Field>
    </div>
  );
}

function StepGithub({
  dictionary,
  form,
  update,
  updateDisplayOption,
  githubFullName,
  projectId,
  onUnlinked,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  updateDisplayOption: <K extends keyof GithubDisplayOptions>(
    key: K,
    value: GithubDisplayOptions[K],
  ) => void;
  githubFullName: string;
  projectId: string | null;
  onUnlinked: () => void;
}) {
  const dict = dictionary.githubIntegration;
  const aiDict = dictionary.aiDraft;
  const router = useLocalizedRouter();
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<
    | { kind: "ok"; appliedCount: number }
    | { kind: "info"; reason: "all_filled" }
    | { kind: "error"; message: string }
    | null
  >(null);

  const roleOptions = useMemo(
    () =>
      GITHUB_PROJECT_ROLES.map((role) => ({
        value: role,
        label: dict.roles[role],
      })),
    [dict.roles],
  );

  const generateAiDraft = async () => {
    setAiGenerating(true);
    setAiMessage(null);

    const result = await apiFetch<{
      draft: {
        role: GithubProjectRole | null;
        contribution: string;
        motivation: string;
        techDecisions: string;
        learnings: string;
        showcaseNotes: string;
        productionUsage: string;
        projectRole: string;
        problem: string;
        solution: string;
        results: string;
      };
    }>("/api/ai/github-draft", {
      method: "POST",
      body: {
        fullName: githubFullName,
        locale: router.locale,
        existing: {
          role: form.githubRole || null,
          contribution: form.githubContribution,
          motivation: form.githubMotivation,
          techDecisions: form.githubTechDecisions,
          learnings: form.githubLearnings,
          showcaseNotes: form.githubShowcaseNotes,
          productionUsage: form.githubProductionUsage,
          projectRole: form.role,
          problem: form.problem,
          solution: form.solution,
          results: form.results,
        },
      },
    });

    setAiGenerating(false);

    if (!result.ok) {
      setAiMessage({
        kind: "error",
        message: result.error || aiDict.error,
      });
      return;
    }

    const draft = result.data.draft;

    // Apply only to empty fields — never overwrite the user's text.
    let applied = 0;
    if (!form.githubRole && draft.role) {
      update("githubRole", draft.role);
      applied += 1;
    }
    const setIfEmpty = <K extends keyof ProjectFormState>(
      field: K,
      value: string,
    ) => {
      if (typeof form[field] === "string" && (form[field] as string).trim().length === 0 && value.trim().length > 0) {
        update(field, value as ProjectFormState[K]);
        applied += 1;
      }
    };
    setIfEmpty("githubContribution", draft.contribution);
    setIfEmpty("githubMotivation", draft.motivation);
    setIfEmpty("githubTechDecisions", draft.techDecisions);
    setIfEmpty("githubLearnings", draft.learnings);
    setIfEmpty("githubShowcaseNotes", draft.showcaseNotes);
    setIfEmpty("githubProductionUsage", draft.productionUsage);
    // Standard project narrative fields (Steps 1 + 3).
    setIfEmpty("role", draft.projectRole);
    setIfEmpty("problem", draft.problem);
    setIfEmpty("solution", draft.solution);
    setIfEmpty("results", draft.results);

    setAiMessage(
      applied === 0
        ? { kind: "info", reason: "all_filled" }
        : { kind: "ok", appliedCount: applied },
    );
  };

  const requestUnlink = () => {
    setUnlinkError(null);
    setConfirmingUnlink(true);
  };

  const cancelUnlink = () => {
    setConfirmingUnlink(false);
  };

  const performUnlink = async () => {
    setUnlinking(true);
    setUnlinkError(null);

    if (projectId) {
      const result = await apiFetch(
        `/api/projects/${projectId}/unlink-github`,
        { method: "POST" },
      );
      if (!result.ok) {
        setUnlinking(false);
        setUnlinkError(result.error || dict.unlinkError);
        return;
      }
    }

    setUnlinking(false);
    setConfirmingUnlink(false);
    onUnlinked();
  };

  const togglesGroup: Array<{
    key: keyof GithubDisplayOptions;
    label: string;
  }> = [
    { key: "showStats", label: dict.toggleStats },
    { key: "showLanguages", label: dict.toggleLanguages },
    { key: "showTopics", label: dict.toggleTopics },
    { key: "showRelease", label: dict.toggleRelease },
    { key: "showLicense", label: dict.toggleLicense },
    { key: "showContributors", label: dict.toggleContributors },
    { key: "showActivity", label: dict.toggleActivity },
    { key: "showReadme", label: dict.toggleReadme },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border app-border bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dict.linkedHeader}
            </p>
            <a
              href={`https://github.com/${githubFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block break-all text-sm font-semibold text-[color:var(--foreground)] hover:underline"
            >
              {githubFullName}
            </a>
          </div>
          {!confirmingUnlink ? (
            <button
              type="button"
              onClick={requestUnlink}
              className="cursor-pointer rounded-full app-panel px-3 py-1.5 text-xs font-medium app-soft transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
            >
              {dict.unlink}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void performUnlink()}
                disabled={unlinking}
                className="cursor-pointer rounded-full bg-rose-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
              >
                {unlinking ? dict.unlinking : dict.confirmUnlink}
              </button>
              <button
                type="button"
                onClick={cancelUnlink}
                disabled={unlinking}
                className="cursor-pointer rounded-full app-panel px-3 py-1.5 text-xs font-medium app-soft transition-colors hover:bg-[color:var(--surface)]"
              >
                {dict.cancel}
              </button>
            </div>
          )}
        </div>
        {confirmingUnlink ? (
          <p className="mt-2 text-xs app-muted">{dict.unlinkConfirm}</p>
        ) : null}
        {unlinkError ? (
          <p role="alert" className="mt-2 text-xs text-rose-500">
            {unlinkError}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed app-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              ✨ {aiDict.title}
            </p>
            <p className="mt-0.5 text-xs app-muted">{aiDict.description}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void generateAiDraft()}
            disabled={aiGenerating}
          >
            {aiGenerating ? aiDict.generating : aiDict.button}
          </Button>
        </div>

        {aiMessage?.kind === "error" ? (
          <p role="alert" className="mt-2 text-xs text-rose-500">
            {aiMessage.message}
          </p>
        ) : null}
        {aiMessage?.kind === "ok" ? (
          <p role="status" className="mt-2 text-xs text-emerald-600">
            {aiDict.applied.replace("{count}", String(aiMessage.appliedCount))}
          </p>
        ) : null}
        {aiMessage?.kind === "info" ? (
          <p role="status" className="mt-2 text-xs app-muted">
            {aiDict.allFilled}
          </p>
        ) : null}
      </div>

      <Field label={dict.roleLabel}>
        <FormSelect
          value={form.githubRole || ""}
          onChange={(value) =>
            update("githubRole", value as ProjectFormState["githubRole"])
          }
          placeholder={dict.rolePlaceholder}
          options={roleOptions}
        />
      </Field>

      <Field
        label={dict.contributionLabel}
        htmlFor="github-contribution"
        description={dict.contributionHint}
      >
        <FormTextarea
          id="github-contribution"
          value={form.githubContribution}
          onChange={(event) =>
            update("githubContribution", event.target.value)
          }
          placeholder={dict.contributionPlaceholder}
          className="min-h-28 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.contribution}
        />
      </Field>

      <Field
        label={dict.motivationLabel}
        htmlFor="github-motivation"
        description={dict.motivationHint}
      >
        <FormTextarea
          id="github-motivation"
          value={form.githubMotivation}
          onChange={(event) => update("githubMotivation", event.target.value)}
          placeholder={dict.motivationPlaceholder}
          className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.motivation}
        />
      </Field>

      <Field
        label={dict.techDecisionsLabel}
        htmlFor="github-tech-decisions"
        description={dict.techDecisionsHint}
      >
        <FormTextarea
          id="github-tech-decisions"
          value={form.githubTechDecisions}
          onChange={(event) =>
            update("githubTechDecisions", event.target.value)
          }
          placeholder={dict.techDecisionsPlaceholder}
          className="min-h-28 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.techDecisions}
        />
      </Field>

      <Field
        label={dict.learningsLabel}
        htmlFor="github-learnings"
        description={dict.learningsHint}
      >
        <FormTextarea
          id="github-learnings"
          value={form.githubLearnings}
          onChange={(event) => update("githubLearnings", event.target.value)}
          placeholder={dict.learningsPlaceholder}
          className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.learnings}
        />
      </Field>

      <Field
        label={dict.showcaseLabel}
        htmlFor="github-showcase"
        description={dict.showcaseHint}
      >
        <FormTextarea
          id="github-showcase"
          value={form.githubShowcaseNotes}
          onChange={(event) =>
            update("githubShowcaseNotes", event.target.value)
          }
          placeholder={dict.showcasePlaceholder}
          className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.showcaseNotes}
        />
      </Field>

      <Field
        label={dict.productionUsageLabel}
        htmlFor="github-production-usage"
        description={dict.productionUsageHint}
      >
        <FormTextarea
          id="github-production-usage"
          value={form.githubProductionUsage}
          onChange={(event) =>
            update("githubProductionUsage", event.target.value)
          }
          placeholder={dict.productionUsagePlaceholder}
          className="min-h-20 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.productionUsage}
        />
      </Field>

      <fieldset className="rounded-2xl border app-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {dict.displayPreferences}
        </legend>
        <p className="mt-1 mb-3 text-xs app-muted">
          {dict.displayPreferencesHint}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {togglesGroup.map((toggle) => (
            <label
              key={toggle.key}
              className="flex cursor-pointer items-center gap-2 rounded-xl p-2 hover:bg-[color:var(--surface-muted)]"
            >
              <input
                type="checkbox"
                checked={form.githubDisplayOptions[toggle.key]}
                onChange={(event) =>
                  updateDisplayOption(toggle.key, event.target.checked)
                }
                className="h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
              />
              <span className="text-sm text-[color:var(--foreground)]">
                {toggle.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border app-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {dict.syncPreferences}
        </legend>
        <label className="mt-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.githubAutoSync}
            onChange={(event) => update("githubAutoSync", event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
          />
          <span className="text-sm text-[color:var(--foreground)]">
            {dict.autoSyncLabel}
          </span>
        </label>
        <p className="mt-1 ml-6 text-xs app-muted">{dict.autoSyncHint}</p>
      </fieldset>
    </div>
  );
}

function StepDetails({
  dictionary,
  form,
  update,
  isOngoing,
  onOngoingChange,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  isOngoing: boolean;
  onOngoingChange: (next: boolean) => void;
}) {
  const handleOngoingToggle = (checked: boolean) => {
    onOngoingChange(checked);
    if (checked) {
      update("completedOn", "");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label={dictionary.forms.projectStatus}
        htmlFor="project-status"
      >
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
      </Field>

      <Field label={dictionary.forms.teamSize} htmlFor="project-team-size">
        <input
          id="project-team-size"
          type="number"
          min="1"
          placeholder={dictionary.forms.teamSizePlaceholder}
          className="app-input"
          value={form.teamSize}
          onChange={(e) => update("teamSize", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.startedOn} htmlFor="project-started-on">
        <input
          id="project-started-on"
          type="date"
          title={dictionary.forms.startedOn}
          className="app-input"
          value={form.startedOn}
          onChange={(e) => update("startedOn", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.completedOn} htmlFor="project-completed-on">
        <input
          id="project-completed-on"
          type="date"
          title={dictionary.forms.completedOn}
          className="app-input disabled:cursor-not-allowed disabled:opacity-60"
          value={isOngoing ? "" : form.completedOn}
          onChange={(e) => update("completedOn", e.target.value)}
          disabled={isOngoing}
        />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm app-muted">
          <input
            type="checkbox"
            checked={isOngoing}
            onChange={(e) => handleOngoingToggle(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border app-border accent-[color:var(--accent)]"
          />
          {dictionary.forms.projectStillOngoing}
        </label>
      </Field>

      <Field label={dictionary.forms.projectUrl} htmlFor="project-url">
        <input
          id="project-url"
          type="url"
          placeholder={dictionary.forms.projectUrlPlaceholder}
          className="app-input"
          value={form.projectUrl}
          onChange={(e) => update("projectUrl", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.repositoryUrl} htmlFor="project-repo-url">
        <input
          id="project-repo-url"
          type="url"
          placeholder={dictionary.forms.repositoryUrlPlaceholder}
          className="app-input"
          value={form.repositoryUrl}
          onChange={(e) => update("repositoryUrl", e.target.value)}
        />
      </Field>
    </div>
  );
}

function StepStory({
  dictionary,
  form,
  update,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
}) {
  return (
    <div className="grid gap-4">
      <Field label={dictionary.forms.problem} htmlFor="project-problem">
        <FormTextarea
          id="project-problem"
          placeholder={dictionary.forms.problemPlaceholder}
          className="min-h-28 p-4 text-[color:var(--foreground)]"
          value={form.problem}
          onChange={(e) => update("problem", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.solution} htmlFor="project-solution">
        <FormTextarea
          id="project-solution"
          placeholder={dictionary.forms.solutionPlaceholder}
          className="min-h-28 p-4 text-[color:var(--foreground)]"
          value={form.solution}
          onChange={(e) => update("solution", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.results} htmlFor="project-results">
        <FormTextarea
          id="project-results"
          placeholder={dictionary.forms.resultsPlaceholder}
          className="min-h-28 p-4 text-[color:var(--foreground)]"
          value={form.results}
          onChange={(e) => update("results", e.target.value)}
        />
      </Field>
    </div>
  );
}

function StepMedia({
  dictionary,
  mediaItems,
  onPickFiles,
  onDropFiles,
  onRemove,
  onMove,
  working,
  youTubeInput,
  onYouTubeInputChange,
  onAddYouTube,
}: {
  dictionary: Dictionary;
  mediaItems: WizardMediaItem[];
  onPickFiles: () => void;
  onDropFiles: (event: DragEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  working: boolean;
  youTubeInput: string;
  onYouTubeInputChange: (value: string) => void;
  onAddYouTube: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDropFiles}
        className="rounded-3xl border border-dashed app-border bg-[color:var(--surface)] p-6 text-center"
      >
        <p className="text-sm font-medium text-[color:var(--foreground)]">
          {dictionary.forms.mediaDropHint}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onPickFiles}
            disabled={working}
          >
            {mediaItems.length === 0
              ? dictionary.forms.mediaBrowseFiles
              : dictionary.forms.mediaUploadAnother}
          </Button>
        </div>
        <p className="mt-3 text-xs app-soft">
          {dictionary.forms.mediaImageLimit} {dictionary.forms.mediaVideoLimit}
        </p>
      </div>

      <div className="rounded-3xl border app-border bg-[color:var(--surface)] p-4">
        <label
          htmlFor="project-youtube-url"
          className="block text-sm font-medium text-[color:var(--foreground)]"
        >
          {dictionary.forms.mediaYouTubeLabel}
        </label>
        <p className="mt-1 text-xs app-soft">
          {dictionary.forms.mediaYouTubeHint}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="project-youtube-url"
            type="url"
            inputMode="url"
            placeholder={dictionary.forms.mediaYouTubePlaceholder}
            className="app-input flex-1"
            value={youTubeInput}
            onChange={(event) => onYouTubeInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddYouTube();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onAddYouTube}
            disabled={!youTubeInput.trim()}
          >
            {dictionary.forms.mediaYouTubeAdd}
          </Button>
        </div>
      </div>

      {mediaItems.length === 0 ? (
        <div className="rounded-3xl app-panel-dashed p-6 text-sm app-muted">
          {dictionary.forms.mediaEmptyState}
        </div>
      ) : (
        <>
          <p className="text-xs app-soft">
            {dictionary.forms.mediaReorderHint}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {mediaItems.map((item, index) => {
              const isDragging = dragIndex === index;
              const isOver = overIndex === index && dragIndex !== index;
              const isYouTube = item.kind === "youtube";
              const previewUrl =
                item.kind === "local" ? item.previewUrl : item.url;
              const ratio = Math.min(Math.max(item.aspectRatio, 0.4), 3);

              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOverIndex(index);
                  }}
                  onDragLeave={() => {
                    setOverIndex((current) =>
                      current === index ? null : current,
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) {
                      onMove(dragIndex, index);
                    }
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={`group relative cursor-move overflow-hidden rounded-3xl border app-border bg-[color:var(--surface)] transition ${
                    isDragging ? "opacity-50" : ""
                  } ${
                    isOver
                      ? "ring-2 ring-[color:var(--accent)] ring-offset-2 ring-offset-[color:var(--background)]"
                      : ""
                  }`}
                >
                  <div
                    className="relative flex w-full items-center justify-center bg-[color:var(--surface-muted)]"
                    style={{ aspectRatio: ratio }}
                  >
                    {index === 0 && item.mediaKind === "image" && (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                        {dictionary.dashboardProjects.previewBadge}
                      </span>
                    )}

                    {isYouTube ? (
                      <iframe
                        src={buildYouTubeEmbedUrl(item.videoId)}
                        title="YouTube preview"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 h-full w-full"
                      />
                    ) : item.mediaKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        controls
                        preload="metadata"
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="text-xs uppercase tracking-eyebrow app-soft">
                      {dictionary.forms.stepLabel} {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        ariaLabel={dictionary.forms.stepBack}
                        onClick={() => onMove(index, Math.max(0, index - 1))}
                        disabled={index === 0}
                      >
                        <span aria-hidden>↑</span>
                      </IconButton>
                      <IconButton
                        ariaLabel={dictionary.forms.stepNext}
                        onClick={() =>
                          onMove(
                            index,
                            Math.min(mediaItems.length - 1, index + 1),
                          )
                        }
                        disabled={index === mediaItems.length - 1}
                      >
                        <span aria-hidden>↓</span>
                      </IconButton>
                      <IconButton
                        ariaLabel={dictionary.forms.mediaRemove}
                        onClick={() => onRemove(item.id)}
                      >
                        <span aria-hidden>✕</span>
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  htmlFor,
  className,
  description,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  description?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
      >
        {label}
      </label>
      {description ? (
        <p className="-mt-1 mb-2 text-xs app-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
