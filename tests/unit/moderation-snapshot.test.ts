import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));

import { parseReportSnapshot } from "@/lib/db/moderation";

describe("parseReportSnapshot", () => {
  it("reads what a conversation report kept, edits and deletions included", () => {
    const snapshot = parseReportSnapshot({
      company: { name: "Acme" },
      messages: [
        { id: "m1", kind: "text", body: "Hello", authorName: "Bob", byReported: true, createdAt: "t" },
        { id: "m2", kind: "text", body: "Pay now", edited: true, originalBody: "I will find you", createdAt: "t" },
        { id: "m3", kind: "text", body: "Deleted text", deleted: true, deletedBy: "author", createdAt: "t" },
        { id: "m4", kind: "text", body: "", deleted: true, createdAt: "t" },
        { id: "m5", kind: "event", body: "", createdAt: "t" },
        { nope: true },
      ],
    });

    expect(snapshot?.companyName).toBe("Acme");
    expect(snapshot?.messages.map((message) => message.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(snapshot?.messages[0]).toMatchObject({ edited: false, originalBody: null, deletedBy: null, byReported: true });
    expect(snapshot?.messages[1]).toMatchObject({ edited: true, originalBody: "I will find you", body: "Pay now" });
    expect(snapshot?.messages[2]).toMatchObject({ deleted: true, deletedBy: "author", body: "Deleted text" });
    // An older snapshot without the field: a removal, the stricter reading.
    expect(snapshot?.messages[3]).toMatchObject({ deleted: true, deletedBy: "moderator" });
    expect(snapshot?.messages[4].kind).toBe("event");
  });

  it("is null without a snapshot", () => {
    expect(parseReportSnapshot(null)).toBeNull();
    expect(parseReportSnapshot("x")).toBeNull();
    expect(parseReportSnapshot({})).toEqual({ companyName: null, messages: [] });
  });
});
