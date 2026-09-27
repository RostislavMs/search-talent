"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import QrCode, { downloadQrPng } from "@/components/ui/qr-code";
import { SHARE_SERVICES } from "@/components/ui/share-button";
import { useToast } from "@/components/ui/toast";
import { useDictionary } from "@/lib/i18n/client";

// Where people actually put a portfolio link, most likely first.
const SERVICE_ORDER = ["LinkedIn", "Telegram", "Facebook", "X"];
const SERVICES = SERVICE_ORDER.flatMap((key) =>
  SHARE_SERVICES.filter((service) => service.key === key),
);

function withoutProtocol(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Everything needed to hand out a portfolio: the link with a copy button,
 * share links and a QR code that downloads as a PNG. Laid out inline (not a
 * popover like `ShareButton`), for places with room for it.
 *
 * `onShared` fires on the first copy, share or QR download, so the caller can
 * tick "shared the link" off the newcomer checklist.
 */
export default function ProfileSharePanel({
  profileUrl,
  fileSlug,
  onShared,
}: {
  /** Absolute URL of the public portfolio page. */
  profileUrl: string;
  /** Used in the QR file name: `searchtalent-<slug>-qr.png`. */
  fileSlug: string;
  onShared?: () => void;
}) {
  const dictionary = useDictionary();
  const t = dictionary.profileShare;
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const displayUrl = withoutProtocol(profileUrl);
  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(t.shareText);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      onShared?.();
    } catch {
      toast.error(t.copyFailed);
    }
  };

  const handleDownloadQr = () => {
    if (downloadQrPng(profileUrl, `searchtalent-${fileSlug}-qr.png`)) {
      onShared?.();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="profile-share-link" className="text-sm font-medium text-[color:var(--foreground)]">
          {t.linkLabel}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="profile-share-link"
            type="text"
            readOnly
            value={displayUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="app-input min-w-0 flex-1 font-mono text-sm"
          />
          <Button onClick={handleCopy} className="shrink-0 justify-center" aria-live="polite">
            {copied ? t.copied : t.copy}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[color:var(--foreground)]">{t.shareOn}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICES.map((service) => (
            <a
              key={service.key}
              href={service.href(encodedUrl, encodedText)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShared?.()}
              className={buttonStyles({ variant: "secondary", size: "sm", className: "gap-2" })}
            >
              {service.icon}
              <span>{service.label}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border app-border p-4 sm:flex-row sm:items-center">
        <QrCode
          value={profileUrl}
          label={t.qrLabel.replace("{url}", displayUrl)}
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
    </div>
  );
}
