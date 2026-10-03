import { escapeHtml } from "@/lib/email/resend";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { formatCount } from "@/lib/vacancies";

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
  // Plaintext version uses the raw name — plaintext is not HTML-rendered, so no
  // escaping (and no tag-stripping) is needed.
  const plainGreeting = email.greeting.replace("{name}", input.recipientName || "");
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
    plainGreeting,
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

type CompanyVerificationEmailInput = {
  companyName: string;
  host: string;
  code: string;
  locale: Locale;
};

/**
 * The one-time code that proves the sender can read mail on the company's
 * domain. No link on purpose: the code is typed on the page that asked for it,
 * so a forwarded email cannot verify a page by itself.
 */
export function buildCompanyVerificationEmail(input: CompanyVerificationEmailInput) {
  const email = getDictionary(input.locale).emails.companyVerification;
  const intro = email.intro
    .replace("{company}", escapeHtml(input.companyName))
    .replace("{host}", escapeHtml(input.host));
  const plainIntro = email.intro
    .replace("{company}", input.companyName)
    .replace("{host}", input.host);

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">${intro}</p>
    <p style="margin: 0 0 4px 0; font-size: 13px; color: #64748b;">${escapeHtml(email.codeLabel)}</p>
    <p style="margin: 0 0 16px 0; font-size: 32px; font-weight: 700; letter-spacing: 0.3em; color: #0f172a;">${escapeHtml(input.code)}</p>
    <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #334155;">${escapeHtml(email.validity)}</p>
    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">${escapeHtml(email.ignore)}</p>
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">${escapeHtml(email.signature)}</p>`;

  const text = [
    plainIntro,
    "",
    `${email.codeLabel}: ${input.code}`,
    email.validity,
    "",
    email.ignore,
    "",
    email.signature,
  ].join("\n");

  return {
    subject: email.subject
      .replace("{company}", input.companyName)
      .replace("{code}", input.code),
    html: renderEmailShell(input.locale, bodyHtml),
    text,
  };
}

type ApplicationReceivedEmailInput = {
  recipientName: string;
  applicantName: string;
  vacancyTitle: string;
  companyName: string;
  url: string;
  locale: Locale;
};

/**
 * A candidate applied. Who and to what, nothing more: the message and the
 * contacts stay on the site, behind the team's sign-in.
 */
export function buildApplicationReceivedEmail(input: ApplicationReceivedEmailInput) {
  const email = getDictionary(input.locale).emails.applicationReceived;
  const greeting = input.recipientName ? email.greeting : email.greetingNoName;
  const fill = (template: string, escape: boolean) => {
    const value = (text: string) => (escape ? escapeHtml(text) : text);
    return template
      .replace("{name}", value(input.recipientName || ""))
      .replace("{candidate}", value(input.applicantName || email.someone))
      .replace("{vacancy}", value(input.vacancyTitle))
      .replace("{company}", value(input.companyName));
  };

  const bodyHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: #0f172a;">${fill(greeting, true)}</h1>
    <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #334155;">${fill(email.intro, true)}</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">${escapeHtml(email.body)}</p>
    ${ctaButton(email.cta, input.url)}
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">${escapeHtml(email.signature)}</p>`;

  const text = [
    fill(greeting, false),
    fill(email.intro, false),
    email.body,
    "",
    `${email.cta}: ${input.url}`,
    "",
    email.signature,
  ].join("\n");

  return { subject: fill(email.subject, false), html: renderEmailShell(input.locale, bodyHtml), text };
}

type ApplicationStatusEmailInput = {
  recipientName: string;
  vacancyTitle: string;
  companyName: string;
  notice: "shortlisted" | "rejected" | "hired";
  url: string;
  locale: Locale;
};

/**
 * The company decided: shortlisted, rejected or hired. A rejection reads as a
 * short, kind note rather than silence.
 */
