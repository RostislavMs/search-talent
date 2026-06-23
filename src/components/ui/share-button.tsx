"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDictionary } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";

type ShareButtonProps = {
  /** Absolute URL of the page being shared. */
  url: string;
  /** Page title — used as the share text / native-share title. */
  title?: string;
  /** Which side the popover anchors to on >=sm screens. */
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const PANEL_MAX_WIDTH = 352; // 22rem
const VIEWPORT_MARGIN = 8;

type PanelCoords = { top: number; left: number; width: number; maxHeight: number };

function computeCoords(
  trigger: HTMLElement,
  align: "start" | "end",
): PanelCoords {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(vw - VIEWPORT_MARGIN * 2, PANEL_MAX_WIDTH);
  let left = align === "end" ? rect.right - width : rect.left;
  // Keep the panel fully inside the viewport regardless of anchor side.
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - width - VIEWPORT_MARGIN));
  const top = rect.bottom + VIEWPORT_MARGIN;
  return { top, left, width, maxHeight: vh - top - VIEWPORT_MARGIN };
}

type ShareService = {
  key: string;
  label: string;
  href: (encodedUrl: string, encodedText: string) => string;
  icon: ReactNode;
};

// Brand glyphs are inline so we keep zero icon-library dependencies (the rest of
// the codebase uses inline SVG too). Rendered in currentColor to stay within the
// minimalist, neutral palette — colour is reserved for hover affordance.
const SERVICES: ShareService[] = [
  {
    key: "Telegram",
    label: "Telegram",
    href: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    key: "Facebook",
    label: "Facebook",
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: "X",
    label: "X",
    href: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "LinkedIn",
    label: "LinkedIn",
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: "Email",
    label: "Email",
    href: (u, t) => `mailto:?subject=${t}&body=${u}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function ShareButton({
  url,
  title,
  align = "start",
  className,
  triggerClassName,
}: ShareButtonProps) {
  const dictionary = useDictionary();
  const t = dictionary.share;
  const toast = useToast();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const panelId = useId();

  // Portal needs the DOM; the popover only opens after a client click anyway.
  useEffect(() => {
    setMounted(true);
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  // Track the breakpoint so we can switch between an anchored popover (>=sm)
  // and a centred modal (mobile).
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Re-anchor the desktop popover to the trigger as the layout shifts.
  useEffect(() => {
    if (!isOpen || !isDesktop) return;
    const update = () => {
      if (triggerRef.current) {
        setCoords(computeCoords(triggerRef.current, align));
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, isDesktop, align]);

  // Close on outside click / Escape. The panel lives in a portal (outside the
  // wrapper), so we check both refs explicitly.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const shareText = title || "";
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  function toggle() {
    setIsOpen((prev) => {
      const next = !prev;
      // Compute coords synchronously on open so the panel never flashes at (0,0).
      if (next && isDesktop && triggerRef.current) {
        setCoords(computeCoords(triggerRef.current, align));
      }
      return next;
    });
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      toast.success(t.copied);
      setIsOpen(false);
    } catch {
      toast.error(t.copyFailed);
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: shareText || undefined, url });
      setIsOpen(false);
    } catch {
      // User dismissed the native sheet, or it failed — no toast needed.
    }
  }

  const panelInner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold text-[color:var(--foreground)]">
          {t.panelTitle}
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label={t.close}
          className="-mr-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-lg leading-none app-muted transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
        >
          ×
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={t.panelTitle}
          className="min-w-0 flex-1 rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--border)]"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 cursor-pointer rounded-full bg-[color:var(--brand)] px-4 py-2 text-sm font-medium text-[color:var(--brand-foreground)] transition-colors duration-200 hover:bg-[color:var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          {t.copy}
        </button>
      </div>

      {canNativeShare ? (
        <button
          type="button"
          onClick={handleNativeShare}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border app-border bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        >
          {t.nativeShare}
        </button>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {SERVICES.map((service) => (
          <a
            key={service.key}
            href={service.href(encodedUrl, encodedText)}
            target={service.key === "Email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={`${t.label} · ${service.key}`}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 rounded-xl border app-border bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            <span className="shrink-0 app-muted">{service.icon}</span>
            <span className="truncate">{service.label}</span>
          </a>
        ))}
      </div>
    </>
  );

  const panelClassName =
    "rounded-2xl border app-border bg-[color:var(--surface)] p-4 text-left shadow-[0_28px_90px_rgba(2,6,23,0.4)]";

  return (
    <div ref={wrapperRef} className={cx("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={t.label}
        title={t.label}
        onClick={toggle}
        className={cx(
          "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] transition-colors duration-200 hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
          triggerClassName,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
      </button>

      {isOpen && mounted
        ? createPortal(
            isDesktop ? (
              coords ? (
                <div
                  id={panelId}
                  ref={panelRef}
                  role="dialog"
                  aria-modal="false"
                  aria-label={t.panelTitle}
                  style={{
                    position: "fixed",
                    top: coords.top,
                    left: coords.left,
                    width: coords.width,
                    maxHeight: coords.maxHeight,
                    overflowY: "auto",
                  }}
                  className={cx("z-[120]", panelClassName)}
                >
                  {panelInner}
                </div>
              ) : null
            ) : (
              <>
                <div
                  className="fixed inset-0 z-[110] bg-[rgba(2,6,23,0.55)]"
                  aria-hidden="true"
                  onClick={() => setIsOpen(false)}
                />
                <div
                  id={panelId}
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.panelTitle}
                  className={cx(
                    "fixed left-1/2 top-1/2 z-[120] max-h-[90vh] w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
                    panelClassName,
                  )}
                >
                  {panelInner}
                </div>
              </>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
