import { describe, expect, it, vi } from "vitest";
import {
  buildOptimizerUrl,
  loadOgCover,
  loadOgCovers,
  pickOgCovers,
  sniffImageType,
} from "@/lib/og-cover-images";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const WEBP = new TextEncoder().encode("RIFF\x00\x00\x00\x00WEBPVP8 ");

function respond(bytes: Uint8Array<ArrayBuffer>, init: ResponseInit = { status: 200 }) {
  return new Response(bytes, init);
}

describe("pickOgCovers", () => {
  it("keeps the profile's order, skips projects without a cover and stops at three", () => {
    expect(
      pickOgCovers([
        { cover_url: "https://cdn.example/a.webp" },
        { cover_url: null },
        { cover_url: "  " },
        { cover_url: "https://cdn.example/a.webp" },
        { cover_url: "https://cdn.example/b.webp" },
        { cover_url: "javascript:alert(1)" },
        { cover_url: "https://cdn.example/c.jpg" },
        { cover_url: "https://cdn.example/d.jpg" },
      ]),
    ).toEqual([
      "https://cdn.example/a.webp",
      "https://cdn.example/b.webp",
      "https://cdn.example/c.jpg",
    ]);
  });
});

describe("sniffImageType", () => {
  it("recognises PNG and JPEG only", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("buildOptimizerUrl", () => {
  it("asks the site's optimizer for an allowed width and quality", () => {
    const url = new URL(
      buildOptimizerUrl("https://searchtalent.dev", "https://cdn.example/a cover.webp"),
    );
    expect(url.origin + url.pathname).toBe("https://searchtalent.dev/_next/image");
    expect(url.searchParams.get("url")).toBe("https://cdn.example/a cover.webp");
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("75");
  });
});

describe("loadOgCover", () => {
  it("asks for JPEG or PNG and returns a data URI", async () => {
    const fetcher = vi.fn(async () => respond(JPEG));
    const cover = await loadOgCover("https://cdn.example/a.webp", "https://searchtalent.dev", fetcher);

    expect(cover).toBe(`data:image/jpeg;base64,${Buffer.from(JPEG).toString("base64")}`);
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).not.toMatch(/webp|avif/);
  });

  it("drops a cover that is still WebP, failed, or timed out", async () => {
    expect(
      await loadOgCover("https://cdn.example/a.webp", "https://s.dev", async () => respond(WEBP)),
    ).toBeNull();
    expect(
      await loadOgCover("https://cdn.example/a.webp", "https://s.dev", async () =>
        respond(PNG, { status: 400 }),
      ),
    ).toBeNull();
    expect(
      await loadOgCover("https://cdn.example/a.webp", "https://s.dev", async () => {
        throw new Error("timeout");
      }),
    ).toBeNull();
  });

  it("keeps the covers that loaded, in order", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("bad") ? respond(WEBP) : respond(PNG),
    );
    const covers = await loadOgCovers(
      ["https://cdn.example/1.webp", "https://cdn.example/bad.webp", "https://cdn.example/3.webp"],
      "https://s.dev",
      fetcher as unknown as typeof fetch,
    );
    expect(covers).toHaveLength(2);
    expect(covers.every((cover) => cover.startsWith("data:image/png;base64,"))).toBe(true);
  });
});
