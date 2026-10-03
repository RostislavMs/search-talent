import { describe, expect, it } from "vitest";
import {
  buildNotificationHref,
  describeNotification,
  getNotificationCategory,
  resolveActorName,
  resolveNotificationEmoji,
} from "@/lib/notifications-presentation";
import { NOTIFICATION_TYPES, type NotificationItem } from "@/lib/constants/notifications";
import { dictionaries } from "@/lib/i18n/dictionaries";

const en = dictionaries.en.notifications;
const uk = dictionaries.uk.notifications;

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "vacancy_match",
    recipientUserId: "u1",
    actorUserId: null,
    targetType: null,
    targetId: null,
    metadata: { matchCount: 3 },
    readAt: null,
    createdAt: "2026-10-03T03:30:00Z",
    ...overrides,
  };
}

const single = makeItem({
  targetType: "vacancy",
  targetId: "v1",
  metadata: {
    matchCount: 1,
    vacancyId: "v1",
    vacancySlug: "junior-designer-abc123",
    vacancyTitle: "Junior designer",
    companyName: "Acme",
  },
});

const opened = makeItem({
  type: "company_contact_opened",
  targetType: "company",
  targetId: "c1",
  metadata: { companyId: "c1", companySlug: "acme", companyName: "Acme" },
});

describe("job alert notifications", () => {
  it("are known types, filed under their own chip and companies", () => {
    expect(NOTIFICATION_TYPES).toEqual(expect.arrayContaining(["vacancy_match", "company_contact_opened"]));
    expect(getNotificationCategory(makeItem())).toBe("jobs");
    expect(getNotificationCategory(opened)).toBe("companies");
    expect(en.filters.jobs).toBe("Job alerts");
    expect(uk.filters.jobs).toBe("Підписки на вакансії");
  });

  it("speak as the job alerts, with a bell", () => {
    expect(resolveActorName(makeItem(), uk)).toBe("Підписки на вакансії");
    expect(resolveNotificationEmoji(makeItem())).toBe("🔔");
  });

  it("count the new vacancies with the right plural", () => {
    expect(describeNotification(makeItem(), uk)).toBe("3 нові вакансії для вас");
    expect(describeNotification(makeItem({ metadata: { matchCount: 5 } }), uk)).toBe("5 нових вакансій для вас");
    expect(describeNotification(makeItem({ metadata: { matchCount: 21 } }), uk)).toBe("21 нова вакансія для вас");
    expect(describeNotification(makeItem(), en)).toBe("3 new vacancies for you");
    // An odd notification without a count still reads.
    expect(describeNotification(makeItem({ metadata: {} }), en)).toBe("1 new vacancy for you");
  });

  it("name the search when only one found something", () => {
    expect(describeNotification(makeItem({ metadata: { matchCount: 2, searchName: "Стажування" } }), uk)).toBe(
      "2 нові вакансії для вас · «Стажування»",
    );
  });

  it("name a single vacancy and open it", () => {
    expect(describeNotification(single, uk)).toBe("нова вакансія: «Junior designer», Acme");
    expect(describeNotification(single, en)).toBe("a new vacancy: “Junior designer”, Acme");
    expect(buildNotificationHref(single, "uk")).toBe("/uk/jobs/junior-designer-abc123");
  });

  it("open the alerts page for several vacancies", () => {
    expect(buildNotificationHref(makeItem(), "en")).toBe("/en/my-space/job-alerts");
    expect(buildNotificationHref(makeItem({ metadata: { matchCount: 1 } }), "en")).toBe("/en/my-space/job-alerts");
  });

  it("say which company opened the contacts and open its page", () => {
    expect(resolveActorName(opened, uk)).toBe("Acme");
    expect(resolveNotificationEmoji(opened)).toBe("🏢");
    expect(describeNotification(opened, uk)).toBe("цікавиться вами й відкриває ваші контакти");
    expect(describeNotification(opened, en)).toBe("is interested in you and opened your contacts");
    expect(buildNotificationHref(opened, "uk")).toBe("/uk/companies/acme");
    expect(buildNotificationHref(makeItem({ ...opened, metadata: {} }), "uk")).toBe("/uk/my-space");
    expect(resolveActorName(makeItem({ ...opened, metadata: {} }), en)).toBe(en.someone);
  });
});
