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

const vacancyMetadata = {
  vacancyId: "v1",
  vacancySlug: "junior-designer-abc123",
  vacancyTitle: "Junior designer",
  companyId: "c1",
  companySlug: "acme",
  companyName: "Acme",
};

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "vacancy_approved",
    recipientUserId: "u1",
    actorUserId: null,
    targetType: "vacancy",
    targetId: "v1",
    metadata: vacancyMetadata,
    readAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("vacancy notification types", () => {
  it("are known types with a vacancy target", () => {
    expect(NOTIFICATION_TYPES).toEqual(expect.arrayContaining(["vacancy_approved", "vacancy_expired"]));
    expect(NOTIFICATION_TARGET_TYPES).toContain("vacancy");
  });

  it("are filed under companies", () => {
    expect(getNotificationCategory(makeItem())).toBe("companies");
    expect(getNotificationCategory(makeItem({ type: "vacancy_expired" }))).toBe("companies");
  });
});

describe("vacancy_approved", () => {
  const item = makeItem();

  it("comes from moderation, with a check mark", () => {
    expect(resolveActorName(item, en)).toBe("Moderation");
    expect(resolveActorName(item, uk)).toBe(uk.moderationActor);
    expect(resolveNotificationEmoji(item)).toBe("✅");
  });

  it("names the vacancy", () => {
    expect(describeNotification(item, en)).toBe("checked your vacancy “Junior designer”: it's live now");
    expect(describeNotification(item, uk)).toBe("перевірила вакансію «Junior designer»: вона вже на сайті");
    expect(describeNotification(makeItem({ metadata: {} }), en)).toBe("checked your vacancy “”: it's live now");
  });

  it("opens the vacancy, or the team's list without its address", () => {
    expect(buildNotificationHref(item, "en")).toBe("/en/jobs/junior-designer-abc123");
    expect(buildNotificationHref(makeItem({ metadata: { vacancyTitle: "X" } }), "uk")).toBe(
      "/uk/my-space/vacancies",
    );
  });
});

describe("vacancy_expired", () => {
  const item = makeItem({ type: "vacancy_expired" });

  it("makes the vacancy the subject, with an hourglass", () => {
    expect(resolveActorName(item, en)).toBe("Junior designer");
    expect(resolveActorName(makeItem({ type: "vacancy_expired", metadata: {} }), en)).toBe("Someone");
    expect(resolveNotificationEmoji(item)).toBe("⏳");
  });

  it("says it closed after 60 days", () => {
    expect(describeNotification(item, en)).toBe("closed after 60 days. Extend it if you're still looking");
    expect(describeNotification(item, uk)).toBe("закрилася через 60 днів. Продовжте, якщо ще шукаєте людей");
  });

  it("opens the team's list, where it is extended", () => {
    expect(buildNotificationHref(item, "en")).toBe("/en/my-space/vacancies");
    expect(buildNotificationHref(item, "uk")).toBe("/uk/my-space/vacancies");
  });
});

describe("moderation decisions about a vacancy", () => {
  const decision = (moderationStatus: "removed" | "restricted") =>
    makeItem({
      type: "moderation_decision",
      metadata: { ...vacancyMetadata, moderationStatus, contentKind: "vacancy", contentTitle: "Junior designer" },
    });

  it("names the vacancy", () => {
    expect(describeNotification(decision("removed"), en)).toBe("removed the vacancy “Junior designer”");
    expect(describeNotification(decision("restricted"), en)).toBe("restricted the vacancy “Junior designer”");
    expect(describeNotification(decision("removed"), uk)).toContain("Junior designer");
    expect(resolveActorName(decision("removed"), en)).toBe("Moderation");
    expect(resolveNotificationEmoji(decision("removed"))).toBe("🛡️");
    expect(getNotificationCategory(decision("removed"))).toBe("moderation");
  });

  it("sends a removed vacancy to the team's list and a restricted one to its page", () => {
    expect(buildNotificationHref(decision("removed"), "en")).toBe("/en/my-space/vacancies");
    expect(buildNotificationHref(decision("restricted"), "uk")).toBe("/uk/jobs/junior-designer-abc123");
  });

  it("leaves other removals where they were", () => {
    const project = makeItem({
      type: "moderation_decision",
      targetType: "project",
      metadata: { moderationStatus: "removed", contentKind: "project", projectId: "p1" },
    });
    expect(buildNotificationHref(project, "en")).toBe("/en/my-space");
  });
});
