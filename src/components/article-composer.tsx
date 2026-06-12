"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import {
  getCategoryDisplayName,
  sortArticleCategories,
  type ArticleCategory,
} from "@/lib/articles";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { compressImageFile } from "@/lib/image-compression";
import { extractPlainTextFromRichText } from "@/lib/rich-text";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";

// The rich-text editor (with its lazy-loaded emoji dataset) is a heavy,
// client-only chunk. Splitting it out lets the rest of the article form
// hydrate and become interactive before the editor bundle arrives.
const RichTextComposer = dynamic(
  () => import("@/components/rich-text-composer"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="min-h-[520px] animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]"
      />
    ),
  },
);

function inferAssetKind(file: File) {
  return file.type.startsWith("video/") ? "video" : "image";
}

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

// Languages a bilingual article can be written in — matches the site locales.
const LOCALES = ["uk", "en"] as const;
type ArticleLocale = (typeof LOCALES)[number];
const LOCALE_NAMES: Record<ArticleLocale, string> = {
  uk: "Українська",
  en: "English",
};

// One language version: title, summary, body and media are all per-language.
// The category and status are shared across languages.
type LangVersion = {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
  heroVideoUrl: string | null;
  heroVideoStoragePath: string | null;
};

const emptyVersion = (): LangVersion => ({
  title: "",
  excerpt: "",
  content: "",
  coverImageUrl: null,
  coverImageStoragePath: null,
  heroVideoUrl: null,
  heroVideoStoragePath: null,
});

function versionHasContent(version: LangVersion) {
  return Boolean(
    version.title.trim() ||
      version.excerpt.trim() ||
      extractPlainTextFromRichText(version.content) ||
      version.coverImageUrl ||
      version.heroVideoUrl,
  );
}

type EditableTranslation = {
  title: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
  heroVideoUrl: string | null;
  heroVideoStoragePath: string | null;
};

type EditableArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  categorySlug: string;
  status: "draft" | "published";
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
  heroVideoUrl: string | null;
  heroVideoStoragePath: string | null;
  contentLocale?: "uk" | "en";
  translations?: Partial<Record<ArticleLocale, EditableTranslation>>;
};

