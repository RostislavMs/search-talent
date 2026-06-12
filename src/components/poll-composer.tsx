"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import PollQuestionBuilder, {
  emptyQuestion,
  serializeQuestions,
  type QuestionDraft,
} from "@/components/poll-question-builder";
import { apiFetch } from "@/lib/api-client";
import { getCategoryDisplayName, sortArticleCategories } from "@/lib/articles";
import type { PollCategory } from "@/lib/polls";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { compressImageFile } from "@/lib/image-compression";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";

const RichTextComposer = dynamic(() => import("@/components/rich-text-composer"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="min-h-[320px] animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]"
    />
  ),
});

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const LOCALES = ["uk", "en"] as const;
type PollLocale = (typeof LOCALES)[number];
const LOCALE_NAMES: Record<PollLocale, string> = { uk: "Українська", en: "English" };

type LangVersion = {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
};

const emptyVersion = (): LangVersion => ({
  title: "",
  excerpt: "",
  content: "",
  coverImageUrl: null,
  coverImageStoragePath: null,
});

function versionHasContent(version: LangVersion) {
  return Boolean(version.title.trim() || version.excerpt.trim() || version.coverImageUrl);
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export type EditableTranslation = {
  title: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
};

export type EditablePoll = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  categorySlug: string;
  status: "draft" | "published";
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
  contentLocale?: "uk" | "en";
  translations?: Partial<Record<PollLocale, EditableTranslation>>;
  closesAt: string | null;
  questions: QuestionDraft[];
  locked: boolean;
};

