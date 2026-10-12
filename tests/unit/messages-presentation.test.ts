import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { LastMessagePreview } from "@/lib/messages";
import {
  describeLastMessage,
  describeMessageEvent,
  formatConversationTime,
  formatMessageDay,
  formatMessageTime,
} from "@/lib/messages-presentation";

const uk = getDictionary("uk").messages;
const en = getDictionary("en").messages;

function last(patch: Partial<LastMessagePreview> = {}): LastMessagePreview {
  return {
    id: "m1",
    seq: 1,
    kind: "text",
    event: null,
    eventData: null,
    body: "Привіт",
    held: false,
    removed: false,
    removedBy: null,
    fromMySide: false,
    mine: false,
    createdAt: "2026-10-10T10:00:00Z",
    ...patch,
  };
}

const data = (status: string | null) => ({
  applicationId: null,
  vacancyId: null,
  vacancySlug: null,
  vacancyTitle: "Junior designer",
  status,
});

describe("events", () => {
  it("words the application and its decisions", () => {
    expect(describeMessageEvent("application", data("new"), uk)).toBe("Щодо відгуку на «Junior designer»");
    expect(describeMessageEvent("application_status", data("shortlisted"), uk)).toBe("Відгук на «Junior designer»: в обраних");
    expect(describeMessageEvent("application_status", data("withdrawn"), en)).toBe(
      "The application to “Junior designer” was withdrawn",
    );
    expect(describeMessageEvent("application_status", data("viewed"), uk)).toBe("");
    expect(describeMessageEvent(null, null, uk)).toBe("");
  });
});

describe("the list's last line", () => {
  it("shows the text, mine with 'You:'", () => {
    expect(describeLastMessage(last(), uk)).toBe("Привіт");
    expect(describeLastMessage(last({ mine: true, fromMySide: true, body: "Hi\n  there" }), en)).toBe("You: Hi there");
  });

  it("says when it is held or removed", () => {
    expect(describeLastMessage(last({ body: null, held: true }), uk)).toBe(uk.preview.held);
    expect(describeLastMessage(last({ body: "", removed: true }), en)).toBe(en.preview.removed);
  });

  it("words an event and nothing for no message", () => {
    expect(describeLastMessage(last({ kind: "event", event: "application", eventData: data(null), body: "" }), en)).toBe(
      "About the application to “Junior designer”",
    );
    expect(describeLastMessage(null, uk)).toBe("");
  });
});

describe("times", () => {
  const now = new Date(2026, 9, 10, 15, 0, 0);

  it("labels today, yesterday and older days", () => {
    expect(formatMessageDay(new Date(2026, 9, 10, 9, 0).toISOString(), "uk", uk, now)).toBe("Сьогодні");
    expect(formatMessageDay(new Date(2026, 9, 9, 23, 0).toISOString(), "en", en, now)).toBe("Yesterday");
    expect(formatMessageDay(new Date(2026, 8, 1, 12, 0).toISOString(), "en", en, now)).toMatch(/September/);
    expect(formatMessageDay(new Date(2025, 8, 1, 12, 0).toISOString(), "en", en, now)).toMatch(/2025/);
    expect(formatMessageDay("nope", "en", en, now)).toBe("");
  });

  it("shows the clock today and the date otherwise", () => {
    expect(formatConversationTime(new Date(2026, 9, 10, 9, 5).toISOString(), "uk", now)).toBe(
      formatMessageTime(new Date(2026, 9, 10, 9, 5).toISOString(), "uk"),
    );
    expect(formatConversationTime(new Date(2026, 9, 1, 9, 5).toISOString(), "en", now)).toMatch(/Oct/);
    expect(formatConversationTime("nope", "en", now)).toBe("");
    expect(formatMessageTime("nope", "en")).toBe("");
  });
});

describe("who removed the last message (13.3)", () => {
  it("says deleted for its author, removed for a moderator", () => {
    expect(describeLastMessage(last({ removed: true, removedBy: "author", body: "" }), uk)).toBe(uk.preview.deleted);
    expect(describeLastMessage(last({ removed: true, removedBy: "moderator", body: "" }), uk)).toBe(uk.preview.removed);
    expect(describeLastMessage(last({ removed: true, removedBy: null, body: "" }), en)).toBe(en.preview.removed);
  });
});
