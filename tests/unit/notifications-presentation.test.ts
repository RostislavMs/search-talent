import { describe, expect, it } from "vitest";
import {
  buildNotificationHref,
  describeNotification,
  getNotificationCategory,
  resolveActorName,
  resolveNotificationEmoji,
} from "@/lib/notifications-presentation";
import type { NotificationItem } from "@/lib/constants/notifications";
import { dictionaries } from "@/lib/i18n/dictionaries";

const baseDict = {
  someone: "Someone",
  actions: {
    mention: "mentioned you in a comment",
    commentReply: "replied to your comment",
    newComment: "commented on your content",
    reaction: "reacted with {emoji} to your post",
    newFollower: "started following you",
    newArticle: "published a new article: {title}",
    newProject: "published a new project: {title}",
  },
} as unknown as Parameters<typeof describeNotification>[1];

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "mention",
    recipientUserId: "u1",
    actorUserId: "u2",
    targetType: "article_comment",
    targetId: "c1",
    metadata: {},
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("describeNotification", () => {
  it("returns the action sentence for a mention", () => {
    expect(describeNotification(makeItem(), baseDict)).toBe(
      "mentioned you in a comment",
    );
  });

  it("substitutes the emoji into reaction copy", () => {
    const item = makeItem({ type: "reaction", metadata: { emoji: "🔥" } });
    expect(describeNotification(item, baseDict)).toBe(
      "reacted with 🔥 to your post",
    );
  });

  it("falls back to empty emoji substitution when missing", () => {
    const item = makeItem({ type: "reaction", metadata: {} });
    expect(describeNotification(item, baseDict)).toBe(
      "reacted with  to your post",
    );
  });

  it("returns the follower copy for new_follower", () => {
    const item = makeItem({ type: "new_follower", targetType: "profile" });
    expect(describeNotification(item, baseDict)).toBe("started following you");
  });

  it("substitutes the title for a published article", () => {
    const item = makeItem({
      type: "new_content",
      targetType: "article",
      metadata: { contentTitle: "Hello World" },
    });
    expect(describeNotification(item, baseDict)).toBe(
      "published a new article: Hello World",
    );
  });

  it("uses the project copy when new_content targets a project", () => {
    const item = makeItem({
      type: "new_content",
      targetType: "project",
      metadata: { contentTitle: "My Project" },
    });
    expect(describeNotification(item, baseDict)).toBe(
      "published a new project: My Project",
    );
  });
});

describe("buildNotificationHref", () => {
  it("links to the article slug + comment anchor for article comments", () => {
    const item = makeItem({
      targetType: "article_comment",
      targetId: "c-123",
      metadata: { articleSlug: "hello-world" },
    });
    expect(buildNotificationHref(item, "en")).toBe(
      "/en/articles/hello-world#comment-c-123",
    );
  });

  it("links to the project + comment anchor for project comments", () => {
    const item = makeItem({
      targetType: "project_comment",
      targetId: "pc-1",
      metadata: { projectId: "proj-7" },
    });
    expect(buildNotificationHref(item, "uk")).toBe(
      "/uk/projects/proj-7#comment-pc-1",
    );
  });

  it("links to the actor profile for new follower", () => {
    const item = makeItem({
      targetType: "profile",
      targetId: null,
      metadata: { actorUsername: "alice" },
    });
    expect(buildNotificationHref(item, "en")).toBe("/en/u/alice");
  });

  it("links to the article page for a published-article notification", () => {
    const item = makeItem({
      type: "new_content",
      targetType: "article",
      targetId: "a-1",
      metadata: { articleSlug: "my-post", contentTitle: "My Post" },
    });
    expect(buildNotificationHref(item, "en")).toBe("/en/articles/my-post");
  });

  it("links to the project page for a published-project notification", () => {
    const item = makeItem({
      type: "new_content",
      targetType: "project",
      targetId: "p-1",
      metadata: { projectId: "p-1", contentTitle: "My Project" },
    });
    expect(buildNotificationHref(item, "uk")).toBe("/uk/projects/p-1");
  });

  it("falls back to /notifications when target type is unknown", () => {
    const item = makeItem({ targetType: null, targetId: null, metadata: {} });
    expect(buildNotificationHref(item, "en")).toBe("/en/notifications");
  });

  it("sends a company invitation to the page where it is answered", () => {
    const item = makeItem({
      type: "company_invite",
      targetType: "company",
      metadata: { companySlug: "acme", companyName: "Acme", invitationId: "m1" },
    });
    expect(buildNotificationHref(item, "uk")).toBe("/uk/my-space/companies");
  });

  it("opens the company page for the other company events", () => {
    for (const type of ["company_invite_accepted", "company_verified"] as const) {
      const item = makeItem({ type, targetType: "company", metadata: { companySlug: "acme" } });
      expect(buildNotificationHref(item, "en")).toBe("/en/companies/acme");
    }
    const noSlug = makeItem({ type: "company_verified", targetType: "company", metadata: {} });
    expect(buildNotificationHref(noSlug, "en")).toBe("/en/my-space/companies");
  });

  it("sends a removed company page to the list of companies", () => {
    const item = makeItem({
      type: "moderation_decision",
      targetType: "company",
      metadata: { moderationStatus: "removed", contentKind: "company", companySlug: "acme" },
    });
    expect(buildNotificationHref(item, "en")).toBe("/en/my-space/companies");
  });
});

