import {
  createDefaultProfilePresentation,
  getDefaultSectionSize,
  profileSectionIds,
  type ProfilePresentation,
  type ProfileProjectLayout,
  type ProfileSectionId,
  type ProfileSectionSize,
} from "@/lib/profile-presentation";
import {
  applyProfileLook,
  getActiveProfileThemeId,
  profileThemes,
  type ProfileTheme,
  type ProfileThemeId,
} from "@/lib/profile-themes";

// ---------------------------------------------------------------------------
// Profile templates: ready sets of the existing layout fields — block order,
// block widths and how project cards look — plus a theme that suits them.
// Applying one changes styling only; the author's content stays as it is.
// ---------------------------------------------------------------------------

export const profileTemplateIds = ["gallery", "cases", "resume"] as const;
export type ProfileTemplateId = (typeof profileTemplateIds)[number];

export type ProfileTemplate = {
  id: ProfileTemplateId;
  projectLayout: ProfileProjectLayout;
  sectionOrder: readonly ProfileSectionId[];
  sectionSizes: Readonly<Record<ProfileSectionId, ProfileSectionSize>>;
  themeId: ProfileThemeId;
};

function withSizes(
  overrides: Partial<Record<ProfileSectionId, ProfileSectionSize>>,
): Record<ProfileSectionId, ProfileSectionSize> {
  return Object.fromEntries(
    profileSectionIds.map((sectionId) => [
      sectionId,
      overrides[sectionId] ?? getDefaultSectionSize(sectionId),
    ]),
  ) as Record<ProfileSectionId, ProfileSectionSize>;
}

export const profileTemplates: readonly ProfileTemplate[] = [
  {
    // Design, video, photo, 3D: the work is the picture, so covers come first
    // and the text around them stays short.
    id: "gallery",
    projectLayout: "gallery",
    themeId: "mono",
    sectionOrder: [
      "projects",
      "about",
      "contacts",
      "skills",
      "workExperience",
      "professionalDetails",
      "certificates",
      "education",
      "languages",
      "articles",
      "qa",
    ],
    sectionSizes: withSizes({ workExperience: "wide" }),
  },
  {
    // Development, QA, data: a project is a story — what was wrong, what was
    // done — so each card shows the description beside the cover.
    id: "cases",
    projectLayout: "cases",
    themeId: "graphite",
    sectionOrder: [
      "projects",
      "about",
      "contacts",
      "workExperience",
      "professionalDetails",
      "skills",
      "education",
      "articles",
      "certificates",
      "languages",
      "qa",
    ],
    sectionSizes: withSizes({}),
  },
  {
    // Management, sales, education: experience is the argument, the projects
    // back it up below.
    id: "resume",
    projectLayout: "grid",
    themeId: "paper",
    sectionOrder: [
      "about",
      "contacts",
      "workExperience",
      "professionalDetails",
      "education",
      "skills",
      "projects",
      "certificates",
      "languages",
      "qa",
      "articles",
    ],
    sectionSizes: withSizes({ certificates: "wide" }),
  },
];

export function getProfileTemplate(id: ProfileTemplateId): ProfileTemplate {
  return profileTemplates.find((template) => template.id === id) ?? profileTemplates[0];
}

export function getProfileTemplateTheme(template: ProfileTemplate): ProfileTheme {
  return profileThemes.find((theme) => theme.id === template.themeId) ?? profileThemes[0];
}

export function isProfileTemplateId(value: unknown): value is ProfileTemplateId {
  return typeof value === "string" && profileTemplateIds.includes(value as ProfileTemplateId);
}

/**
 * The template the profile's layout matches, or null once the author has moved
 * or resized a block or picked another card look. The theme doesn't count: it
 * can be changed on its own and the layout is still the template's.
 */
export function getActiveProfileTemplateId(
  presentation: ProfilePresentation,
): ProfileTemplateId | null {
  const template = profileTemplates.find(
    (candidate) =>
      candidate.projectLayout === presentation.projectLayout &&
      candidate.sectionOrder.every(
        (sectionId, index) => presentation.sectionOrder[index] === sectionId,
      ) &&
      profileSectionIds.every(
        (sectionId) => candidate.sectionSizes[sectionId] === presentation.sectionSizes[sectionId],
      ),
  );

  return template?.id ?? null;
}

/**
 * True while the layout is the platform default: nobody moved or resized a
 * block or changed the card look. Only then does the onboarding preselect the
 * suggested template — a layout the author arranged stays unless they pick one.
 */
export function isDefaultProfileLayout(presentation: ProfilePresentation): boolean {
  const defaults = createDefaultProfilePresentation();
  return (
    presentation.projectLayout === defaults.projectLayout &&
    defaults.sectionOrder.every(
      (sectionId, index) => presentation.sectionOrder[index] === sectionId,
    ) &&
    profileSectionIds.every(
      (sectionId) => presentation.sectionSizes[sectionId] === defaults.sectionSizes[sectionId],
    )
  );
}

/**
 * Whether a template should bring its theme along by default: yes while the
 * profile is on the site look or one of the ready themes, no once the author
 * has mixed their own colours — those took effort and a layout change
 * shouldn't wipe them.
 */
export function templateBringsThemeByDefault(presentation: ProfilePresentation): boolean {
  return getActiveProfileThemeId(presentation) !== null;
}

/**
 * Put a template on a profile: block order, widths and the project card look,
 * and, with `withTheme`, the template's theme. Content, the hero photo or video,
 * the text size and the hero alignment stay.
 */
export function applyProfileTemplate(
  presentation: ProfilePresentation,
  template: ProfileTemplate,
  { withTheme }: { withTheme: boolean },
): ProfilePresentation {
  const next: ProfilePresentation = {
    ...presentation,
    projectLayout: template.projectLayout,
    sectionOrder: [...template.sectionOrder],
    sectionSizes: { ...template.sectionSizes },
  };

  return withTheme ? applyProfileLook(next, getProfileTemplateTheme(template)) : next;
}

// Directions live in the database as English names ("UI/UX Design", "QA /
// Testing"…), so the hint reads the name. Anything unmatched — most of the
// development directions — gets "cases".
const GALLERY_DIRECTIONS =
  /design|motion|video|youtube|tiktok|stream|3d|photo|illustrat|anima|music|sound|content creat|creator|ar \/ vr/i;
const RESUME_DIRECTIONS =
  /management|manager|business analysis|scrum|agile|\bhr\b|recruit|sales|support|customer success|education|tutor|founder/i;

/** The template to suggest for a direction, or null when none is chosen yet. */
export function suggestProfileTemplate(directionName: string | null | undefined): ProfileTemplateId | null {
  const name = directionName?.trim();

  if (!name) {
    return null;
  }

  if (GALLERY_DIRECTIONS.test(name)) {
    return "gallery";
  }

  if (RESUME_DIRECTIONS.test(name)) {
    return "resume";
  }

  return "cases";
}