export function buildApplicationStatusEmail(input: ApplicationStatusEmailInput) {
  const email = getDictionary(input.locale).emails.applicationStatus;
  const greeting = input.recipientName ? email.greeting : email.greetingNoName;
  const copy = email[input.notice];
  const fill = (template: string, escape: boolean) => {
    const value = (text: string) => (escape ? escapeHtml(text) : text);
    return template
      .replace("{name}", value(input.recipientName || ""))
      .replace("{vacancy}", value(input.vacancyTitle))
      .replace("{company}", value(input.companyName));
  };

  const bodyHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: #0f172a;">${fill(greeting, true)}</h1>
    <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #334155;">${fill(copy.intro, true)}</p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">${fill(copy.body, true)}</p>
    ${ctaButton(email.cta, input.url)}
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">${escapeHtml(email.signature)}</p>`;

  const text = [
    fill(greeting, false),
    fill(copy.intro, false),
    fill(copy.body, false),
    "",
    `${email.cta}: ${input.url}`,
    "",
    email.signature,
  ].join("\n");

  return { subject: fill(copy.subject, false), html: renderEmailShell(input.locale, bodyHtml), text };
}

export type JobAlertEmailItem = {
  title: string;
  company: string;
  /** "Internship · 500–800 USD per month · Remote", already worded. */
  details: string;
  url: string;
};

export type JobAlertEmailSection = {
  name: string;
  items: JobAlertEmailItem[];
  /** Matches not listed in the email. */
  more: number;
  moreUrl: string;
};

type JobAlertDigestEmailInput = {
  recipientName: string;
  sections: JobAlertEmailSection[];
  total: number;
  manageUrl: string;
  /** The page that turns these emails off; null without the service key. */
  unsubscribeUrl: string | null;
  locale: Locale;
};

/**
 * The morning job alert: new vacancies, grouped by the alert that found them.
 * Every vacancy links to its page; the footer turns the emails off in one
 * click, without signing in.
 */
export function buildJobAlertDigestEmail(input: JobAlertDigestEmailInput) {
  const email = getDictionary(input.locale).emails.jobAlert;
  const greeting = input.recipientName
    ? email.greeting.replace("{name}", input.recipientName)
    : email.greetingNoName;
  const subject = formatCount(input.total, email.subject, input.locale);

  const sectionsHtml = input.sections
    .map((section) => {
      const items = section.items
        .map(
          (item) => `
        <li style="padding: 12px 0; border-top: 1px solid #e6edf5;">
          <a href="${escapeHtml(item.url)}" style="font-size: 15px; font-weight: 600; line-height: 1.4; color: #0f172a; text-decoration: none;">${escapeHtml(item.title)}</a>
          <div style="margin-top: 2px; font-size: 13px; line-height: 1.5; color: #64748b;">${escapeHtml([item.company, item.details].filter(Boolean).join(" · "))}</div>
        </li>`,
        )
        .join("");
      const more =
        section.more > 0
          ? `<p style="margin: 8px 0 0 0; font-size: 14px;"><a href="${escapeHtml(section.moreUrl)}" style="color: #b45309;">${escapeHtml(formatCount(section.more, email.more, input.locale))}</a></p>`
          : "";

      return `
    <h2 style="margin: 24px 0 4px 0; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b;">${escapeHtml(section.name)}</h2>
    <ul style="list-style: none; margin: 0; padding: 0;">${items}</ul>${more}`;
    })
    .join("");

  const footerLinks = [
    `<a href="${escapeHtml(input.manageUrl)}" style="color: #94a3b8;">${escapeHtml(email.manage)}</a>`,
    input.unsubscribeUrl
      ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #94a3b8;">${escapeHtml(email.unsubscribe)}</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const bodyHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: #0f172a;">${escapeHtml(greeting)}</h1>
    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">${escapeHtml(email.intro)}</p>
    ${sectionsHtml}
    ${ctaButton(email.cta, input.manageUrl)}
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">${escapeHtml(email.footer)}<br />${footerLinks}</p>`;

  const text = [
    greeting,
    email.intro,
    ...input.sections.flatMap((section) => [
      "",
      section.name.toUpperCase(),
      ...section.items.map(
        (item) => `- ${item.title} (${[item.company, item.details].filter(Boolean).join(" · ")})\n  ${item.url}`,
      ),
      section.more > 0 ? `${formatCount(section.more, email.more, input.locale)}: ${section.moreUrl}` : "",
    ]),
    "",
    `${email.cta}: ${input.manageUrl}`,
    "",
    email.footer,
    input.unsubscribeUrl ? `${email.unsubscribe}: ${input.unsubscribeUrl}` : "",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    .trim();

  return { subject, html: renderEmailShell(input.locale, bodyHtml), text };
}
