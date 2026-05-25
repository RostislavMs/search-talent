"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";

type PinProjectToggleProps = {
  projectId: string;
  initialPinned: boolean;
};

export default function PinProjectToggle({
  projectId,
  initialPinned,
}: PinProjectToggleProps) {
  const dictionary = useDictionary();
  const toast = useToast();
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const togglePin = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    const nextPinned = !pinned;

    const result = await apiFetch<{ success: boolean; pinned?: boolean }>(
      `/api/projects/${projectId}/pin`,
      { method: nextPinned ? "POST" : "DELETE" },
    );

    if (!result.ok) {
      toast.error(result.error || dictionary.common.pinFailedMessage);
      setBusy(false);
      return;
    }

    setPinned(nextPinned);
    toast.success(
      nextPinned
        ? dictionary.common.pinSuccessMessage
        : dictionary.common.unpinSuccessMessage,
    );

    startTransition(() => {
      router.refresh();
    });

    setBusy(false);
  };

  const disabled = busy || isPending;

  return (
    <button
      type="button"
      onClick={togglePin}
      disabled={disabled}
      aria-pressed={pinned}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition",
        pinned
          ? "bg-[color:var(--foreground)] text-[color:var(--background)] hover:opacity-90"
          : "border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.134a2.97 2.97 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
      </svg>
      <span>
        {pinned ? dictionary.common.unpinProject : dictionary.common.pinProject}
      </span>
    </button>
  );
}
