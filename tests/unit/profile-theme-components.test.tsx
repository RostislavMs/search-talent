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

import ProfileContrastCheck from "@/components/profile-contrast-check";
import ProfileThemePicker from "@/components/profile-theme-picker";
import {
  createDefaultProfilePresentation,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import { applyProfileLook, getActiveProfileThemeId, profileThemes } from "@/lib/profile-themes";

const copy = dictionaries.en.profileThemes;

afterEach(() => cleanup());

/** Holds the presentation like the editor does, and exposes the latest one. */
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
      <ProfileThemePicker presentation={presentation} onChange={setPresentation} />
      <ProfileContrastCheck presentation={presentation} onChange={setPresentation} />
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

describe("<ProfileThemePicker />", () => {
  it("marks the site look as active by default", () => {
    renderHarness();
    expect(screen.getByRole("button", { name: copy.site })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies a theme in one click", () => {
    const current = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: copy.names.ember }));

    expect(getActiveProfileThemeId(current())).toBe("ember");
    expect(screen.getByRole("button", { name: copy.names.ember })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("undoes the last theme and then hides the button", () => {
    const current = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: copy.names.paper }));
    fireEvent.click(screen.getByRole("button", { name: copy.undo }));

    expect(getActiveProfileThemeId(current())).toBe("site");
    expect(screen.queryByRole("button", { name: copy.undo })).not.toBeInTheDocument();
  });

  it("drops the undo once something else changes", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: copy.names.paper }));
    fireEvent.click(screen.getByRole("button", { name: "other edit" }));

    expect(screen.queryByRole("button", { name: copy.undo })).not.toBeInTheDocument();
  });

  it("a random theme reads well", () => {
    const current = renderHarness();
    fireEvent.click(screen.getByRole("button", { name: copy.random }));

    expect(getActiveProfileThemeId(current())).not.toBe("site");
    expect(screen.getByText(copy.contrastOk)).toBeInTheDocument();
  });
});

describe("<ProfileContrastCheck />", () => {
  it("stays silent on the site look", () => {
    renderHarness();
    expect(screen.queryByText(copy.contrastOk)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.fix })).not.toBeInTheDocument();
  });

  it("names the problem and fixes it", () => {
    const broken = {
      ...applyProfileLook(createDefaultProfilePresentation(), profileThemes[1]),
      mutedColor: "#d4d4d8",
    };
    renderHarness(broken);

    expect(screen.getByText(copy.issues.muted)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.fix }));

    expect(screen.queryByText(copy.issues.muted)).not.toBeInTheDocument();
    expect(screen.getByText(copy.contrastOk)).toBeInTheDocument();
  });

  it("explains when light and dark backgrounds can't share one text colour", () => {
    const mixed = {
      ...applyProfileLook(createDefaultProfilePresentation(), profileThemes[1]),
      gradientFrom: "#000000",
      gradientTo: "#000000",
      solidColor: "#000000",
    };
    renderHarness(mixed);

    expect(screen.getByText(copy.mixedBackgrounds)).toBeInTheDocument();
  });
});
