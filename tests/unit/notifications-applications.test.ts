import { describe, expect, it } from "vitest";
import {
  buildNotificationHref,
  describeNotification,
  getNotificationCategory,
  resolveActorName,
  resolveNotificationEmoji,
} from "@/lib/notifications-presentation";
import {
  NOTIFICATION_TARGET_TYPES,
  NOTIFICATION_TYPES,
  type NotificationItem,
} from "@/lib/constants/notifications";
import { dictionaries } from "@/lib/i18n/dictionaries";

const en = dictionaries.en.notifications;
const uk = dictionaries.uk.notifications;

const metadata = {
  vacancyId: "v1",
  vacancySlug: "junior-designer-abc123",
  vacancyTitle: "Junior designer",
  companyId: "c1",
  companySlug: "acme",
  companyName: "Acme",
  applicationId: "a1",
};

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "application_received",
    recipientUserId: "u1",
    actorUserId: "candidate",
    targetType: "vacancy_application",
    targetId: "a1",
    metadata: { ...metadata, actorName: "Carol" },
    readAt: null,
    createdAt: "2026-10-02T00:00:00Z",
    ...overrides,
  };
}

const statusItem = (status: "viewed" | "shortlisted" | "rejected" | "hired") =>
  makeItem({
    type: "application_status",
    actorUserId: null,
    metadata: { ...metadata, applicationStatus: status },
  });

describe("application notification types", () => {
  it("are known types with their own target", () => {
    expect(NOTIFICATION_TYPES).toEqual(expect.arrayContaining(["application_received", "application_status"]));
    expect(NOTIFICATION_TARGET_TYPES).toContain("vacancy_application");
  });

  it("have their own filter", () => {
    expect(getNotificationCategory(makeItem())).toBe("applications");
    expect(getNotificationCategory(statusItem("hired"))).toBe("applications");
    expect(en.filters.applications).toBe("Applications");
    expect(uk.filters.applications).toBe("Відгуки");
  });
});

describe("a new application", () => {
  it("names the candidate and the vacancy", () => {
    expect(resolveActorName(makeItem(), en)).toBe("Carol");
    expect(describeNotification(makeItem(), en)).toBe("applied to “Junior designer”");
    expect(describeNotification(makeItem(), uk)).toBe("відгукнувся(-лася) на вакансію «Junior designer»");
    expect(resolveNotificationEmoji(makeItem())).toBeNull();
  });

  it("opens the team's list for that vacancy", () => {
    expect(buildNotificationHref(makeItem(), "uk")).toBe("/uk/my-space/vacancies/v1");
    expect(buildNotificationHref(makeItem({ metadata: {} }), "en")).toBe("/en/my-space/vacancies");
  });
});

describe("an answer to the candidate", () => {
  it("speaks as the company", () => {
    expect(resolveActorName(statusItem("viewed"), en)).toBe("Acme");
    expect(resolveActorName(makeItem({ type: "application_status", metadata: {} }), en)).toBe(en.someone);
  });

  it("words each decision", () => {
    expect(describeNotification(statusItem("viewed"), en)).toBe("viewed your application to “Junior designer”");
    expect(describeNotification(statusItem("shortlisted"), en)).toBe(
      "would like to talk to you about “Junior designer”",
    );
    expect(describeNotification(statusItem("rejected"), uk)).toBe(
      "дякує за відгук на «Junior designer», але цього разу обирає інших",
    );
    expect(describeNotification(statusItem("hired"), uk)).toBe("обирає вас на «Junior designer». Вітаємо!");
    expect(describeNotification(makeItem({ type: "application_status", metadata }), en)).toBe("");
  });

  it("uses an emoji instead of an avatar", () => {
    expect(resolveNotificationEmoji(statusItem("hired"))).toBe("🎉");
    expect(resolveNotificationEmoji(statusItem("rejected"))).toBe("💼");
  });

  it("opens My applications", () => {
    expect(buildNotificationHref(statusItem("shortlisted"), "uk")).toBe("/uk/my-space/applications");
  });
});
