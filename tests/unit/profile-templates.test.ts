import { describe, expect, it } from "vitest";
import {
  createDefaultProfilePresentation,
  getProfileItemsGridClass,
  normalizeProfilePresentation,
  pickProfileProjects,
  PROFILE_GALLERY_GRID_LIMIT,
  PROFILE_PROJECTS_GRID_LIMIT,
  profileSectionIds,
} from "@/lib/profile-presentation";
import { applyProfileLook, getActiveProfileThemeId, profileThemes } from "@/lib/profile-themes";
import {
  applyProfileTemplate,
  getActiveProfileTemplateId,
  getProfileTemplate,
  isDefaultProfileLayout,
  isProfileTemplateId,
  profileTemplates,
  suggestProfileTemplate,
  templateBringsThemeByDefault,
} from "@/lib/profile-templates";

describe("profile templates", () => {
  it("each lists every block exactly once", () => {
    for (const template of profileTemplates) {
      expect([...template.sectionOrder].sort()).toEqual([...profileSectionIds].sort());
      expect(Object.keys(template.sectionSizes).sort()).toEqual([...profileSectionIds].sort());
    }
  });

  it("survive a save: normalizing keeps the order, sizes and card look", () => {
    for (const template of profileTemplates) {
      const applied = applyProfileTemplate(createDefaultProfilePresentation(), template, {
        withTheme: false,
      });
      const saved = normalizeProfilePresentation(JSON.parse(JSON.stringify(applied)));
      expect(getActiveProfileTemplateId(saved)).toBe(template.id);
    }
  });

  it("each points at a ready theme", () => {
    const themeIds = profileThemes.map((theme) => theme.id);
    for (const template of profileTemplates) {
      expect(themeIds).toContain(template.themeId);
    }
  });

  it("puts projects first in the gallery and the cases, after experience in the résumé", () => {
    expect(getProfileTemplate("gallery").sectionOrder[0]).toBe("projects");
    expect(getProfileTemplate("cases").sectionOrder[0]).toBe("projects");
    const resume = getProfileTemplate("resume").sectionOrder;
    expect(resume.indexOf("workExperience")).toBeLessThan(resume.indexOf("projects"));
    expect(resume.indexOf("education")).toBeLessThan(resume.indexOf("projects"));
  });
});

describe("applyProfileTemplate", () => {
  it("brings the template's theme along when asked", () => {
    const next = applyProfileTemplate(createDefaultProfilePresentation(), getProfileTemplate("gallery"), {
      withTheme: true,
    });
    expect(getActiveProfileTemplateId(next)).toBe("gallery");
    expect(getActiveProfileThemeId(next)).toBe("mono");
    expect(next.projectLayout).toBe("gallery");
  });

  it("keeps the colours without the theme", () => {
    const ember = applyProfileLook(
      createDefaultProfilePresentation(),
      profileThemes.find((theme) => theme.id === "ember")!,
    );
    const next = applyProfileTemplate(ember, getProfileTemplate("resume"), { withTheme: false });
    expect(getActiveProfileThemeId(next)).toBe("ember");
    expect(next.fontPreset).toBe(ember.fontPreset);
    expect(getActiveProfileTemplateId(next)).toBe("resume");
  });

  it("keeps the hero photo, text size and alignment", () => {
    const base = {
      ...createDefaultProfilePresentation(),
      backgroundMode: "image" as const,
      backgroundUrl: "https://cdn.example.com/hero.jpg",
      textScale: "lg" as const,
      heroAlignment: "center" as const,
    };
    const next = applyProfileTemplate(base, getProfileTemplate("cases"), { withTheme: true });
    expect(next.backgroundMode).toBe("image");
    expect(next.backgroundUrl).toBe(base.backgroundUrl);
    expect(next.textScale).toBe("lg");
    expect(next.heroAlignment).toBe("center");
  });

  it("does not share the template's arrays with the profile", () => {
    const template = getProfileTemplate("gallery");
    const next = applyProfileTemplate(createDefaultProfilePresentation(), template, {
      withTheme: false,
    });
    next.sectionOrder.reverse();
    next.sectionSizes.projects = "compact";
    expect(template.sectionOrder[0]).toBe("projects");
    expect(template.sectionSizes.projects).toBe("full");
  });
});

