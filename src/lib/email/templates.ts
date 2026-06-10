import { escapeHtml } from "@/lib/email/resend";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type FollowerEmailInput = {
  recipientName: string;
  followerName: string;
  followerUsername: string | null;
  followerHeadline: string | null;
  profileUrl: string;
  unsubscribeUrl?: string;
  locale: Locale;
};

export function buildNewFollowerEmail(input: FollowerEmailInput) {
  const dictionary = getDictionary(input.locale);
  const email = dictionary.emails.newFollower;

  const safeRecipient = escapeHtml(input.recipientName || "");
  const safeFollower = escapeHtml(input.followerName || "");
  const safeHandle = input.followerUsername
    ? `@${escapeHtml(input.followerUsername)}`
    : "";
  const safeHeadline = input.followerHeadline
    ? escapeHtml(input.followerHeadline)
    : "";
  const safeUrl = escapeHtml(input.profileUrl);

  const greeting = email.greeting.replace("{name}", safeRecipient);
  const intro = email.intro
    .replace("{follower}", safeFollower)
    .replace("{handle}", safeHandle);

  const subject = email.subject.replace("{follower}", input.followerName);

  const html = `<!doctype html>
<html lang="${input.locale}">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f7f9; margin: 0; padding: 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <tr>
        <td style="padding: 32px 32px 16px 32px;">
          <h1 style="margin: 0 0 16px 0; font-size: 20px; color: #111;">${greeting}</h1>
          <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #333;">${intro}</p>
          ${safeHeadline ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #555; font-style: italic;">${safeHeadline}</p>` : ""}
          <p style="margin: 24px 0;">
            <a href="${safeUrl}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 600;">${escapeHtml(email.cta)}</a>
          </p>
          <p style="margin: 24px 0 0 0; font-size: 13px; color: #888; line-height: 1.5;">${escapeHtml(email.signature)}</p>
        </td>
      </tr>
      ${
        input.unsubscribeUrl
          ? `<tr>
        <td style="padding: 16px 32px; background: #fafafa; border-top: 1px solid #eee; font-size: 12px; color: #888;">
          <a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #888;">${escapeHtml(email.manageNotifications)}</a>
        </td>
      </tr>`
          : ""
      }
    </table>
  </body>
</html>`;

  const text = [
    `${input.recipientName ? `${dictionary.emails.newFollower.greeting.replace("{name}", input.recipientName)}` : ""}`,
    `${input.followerName} ${input.followerUsername ? `(@${input.followerUsername}) ` : ""}${email.intro.replace("{follower}", "").replace("{handle}", "").trim()}`,
    input.followerHeadline || "",
    "",
    `${email.cta}: ${input.profileUrl}`,
    "",
    email.signature,
    input.unsubscribeUrl ? `\n${email.manageNotifications}: ${input.unsubscribeUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

/**
 * Shared branded shell for code-path (Resend) transactional emails so they
 * match the GoTrue auth templates in supabase/email-templates/.
 */
function renderEmailShell(locale: Locale, bodyHtml: string) {
  return `<!doctype html>
<html lang="${locale}">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f7fb; margin: 0; padding: 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e6edf5; border-radius: 16px; overflow: hidden;">
      <tr>
        <td style="padding: 28px 32px 0 32px;">
          <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #d97706;">Search Talent</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 32px 32px 32px;">${bodyHtml}</td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(label: string, url: string) {
  return `<p style="margin: 24px 0 0 0;"><a href="${escapeHtml(url)}" style="display: inline-block; background: #d97706; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">${escapeHtml(label)}</a></p>`;
}

type ModerationDecisionEmailInput = {
  recipientName: string;
  contentKind: "article" | "project" | "profile";
  contentTitle: string;
  status: "removed" | "restricted";
  note: string | null;
  url: string;
  locale: Locale;
};

export function buildModerationDecisionEmail(input: ModerationDecisionEmailInput) {
  const email = getDictionary(input.locale).emails.moderation;
  const greeting = email.greeting.replace(
    "{name}",
    escapeHtml(input.recipientName || ""),
  );
  const intro = input.status === "removed" ? email.removedIntro : email.restrictedIntro;
  const typeWord = email.types[input.contentKind];
  const safeTitle = escapeHtml(input.contentTitle || "");
  const typeLine = safeTitle ? `${escapeHtml(typeWord)}: “${safeTitle}”` : escapeHtml(typeWord);

  const bodyHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: #0f172a;">${greeting}</h1>
    <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #334155;">${escapeHtml(intro)}</p>
    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #0f172a;">${typeLine}</p>
    ${
      input.note
        ? `<p style="margin: 12px 0 0 0; font-size: 14px; line-height: 1.6; color: #555;"><strong>${escapeHtml(email.noteLabel)}</strong> ${escapeHtml(input.note)}</p>`
        : ""
    }
    ${ctaButton(email.cta, input.url)}
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">${escapeHtml(email.signature)}</p>`;

  const text = [
    `${greeting.replace(/<[^>]+>/g, "")}`,
    intro,
    `${typeWord}: “${input.contentTitle || ""}”`.trim(),
    input.note ? `${email.noteLabel} ${input.note}` : "",
    `${email.cta}: ${input.url}`,
    "",
    email.signature,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: email.subject, html: renderEmailShell(input.locale, bodyHtml), text };
}
