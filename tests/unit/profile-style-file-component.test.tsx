// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { dictionaries } from "@/lib/i18n/dictionaries";

vi.mock("@/lib/i18n/client", async () => {
  const { dictionaries: all } = await import("@/lib/i18n/dictionaries");
  return { useCurrentLocale: () => "en", useDictionary: () => all.en };
});

import ProfileStyleFile from "@/components/profile-style-file";
import {
  createDefaultProfilePresentation,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import {
  createProfileStyleFile,
  PROFILE_STYLE_FILE_MAX_BYTES,
  PROFILE_STYLE_FILE_NAME,
} from "@/lib/profile-style-file";
import { applyProfileTemplate, getProfileTemplate } from "@/lib/profile-templates";
import { getActiveProfileThemeId } from "@/lib/profile-themes";

const copy = dictionaries.en.profileStyleFile;

// Browsers have Blob#text; this jsdom doesn't.
if (typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
      <ProfileStyleFile presentation={presentation} onChange={setPresentation} />
      <button type="button" onClick={() => setPresentation({ ...presentation, textScale: "sm" })}>
        other edit
      </button>
    </>
  );
}

function renderHarness(initial = createDefaultProfilePresentation()) {
  let latest = initial;
  const { container } = render(<Harness initial={initial} onState={(value) => (latest = value)} />);
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  return { current: () => latest, input };
}

function pick(input: HTMLInputElement, content: string, size?: number) {
  const file = new File([content], "look.json", { type: "application/json" });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  fireEvent.change(input, { target: { files: [file] } });
}

/** A file from someone on the "Case studies" template with its "Graphite" theme. */
function casesGraphiteFile() {
  return createProfileStyleFile(
    applyProfileTemplate(createDefaultProfilePresentation(), getProfileTemplate("cases"), {
      withTheme: true,
    }),
  );
}

describe("<ProfileStyleFile />", () => {
  it("downloads the current look as a JSON file", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:look");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderHarness(applyProfileTemplate(createDefaultProfilePresentation(), getProfileTemplate("resume"), { withTheme: true }));
    fireEvent.click(screen.getByRole("button", { name: copy.download }));

    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe(PROFILE_STYLE_FILE_NAME);
    const text = await (createObjectURL.mock.calls[0][0] as Blob).text();
    expect(JSON.parse(text).style.projectLayout).toBe("grid");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:look");
  });

  it("shows what a file sets and changes nothing until Apply", async () => {
    const { current, input } = renderHarness();
    pick(input, casesGraphiteFile());

    await screen.findByText(copy.previewTitle);
    expect(screen.getByText("Theme: Graphite")).toBeInTheDocument();
    expect(screen.getByText("Template: Case studies")).toBeInTheDocument();
    expect(getActiveProfileThemeId(current())).toBe("site");

    fireEvent.click(screen.getByRole("button", { name: copy.apply }));
    expect(getActiveProfileThemeId(current())).toBe("graphite");
    expect(current().projectLayout).toBe("cases");
    expect(screen.getByText(copy.applied)).toBeInTheDocument();
  });

  it("Cancel drops the file", async () => {
    const { current, input } = renderHarness();
    pick(input, casesGraphiteFile());
    await screen.findByText(copy.previewTitle);

    fireEvent.click(screen.getByRole("button", { name: copy.cancel }));
    expect(screen.queryByText(copy.previewTitle)).toBeNull();
    expect(getActiveProfileThemeId(current())).toBe("site");
  });

  it("undoes the file, and only until something else changes", async () => {
    const { current, input } = renderHarness();
    pick(input, casesGraphiteFile());
    fireEvent.click(await screen.findByRole("button", { name: copy.apply }));
    fireEvent.click(screen.getByRole("button", { name: copy.undo }));
    expect(getActiveProfileThemeId(current())).toBe("site");

    pick(input, casesGraphiteFile());
    fireEvent.click(await screen.findByRole("button", { name: copy.apply }));
    fireEvent.click(screen.getByRole("button", { name: "other edit" }));
    expect(screen.queryByRole("button", { name: copy.undo })).toBeNull();
  });

  it("explains a wrong file", async () => {
    const { input } = renderHarness();
    pick(input, JSON.stringify({ name: "package", version: "1.0.0" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.errors.notStyle);
  });

  it("refuses a big file without reading it", async () => {
    const { input } = renderHarness();
    pick(input, "{}", PROFILE_STYLE_FILE_MAX_BYTES + 1);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(copy.errors.tooLarge));
  });

  it("warns when the file's colours are hard to read", async () => {
    const { input } = renderHarness();
    pick(
      input,
      JSON.stringify({
        type: "searchtalent/profile-style",
        version: 1,
        style: { surfaceColor: "#ffffff", textColor: "#eeeeee", skipMe: 1, fontPreset: "nope" },
      }),
    );

    await screen.findByText(copy.previewTitle);
    expect(screen.getByText(copy.contrastWarning)).toBeInTheDocument();
    expect(screen.getByText(copy.skipped.replace("{count}", "1"))).toBeInTheDocument();
  });
});
