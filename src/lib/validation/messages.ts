import { z } from "zod";
import {
  conversationBoxes,
  MESSAGE_MAX_LENGTH,
  MESSAGE_SEARCH_MAX_LENGTH,
  MESSAGE_SEARCH_MIN_LENGTH,
  messageEmailModes,
  normalizeSearchQuery,
  whoCanMessageOptions,
} from "@/lib/messages";

const uuidMessage = "Invalid identifier";

/**
 * The text of a message. Only the length is checked here, so the form can say
 * so at once; the database checks the rest (requests, links, moderation).
 */
const messageBody = z
  .string()
  .max(MESSAGE_MAX_LENGTH + 200, { message: "The message is too long" })
  .transform((value) => value.replace(/\r/g, "").trim())
  .refine((value) => value.length > 0, { message: "The message is empty" })
  .refine((value) => value.length <= MESSAGE_MAX_LENGTH, { message: "The message is too long" });

/** A new conversation: to a person, as oneself or as a company, maybe about an application. */
export const startConversationSchema = z
  .object({
    recipientUserId: z.string().uuid(uuidMessage),
    body: messageBody,
    clientId: z.string().uuid(uuidMessage).optional(),
    companyId: z.string().uuid(uuidMessage).nullish(),
    applicationId: z.string().uuid(uuidMessage).nullish(),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    body: messageBody,
    clientId: z.string().uuid(uuidMessage).optional(),
  })
  .strict();

/** A new text for one's own message; edit_message() checks the rest. */
export const editMessageSchema = z
  .object({
    body: messageBody,
  })
  .strict();

/** ?q=&company= — search in one's own messages or a company's team inbox. */
export const messageSearchQuerySchema = z.object({
  q: z
    .string()
    .transform(normalizeSearchQuery)
    .refine((value) => value.length >= MESSAGE_SEARCH_MIN_LENGTH && value.length <= MESSAGE_SEARCH_MAX_LENGTH, {
      message: "The search is too short or too long",
    }),
  company: z.string().uuid(uuidMessage).optional(),
});

/** The email choices: any of them; the rest stays. */
export const notificationPreferencesSchema = z
  .object({
    messageEmails: z.enum(messageEmailModes).optional(),
    followerEmails: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to change" });

export const markConversationReadSchema = z
  .object({
    seq: z.number().int().nonnegative().optional(),
  })
  .strict();

/** One change at a time from the conversation menu. */
export const conversationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }).strict(),
  z.object({ action: z.literal("archive"), value: z.boolean() }).strict(),
  z.object({ action: z.literal("mute"), value: z.boolean() }).strict(),
  z.object({ action: z.literal("clear") }).strict(),
  z.object({ action: z.literal("block"), value: z.boolean() }).strict(),
]);

export type ConversationAction = z.infer<typeof conversationActionSchema>;

export const messagingSettingsSchema = z
  .object({
    whoCanMessage: z.enum(whoCanMessageOptions).optional(),
    emailNotifications: z.boolean().optional(),
    readReceipts: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to change" });

export const routeConversationIdSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

export const routeMessageIdSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

/** ?before= / ?after= on a conversation's messages: sequence numbers. */
export const messagesPageQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  after: z.coerce.number().int().nonnegative().optional(),
});

export const conversationsQuerySchema = z.object({
  box: z.enum(conversationBoxes).optional(),
  company: z.string().uuid(uuidMessage).optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

export const messageEmailUnsubscribeSchema = z.object({
  u: z.string().uuid(uuidMessage),
  t: z.string().regex(/^[0-9a-f]{64}$/),
});

/** The one-click "stop these emails" link: which emails (k), whose (u), and its HMAC (t). */
export const emailUnsubscribeSchema = messageEmailUnsubscribeSchema.extend({
  k: z.enum(["messages", "followers"]),
});

/** A moderator limits (scope) or frees (scope null) someone's messaging. */
export const messagingRestrictionSchema = z
  .object({
    userId: z.string().uuid(uuidMessage),
    scope: z.enum(["new_conversations", "all"]).nullable(),
    days: z.number().int().min(1).max(3650).nullable().optional(),
    note: z.string().trim().max(1200).optional().default(""),
    reportId: z.string().uuid(uuidMessage).optional(),
  })
  .strict();
