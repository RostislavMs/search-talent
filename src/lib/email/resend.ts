/**
 * Minimal Resend client via the HTTP API. No SDK dependency.
 *
 * Usage:
 *   await sendEmail({ to, subject, html, text? });
 *
 * Environment variables:
 *   RESEND_API_KEY     — Resend API key (required for sending)
 *   RESEND_FROM_EMAIL  — sender address, e.g. "Search Talent <notifications@yourdomain.com>"
 *
 * Emails are sent best-effort from server routes. If env is not configured,
 * `sendEmail` returns false and logs a warning — never throws.
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe for recurring emails. */
  headers?: Record<string, string>;
};

export type SendEmailResult = {
  sent: boolean;
  id?: string;
  error?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
/** Resend takes up to 100 emails in one batch request. */
export const RESEND_BATCH_LIMIT = 100;

function toResendPayload(from: string, input: SendEmailInput) {
  return {
    from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    reply_to: input.replyTo,
    headers: input.headers,
  };
}

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

export function isEmailConfigured(): boolean {
  return resendConfig() !== null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = resendConfig();

  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[email] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping send",
        { to: input.to, subject: input.subject },
      );
    }
    return { sent: false, error: "email_not_configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toResendPayload(config.from, input)),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[email] Resend send failed", response.status, body);
      return { sent: false, error: `status_${response.status}` };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (error) {
    console.error("[email] Resend send threw", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

/**
 * Many emails at once (the morning job alerts): one request per 100, so the
 * API's per-second limit is not hit. Results come back in the order given; a
 * failed request fails every email in it. Never throws.
 */
export async function sendEmailBatch(inputs: SendEmailInput[]): Promise<SendEmailResult[]> {
  const config = resendConfig();

  if (!config) {
    if (inputs.length > 0 && process.env.NODE_ENV !== "production") {
      console.warn("[email] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping batch", {
        count: inputs.length,
      });
    }
    return inputs.map(() => ({ sent: false, error: "email_not_configured" }));
  }

  const results: SendEmailResult[] = [];

  for (let start = 0; start < inputs.length; start += RESEND_BATCH_LIMIT) {
    const chunk = inputs.slice(start, start + RESEND_BATCH_LIMIT);

    try {
      const response = await fetch(RESEND_BATCH_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map((input) => toResendPayload(config.from, input))),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("[email] Resend batch failed", response.status, body);
        results.push(...chunk.map(() => ({ sent: false, error: `status_${response.status}` })));
        continue;
      }

      const data = (await response.json().catch(() => ({}))) as { data?: Array<{ id?: string }> };
      results.push(...chunk.map((_, index) => ({ sent: true, id: data.data?.[index]?.id })));
    } catch (error) {
      console.error("[email] Resend batch threw", error);
      const message = error instanceof Error ? error.message : "unknown";
      results.push(...chunk.map(() => ({ sent: false, error: message })));
    }
  }

  return results;
}

/**
 * Basic HTML escaping so user-supplied strings can be interpolated into
 * an email template without enabling injection of arbitrary markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
