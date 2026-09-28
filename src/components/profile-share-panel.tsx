"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import FormTextarea from "@/components/ui/form-textarea";
import QrCode, { downloadQrPng } from "@/components/ui/qr-code";
import { SHARE_SERVICES, type ShareService } from "@/components/ui/share-button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatOpenToList, type OpenToOption } from "@/lib/open-to";
import { buildBadgeMarkdown } from "@/lib/portfolio-badge";
import { displayUrl, withShareTag } from "@/lib/share-links";

// Where people actually put a portfolio link, most likely first.
const SERVICE_ORDER = ["LinkedIn", "Telegram", "Facebook", "X"];
const SERVICES = SERVICE_ORDER.flatMap((key) =>
  SHARE_SERVICES.filter((service) => service.key === key),
);
// These two take only the link, so the post text goes to the clipboard on the
// click and the person pastes it into the post.
const LINK_ONLY_SERVICES = new Set(["LinkedIn", "Facebook"]);

type CopyTarget = "link" | "post" | "badge";

/** The ready post: one line about the portfolio, plus what the author is open to. */
export function buildPortfolioPost(
  openTo: OpenToOption[],
  dictionary: Pick<Dictionary, "profileShare" | "openTo">,
): string {
  const t = dictionary.profileShare;
  const list = formatOpenToList(openTo, dictionary.openTo.phrases);
  return list ? `${t.postTemplate}\n${t.postOpenTo.replace("{list}", list)}` : t.postTemplate;
}

async function writeClipboard(text: string) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Everything needed to hand out a portfolio: the link, a ready post for
 * LinkedIn and Telegram, a QR code that downloads as a PNG and, optionally, the
 * README badge. Laid out inline (not a popover like `ShareButton`) and shown
 * only to the portfolio's owner: onboarding, "Мій простір" and the "Поділитися"
 * dialog on their own profile.
 *
 * The first copy, share or download ticks "shared the link" off the newcomer
 * checklist. The QR code and the badge carry a share tag (lib/share-links), so
 * the metrics can tell the sign-ups they bring; the link people read stays clean.
 */
export default function ProfileSharePanel({
  profileUrl,
  username,
  openTo = [],
  showBadge = false,
  alreadyShared = false,
  columns = false,
  onShared,
}: {
  /** Absolute URL of the public portfolio page. */
  profileUrl: string;
  /** Names the QR file and the badge. */
  username: string;
  openTo?: OpenToOption[];
  showBadge?: boolean;
  /** The checklist already has "shared the link": no need to record it again. */
  alreadyShared?: boolean;
  /** Two columns on wide screens: sharing on the left, QR and badge on the right. */
  columns?: boolean;
  /**
   * Replaces the built-in "shared the link" record, for a caller that keeps
   * track itself (the onboarding flow, across its steps).
   */
  onShared?: () => void;
}) {
  const dictionary = useDictionary();
  const t = dictionary.profileShare;
  const toast = useToast();
  const sharedRef = useRef(alreadyShared);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [post, setPost] = useState(() => buildPortfolioPost(openTo, dictionary));

  const shownUrl = displayUrl(profileUrl);
  const qrUrl = withShareTag(profileUrl, "qr");
  const badgeUrl = `${new URL(profileUrl).origin}/api/badge/${username}.svg`;
  const badgeMarkdown = buildBadgeMarkdown({
    badgeUrl,
    portfolioUrl: withShareTag(profileUrl, "badge"),
  });
  const postText = post.trim();
  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedPost = encodeURIComponent(postText);

  const markShared = () => {
    if (onShared) {
      onShared();
      return;
    }
    if (sharedRef.current) {
      return;
    }
    sharedRef.current = true;
    void apiFetch("/api/onboarding", { method: "POST", body: { action: "link_shared" } });
  };

  const copy = async (target: CopyTarget, text: string) => {
    try {
      await writeClipboard(text);
      setCopied(target);
      markShared();
    } catch {
      toast.error(t.copyFailed);
    }
  };

  const handleService = (service: ShareService) => {
    markShared();

    if (LINK_ONLY_SERVICES.has(service.key) && postText) {
      // Best effort: if the clipboard is blocked, the text is still on screen.
      writeClipboard(postText).then(
        () => toast.success(t.postCopied),
        () => undefined,
      );
    }
  };

  const handleDownloadQr = () => {
    if (downloadQrPng(qrUrl, `searchtalent-${username}-qr.png`)) {
      markShared();
    }
  };

  const copyLabel = (target: CopyTarget, idle: string) => (copied === target ? t.copied : idle);

  return (
    <div className={columns ? "grid gap-6 lg:grid-cols-2 lg:gap-8" : "space-y-6"}>
      <div className="min-w-0 space-y-6">
        <div>
          <label htmlFor="profile-share-link" className="text-sm font-medium text-[color:var(--foreground)]">
            {t.linkLabel}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="profile-share-link"
              type="text"
              readOnly
              value={shownUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="app-input min-w-0 flex-1 font-mono text-sm"
            />
            <Button
              onClick={() => void copy("link", profileUrl)}
              className="shrink-0 justify-center"
              aria-live="polite"
            >
              {copyLabel("link", t.copy)}
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="profile-share-post" className="text-sm font-medium text-[color:var(--foreground)]">
            {t.postLabel}
          </label>
          <FormTextarea
            id="profile-share-post"
            value={post}
            onChange={(event) => setPost(event.target.value)}
            rows={2}
            maxLength={600}
            className="mt-2 min-h-20 px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs leading-5 app-muted">{t.postHint}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copy("post", postText ? `${postText}\n${profileUrl}` : profileUrl)}
              className="shrink-0"
              aria-live="polite"
            >
              {copyLabel("post", t.copyPost)}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">{t.shareOn}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICES.map((service) => (
              <a
                key={service.key}
                href={service.href(encodedUrl, encodedPost)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleService(service)}
                className={buttonStyles({ variant: "secondary", size: "sm", className: "gap-2" })}
              >
                {service.icon}
                <span>{service.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border app-border p-4 sm:flex-row sm:items-center">
          <QrCode
            value={qrUrl}
            label={t.qrLabel.replace("{url}", shownUrl)}
            className="h-32 w-32 shrink-0 rounded-lg"
          />
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">{t.qrTitle}</p>
            <p className="text-sm app-muted">{t.qrHint}</p>
            <Button variant="secondary" size="sm" onClick={handleDownloadQr}>
              {t.downloadQr}
            </Button>
          </div>
        </div>

        {showBadge ? (
          <div className="space-y-3 rounded-2xl border app-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-[color:var(--foreground)]">{t.badgeTitle}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- our own SVG from /api/badge, shown at its natural size */}
              <img src={badgeUrl} alt={t.badgeAlt} height={20} className="h-5 w-auto" />
            </div>
            <p className="text-sm app-muted">{t.badgeHint}</p>
            <div>
              <label htmlFor="profile-share-badge" className="sr-only">
                {t.badgeSnippetLabel}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="profile-share-badge"
                  type="text"
                  readOnly
                  value={badgeMarkdown}
                  onFocus={(event) => event.currentTarget.select()}
                  className="app-input min-w-0 flex-1 font-mono text-xs"
                />
                <Button
                  variant="secondary"
                  onClick={() => void copy("badge", badgeMarkdown)}
                  className="shrink-0 justify-center"
                  aria-label={`${copyLabel("badge", t.copy)}: ${t.badgeSnippetLabel}`}
                  aria-live="polite"
                >
                  {copyLabel("badge", t.copy)}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
