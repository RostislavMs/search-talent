export const projectStatuses = [
  "planning",
  "in_progress",
  "completed",
  "on_hold",
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const projectVisibilityStatuses = ["draft", "published"] as const;

export type ProjectVisibilityStatus = (typeof projectVisibilityStatuses)[number];

export function normalizeProjectVisibilityStatus(
  value: unknown,
): ProjectVisibilityStatus {
  return typeof value === "string" &&
    projectVisibilityStatuses.includes(value as ProjectVisibilityStatus)
    ? (value as ProjectVisibilityStatus)
    : "published";
}

const transliterationMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "yi",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "yu",
  я: "ya",
  ё: "yo",
  ы: "y",
  э: "e",
  ъ: "",
};

function transliterate(value: string) {
  return value
    .split("")
    .map((character) => {
      const lowerCharacter = character.toLowerCase();
      return transliterationMap[lowerCharacter] ?? character;
    })
    .join("");
}

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function cleanDate(value: unknown) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function cleanSkillIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(Number).filter((item) => Number.isInteger(item) && item > 0))];
}

export function slugify(text: string) {
  return transliterate(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-");
}

const projectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const projectRoutePattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:-(.+))?$/i;

export function buildProjectPath(projectId: string, slug?: string | null) {
  return `/projects/${projectId}${slug ? `-${slug}` : ""}`;
}

export function parseProjectPath(value: string) {
  const routeMatch = value.match(projectRoutePattern);

  const candidateId = routeMatch?.[1];
  const candidateSlug = routeMatch?.[2];

  if (candidateId && projectIdPattern.test(candidateId)) {
    return {
      id: candidateId,
      slug: candidateSlug || null,
    };
  }

  return {
    id: null,
    slug: value,
  };
}

export async function generateUniqueProjectSlug(
  supabase: unknown,
  source: string,
  excludeProjectId?: string,
) {
  const baseSlug = slugify(source) || "project";
  const slugClient = supabase as {
    from: (...args: unknown[]) => {
      select: (...args: unknown[]) => {
        ilike: (...args: unknown[]) => Promise<{ data: Array<{ slug: string | null }> | null }> & {
          neq: (...args: unknown[]) => Promise<{ data: Array<{ slug: string | null }> | null }>;
        };
      };
    };
  };
  const query = slugClient.from("projects").select("slug").ilike("slug", `${baseSlug}%`) as {
    neq: (...args: unknown[]) => Promise<{ data: Array<{ slug: string | null }> | null }>;
  } & Promise<{ data: Array<{ slug: string | null }> | null }>;
  const response = excludeProjectId
    ? await query.neq("id", excludeProjectId)
    : await query;
  const existingSlugs = new Set(
    (response.data || [])
      .map((project: { slug: string | null }) => project.slug?.trim())
      .filter((slug: string | undefined): slug is string => Boolean(slug)),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export function normalizeProjectPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const source = body as Record<string, unknown>;
  const title = cleanText(source.title);

  if (!title) {
    throw new Error("Project title is required");
  }

  const slug = cleanText(source.slug) ?? slugify(title);

  if (!slug) {
    throw new Error("Project slug is required");
  }

  const statusCandidate = cleanText(source.projectStatus);
  const startedOn = cleanDate(source.startedOn);
  const completedOn = cleanDate(source.completedOn);

  if (statusCandidate && !projectStatuses.includes(statusCandidate as ProjectStatus)) {
    throw new Error("Invalid project status");
  }

  if (source.startedOn && !startedOn) {
    throw new Error("Invalid start date");
  }

  if (source.completedOn && !completedOn) {
    throw new Error("Invalid completion date");
  }

  if (startedOn && completedOn && completedOn < startedOn) {
    throw new Error("Project completion date cannot be earlier than the start date");
  }

  return {
    title,
    slug,
    description: cleanText(source.description),
    role: cleanText(source.role),
    projectStatus: (statusCandidate as ProjectStatus | null) ?? null,
    teamSize: cleanPositiveInteger(source.teamSize),
    projectUrl: cleanText(source.projectUrl),
    repositoryUrl: cleanText(source.repositoryUrl),
    startedOn,
    completedOn,
    problem: cleanText(source.problem),
    solution: cleanText(source.solution),
    results: cleanText(source.results),
    skillIds: cleanSkillIds(source.skillIds),
  };
}
