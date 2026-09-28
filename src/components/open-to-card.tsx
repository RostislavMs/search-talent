"use client";

import { useState } from "react";
import OpenToPicker from "@/components/open-to-picker";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { formatOpenToList, isOpenToStale, type OpenToOption } from "@/lib/open-to";

type SaveResult = { openTo: OpenToOption[]; updatedAt: string | null };

/**
 * «Відкрито до пропозицій» in My Space and the onboarding: every click saves
 * right away, so the status is on after two clicks (the switch and one
 * option). When the status is two months old it asks whether it still holds.
 */
export default function OpenToCard({
  initialOpenTo,
  initialUpdatedAt,
  className,
}: {
  initialOpenTo: OpenToOption[];
  initialUpdatedAt: string | null;
  className?: string;
}) {
  const dictionary = useDictionary();
  const t = dictionary.openTo;
  const toast = useToast();
  const [openTo, setOpenTo] = useState(initialOpenTo);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  // Captured once: the reminder is about the status the page opened with, and
  // "now" must not change between renders.
  const [openedAt] = useState(() => Date.now());
  const stale = isOpenToStale(openTo, updatedAt, openedAt);

  const save = async (body: { open_to: OpenToOption[] } | { confirm: true }) => {
    setSaving(true);
    const result = await apiFetch<SaveResult>("/api/profile/open-to", { method: "PATCH", body });
    setSaving(false);

    if (!result.ok) {
      return null;
    }

    setUpdatedAt(result.data.updatedAt);
    return result.data;
  };

  const change = async (next: OpenToOption[]) => {
    const previous = openTo;
    setOpenTo(next);

    const saved = await save({ open_to: next });

    if (!saved) {
      setOpenTo(previous);
      toast.error(t.saveFailed);
    }
  };

  const confirm = async () => {
    if (!(await save({ confirm: true }))) {
      toast.error(t.saveFailed);
    }
  };

  return (
    <section className={className} aria-busy={saving}>
      {stale ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl app-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {t.reminderTitle.replace("{list}", formatOpenToList(openTo, t.phrases))}
            </p>
            <p className="mt-1 text-sm app-muted">{t.reminderText}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={confirm} disabled={saving} className="shrink-0">
            {t.reminderConfirm}
          </Button>
        </div>
      ) : null}

      <OpenToPicker value={openTo} onChange={change} disabled={saving} />

      <p className="mt-4 text-sm app-muted">
        <LocalizedLink
          href="/profile/edit?section=professional"
          className="underline decoration-[color:var(--border)] underline-offset-4 transition hover:text-[color:var(--foreground)] hover:decoration-[color:var(--foreground)]"
        >
          {t.moreDetails}
        </LocalizedLink>
      </p>
    </section>
  );
}
