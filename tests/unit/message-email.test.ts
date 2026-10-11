import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelScheduledEmail, sendEmail } from "@/lib/email/resend";
import { buildNewMessageEmail } from "@/lib/email/templates";
import {
  buildMessageEmailOneClickUrl,
  isValidMessageEmailUnsubscribeToken,
  messageEmailUnsubscribeToken,
} from "@/lib/message-email-token";
import { jobAlertUnsubscribeToken } from "@/lib/job-alert-token";

const ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the new message email", () => {
  const base = {
    recipientName: "Olena",
    senderName: "Bob <script>",
    asCompany: false,
    isRequest: false,
    url: "https://searchtalent.dev/uk/messages/x",
    settingsUrl: "https://searchtalent.dev/uk/messages/settings",
    locale: "uk" as const,
  };

  it("says who wrote, never what", () => {
    const email = buildNewMessageEmail(base);
    expect(email.subject).toBe("Нове повідомлення від Bob <script> на Search Talent");
    expect(email.html).toContain("Bob &lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain(base.url);
    expect(email.html).toContain(base.settingsUrl);
    expect(email.text).toContain(`${base.url}`);
  });

  it("has its own words for a request and for a company", () => {
    expect(buildNewMessageEmail({ ...base, isRequest: true, locale: "en" }).text).toContain("wants to talk");
    expect(buildNewMessageEmail({ ...base, asCompany: true, senderName: "Acme", locale: "en" }).text).toContain("Acme wrote to you.");
  });

  it("greets without a name and names nobody when the sender is unknown", () => {
    const email = buildNewMessageEmail({ ...base, recipientName: "", senderName: "", locale: "en" });
    expect(email.text.startsWith("Hi!")).toBe(true);
    expect(email.subject).toBe("Someone wrote to you on Search Talent");
  });
});

describe("the unsubscribe token", () => {
  it("needs the service key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(messageEmailUnsubscribeToken(ID)).toBeNull();
    expect(buildMessageEmailOneClickUrl(ID)).toBeNull();
    expect(isValidMessageEmailUnsubscribeToken(ID, "a".repeat(64))).toBe(false);
  });

  it("checks the person's own token, and not the job alerts one", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const token = messageEmailUnsubscribeToken(ID)!;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(isValidMessageEmailUnsubscribeToken(ID, token)).toBe(true);
    expect(isValidMessageEmailUnsubscribeToken(ID.toUpperCase(), token)).toBe(true);
    expect(isValidMessageEmailUnsubscribeToken("22222222-2222-4222-8222-222222222222", token)).toBe(false);
    expect(isValidMessageEmailUnsubscribeToken(ID, jobAlertUnsubscribeToken(ID))).toBe(false);
    expect(isValidMessageEmailUnsubscribeToken(ID, "zz")).toBe(false);
    expect(messageEmailUnsubscribeToken("nope")).toBeNull();
    expect(buildMessageEmailOneClickUrl(ID)).toContain(`/api/messages/email-unsubscribe?u=${ID}&t=${token}`);
  });
});

describe("Resend scheduling", () => {
  it("passes scheduled_at", async () => {
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Search Talent <hi@example.com>");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_9" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({ to: "a@b.c", subject: "s", html: "h", scheduledAt: "2026-10-10T10:10:00.000Z" });
    expect(result).toEqual({ sent: true, id: "re_9" });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.scheduled_at).toBe("2026-10-10T10:10:00.000Z");
  });

  it("cancels a scheduled email", async () => {
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Search Talent <hi@example.com>");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await cancelScheduledEmail("re_9")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/re_9/cancel");
    expect(init.method).toBe("POST");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await cancelScheduledEmail("re_9")).toBe(false);

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    expect(await cancelScheduledEmail("re_9")).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await cancelScheduledEmail("re_9")).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it("cancels nothing when not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await cancelScheduledEmail("re_9")).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("RESEND_FROM_EMAIL", "x");
    expect(await cancelScheduledEmail("")).toBe(false);
  });
});
