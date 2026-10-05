// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { dictionaries } from "@/lib/i18n/dictionaries";

vi.mock("@/lib/i18n/client", async () => {
  const { dictionaries: all } = await import("@/lib/i18n/dictionaries");
  return { useCurrentLocale: () => "en", useDictionary: () => all.en };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/en/u/olena" }));

import ProfileTemplatePicker from "@/components/profile-template-picker";
import ProjectCard from "@/components/project-card";
import {
  createDefaultProfilePresentation,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import { applyProfileLook, getActiveProfileThemeId, profileThemes } from "@/lib/profile-themes";
import { getActiveProfileTemplateId } from "@/lib/profile-templates";

const en = dictionaries.en;
const copy = en.profileTemplates;

afterEach(() => cleanup());

function Harness({
  initial,
  onState,
}: {
  initial: ProfilePresentation;
  onState: (value: ProfilePresentation) => void;
}) {
  const [presentation, setPresentation] = useState(initial);
  onState(presentation);
  return (
    <>
      <ProfileTemplatePicker presentation={presentation} onChange={setPresentation} />
      <button type="button" onClick={() => setPresentation({ ...presentation, textScale: "lg" })}>
        other edit
      </button>
    </>
  );
}

function renderHarness(initial = createDefaultProfilePresentation()) {
  let latest = initial;
  render(<Harness initial={initial} onState={(value) => (latest = value)} />);
  return () => latest;
}

/** The template card, not the card-look switch that shares some names. */
function templateButton(name: string) {
  return screen.getAllByRole("button", { name: new RegExp(`^${name}`) })[0];
}

describe("<ProfileTemplatePicker />", () => {
  it("applies a template with its theme on a site-look profile", () => {
    const current = renderHarness();
    expect(screen.getByRole("checkbox", { name: new RegExp(copy.withTheme) })).toBeChecked();

    fireEvent.click(templateButton(copy.names.gallery));
    expect(getActiveProfileTemplateId(current())).toBe("gallery");
    expect(getActiveProfileThemeId(current())).toBe("mono");
    expect(templateButton(copy.names.gallery)).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the author's own colours unless they tick the theme", () => {
    const own = { ...createDefaultProfilePresentation(), accentColor: "#123456" };
    const current = renderHarness(own);
    expect(screen.getByRole("checkbox", { name: new RegExp(copy.withTheme) })).not.toBeChecked();

    fireEvent.click(templateButton(copy.names.resume));
    expect(getActiveProfileTemplateId(current())).toBe("resume");
    expect(current().accentColor).toBe("#123456");
  });

  it("brings the theme when ticked by hand", () => {
    const ember = applyProfileLook(
      { ...createDefaultProfilePresentation(), accentColor: "#123456" },
      profileThemes.find((theme) => theme.id === "ember")!,
    );
    const custom = { ...ember, accentColor: "#123456" };
    const current = renderHarness(custom);

    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(copy.withTheme) }));
    fireEvent.click(templateButton(copy.names.cases));
    expect(getActiveProfileThemeId(current())).toBe("graphite");
  });

  it("undoes the last template, and only until something else changes", () => {
    const current = renderHarness();
    fireEvent.click(templateButton(copy.names.cases));
    fireEvent.click(screen.getByRole("button", { name: copy.undo }));
    expect(getActiveProfileTemplateId(current())).toBeNull();
    expect(getActiveProfileThemeId(current())).toBe("site");
    expect(screen.queryByRole("button", { name: copy.undo })).toBeNull();

    fireEvent.click(templateButton(copy.names.cases));
    fireEvent.click(screen.getByRole("button", { name: "other edit" }));
    expect(screen.queryByRole("button", { name: copy.undo })).toBeNull();
  });

  it("switches the project card look on its own", () => {
    const current = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: copy.projectLayouts.cases }));
    expect(current().projectLayout).toBe("cases");
    expect(current().sectionOrder).toEqual(createDefaultProfilePresentation().sectionOrder);
    expect(screen.getByRole("button", { name: copy.projectLayouts.cases })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("<ProjectCard /> layouts", () => {
  const project = {
    id: "p1",
    title: "Night city",
    slug: "night-city",
    description: "A short film about the city at night.",
    score: 21,
    cover_url: null,
    kind: "video",
  };

  it("gallery: just the title and score, no description or button", () => {
    render(<ProjectCard dictionary={en} project={project} hideOwner variant="gallery" />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Night city");
    expect(link).not.toHaveTextContent(project.description);
    expect(link).not.toHaveTextContent(en.common.viewProject);
  });

  it("case: the description beside the cover inside a container", () => {
    render(<ProjectCard dictionary={en} project={project} hideOwner variant="case" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("@container");
    expect(link).toHaveTextContent(project.description);
    expect(link).toHaveTextContent(en.common.viewProject);
  });
});
