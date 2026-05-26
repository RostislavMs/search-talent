"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";

type PinDuration = "24h" | "3d" | "1w" | "unpin";

function getPinnedUntil(duration: PinDuration): string | null {
  if (duration === "unpin") return null;

  const now = new Date();

  switch (duration) {
    case "24h":
      now.setHours(now.getHours() + 24);
      break;
    case "3d":
      now.setDate(now.getDate() + 3);
      break;
    case "1w":
      now.setDate(now.getDate() + 7);
      break;
  }

  return now.toISOString();
}

export default function ArticlePinButton({
  articleId,
  currentPinnedUntil,
  locale,
}: {
  articleId: string;
  currentPinnedUntil: string | null;
  locale: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPinned = currentPinnedUntil && new Date(currentPinnedUntil) > new Date();

  const ui = locale === "uk"
    ? {
        pin: "Закріпити",
        pinned: "Закріплено",
        title: "Закріпити статтю",
        description: "Стаття буде зверху стрічки протягом обраного терміну.",
        day: "На добу",
        threeDays: "На 3 дні",
        week: "На тиждень",
        unpin: "Відкріпити",
        close: "Закрити",
        saving: "Збереження...",
        error: "Не вдалося закріпити статтю.",
      }
    : {
        pin: "Pin",
        pinned: "Pinned",
        title: "Pin article",
        description: "The article will stay at the top of the feed for the chosen duration.",
        day: "24 hours",
        threeDays: "3 days",
        week: "1 week",
        unpin: "Unpin",
        close: "Close",
        saving: "Saving...",
        error: "Could not pin the article.",
      };

  async function handlePin(duration: PinDuration) {
    setSaving(true);
    setError("");

    const result = await apiFetch(`/api/articles/${articleId}`, {
      method: "PATCH",
      body: { pinned_until: getPinnedUntil(duration) },
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error || ui.error);
      return;
    }

    setIsOpen(false);
    router.refresh();
  }

  const pinOptions: { duration: PinDuration; label: string }[] = [
    { duration: "24h", label: ui.day },
    { duration: "3d", label: ui.threeDays },
    { duration: "1w", label: ui.week },
  ];

  return (
    <>
      <Button
        variant={isPinned ? "primary" : "ghost"}
        onClick={() => setIsOpen(true)}
      >
        {isPinned ? ui.pinned : ui.pin}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 px-4 py-4 sm:items-center sm:px-6">
          <div className="mx-auto w-full max-w-md rounded-hero border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
                  {ui.title}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted">
                  {ui.description}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                {ui.close}
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {pinOptions.map((option) => (
                <Button
                  key={option.duration}
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handlePin(option.duration)}
                  className="w-full justify-center"
                >
                  {saving ? ui.saving : option.label}
                </Button>
              ))}

              {isPinned && (
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void handlePin("unpin")}
                  className="w-full justify-center text-rose-400"
                >
                  {saving ? ui.saving : ui.unpin}
                </Button>
              )}

              {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
