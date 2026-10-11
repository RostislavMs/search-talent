import { describe, expect, it } from "vitest";
import {
  conversationActionSchema,
  conversationsQuerySchema,
  markConversationReadSchema,
  messageEmailUnsubscribeSchema,
  messagesPageQuerySchema,
  messagingRestrictionSchema,
  messagingSettingsSchema,
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
