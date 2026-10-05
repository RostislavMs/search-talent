import { describe, expect, it } from "vitest";
import {
  createDefaultProfilePresentation,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import {
  applyProfileStyle,
  createProfileStyleFile,
  parseProfileStyleFile,
  PROFILE_STYLE_FILE_MAX_BYTES,
  PROFILE_STYLE_FILE_TYPE,
  profileStyleFields,
} from "@/lib/profile-style-file";
import { applyProfileTemplate, getProfileTemplate } from "@/lib/profile-templates";
import { applyProfileLook, profileThemes } from "@/lib/profile-themes";

const ember = profileThemes.find((theme) => theme.id === "ember")!;

function styled(): ProfilePresentation {
  return applyProfileTemplate(
    {
      ...applyProfileLook(createDefaultProfilePresentation(), ember),
      textScale: "lg",
      heroAlignment: "center",
      overlayStrength: 30,
    },
    getProfileTemplate("gallery"),
    { withTheme: false },
  );
}

function fileWith(style: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ type: PROFILE_STYLE_FILE_TYPE, version: 1, style, ...extra });
}

describe("createProfileStyleFile", () => {
  it("writes the look and nothing else: no photo, video or storage path", () => {
    const source = {
      ...styled(),
      backgroundMode: "image" as const,
      backgroundUrl: "https://cdn.example.com/me.jpg",
      backgroundStoragePath: "user-1/hero.jpg",
    };
    const text = createProfileStyleFile(source, new Date("2026-10-05T10:00:00Z"));
    const data = JSON.parse(text);

    expect(data.type).toBe(PROFILE_STYLE_FILE_TYPE);
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBe("2026-10-05T10:00:00.000Z");
    expect(Object.keys(data.style).sort()).toEqual([...profileStyleFields].sort());
    expect(text).not.toContain("cdn.example.com");
    expect(text).not.toContain("user-1");
  });

  it("round-trips: applying its own file changes nothing", () => {
    const source = styled();
    const result = parseProfileStyleFile(createProfileStyleFile(source));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toBe(0);
    expect(applyProfileStyle(createDefaultProfilePresentation(), result.style)).toEqual(source);
  });

  it("stays a couple of kilobytes, far below the limit", () => {
    expect(createProfileStyleFile(styled()).length).toBeLessThan(PROFILE_STYLE_FILE_MAX_BYTES / 4);
  });
});

describe("parseProfileStyleFile", () => {
  it.each([
    ["not JSON", "{ nope", "notJson"],
    ["another JSON", JSON.stringify({ name: "package" }), "notStyle"],
    ["no style object", JSON.stringify({ type: PROFILE_STYLE_FILE_TYPE, version: 1 }), "notStyle"],
    ["no version", JSON.stringify({ type: PROFILE_STYLE_FILE_TYPE, style: {} }), "notStyle"],
    ["a newer version", fileWith({ accentColor: "#ffffff" }, { version: 2 }), "newerVersion"],
    ["nothing usable", fileWith({ accentColor: "red", backgroundUrl: "https://x.y" }), "empty"],
  ])("rejects %s", (_, text, error) => {
    expect(parseProfileStyleFile(text)).toEqual({ ok: false, error });
  });

  it("rejects a file over the size limit before parsing it", () => {
    const padding = "x".repeat(PROFILE_STYLE_FILE_MAX_BYTES);
    expect(parseProfileStyleFile(fileWith({ accentColor: "#ffffff" }, { padding }))).toEqual({
      ok: false,
      error: "tooLarge",
    });
  });

  it("skips values that don't fit and counts them; unknown fields are ignored", () => {
    const result = parseProfileStyleFile(
      fileWith({
        accentColor: "#ABCDEF",
        textColor: "rgb(0,0,0)",
        fontPreset: "comic-sans",
        overlayStrength: 99,
        cardStyle: "outline",
        backgroundUrl: "https://evil.example/x.jpg",
        backgroundStoragePath: "someone-else/hero.jpg",
      }),
    );

    expect(result).toEqual({
      ok: true,
      style: { accentColor: "#abcdef", cardStyle: "outline" },
      skipped: 3,
    });
  });

  it("completes a partial block order and keeps only known blocks", () => {
    const result = parseProfileStyleFile(
      fileWith({ sectionOrder: ["skills", "projects", "unknown", "skills"] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = result.style.sectionOrder!;
    expect(order.slice(0, 2)).toEqual(["skills", "projects"]);
    expect(new Set(order).size).toBe(createDefaultProfilePresentation().sectionOrder.length);
  });

  it("reads widths only for the blocks the file names", () => {
    const result = parseProfileStyleFile(
      fileWith({ sectionSizes: { about: "full", skills: "huge", nope: "full" } }),
    );

    expect(result).toEqual({ ok: true, style: { sectionSizes: { about: "full" } }, skipped: 0 });
  });
});

describe("applyProfileStyle", () => {
  it("keeps the author's own hero photo", () => {
    const withPhoto = {
      ...createDefaultProfilePresentation(),
      backgroundMode: "image" as const,
      backgroundUrl: "https://cdn.example.com/me.jpg",
      backgroundStoragePath: "user-1/hero.jpg",
    };
    const next = applyProfileStyle(withPhoto, { backgroundMode: "solid", accentColor: "#111111" });

    expect(next.backgroundMode).toBe("image");
    expect(next.backgroundUrl).toBe(withPhoto.backgroundUrl);
    expect(next.backgroundStoragePath).toBe(withPhoto.backgroundStoragePath);
    expect(next.accentColor).toBe("#111111");
  });

  it("falls back to the gradient when the file was made over a photo", () => {
    const next = applyProfileStyle(createDefaultProfilePresentation(), { backgroundMode: "video" });
    expect(next.backgroundMode).toBe("gradient");
  });

  it("takes the file's flat hero when the author has no photo", () => {
    const next = applyProfileStyle(createDefaultProfilePresentation(), { backgroundMode: "solid" });
    expect(next.backgroundMode).toBe("solid");
  });

  it("merges block widths and leaves what the file doesn't mention", () => {
    const current = styled();
    const next = applyProfileStyle(current, { sectionSizes: { about: "compact" } });

    expect(next.sectionSizes.about).toBe("compact");
    expect(next.sectionSizes.workExperience).toBe(current.sectionSizes.workExperience);
    expect(next.sectionOrder).toBe(current.sectionOrder);
    expect(next.accentColor).toBe(current.accentColor);
  });
});