describe("getActiveProfileTemplateId", () => {
  it("is null for the default layout and once a block is moved or resized", () => {
    expect(getActiveProfileTemplateId(createDefaultProfilePresentation())).toBeNull();

    const gallery = applyProfileTemplate(createDefaultProfilePresentation(), getProfileTemplate("gallery"), {
      withTheme: false,
    });
    const moved = { ...gallery, sectionOrder: [...gallery.sectionOrder].reverse() };
    const resized = { ...gallery, sectionSizes: { ...gallery.sectionSizes, about: "full" as const } };
    const otherCards = { ...gallery, projectLayout: "grid" as const };
    expect(getActiveProfileTemplateId(moved)).toBeNull();
    expect(getActiveProfileTemplateId(resized)).toBeNull();
    expect(getActiveProfileTemplateId(otherCards)).toBeNull();
  });
});

describe("isDefaultProfileLayout", () => {
  it("tells the untouched layout from an arranged one", () => {
    const defaults = createDefaultProfilePresentation();
    expect(isDefaultProfileLayout(defaults)).toBe(true);
    // The theme doesn't count, only the layout.
    expect(isDefaultProfileLayout(applyProfileLook(defaults, profileThemes[0]))).toBe(true);
    expect(isDefaultProfileLayout({ ...defaults, projectLayout: "cases" })).toBe(false);
    expect(
      isDefaultProfileLayout({ ...defaults, sectionSizes: { ...defaults.sectionSizes, skills: "full" } }),
    ).toBe(false);
    expect(
      isDefaultProfileLayout({ ...defaults, sectionOrder: [...defaults.sectionOrder].reverse() }),
    ).toBe(false);
  });
});

describe("templateBringsThemeByDefault", () => {
  it("is on for the site look and ready themes, off for the author's own colours", () => {
    const defaults = createDefaultProfilePresentation();
    expect(templateBringsThemeByDefault(defaults)).toBe(true);
    expect(templateBringsThemeByDefault(applyProfileLook(defaults, profileThemes[2]))).toBe(true);
    expect(templateBringsThemeByDefault({ ...defaults, accentColor: "#123456" })).toBe(false);
  });
});

describe("suggestProfileTemplate", () => {
  it.each([
    ["UI/UX Design", "gallery"],
    ["Motion Design", "gallery"],
    ["Video Production", "gallery"],
    ["3D Modeling", "gallery"],
    ["Photography", "gallery"],
    ["Illustration", "gallery"],
    ["AR / VR", "gallery"],
    ["Frontend Development", "cases"],
    ["QA / Testing", "cases"],
    ["Data Science", "cases"],
    ["Copywriting", "cases"],
    ["Product Management", "resume"],
    ["HR / Recruiting", "resume"],
    ["Sales", "resume"],
    ["Education / Tutoring", "resume"],
  ])("%s → %s", (direction, expected) => {
    expect(suggestProfileTemplate(direction)).toBe(expected);
  });

  it("suggests nothing without a direction", () => {
    expect(suggestProfileTemplate(null)).toBeNull();
    expect(suggestProfileTemplate("  ")).toBeNull();
  });
});

describe("isProfileTemplateId", () => {
  it("accepts only known ids", () => {
    expect(isProfileTemplateId("gallery")).toBe(true);
    expect(isProfileTemplateId("bento")).toBe(false);
    expect(isProfileTemplateId(3)).toBe(false);
  });
});

describe("project card look", () => {
  it("defaults to the standard grid and drops unknown values", () => {
    expect(createDefaultProfilePresentation().projectLayout).toBe("grid");
    expect(normalizeProfilePresentation({ projectLayout: "cases" }).projectLayout).toBe("cases");
    expect(normalizeProfilePresentation({ projectLayout: "bento" }).projectLayout).toBe("grid");
    expect(normalizeProfilePresentation({}).projectLayout).toBe("grid");
  });

  it("shows more cards in the gallery", () => {
    const projects = Array.from({ length: 20 }, (_, index) => ({ id: index, is_pinned: false }));
    expect(pickProfileProjects(projects, "full").grid).toHaveLength(PROFILE_PROJECTS_GRID_LIMIT);
    expect(pickProfileProjects(projects, "full", "gallery").grid).toHaveLength(
      PROFILE_GALLERY_GRID_LIMIT,
    );
    expect(pickProfileProjects(projects, "full", "cases").grid).toHaveLength(
      PROFILE_PROJECTS_GRID_LIMIT,
    );
  });

  it("lays gallery cards two to a row on phones and cases one to a row in a narrow block", () => {
    expect(getProfileItemsGridClass("full", "gallery")).toBe("grid-cols-2 lg:grid-cols-3");
    expect(getProfileItemsGridClass("full", "cases")).toBe("xl:grid-cols-2");
    expect(getProfileItemsGridClass("regular", "cases")).toBe("");
    expect(getProfileItemsGridClass("full")).toBe(getProfileItemsGridClass("full", "grid"));
  });
});
