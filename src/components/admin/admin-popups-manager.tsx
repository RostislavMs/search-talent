"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import type { PopupKind, SitePopupRecord } from "@/lib/db/popups";
import type { Locale } from "@/lib/i18n/config";

export type AdminPopupsCopy = {
  createButton: string;
  emptyState: string;
  activeBadge: string;
  inactiveBadge: string;
  activate: string;
  deactivate: string;
  edit: string;
  deleteButton: string;
  save: string;
  saving: string;
  cancel: string;
  activeHint: string;
  newPopupTitle: string;
  editPopupTitle: string;
  kindMessage: string;
  kindFeedback: string;
  delayUnit: string;
  fields: {
    kind: string;
    isActive: string;
    delaySeconds: string;
    delayHint: string;
    titleEn: string;
    titleUk: string;
    bodyEn: string;
    bodyUk: string;
    ctaLabelEn: string;
    ctaLabelUk: string;
    ctaHref: string;
    ctaHint: string;
  };
  sections: {
    behavior: string;
    content: string;
    button: string;
  };
  preview: {
    label: string;
    emptyHint: string;
  };
  popupCopy: {
    feedbackCta: string;
    feedbackDefaultTitle: string;
    feedbackDefaultBody: string;
    dismiss: string;
  };
  confirmDeleteTitle: string;
  confirmDeleteMessage: string;
  confirmDeleteButton: string;
  errorFallback: string;
  messageEmptyError: string;
};

// Default feedback copy for both locales, used to pre-fill the editor so
// feedback popups never open with blank fields (they mirror what visitors see).
export type FeedbackDefaults = {
  titleEn: string;
  titleUk: string;
  bodyEn: string;
  bodyUk: string;
};

type FormState = {
  kind: PopupKind;
  isActive: boolean;
  titleEn: string;
  titleUk: string;
  bodyEn: string;
  bodyUk: string;
  ctaLabelEn: string;
  ctaLabelUk: string;
  ctaHref: string;
  delaySeconds: number;
};

const EMPTY_FORM: FormState = {
  kind: "feedback",
  isActive: false,
  titleEn: "",
  titleUk: "",
  bodyEn: "",
  bodyUk: "",
  ctaLabelEn: "",
  ctaLabelUk: "",
  ctaHref: "",
  delaySeconds: 5,
};

function formFromRecord(record: SitePopupRecord): FormState {
  return {
    kind: record.kind,
    isActive: record.is_active,
    titleEn: record.title_en ?? "",
    titleUk: record.title_uk ?? "",
    bodyEn: record.body_en ?? "",
    bodyUk: record.body_uk ?? "",
    ctaLabelEn: record.cta_label_en ?? "",
    ctaLabelUk: record.cta_label_uk ?? "",
    ctaHref: record.cta_href ?? "",
    delaySeconds: record.delay_seconds,
  };
}

// A message popup needs at least a title, body, or button label to render.
function recordHasVisibleContent(record: SitePopupRecord) {
  return [
    record.title_en,
    record.title_uk,
    record.body_en,
    record.body_uk,
    record.cta_label_en,
    record.cta_label_uk,
  ].some((value) => (value ?? "").trim().length > 0);
}

// Fill any blank title/body with the feedback defaults so the editor mirrors
// what the live popup renders. Only empty fields are touched.
function applyFeedbackDefaults(
  form: FormState,
  defaults: FeedbackDefaults,
): FormState {
  return {
    ...form,
    titleEn: form.titleEn || defaults.titleEn,
    titleUk: form.titleUk || defaults.titleUk,
    bodyEn: form.bodyEn || defaults.bodyEn,
    bodyUk: form.bodyUk || defaults.bodyUk,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t app-border pt-5 first:border-0 first:pt-0">
      <p className="mb-3 text-xs font-semibold uppercase tracking-eyebrow app-soft">
        {title}
      </p>
      {children}
    </div>
  );
}

type AdminPopupsManagerProps = {
  popups: SitePopupRecord[];
  copy: AdminPopupsCopy;
  locale: Locale;
  feedbackDefaults: FeedbackDefaults;
};

