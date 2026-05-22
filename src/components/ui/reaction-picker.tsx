"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type ReactionSummary,
  type ReactionTargetType,
} from "@/lib/constants/reactions";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

type ReactionPickerProps = {
  targetType: ReactionTargetType;
  targetId: string;
  initialReactions?: ReactionSummary[];
  isAuthenticated: boolean;
  size?: "sm" | "md";
};

type ToggleResponse = {
  active: boolean;
  reactions: ReactionSummary[];
};

function mergeReactions(
  current: ReactionSummary[],
  emoji: ReactionEmoji,
  active: boolean,
): ReactionSummary[] {
  const others = current.filter((entry) => entry.emoji !== emoji);
  const existing = current.find((entry) => entry.emoji === emoji);
  const baseCount = existing?.count ?? 0;
  const wasMine = existing?.reactedByMe ?? false;

  let newCount = baseCount;
  if (active && !wasMine) newCount += 1;
  if (!active && wasMine) newCount = Math.max(0, baseCount - 1);

  if (newCount === 0) {
    return [...others].sort(
      (a, b) =>
        REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji),
    );
  }

  return [
    ...others,
    {
      emoji,
      count: newCount,
      reactedByMe: active,
    },
  ].sort(
    (a, b) =>
      REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji),
  );
}

export default function ReactionPicker({
  targetType,
  targetId,
  initialReactions = [],
  isAuthenticated,
  size = "md",
}: ReactionPickerProps) {
  const dictionary = useDictionary();
  const router = useLocalizedRouter();
  const loginPath = `/${router.locale}/login`;
  const [reactions, setReactions] = useState<ReactionSummary[]>(
    [...initialReactions].sort(
      (a, b) =>
        REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji),
    ),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<ReactionEmoji | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;

    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setPickerOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [pickerOpen]);

  const dict = dictionary.reactions;

  const toggle = async (emoji: ReactionEmoji) => {
    if (!isAuthenticated) {
      window.location.assign(loginPath);
      return;
    }

    setPending(emoji);
    setError(null);

    const result = await apiFetch<ToggleResponse>("/api/reactions", {
      method: "POST",
      body: { target_type: targetType, target_id: targetId, emoji },
    });

    setPending(null);
    setPickerOpen(false);

    if (!result.ok) {
      setError(result.error || dict.toggleError);
      return;
    }

    if (result.data.reactions) {
      setReactions(
        [...result.data.reactions].sort(
          (a, b) =>
            REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji),
        ),
      );
    } else {
      setReactions((current) =>
        mergeReactions(current, emoji, result.data.active),
      );
    }
  };

  const pillSizes =
    size === "sm"
      ? "h-7 gap-1 px-2 text-xs"
      : "h-8 gap-1.5 px-2.5 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((entry) => (
        <button
          key={entry.emoji}
          type="button"
          onClick={() => void toggle(entry.emoji)}
          disabled={pending === entry.emoji}
          aria-label={dict.reactedAria
            .replace("{emoji}", entry.emoji)
            .replace("{count}", String(entry.count))}
          aria-pressed={entry.reactedByMe}
          className={[
            "inline-flex cursor-pointer items-center rounded-full border transition-colors",
            pillSizes,
            entry.reactedByMe
              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--foreground)]"
              : "app-border app-panel text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
            pending === entry.emoji ? "opacity-60" : "",
          ].join(" ")}
        >
          <span aria-hidden="true">{entry.emoji}</span>
          <span className="tabular-nums">{entry.count}</span>
        </button>
      ))}

      <div ref={pickerRef} className="relative inline-flex">
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              window.location.assign(loginPath);
              return;
            }
            setPickerOpen((open) => !open);
          }}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          aria-label={dict.addReaction}
          className={[
            "inline-flex cursor-pointer items-center justify-center rounded-full border app-border app-panel text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)] transition-colors",
            size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
          ].join(" ")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M9 10h.01M15 10h.01M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M19 5v3M17.5 6.5h3"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {pickerOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-1 rounded-full border app-border bg-[color:var(--surface)] p-1.5 shadow-lg"
          >
            {REACTION_EMOJIS.map((emoji) => {
              const mine =
                reactions.find((entry) => entry.emoji === emoji)?.reactedByMe ??
                false;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  onClick={() => void toggle(emoji)}
                  disabled={pending === emoji}
                  aria-label={dict.toggleAria.replace("{emoji}", emoji)}
                  className={[
                    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-lg transition-transform hover:scale-110",
                    mine ? "bg-[color:var(--accent-soft)]" : "",
                  ].join(" ")}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <span className="text-xs text-rose-500" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