describe("company notifications", () => {
  const dict = dictionaries.en.notifications;

  it("names the company in every event", () => {
    const metadata = { companyName: "Acme" };
    expect(describeNotification(makeItem({ type: "company_invite", metadata }), dict)).toBe(
      "invited you to the “Acme” team",
    );
    expect(
      describeNotification(makeItem({ type: "company_invite_accepted", metadata }), dict),
    ).toBe("accepted your invitation to the “Acme” team");
    expect(
      describeNotification(makeItem({ type: "company_invite_declined", metadata }), dict),
    ).toBe("declined your invitation to the “Acme” team");
  });

  it("makes the page the subject of the verified-mark message", () => {
    const item = makeItem({
      type: "company_verified",
      actorUserId: null,
      metadata: { companyName: "Acme" },
    });
    expect(resolveActorName(item, dict)).toBe("Acme");
    expect(describeNotification(item, dict)).toBe("now has the “Verified company” mark");
    expect(resolveNotificationEmoji(item)).toBe("✅");
  });

  it("puts the page's name into a moderation decision about it", () => {
    const item = makeItem({
      type: "moderation_decision",
      targetType: "company",
      metadata: { moderationStatus: "restricted", contentKind: "company", contentTitle: "Acme" },
    });
    expect(describeNotification(item, dict)).toBe("restricted the “Acme” company page");
  });

  it("describes leaving, removal and project decisions", () => {
    const metadata = { companyName: "Acme", projectTitle: "Лендинг", projectId: "p1", projectSlug: "landing", companyId: "c1" };
    expect(describeNotification(makeItem({ type: "company_member_left", metadata }), dict)).toBe(
      "left the “Acme” team",
    );
    expect(describeNotification(makeItem({ type: "company_member_removed", metadata }), dict)).toBe(
      "removed you from the “Acme” team",
    );
    expect(describeNotification(makeItem({ type: "company_project_request", metadata }), dict)).toBe(
      "asks to show the project “Лендинг” on the “Acme” page",
    );
    expect(describeNotification(makeItem({ type: "company_project_confirmed", metadata }), dict)).toBe(
      "confirmed your project “Лендинг” for “Acme”",
    );
    expect(
      buildNotificationHref(makeItem({ type: "company_project_request", targetType: "company", metadata }), "uk"),
    ).toBe("/uk/companies/edit/c1");
    expect(
      buildNotificationHref(makeItem({ type: "company_project_declined", targetType: "project", metadata }), "en"),
    ).toBe("/en/projects/landing");
  });

  it("files every company event under the companies filter", () => {
    for (const type of [
      "company_invite",
      "company_invite_accepted",
      "company_invite_declined",
      "company_verified",
    ] as const) {
      expect(getNotificationCategory(makeItem({ type }))).toBe("companies");
    }
  });

  it("has the same company copy in both languages", () => {
    const keys = ["companyInvite", "companyInviteAccepted", "companyInviteDeclined", "companyVerified"] as const;
    for (const key of keys) {
      expect(dictionaries.uk.notifications.actions[key]).toBeTruthy();
      expect(dictionaries.en.notifications.actions[key]).toBeTruthy();
    }
    expect(dictionaries.uk.notifications.filters.companies).toBe("Компанії");
  });
});