export default function AdminPopupsManager({
  popups,
  copy,
  locale,
  feedbackDefaults,
}: AdminPopupsManagerProps) {
  const router = useRouter();

  // `"new"` opens the create form; an id opens that popup's editor; null closes.
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const kindOptions = [
    { value: "feedback", label: copy.kindFeedback },
    { value: "message", label: copy.kindMessage },
  ];

  function openCreate() {
    // New popups default to the feedback kind, so seed the default copy.
    setForm(applyFeedbackDefaults(EMPTY_FORM, feedbackDefaults));
    setError(null);
    setEditingId("new");
  }

  function openEdit(record: SitePopupRecord) {
    const base = formFromRecord(record);
    setForm(
      record.kind === "feedback"
        ? applyFeedbackDefaults(base, feedbackDefaults)
        : base,
    );
    setError(null);
    setEditingId(record.id);
  }

  function closeEditor() {
    setEditingId(null);
    setError(null);
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeKind(kind: PopupKind) {
    setForm((current) => {
      const next = { ...current, kind };
      // Switching to feedback seeds the default copy into any blank fields.
      return kind === "feedback"
        ? applyFeedbackDefaults(next, feedbackDefaults)
        : next;
    });
  }

  function hasVisibleContent(state: FormState) {
    return [
      state.titleEn,
      state.titleUk,
      state.bodyEn,
      state.bodyUk,
      state.ctaLabelEn,
      state.ctaLabelUk,
    ].some((value) => value.trim().length > 0);
  }

  function apiCall(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
    return apiFetch(url, { method, body });
  }

  async function handleSave() {
    // A message popup with no content would render nothing (and never appear),
    // so block it before hitting the API. Feedback popups fall back to defaults.
    if (form.kind === "message" && !hasVisibleContent(form)) {
      setError(copy.messageEmptyError);
      return;
    }

    setPending(true);
    setError(null);

    const payload = {
      kind: form.kind,
      isActive: form.isActive,
      titleEn: form.titleEn,
      titleUk: form.titleUk,
      bodyEn: form.bodyEn,
      bodyUk: form.bodyUk,
      ctaLabelEn: form.ctaLabelEn,
      ctaLabelUk: form.ctaLabelUk,
      ctaHref: form.ctaHref,
      delaySeconds: form.delaySeconds,
    };

    const result =
      editingId === "new"
        ? await apiCall("/api/admin/popups", "POST", payload)
        : await apiCall(`/api/admin/popups/${editingId}`, "PATCH", payload);

    setPending(false);

    if (!result.ok) {
      setError(result.error || copy.errorFallback);
      return;
    }

    setEditingId(null);
    router.refresh();
  }

  async function handleToggleActive(record: SitePopupRecord) {
    // Activating an empty message popup would show nothing to visitors — block
    // it and point the admin at the fix.
    if (
      !record.is_active &&
      record.kind === "message" &&
      !recordHasVisibleContent(record)
    ) {
      setListError(copy.messageEmptyError);
      return;
    }

    setListError(null);
    setTogglingId(record.id);

    const result = await apiCall(`/api/admin/popups/${record.id}`, "PATCH", {
      isActive: !record.is_active,
    });

    setTogglingId(null);

    if (!result.ok) {
      setListError(result.error || copy.errorFallback);
      return;
    }

    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await apiCall(
      `/api/admin/popups/${deleteTarget}`,
      "DELETE",
      undefined,
    );

    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.error || copy.errorFallback);
      return;
    }

    setDeleteTarget(null);
    router.refresh();
  }

  const showCta = form.kind === "message";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate} disabled={editingId !== null}>
          {copy.createButton}
        </Button>
      </div>

      {editingId !== null ? (
        <section className="rounded-hero app-card p-5 sm:p-6">
          <h3 className="font-display text-lg font-medium tracking-tight text-[color:var(--foreground)]">
            {editingId === "new" ? copy.newPopupTitle : copy.editPopupTitle}
          </h3>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <Section title={copy.sections.behavior}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                      {copy.fields.kind}
                    </label>
                    <FormSelect
                      className="w-full"
                      triggerClassName="w-full"
                      value={form.kind}
                      onChange={(value) => changeKind(value as PopupKind)}
                      options={kindOptions}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="popup-delay"
                      className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                    >
                      {copy.fields.delaySeconds}
                    </label>
                    <input
                      id="popup-delay"
                      type="number"
                      min={0}
                      max={600}
                      className="app-input"
                      value={form.delaySeconds}
                      onChange={(event) =>
                        patch(
                          "delaySeconds",
                          Math.max(
                            0,
                            Math.min(600, Number(event.target.value) || 0),
                          ),
                        )
                      }
                    />
                    <p className="mt-1 text-xs app-soft">
                      {copy.fields.delayHint}
                    </p>
                  </div>
                </div>

                <label className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="app-checkbox mt-1"
                    checked={form.isActive}
                    onChange={(event) => patch("isActive", event.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[color:var(--foreground)]">
                      {copy.fields.isActive}
                    </span>
                    <span className="mt-1 block text-xs app-soft">
                      {copy.activeHint}
                    </span>
                  </span>
                </label>
              </Section>

              <Section title={copy.sections.content}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="popup-title-en"
                      className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                    >
                      {copy.fields.titleEn}
                    </label>
                    <input
                      id="popup-title-en"
                      type="text"
                      className="app-input"
                      value={form.titleEn}
                      onChange={(event) => patch("titleEn", event.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="popup-title-uk"
                      className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                    >
                      {copy.fields.titleUk}
                    </label>
                    <input
                      id="popup-title-uk"
                      type="text"
                      className="app-input"
                      value={form.titleUk}
                      onChange={(event) => patch("titleUk", event.target.value)}
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="popup-body-en"
                      className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                    >
                      {copy.fields.bodyEn}
                    </label>
                    <FormTextarea
                      id="popup-body-en"
                      className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
                      value={form.bodyEn}
                      onChange={(event) => patch("bodyEn", event.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="popup-body-uk"
                      className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                    >
                      {copy.fields.bodyUk}
                    </label>
                    <FormTextarea
                      id="popup-body-uk"
                      className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
                      value={form.bodyUk}
                      onChange={(event) => patch("bodyUk", event.target.value)}
                      maxLength={2000}
                    />
                  </div>
                </div>
              </Section>

              {showCta ? (
                <Section title={copy.sections.button}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="popup-cta-label-en"
                        className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                      >
                        {copy.fields.ctaLabelEn}
                      </label>
                      <input
                        id="popup-cta-label-en"
                        type="text"
                        className="app-input"
                        value={form.ctaLabelEn}
                        onChange={(event) =>
                          patch("ctaLabelEn", event.target.value)
                        }
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="popup-cta-label-uk"
                        className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                      >
                        {copy.fields.ctaLabelUk}
                      </label>
                      <input
                        id="popup-cta-label-uk"
                        type="text"
                        className="app-input"
                        value={form.ctaLabelUk}
                        onChange={(event) =>
                          patch("ctaLabelUk", event.target.value)
                        }
                        maxLength={80}
                      />
                    </div>
                  </div>
                  <div className="mt-5">
                    <label
                      htmlFor="popup-cta-href"
                      className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
                    >
                      {copy.fields.ctaHref}
                    </label>
                    <input
                      id="popup-cta-href"
                      type="text"
                      className="app-input"
                      value={form.ctaHref}
                      onChange={(event) => patch("ctaHref", event.target.value)}
                      maxLength={500}
                      placeholder="/articles"
                    />
                    <p className="mt-1 text-xs app-soft">
                      {copy.fields.ctaHint}
                    </p>
                  </div>
                </Section>
              ) : null}

              {error ? (
                <p className="text-sm text-red-500">{error}</p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={closeEditor}
                  disabled={pending}
                >
                  {copy.cancel}
                </Button>
                <Button onClick={() => void handleSave()} disabled={pending}>
                  {pending ? copy.saving : copy.save}
                </Button>
              </div>
            </div>

            <aside className="app-sticky-pane lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:self-start lg:pr-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {copy.preview.label}
              </p>
              <PopupPreview form={form} copy={copy} locale={locale} />
            </aside>
          </div>
        </section>
      ) : null}

      {listError ? (
        <p className="rounded-hero border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">
          {listError}
        </p>
      ) : null}

      {popups.length === 0 ? (
        <p className="rounded-hero app-card p-6 text-sm app-muted">
          {copy.emptyState}
        </p>
      ) : (
        <ul className="space-y-3">
          {popups.map((popup) => {
            const label =
              popup.title_en ||
              popup.title_uk ||
              (popup.kind === "feedback"
                ? copy.kindFeedback
                : copy.kindMessage);

            return (
              <li key={popup.id} className="rounded-hero app-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
                      <span className="rounded-full border border-[color:var(--border)] px-3 py-1">
                        {popup.kind === "feedback"
                          ? copy.kindFeedback
                          : copy.kindMessage}
                      </span>
                      <span
                        className={[
                          "rounded-full px-3 py-1",
                          popup.is_active
                            ? "bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                            : "border border-[color:var(--border)]",
                        ].join(" ")}
                      >
                        {popup.is_active ? copy.activeBadge : copy.inactiveBadge}
                      </span>
                    </div>
                    <p className="mt-3 truncate text-base font-medium text-[color:var(--foreground)]">
                      {label}
                    </p>
                    <p className="mt-1 text-sm app-muted">
                      {popup.delay_seconds}
                      {copy.delayUnit}
                    </p>
                  </div>

                  <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleToggleActive(popup)}
                      disabled={togglingId === popup.id || editingId !== null}
                    >
                      {popup.is_active ? copy.deactivate : copy.activate}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(popup)}
                      disabled={editingId !== null}
                    >
                      {copy.edit}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(popup.id);
                      }}
                      disabled={editingId !== null}
                    >
                      {copy.deleteButton}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={copy.confirmDeleteTitle}
        description={copy.confirmDeleteMessage}
        confirmLabel={copy.confirmDeleteButton}
        cancelLabel={copy.cancel}
        confirmVariant="primary"
        pending={deleting}
        errorMessage={deleteError}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

/**
 * Static replica of the live SitePopup modal card, driven by the current form
 * values so admins see what they are building. Non-interactive.
 */
function PopupPreview({
  form,
  copy,
  locale,
}: {
  form: FormState;
  copy: AdminPopupsCopy;
  locale: Locale;
}) {
  const pick = (uk: string, en: string) => {
    const primary = locale === "uk" ? uk : en;
    const fallback = locale === "uk" ? en : uk;
    return (primary || fallback).trim();
  };

  const isFeedback = form.kind === "feedback";
  const title =
    pick(form.titleUk, form.titleEn) ||
    (isFeedback ? copy.popupCopy.feedbackDefaultTitle : "");
  const body =
    pick(form.bodyUk, form.bodyEn) ||
    (isFeedback ? copy.popupCopy.feedbackDefaultBody : "");
  const ctaLabel = isFeedback
    ? copy.popupCopy.feedbackCta
    : pick(form.ctaLabelUk, form.ctaLabelEn);

  const isEmpty = !isFeedback && !title && !body && !ctaLabel;

  return (
    <div className="rounded-hero border app-border bg-[color:var(--surface-muted)] p-4">
      {isEmpty ? (
        <p className="py-6 text-center text-sm app-soft">
          {copy.preview.emptyHint}
        </p>
      ) : (
        <div className="rounded-panel border app-border bg-[color:var(--surface)] p-5 shadow-lg">
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--brand-soft)] text-[color:var(--brand-on-soft)]"
          >
            {isFeedback ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M12 8h.01M11 11.5h1V16h1"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>

          {title ? (
            <h4 className="font-display mt-3 text-base font-medium tracking-tight text-[color:var(--foreground)]">
              {title}
            </h4>
          ) : null}

          {body ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 app-muted">
              {body}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {ctaLabel ? (
              <span
                className={buttonStyles({
                  size: "sm",
                  className: "pointer-events-none",
                })}
              >
                {ctaLabel}
              </span>
            ) : null}
            <span
              className={buttonStyles({
                variant: "secondary",
                size: "sm",
                className: "pointer-events-none",
              })}
            >
              {copy.popupCopy.dismiss}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
