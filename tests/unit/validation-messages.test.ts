import { describe, expect, it } from "vitest";
import {
  conversationActionSchema,
  conversationsQuerySchema,
  markConversationReadSchema,
  messageEmailUnsubscribeSchema,
  messagesPageQuerySchema,
  messagingRestrictionSchema,
  messagingSettingsSchema,
  adminAttachmentQuerySchema,
  createAttachmentSchema,
  routeAttachmentSchema,
  sendMessageSchema,
  startConversationSchema,
} from "@/lib/validation/messages";

const ID = "11111111-1111-4111-8111-111111111111";

describe("message bodies", () => {
  it("trims and drops carriage returns", () => {
    expect(sendMessageSchema.parse({ body: "  Hi\r\nthere  " }).body).toBe("Hi\nthere");
  });

  it("refuses empty and too long", () => {
    expect(sendMessageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: "x".repeat(4001) }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: "x".repeat(4000) }).success).toBe(true);
  });

  it("accepts a client id and nothing unknown", () => {
    expect(sendMessageSchema.safeParse({ body: "hi", clientId: ID }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ body: "hi", clientId: "nope" }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: "hi", extra: 1 }).success).toBe(false);
  });

  it("takes files, and with files the text may be empty", () => {
    expect(sendMessageSchema.parse({ body: "  ", attachmentIds: [ID] })).toMatchObject({ body: "", attachmentIds: [ID] });
    expect(sendMessageSchema.parse({ attachmentIds: [ID] }).body).toBe("");
    expect(sendMessageSchema.parse({ body: "hi" }).attachmentIds).toEqual([]);
    expect(sendMessageSchema.safeParse({ body: "", attachmentIds: [] }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ attachmentIds: ["x"] }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ attachmentIds: Array(6).fill(ID) }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: "x".repeat(4001), attachmentIds: [ID] }).success).toBe(false);
  });
});

describe("files", () => {
  it("a file to upload: a known type, at most 10 MB", () => {
    expect(createAttachmentSchema.parse({ fileName: "  cv.pdf ", contentType: "application/pdf", size: 1000 }).fileName).toBe("cv.pdf");
    expect(createAttachmentSchema.parse({ fileName: "   ", contentType: "image/png", size: 5, width: 10, height: null }).fileName).toBe("file");
    expect(createAttachmentSchema.parse({ fileName: "a".repeat(300), contentType: "image/png", size: 5 }).fileName).toHaveLength(120);
    expect(createAttachmentSchema.safeParse({ fileName: "a.gif", contentType: "image/gif", size: 5 }).success).toBe(false);
    expect(createAttachmentSchema.safeParse({ fileName: "a.pdf", contentType: "application/pdf", size: 0 }).success).toBe(false);
    expect(createAttachmentSchema.safeParse({ fileName: "a.pdf", contentType: "application/pdf", size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(createAttachmentSchema.safeParse({ fileName: "a.pdf", contentType: "application/pdf", size: 1, extra: 1 }).success).toBe(false);
  });

  it("ids in the route and the report in a moderator's link", () => {
    expect(routeAttachmentSchema.safeParse({ id: ID, attachmentId: ID }).success).toBe(true);
    expect(routeAttachmentSchema.safeParse({ id: ID, attachmentId: "x" }).success).toBe(false);
    expect(adminAttachmentQuerySchema.safeParse({ report: ID }).success).toBe(true);
    expect(adminAttachmentQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("starting a conversation", () => {
  it("needs a recipient and a body", () => {
    expect(startConversationSchema.safeParse({ recipientUserId: ID, body: "Hello" }).success).toBe(true);
    expect(startConversationSchema.safeParse({ body: "Hello" }).success).toBe(false);
    expect(startConversationSchema.safeParse({ recipientUserId: "x", body: "Hello" }).success).toBe(false);
  });

  it("takes an optional company and application", () => {
    expect(
      startConversationSchema.safeParse({ recipientUserId: ID, body: "Hi", companyId: ID, applicationId: null }).success,
    ).toBe(true);
    expect(startConversationSchema.safeParse({ recipientUserId: ID, body: "Hi", companyId: "acme" }).success).toBe(false);
  });
});

describe("actions and reads", () => {
  it("accepts one action at a time", () => {
    expect(conversationActionSchema.safeParse({ action: "accept" }).success).toBe(true);
    expect(conversationActionSchema.safeParse({ action: "archive", value: true }).success).toBe(true);
    expect(conversationActionSchema.safeParse({ action: "archive" }).success).toBe(false);
    expect(conversationActionSchema.safeParse({ action: "clear" }).success).toBe(true);
    expect(conversationActionSchema.safeParse({ action: "block", value: false }).success).toBe(true);
    expect(conversationActionSchema.safeParse({ action: "delete" }).success).toBe(false);
  });

  it("reads up to a sequence number", () => {
    expect(markConversationReadSchema.safeParse({}).success).toBe(true);
    expect(markConversationReadSchema.safeParse({ seq: 12 }).success).toBe(true);
    expect(markConversationReadSchema.safeParse({ seq: -1 }).success).toBe(false);
  });

  it("pages by sequence number", () => {
    expect(messagesPageQuerySchema.parse({ before: "40" })).toEqual({ before: 40 });
    expect(messagesPageQuerySchema.parse({ after: "0" })).toEqual({ after: 0 });
    expect(messagesPageQuerySchema.safeParse({ before: "x" }).success).toBe(false);
  });

  it("reads the list query", () => {
    expect(conversationsQuerySchema.safeParse({ box: "requests", company: ID }).success).toBe(true);
    expect(conversationsQuerySchema.safeParse({ before: "2026-10-10T10:00:00.000Z" }).success).toBe(true);
    expect(conversationsQuerySchema.safeParse({ box: "spam" }).success).toBe(false);
  });
});

describe("settings, unsubscribing, restrictions", () => {
  it("needs at least one setting", () => {
    expect(messagingSettingsSchema.safeParse({}).success).toBe(false);
    expect(messagingSettingsSchema.safeParse({ whoCanMessage: "nobody" }).success).toBe(true);
    expect(messagingSettingsSchema.safeParse({ whoCanMessage: "friends" }).success).toBe(false);
    expect(messagingSettingsSchema.safeParse({ readReceipts: false, emailNotifications: true }).success).toBe(true);
  });

  it("checks the unsubscribe link's shape", () => {
    expect(messageEmailUnsubscribeSchema.safeParse({ u: ID, t: "a".repeat(64) }).success).toBe(true);
    expect(messageEmailUnsubscribeSchema.safeParse({ u: ID, t: "xyz" }).success).toBe(false);
  });

  it("limits or lifts", () => {
    expect(messagingRestrictionSchema.safeParse({ userId: ID, scope: "all", days: 30 }).success).toBe(true);
    expect(messagingRestrictionSchema.safeParse({ userId: ID, scope: null }).success).toBe(true);
    expect(messagingRestrictionSchema.safeParse({ userId: ID, scope: "forever" }).success).toBe(false);
    expect(messagingRestrictionSchema.safeParse({ userId: ID, scope: "all", days: 0 }).success).toBe(false);
  });
});