export default function PollComposer({
  locale,
  categories,
  isAdmin,
  editPoll,
}: {
  locale: string;
  categories: PollCategory[];
  isAdmin: boolean;
  editPoll?: EditablePoll | null;
}) {
  const router = useRouter();
  const isUkrainian = locale === "uk";
  const siteLocale: PollLocale = locale === "en" ? "en" : "uk";
  const availableCategories = useMemo(
    () => sortArticleCategories(categories.filter((item) => isAdmin || !item.adminOnly), locale),
    [categories, isAdmin, locale],
  );

  const initialVersions = useMemo<Record<PollLocale, LangVersion>>(() => {
    const base: Record<PollLocale, LangVersion> = { uk: emptyVersion(), en: emptyVersion() };
    if (!editPoll) return base;

    const primaryLocale: PollLocale = editPoll.contentLocale === "en" ? "en" : "uk";
    base[primaryLocale] = {
      title: editPoll.title || "",
      excerpt: editPoll.excerpt || "",
      content: editPoll.content || "",
      coverImageUrl: editPoll.coverImageUrl || null,
      coverImageStoragePath: editPoll.coverImageStoragePath || null,
    };

    for (const loc of LOCALES) {
      const translation = editPoll.translations?.[loc];
      if (translation && loc !== primaryLocale) {
        base[loc] = {
          title: translation.title || "",
          excerpt: translation.excerpt || "",
          content: translation.content || "",
          coverImageUrl: translation.coverImageUrl || null,
          coverImageStoragePath: translation.coverImageStoragePath || null,
        };
      }
    }
    return base;
  }, [editPoll]);

  const [versions, setVersions] = useState<Record<PollLocale, LangVersion>>(initialVersions);
  const [activeLocale, setActiveLocale] = useState<PollLocale>(
    editPoll?.contentLocale === "en" ? "en" : editPoll ? "uk" : siteLocale,
  );
  const [categorySlug, setCategorySlug] = useState(
    editPoll?.categorySlug || availableCategories[0]?.slug || "",
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    editPoll?.questions?.length ? editPoll.questions : [emptyQuestion()],
  );
  const [closesAtLocal, setClosesAtLocal] = useState(toLocalInput(editPoll?.closesAt ?? null));
  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(editPoll?.id);
  const locked = Boolean(editPoll?.locked);

  const current = versions[activeLocale];
  const updateActive = (patch: Partial<LangVersion>) =>
    setVersions((prev) => ({ ...prev, [activeLocale]: { ...prev[activeLocale], ...patch } }));

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        versions: initialVersions,
        categorySlug: editPoll?.categorySlug || availableCategories[0]?.slug || "",
        questions: editPoll?.questions?.length ? editPoll.questions : [],
        closesAt: editPoll?.closesAt ?? null,
      }),
    [initialVersions, editPoll, availableCategories],
  );
  const currentSnapshot = JSON.stringify({
    versions,
    categorySlug,
    questions,
    closesAt: toIso(closesAtLocal),
  });
  const isDirty = saving === null && currentSnapshot !== initialSnapshot;

  const dictionaryCommon = getDictionary(isLocale(locale) ? locale : "en").common;
  const { isWarningOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (availableCategories.some((item) => item.slug === categorySlug)) return;
    setCategorySlug(availableCategories[0]?.slug || "");
  }, [availableCategories, categorySlug]);

  const ui = isUkrainian
    ? {
        editorLabel: "Опис (необов'язково)",
        editorHint: "Додайте контекст: текст, зображення, відео. Можна лишити порожнім.",
        sidebarTitle: "Параметри опитування",
        languageLabel: "Мова опису",
        languageHint: "Заповніть одну або обидві мови.",
        editingIn: "Редагуєте",
        needTitle: "Додайте назву хоча б однією мовою.",
        needQuestion: "Кожне питання потребує тексту.",
        needOptions: "Питання з варіантами потребує щонайменше двох варіантів.",
        title: "Назва опитування",
        titlePlaceholder: "Введіть назву",
        excerpt: "Короткий опис",
        excerptPlaceholder: "Коротко поясніть, про що опитування.",
        category: "Категорія",
        closesAt: "Дата завершення (необов'язково)",
        coverTitle: "Обкладинка",
        coverHint: "Широке фото для картки.",
        uploadCover: "Завантажити обкладинку",
        uploading: "Завантаження...",
        saveDraft: "Зберегти чернетку",
        publishNow: "Опублікувати",
        remove: "Прибрати",
        error: "Не вдалося зберегти опитування.",
        autoModerationRemoved:
          "Опитування автоматично приховано: вміст не пройшов перевірку (нецензурна лексика, образи або спам). Відредагуйте текст і спробуйте ще раз.",
        placeholder: "Додайте опис до опитування...",
      }
    : {
        editorLabel: "Description (optional)",
        editorHint: "Add context: text, images, video. You can leave it empty.",
        sidebarTitle: "Poll settings",
        languageLabel: "Description language",
        languageHint: "Fill in one or both languages.",
        editingIn: "Editing",
        needTitle: "Add a title in at least one language.",
        needQuestion: "Every question needs a prompt.",
        needOptions: "Choice questions need at least two options.",
        title: "Poll title",
        titlePlaceholder: "Enter a title",
        excerpt: "Short summary",
        excerptPlaceholder: "Briefly explain what this poll is about.",
        category: "Category",
        closesAt: "Close date (optional)",
        coverTitle: "Cover image",
        coverHint: "A wide image for the poll card.",
        uploadCover: "Upload cover",
        uploading: "Uploading...",
        saveDraft: "Save draft",
        publishNow: "Publish now",
        remove: "Remove",
        error: "Could not save the poll.",
        autoModerationRemoved:
          "This poll was automatically hidden: the content did not pass the check (profanity, slurs, or spam). Edit the text and try again.",
        placeholder: "Add a description to your poll...",
      };

  const uploadCover = async (rawFile: File) => {
    setUploadingCover(true);
    setErrorMessage(null);
    try {
      const file = await compressImageFile(rawFile, "cover");
      const presign = await apiFetch<{
        uploadUrl: string;
        publicUrl: string;
        storagePath: string;
      }>("/api/storage/presign", {
        method: "POST",
        body: {
          scope: "poll-cover",
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
      });

      if (!presign.ok) throw new Error(presign.error || ui.error);

      const { uploadUrl, publicUrl, storagePath } = presign.data;
      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putResponse.ok) throw new Error(ui.error);

      updateActive({ coverImageUrl: publicUrl, coverImageStoragePath: storagePath });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ui.error);
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadInline = async (rawFile: File) => {
    try {
      const file = await compressImageFile(rawFile, "inline");
      const presign = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
        "/api/storage/presign",
        {
          method: "POST",
          body: {
            scope: "poll-image",
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size,
          },
        },
      );
      if (!presign.ok) return null;
      const { uploadUrl, publicUrl } = presign.data;
      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putResponse.ok) return null;
      return { url: publicUrl, label: file.name };
    } catch {
      return null;
    }
  };

  const savePoll = async (nextStatus: "draft" | "published") => {
    setErrorMessage(null);

    const filledLocales = LOCALES.filter((loc) => versions[loc].title.trim().length > 0);
    if (filledLocales.length === 0) {
      setErrorMessage(ui.needTitle);
      return;
    }

    if (!locked) {
      for (const question of questions) {
        if (!question.prompt.trim()) {
          setErrorMessage(ui.needQuestion);
          return;
        }
        if (question.type !== "rating") {
          const filledOptions = question.options.filter((o) => o.label.trim().length > 0);
          if (filledOptions.length < 2) {
            setErrorMessage(ui.needOptions);
            return;
          }
        }
      }
    }

    const primaryLocale: PollLocale = filledLocales.includes(siteLocale)
      ? siteLocale
      : filledLocales[0];

    const toPayload = (version: LangVersion) => ({
      title: version.title,
      excerpt: version.excerpt.trim() || null,
      content: version.content,
      cover_image_url: version.coverImageUrl,
      cover_image_storage_path: version.coverImageStoragePath,
    });

    const translations: Record<string, ReturnType<typeof toPayload>> = {};
    for (const loc of filledLocales) {
      if (loc === primaryLocale) continue;
      translations[loc] = toPayload(versions[loc]);
    }

    setSaving(nextStatus);

    const url = isEditing ? `/api/polls/${editPoll!.id}` : "/api/polls";
    const method = isEditing ? "PUT" : "POST";

    const result = await apiFetch<{
      poll?: { slug?: string };
      autoRemoved?: boolean;
    }>(url, {
      method,
      body: {
        ...toPayload(versions[primaryLocale]),
        category_slug: categorySlug,
        status: nextStatus,
        content_locale: primaryLocale,
        translations,
        closes_at: toIso(closesAtLocal),
        questions: serializeQuestions(questions),
      },
    });

    setSaving(null);

    if (!result.ok) {
      setErrorMessage(result.error || ui.error);
      return;
    }

    // Auto-moderation removed the just-saved poll; keep the draft on screen.
    if (result.data.autoRemoved) {
      setErrorMessage(ui.autoModerationRemoved);
      return;
    }

    const slug = result.data.poll?.slug;
    if (slug) {
      router.push(`/${siteLocale}/polls/${slug}`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex w-full flex-col items-start gap-1.5 sm:w-auto sm:items-end">
          <div
            className="flex w-full items-center gap-1 rounded-full border app-border bg-[color:var(--surface-muted)] p-1 sm:inline-flex sm:w-auto"
            role="tablist"
            aria-label={ui.languageLabel}
          >
            {LOCALES.map((loc) => {
              const active = loc === activeLocale;
              const filled = versionHasContent(versions[loc]);
              return (
                <button
                  key={loc}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveLocale(loc)}
                  className={cx(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition sm:flex-none",
                    active
                      ? "bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-sm"
                      : "app-muted hover:text-[color:var(--foreground)]",
                  )}
                >
                  {LOCALE_NAMES[loc]}
                  <span
                    aria-hidden
                    className={cx(
                      "h-1.5 w-1.5 rounded-full transition",
                      filled ? "bg-[color:var(--brand)]" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
          <p className="max-w-sm text-xs leading-5 app-soft sm:text-right">{ui.languageHint}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="order-2 space-y-6 xl:order-1">
          <RichTextComposer
            key={activeLocale}
            locale={locale}
            value={current.content}
            onChange={(value) => updateActive({ content: value })}
            label={ui.editorLabel}
            hint={ui.editorHint}
            placeholder={ui.placeholder}
            minHeight={260}
            maxLength={50000}
            showYouTube
            contentClassName="min-h-[16rem] text-[15px] leading-8"
            onUploadInlineAsset={uploadInline}
          />

          <div className="rounded-panel app-card p-5 sm:p-6">
            <PollQuestionBuilder
              locale={locale}
              questions={questions}
              onChange={setQuestions}
              locked={locked}
            />
          </div>
        </section>

        <aside className="order-1 rounded-panel border app-border bg-[color:var(--surface)]/92 shadow-[0_22px_80px_rgba(2,6,23,0.22)] xl:order-2 xl:sticky xl:top-20 xl:self-start">
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {ui.sidebarTitle}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border app-border px-2.5 py-1 text-xs font-medium app-muted">
                {ui.editingIn}: {LOCALE_NAMES[activeLocale]}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">{ui.title}</label>
              <input
                className="app-input w-full bg-[color:var(--surface-muted)]"
                placeholder={ui.titlePlaceholder}
                value={current.title}
                onChange={(event) => updateActive({ title: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">{ui.excerpt}</label>
              <FormTextarea
                className="min-h-24 w-full bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
                placeholder={ui.excerptPlaceholder}
                value={current.excerpt}
                onChange={(event) => updateActive({ excerpt: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">{ui.category}</label>
              <FormSelect
                className="w-full"
                triggerClassName="w-full bg-[color:var(--surface-muted)]"
                value={categorySlug}
                onChange={setCategorySlug}
                options={availableCategories.map((item) => ({
                  value: item.slug,
                  label: getCategoryDisplayName(item, locale),
                }))}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="poll-closes-at"
                className="text-sm font-medium text-[color:var(--foreground)]"
              >
                {ui.closesAt}
              </label>
              <input
                id="poll-closes-at"
                type="datetime-local"
                aria-label={ui.closesAt}
                className="app-input w-full bg-[color:var(--surface-muted)]"
                value={closesAtLocal}
                onChange={(event) => setClosesAtLocal(event.target.value)}
              />
            </div>

            <div className="space-y-3 rounded-[1.4rem] border app-border bg-[color:var(--surface-muted)] p-4">
              <div>
                <p className="text-sm font-medium text-[color:var(--foreground)]">{ui.coverTitle}</p>
                <p className="mt-1 text-sm app-muted">{ui.coverHint}</p>
              </div>
              <label className="inline-flex cursor-pointer">
                <span className="inline-flex items-center rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                  {uploadingCover ? ui.uploading : ui.uploadCover}
                </span>
                <input
                  type="file"
                  accept="image/*,image/gif"
                  className="sr-only"
                  disabled={uploadingCover}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadCover(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {current.coverImageUrl ? (
                <div className="relative overflow-hidden rounded-[1.15rem] border app-border bg-[color:var(--surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.coverImageUrl}
                    alt=""
                    className="block max-h-56 w-full object-contain"
                  />
                  <button
                    type="button"
                    aria-label={ui.remove}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                    onClick={() =>
                      updateActive({ coverImageUrl: null, coverImageStoragePath: null })
                    }
                  >
                    <span aria-hidden>✕</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t app-border bg-[color:var(--surface-muted)]/45 p-5">
            <div className="space-y-3">
              <Button
                disabled={saving !== null}
                variant="secondary"
                onClick={() => void savePoll("draft")}
                className="w-full justify-center"
              >
                {saving === "draft" ? ui.uploading : ui.saveDraft}
              </Button>
              <Button
                disabled={saving !== null}
                variant="primary"
                onClick={() => void savePoll("published")}
                className="w-full justify-center"
              >
                {saving === "published" ? ui.uploading : ui.publishNow}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-500">{errorMessage}</p> : null}
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={isWarningOpen}
        title={dictionaryCommon.unsavedChangesTitle}
        description={dictionaryCommon.unsavedChangesDescription}
        confirmLabel={dictionaryCommon.unsavedChangesLeave}
        cancelLabel={dictionaryCommon.unsavedChangesStay}
        confirmVariant="primary"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}
