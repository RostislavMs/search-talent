import { createClient } from "@/lib/supabase/server";
import {
  normalizeProjectMediaItem,
  type ProjectMediaItem,
} from "@/lib/project-media";

type GetMyProjectsPageOptions = {
  page: number;
  perPage: number;
};

async function attachTechnologies<T extends { id: string }>(
  projects: T[],
): Promise<Array<T & { technologies: { id: number; name: string }[] }>> {
  const supabase = await createClient();

  if (projects.length === 0) {
    return [];
  }

  const { data: projectSkills } = await supabase
    .from("project_skills")
    .select(
      `
      project_id,
      skill_id,
      skills (
        name
      )
    `,
    )
    .in(
      "project_id",
      projects.map((project) => project.id),
    );

  const technologiesMap = new Map<string, { id: number; name: string }[]>();

  for (const relation of projectSkills || []) {
    const existingItems = technologiesMap.get(relation.project_id) || [];
    const relatedSkill = Array.isArray(relation.skills)
      ? relation.skills[0]
      : relation.skills;

    if (!relatedSkill?.name) {
      continue;
    }

    existingItems.push({
      id: relation.skill_id,
      name: relatedSkill.name,
    });
    technologiesMap.set(relation.project_id, existingItems);
  }

  return projects.map((project) => ({
    ...project,
    technologies: technologiesMap.get(project.id) || [],
  }));
}

async function attachMedia<T extends { id: string }>(
  projects: T[],
): Promise<Array<T & { media: ProjectMediaItem[] }>> {
  const supabase = await createClient();

  if (projects.length === 0) {
    return [];
  }

  const { data: mediaItems } = await supabase
    .from("project_media")
    .select(
      "id, project_id, owner_id, url, storage_path, file_name, mime_type, file_size, media_kind, sort_index, created_at",
    )
    .in(
      "project_id",
      projects.map((project) => project.id),
    )
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });

  const mediaMap = new Map<string, ProjectMediaItem[]>();

  for (const item of mediaItems || []) {
    const existingItems = mediaMap.get(item.project_id) || [];
    existingItems.push(normalizeProjectMediaItem(item));
    mediaMap.set(item.project_id, existingItems);
  }

  return projects.map((project) => ({
    ...project,
    media: mediaMap.get(project.id) || [],
  }));
}

export async function getMyProjects() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const withTechnologies = await attachTechnologies(data || []);
  return attachMedia(withTechnologies);
}

export async function getMyProjectsPage({
  page,
  perPage,
}: GetMyProjectsPageOptions) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      projects: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
    };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.max(1, Math.floor(perPage));
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;

  const initialResponse = await supabase
    .from("projects")
    .select(
      "id, title, slug, cover_url, is_pinned, created_at, moderation_status, status",
      { count: "exact" },
    )
    .eq("owner_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalCount = initialResponse.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePerPage));
  const effectivePage = Math.min(safePage, totalPages);

  if (effectivePage !== safePage) {
    const adjustedFrom = (effectivePage - 1) * safePerPage;
    const adjustedTo = adjustedFrom + safePerPage - 1;

    const adjustedResponse = await supabase
      .from("projects")
      .select(
        "id, title, slug, cover_url, is_pinned, created_at, moderation_status, status",
        { count: "exact" },
      )
      .eq("owner_id", user.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(adjustedFrom, adjustedTo);

    return {
      projects: adjustedResponse.data || [],
      totalCount,
      currentPage: effectivePage,
      totalPages,
    };
  }

  return {
    projects: initialResponse.data || [],
    totalCount,
    currentPage: effectivePage,
    totalPages,
  };
}

export async function getMyProjectById(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return null;
  }

  const [withTechnologies] = await attachTechnologies([project]);
  if (!withTechnologies) {
    return null;
  }

  const [result] = await attachMedia([withTechnologies]);
  return result || null;
}