export default function ArticleComposer({
  locale,
  categories,
  isAdmin,
  editArticle,
  showHeading = true,
}: {
  locale: string;
  categories: ArticleCategory[];
  isAdmin: boolean;
  editArticle?: EditableArticle | null;
  /** Render the page title inside the composer. The new-article page hides it
   * because its hero already shows the title. */
  showHeading?: boolean;
}) {
  const router = useRouter();
  const isUkrainian = locale === "uk";
  const siteLocale: ArticleLocale = locale === "en" ? "en" : "uk";
  const availableCategories = useMemo(
    () =>
      sortArticleCategories(
        categories.filter((item) => isAdmin || !item.adminOnly),
        locale,
      ),
    [categories, isAdmin, locale],
  );

  // Reconstruct both language versions from the saved article. The primary
  // (top-level) fields belong to `contentLocale`; any secondary version lives
  // in `translations`.
  const initialVersions = useMemo<Record<ArticleLocale, LangVersion>>(() => {
    const base: Record<ArticleLocale, LangVersion> = {
      uk: emptyVersion(),
      en: emptyVersion(),
    };

    if (!editArticle) {
      return base;
    }

    const primaryLocale: ArticleLocale =
      editArticle.contentLocale === "en" ? "en" : "uk";

    base[primaryLocale] = {
      title: editArticle.title || "",
      excerpt: editArticle.excerpt || "",
      content: editArticle.content || "",
      coverImageUrl: editArticle.coverImageUrl || null,
      coverImageStoragePath: editArticle.coverImageStoragePath || null,
      heroVideoUrl: editArticle.heroVideoUrl || null,
      heroVideoStoragePath: editArticle.heroVideoStoragePath || null,
    };

    for (const loc of LOCALES) {
      const translation = editArticle.translations?.[loc];
      if (translation && loc !== primaryLocale) {
        base[loc] = {
          title: translation.title || "",
          excerpt: translation.excerpt || "",
          content: translation.content || "",
          coverImageUrl: translation.coverImageUrl || null,
          coverImageStoragePath: translation.coverImageStoragePath || null,
          heroVideoUrl: translation.heroVideoUrl || null,
          heroVideoStoragePath: translation.heroVideoStoragePath || null,
        };
      }
    }

    return base;
  }, [editArticle]);

  const [versions, setVersions] =
    useState<Record<ArticleLocale, LangVersion>>(initialVersions);
  const [activeLocale, setActiveLocale] = useState<ArticleLocale>(
    editArticle?.contentLocale === "en" ? "en" : editArticle ? "uk" : siteLocale,
  );
  const [categorySlug, setCategorySlug] = useState(
    editArticle?.categorySlug || availableCategories[0]?.slug || "",
  );
  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [uploadingAsset, setUploadingAsset] = useState<
    null | "cover" | "hero" | "inline"
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(editArticle?.id);

  const current = versions[activeLocale];
  const updateActive = (patch: Partial<LangVersion>) =>
    setVersions((prev) => ({
      ...prev,
      [activeLocale]: { ...prev[activeLocale], ...patch },
    }));

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        versions: initialVersions,
        categorySlug:
          editArticle?.categorySlug || availableCategories[0]?.slug || "",
      }),
    [initialVersions, editArticle, availableCategories],
  );

  const currentSnapshot = JSON.stringify({ versions, categorySlug });
  const isDirty = saving === null && currentSnapshot !== initialSnapshot;

  const dictionaryCommon = getDictionary(isLocale(locale) ? locale : "en").common;
  const { isWarningOpen, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (availableCategories.some((item) => item.slug === categorySlug)) {
      return;
    }

    setCategorySlug(availableCategories[0]?.slug || "");
  }, [availableCategories, categorySlug]);

  const ui = isUkrainian
    ? {
        pageTitle: isEditing ? "Редагувати статтю" : "Нова стаття",
        editorLabel: "Зміст",
        editorHint:
          "Один редактор для заголовків, цитат, списків, виділень, посилань та медіа-блоків. Працює як справжнє полотно для написання.",
        sidebarTitle: "Параметри статті",
        languageLabel: "Мова статті",
        languageHint: "Заповніть одну або обидві мови. Друга — необов'язкова.",
        editingIn: "Редагуєте",
        needTitle: "Додайте назву хоча б однією мовою.",
        title: "Назва статті",
        titlePlaceholder: "Введіть назву",
        excerpt: "Короткий опис",
        excerptPlaceholder:
          "Коротко поясніть, про що стаття, чому її варто відкрити і що читач отримає.",
        category: "Категорія",
        status: "Статус",
        draft: "Чернетка",
        published: "Опублікувати",
        coverTitle: "Обкладинка",
        coverHint: "Широке фото або gif для картки та hero-блоку.",
        heroTitle: "Hero-відео",
        heroHint: "Коротке відео для верхнього блоку статті.",
        uploadCover: "Завантажити обкладинку",
        uploadHero: "Завантажити hero-відео",
        uploading: "Завантаження...",
        saveDraft: "Зберегти чернетку",
        publishNow: "Опублікувати",
        remove: "Прибрати",
        error: "Не вдалося зберегти статтю.",
        autoModerationRemoved:
          "Статтю автоматично приховано: вміст не пройшов перевірку (нецензурна лексика, образи або спам). Відредагуйте текст і спробуйте ще раз.",
        placeholder:
          "Почніть писати, додайте заголовки, цитати, списки й вставляйте медіа прямо в полотно.",
      }
    : {
        pageTitle: isEditing ? "Edit article" : "New article",
        editorLabel: "Content",
        editorHint:
          "One editor for headings, quotes, lists, emphasis, links, and media blocks. It behaves like a real writing canvas.",
        sidebarTitle: "Article settings",
        languageLabel: "Article language",
        languageHint: "Fill in one or both languages. The second is optional.",
        editingIn: "Editing",
        needTitle: "Add a title in at least one language.",
        title: "Article title",
        titlePlaceholder: "Enter a title",
        excerpt: "Short summary",
        excerptPlaceholder:
          "Briefly explain what the article is about, why it matters, and what the reader will get from it.",
        category: "Category",
        status: "Status",
        draft: "Draft",
        published: "Publish",
        coverTitle: "Cover image",
        coverHint: "A wide image or gif for the card and article hero block.",
        heroTitle: "Hero video",
        heroHint: "A short video for the top article section.",
        uploadCover: "Upload cover",
        uploadHero: "Upload hero video",
        uploading: "Uploading...",
        saveDraft: "Save draft",
        publishNow: "Publish now",
        remove: "Remove",
        error: "Could not save the article.",
        autoModerationRemoved:
          "This article was automatically hidden: the content did not pass the check (profanity, slurs, or spam). Edit the text and try again.",
        placeholder:
          "Start writing, add headings, quotes, lists, and drop media right into the canvas.",
      };

  const uploadAsset = async (rawFile: File, mode: "cover" | "hero" | "inline") => {
    setUploadingAsset(mode);
    setErrorMessage(null);

    try {
      const kind = inferAssetKind(rawFile);
      const file =
        kind === "image"
          ? await compressImageFile(rawFile, mode === "cover" ? "cover" : "inline")
          : rawFile;

      const presign = await apiFetch<{
        uploadUrl: string;
        publicUrl: string;
        storagePath: string;
      }>("/api/storage/presign", {
        method: "POST",
        body: {
          scope: "article-image",
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
      });

      if (!presign.ok) {
        throw new Error(presign.error || ui.error);
      }

      const { uploadUrl, publicUrl, storagePath } = presign.data;

      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!putResponse.ok) {
        throw new Error(ui.error);
      }

      if (mode === "cover") {
        updateActive({
          coverImageUrl: publicUrl,
          coverImageStoragePath: storagePath,
        });
        return null;
      }

      if (mode === "hero") {
        updateActive({
          heroVideoUrl: publicUrl,
          heroVideoStoragePath: storagePath,
        });
        return null;
      }

      return {
        url: publicUrl,
        label: file.name,
        kind,
      };
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ui.error);
      return null;
    } finally {
      setUploadingAsset(null);
    }
  };

  const saveArticle = async (nextStatus: "draft" | "published") => {
    setErrorMessage(null);

    // A language version counts as present once it has a title.
    const filledLocales = LOCALES.filter(
      (loc) => versions[loc].title.trim().length > 0,
    );

    if (filledLocales.length === 0) {
      setErrorMessage(ui.needTitle);
      return;
    }

    // Each language that has a title must also have a body — otherwise the
    // server rejects it with a generic, language-less error.
    for (const loc of filledLocales) {
      const body = versions[loc].content;
      const bodyIsEmpty =
        !extractPlainTextFromRichText(body) &&
        !/<(?:img|iframe|video|figure)\b/i.test(body);

      if (bodyIsEmpty) {
        const lang = LOCALE_NAMES[loc];
        setErrorMessage(
          isUkrainian
            ? `Додайте текст статті для версії «${lang}».`
            : `Add the article body for the ${lang} version.`,
        );
        setActiveLocale(loc);
        return;
      }
    }

    // Pick the primary (canonical) version. Prefer the author's site language;
    // otherwise use whichever language was actually filled in.
    const primaryLocale: ArticleLocale = filledLocales.includes(siteLocale)
      ? siteLocale
      : filledLocales[0];

    const toPayload = (version: LangVersion) => ({
      title: version.title,
      excerpt: version.excerpt.trim() || null,
      content: version.content,
      cover_image_url: version.coverImageUrl,
      cover_image_storage_path: version.coverImageStoragePath,
      hero_video_url: version.heroVideoUrl,
      hero_video_storage_path: version.heroVideoStoragePath,
    });

    const translations: Record<string, ReturnType<typeof toPayload>> = {};
    for (const loc of filledLocales) {
      if (loc === primaryLocale) {
        continue;
      }
      translations[loc] = toPayload(versions[loc]);
    }

    setSaving(nextStatus);

    const url = isEditing ? `/api/articles/${editArticle!.id}` : "/api/articles";
    const method = isEditing ? "PUT" : "POST";

    const result = await apiFetch<{
      article?: { slug?: string };
      autoRemoved?: boolean;
    }>(url, {
      method,
      body: {
        ...toPayload(versions[primaryLocale]),
        category_slug: categorySlug,
        status: nextStatus,
        content_locale: primaryLocale,
        translations,
      },
    });

    setSaving(null);

    if (!result.ok) {
      setErrorMessage(result.error || ui.error);
      return;
    }

    // Auto-moderation removed the just-saved article; keep the draft on screen.
    if (result.data.autoRemoved) {
      setErrorMessage(ui.autoModerationRemoved);
      return;
    }

    if (isEditing) {
      router.refresh();
      return;
    }

    setVersions({ uk: emptyVersion(), en: emptyVersion() });
    setActiveLocale(siteLocale);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div
        className={cx(
          "flex flex-col gap-4 sm:flex-row sm:items-center",
          showHeading ? "sm:justify-between" : "sm:justify-end",
        )}
      >
        {showHeading ? (
          <h2 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {ui.pageTitle}
          </h2>
        ) : null}

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
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition sm:flex-none sm:justify-start",
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
                      filled ? "bg-orange-400" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
          <p className="max-w-sm text-xs leading-5 app-soft sm:text-right">
            {ui.languageHint}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="order-2 space-y-5 xl:order-1">
          <RichTextComposer
            key={activeLocale}
            locale={locale}
            value={current.content}
            onChange={(value) => updateActive({ content: value })}
            label={ui.editorLabel}
            hint={ui.editorHint}
            placeholder={ui.placeholder}
            minHeight={520}
            maxLength={50000}
            showYouTube
            stickyToolbar
            contentClassName="min-h-[32rem] text-[15px] leading-8"
            onUploadInlineAsset={async (file) => {
              const result = await uploadAsset(file, "inline");

              if (!result) {
                return null;
              }

              return {
                url: result.url,
                label: file.name,
              };
            }}
          />
        </section>

        <aside className="order-1 rounded-panel border app-border bg-[color:var(--surface)]/92 shadow-[0_22px_80px_rgba(2,6,23,0.22)] xl:order-2 xl:sticky xl:top-20 xl:self-start">
          <div className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {ui.sidebarTitle}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border app-border px-2.5 py-1 text-xs font-medium app-muted">
                {ui.editingIn}: {LOCALE_NAMES[activeLocale]}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">
                {ui.title}
              </label>
              <input
                className="app-input w-full bg-[color:var(--surface-muted)]"
                placeholder={ui.titlePlaceholder}
                value={current.title}
                onChange={(event) => updateActive({ title: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">
                {ui.excerpt}
              </label>
              <FormTextarea
                className="min-h-28 w-full bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
                placeholder={ui.excerptPlaceholder}
                value={current.excerpt}
                onChange={(event) => updateActive({ excerpt: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--foreground)]">
                {ui.category}
              </label>
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

            <div className="space-y-3 rounded-[1.4rem] border app-border bg-[color:var(--surface-muted)] p-4">
              <div>
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {ui.coverTitle}
                </p>
                <p className="mt-1 text-sm app-muted">{ui.coverHint}</p>
              </div>
              <label className="inline-flex cursor-pointer">
                <span className="inline-flex items-center rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                  {uploadingAsset === "cover" ? ui.uploading : ui.uploadCover}
                </span>
                <input
                  type="file"
                  accept="image/*,image/gif"
                  className="sr-only"
                  disabled={uploadingAsset !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    void uploadAsset(file, "cover");
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
                      updateActive({
                        coverImageUrl: null,
                        coverImageStoragePath: null,
                      })
                    }
                  >
                    <span aria-hidden>✕</span>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-[1.4rem] border app-border bg-[color:var(--surface-muted)] p-4">
              <div>
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {ui.heroTitle}
                </p>
                <p className="mt-1 text-sm app-muted">{ui.heroHint}</p>
              </div>
              <label className="inline-flex cursor-pointer">
                <span className="inline-flex items-center rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                  {uploadingAsset === "hero" ? ui.uploading : ui.uploadHero}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  disabled={uploadingAsset !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    void uploadAsset(file, "hero");
                    event.target.value = "";
                  }}
                />
              </label>
              {current.heroVideoUrl ? (
                <div className="relative overflow-hidden rounded-[1.15rem] border app-border bg-[color:var(--surface)]">
                  <video
                    src={current.heroVideoUrl}
                    controls
                    preload="metadata"
                    className="block max-h-56 w-full object-contain"
                  />
                  <button
                    type="button"
                    aria-label={ui.remove}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                    onClick={() =>
                      updateActive({
                        heroVideoUrl: null,
                        heroVideoStoragePath: null,
                      })
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
                onClick={() => void saveArticle("draft")}
                className="w-full justify-center"
              >
                {saving === "draft" ? ui.uploading : ui.saveDraft}
              </Button>
              <Button
                disabled={saving !== null}
                variant="primary"
                onClick={() => void saveArticle("published")}
                className="w-full justify-center"
              >
                {saving === "published" ? ui.uploading : ui.publishNow}
              </Button>
              {errorMessage ? (
                <p className="text-sm text-rose-500">{errorMessage}</p>
              ) : null}
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
