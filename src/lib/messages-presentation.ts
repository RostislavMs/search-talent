import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { LastMessagePreview, MessageEventData, MessageEventKind } from "@/lib/messages";

type MessagesCopy = Dictionary["messages"];

const STATUS_EVENTS = ["shortlisted", "rejected", "hired", "withdrawn"] as const;

/** An event in a conversation, worded: "About the application to …", "… shortlisted". */
export function describeMessageEvent(
  event: MessageEventKind | null,
  data: MessageEventData | null,
  copy: MessagesCopy,
): string {
  const vacancy = data?.vacancyTitle ?? "";

  if (event === "application") {
    return copy.thread.events.application.replace("{vacancy}", vacancy);
  }

  const status = STATUS_EVENTS.find((item) => item === data?.status);
  return status ? copy.thread.events[status].replace("{vacancy}", vacancy) : "";
}

/** The line under a conversation in the list. */
export function describeLastMessage(message: LastMessagePreview | null, copy: MessagesCopy): string {
  if (!message) return "";

  if (message.kind === "event") {
    return describeMessageEvent(message.event, message.eventData, copy);
  }

  if (message.removed) return message.removedBy === "author" ? copy.preview.deleted : copy.preview.removed;
  if (message.body === null) return copy.preview.held;

  const text = message.body.replace(/\s+/g, " ").trim();
  return message.mine ? copy.preview.you.replace("{text}", text) : text;
}

function localeTag(locale: string): string {
  return locale === "uk" ? "uk-UA" : "en-US";
}

/** "14:05" in the reader's own time. */
export function formatMessageTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(locale), { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** The separator over a day's messages: Today, Yesterday, or the date. */
export function formatMessageDay(iso: string, locale: string, copy: MessagesCopy, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (days === 0) return copy.thread.today;
  if (days === 1) return copy.thread.yesterday;

  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** The time next to a conversation in the list: the clock today, else the short date. */
export function formatConversationTime(iso: string, locale: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  if (sameDay) return formatMessageTime(iso, locale);

  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "2-digit" }),
  }).format(date);
}
