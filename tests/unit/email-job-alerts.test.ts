import { afterEach, describe, expect, it, vi } from "vitest";
import { RESEND_BATCH_LIMIT, sendEmailBatch } from "@/lib/email/resend";
import { buildJobAlertDigestEmail } from "@/lib/email/templates";

const MANAGE = "https://searchtalent.example/uk/my-space/job-alerts";
const UNSUBSCRIBE = "https://searchtalent.example/uk/job-alerts/unsubscribe?u=1&t=2";

const item = (title: string) => ({
  title,
  company: "Acme",
  details: "Стажування · Віддалено",
  url: `https://searchtalent.example/uk/jobs/${title.toLowerCase()}`,
});

describe("buildJobAlertDigestEmail", () => {
  it("groups the vacancies by alert, with links and a way out", () => {
    const email = buildJobAlertDigestEmail({
      recipientName: "Олена",
      total: 3,
      manageUrl: MANAGE,
      unsubscribeUrl: UNSUBSCRIBE,
      locale: "uk",
      sections: [
        { name: "Стажування · Віддалено", items: [item("Design"), item("Frontend")], more: 0, moreUrl: "x" },
        { name: "Вам підходять", items: [item("Backend")], more: 4, moreUrl: MANAGE },
      ],
    });

    expect(email.subject).toBe("3 нові вакансії для вас");
    expect(email.text).toContain("Привіт, Олена!");
    expect(email.text).toContain("СТАЖУВАННЯ · ВІДДАЛЕНО");
    expect(email.text).toContain("- Design (Acme · Стажування · Віддалено)\n  https://searchtalent.example/uk/jobs/design");
    expect(email.text).toContain(`І ще 4: ${MANAGE}`);
    expect(email.text).toContain(`Більше не надсилати: ${UNSUBSCRIBE}`);
    expect(email.text).not.toMatch(/\n\n\n/);
    expect(email.html).toContain('href="https://searchtalent.example/uk/jobs/frontend"');
    expect(email.html).toContain("І ще 4");
    expect(email.html).toContain(`href="${UNSUBSCRIBE.replace(/&/g, "&amp;")}"`);
  });

  it("pluralizes the subject, greets without a name and leaves out a missing link", () => {
    const email = buildJobAlertDigestEmail({
      recipientName: "",
      total: 1,
      manageUrl: MANAGE,
      unsubscribeUrl: null,
      locale: "en",
      sections: [{ name: "All new vacancies", items: [item("Design")], more: 0, moreUrl: "x" }],
    });

    expect(email.subject).toBe("1 new vacancy for you");
    expect(email.text.startsWith("Hi!")).toBe(true);
    expect(email.text).not.toContain("Stop these emails");
    expect(email.html).not.toContain("Stop these emails");
    expect(email.html).not.toContain("And ");
  });

  it("escapes what companies and people typed", () => {
    const email = buildJobAlertDigestEmail({
      recipientName: "<i>Eve</i>",
      total: 1,
      manageUrl: MANAGE,
      unsubscribeUrl: UNSUBSCRIBE,
      locale: "en",
      sections: [
        {
          name: "«<script>»",
          items: [{ title: "Dev & <b>", company: "A&B", details: "", url: "https://x.example/?a=1&b=2" }],
          more: 0,
          moreUrl: "x",
        },
      ],
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&lt;i&gt;Eve&lt;/i&gt;");
    expect(email.html).toContain("Dev &amp; &lt;b&gt;");
    expect(email.html).toContain("A&amp;B");
    expect(email.html).toContain('href="https://x.example/?a=1&amp;b=2"');
    expect(email.text).toContain("Dev & <b> (A&B)");
  });
});

describe("sendEmailBatch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const input = (to: string) => ({
    to,
    subject: "s",
    html: "<p>h</p>",
    headers: { "List-Unsubscribe": "<https://x>" },
  });

  it("sends nothing without Resend configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmailBatch([input("a@x"), input("b@x")])).toEqual([
      { sent: false, error: "email_not_configured" },
      { sent: false, error: "email_not_configured" },
    ]);
    expect(await sendEmailBatch([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends 100 at a time with the headers, results in order", async () => {
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Search Talent <hi@x>");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as unknown[];
      return new Response(JSON.stringify({ data: body.map((_, index) => ({ id: `id-${index}` })) }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const inputs = Array.from({ length: RESEND_BATCH_LIMIT + 1 }, (_, index) => input(`u${index}@x`));
    const results = await sendEmailBatch(inputs);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.resend.com/emails/batch");
    const first = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(first).toHaveLength(RESEND_BATCH_LIMIT);
    expect(first[0]).toEqual({
      from: "Search Talent <hi@x>",
      to: ["u0@x"],
      subject: "s",
      html: "<p>h</p>",
      headers: { "List-Unsubscribe": "<https://x>" },
    });
    expect(results).toHaveLength(RESEND_BATCH_LIMIT + 1);
    expect(results[0]).toEqual({ sent: true, id: "id-0" });
    expect(results[RESEND_BATCH_LIMIT]).toEqual({ sent: true, id: "id-0" });
  });

  it("fails the whole chunk when a request fails, and goes on with the next", async () => {
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("RESEND_FROM_EMAIL", "hi@x");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 429 }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const inputs = Array.from({ length: RESEND_BATCH_LIMIT * 2 + 1 }, (_, index) => input(`u${index}@x`));
    const results = await sendEmailBatch(inputs);

    expect(results[0]).toEqual({ sent: false, error: "status_429" });
    expect(results[RESEND_BATCH_LIMIT]).toEqual({ sent: false, error: "offline" });
    expect(results[RESEND_BATCH_LIMIT * 2]).toEqual({ sent: true, id: undefined });
  });
});
