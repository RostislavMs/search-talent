import { describe, expect, it } from "vitest";
import {
  buildNotificationHref,
  describeNotification,
} from "@/lib/notifications-presentation";
import type { NotificationItem } from "@/lib/constants/notifications";

const baseDict = {
  someone: "Someone",
  actions: {
    mention: "mentioned you in a comment",
    commentReply: "replied to your comment",
    newComment: "commented on your content",
    reaction: "reacted with {emoji} to your post",
    newFollower: "started following you",
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

  it("falls back to /notifications when target type is unknown", () => {
    const item = makeItem({ targetType: null, targetId: null, metadata: {} });
    expect(buildNotificationHref(item, "en")).toBe("/en/notifications");
  });
});
