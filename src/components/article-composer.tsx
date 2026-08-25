"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import InfoHint from "@/components/ui/info-hint";
import CoAuthorPicker, {
  type CoAuthorOption,
} from "@/components/co-author-picker";
import CoverCropEditor from "@/components/project-form/cover-crop-editor";
import { apiFetch } from "@/lib/api-client";
import {
  getCategoryDisplayName,
  sortArticleCategories,
  type ArticleCategory,
} from "@/lib/articles";
import { MAX_CO_AUTHORS } from "@/lib/co-authors";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { compressImageFile } from "@/lib/image-compression";
import {
  extractPlainTextFromRichText,
  findHeadingOrderIssue,
  type HeadingOrderIssue,
} from "@/lib/rich-text";
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
//
// heroVideo* is legacy: the composer no longer offers a hero video, but the
// fields are still loaded and saved back untouched so editing an older article
// doesn't silently drop the video it was published with.
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
  slug?: string | null;
  status: "draft" | "published";
  coverImageUrl: string | null;
  coverImageStoragePath: string | null;
  heroVideoUrl: string | null;
  heroVideoStoragePath: string | null;
  contentLocale?: "uk" | "en";
  translations?: Partial<Record<ArticleLocale, EditableTranslation>>;
  coAuthors?: CoAuthorOption[];
};

export default function ArticleComposer({
  locale,
  categories,
  isAdmin,
  editArticle,
  initialCategorySlug,
  showHeading = true,
}: {
  locale: string;
  categories: ArticleCategory[];
  isAdmin: boolean;
  editArticle?: EditableArticle | null;
  /** Pre-selected category for a brand-new article (e.g. arriving from /news
   * with ?category=news). Ignored when editing, or when the slug is not in the
   * viewer's available set. */
  initialCategorySlug?: string | null;
  /** Render the page title inside the composer. The new-article page hides it
   * because its hero already shows the title. */
  showHeading?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
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

  // Honour a ?category preset only when it resolves to a category the viewer
  // can actually pick — otherwise fall back to the first available one.
  const presetCategorySlug =
    initialCategorySlug &&
    availableCategories.some((item) => item.slug === initialCategorySlug)
      ? initialCategorySlug
      : null;

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
    editArticle?.categorySlug ||
      presetCategorySlug ||
      availableCategories[0]?.slug ||
      "",
  );
  // Optional custom URL slug, shared across both language versions. Prefilled
  // with the current slug when editing so the author can see and (while it is
  // still a draft) adjust it; frozen once the article is published.
  const [slug, setSlug] = useState(editArticle?.slug || "");
  const [coAuthors, setCoAuthors] = useState<CoAuthorOption[]>(
    editArticle?.coAuthors ?? [],
  );
  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [uploadingAsset, setUploadingAsset] = useState<
    null | "cover" | "inline"
  >(null);
  // Picked cover file waiting to be framed. It becomes the cover only after the
  // crop editor bakes it to the 16:9 the cards and the article hero render.
  const [coverEditorFile, setCoverEditorFile] = useState<File | null>(null);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const isEditing = Boolean(editArticle?.id);
  // Editing an already-published article: "Publish" would just re-save it, and
  // "Save draft" would silently unpublish it — so relabel both to say what they
  // actually do in this context.
  const isPublished = isEditing && editArticle?.status === "published";

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
          editArticle?.categorySlug ||
          presetCategorySlug ||
          availableCategories[0]?.slug ||
          "",
        slug: editArticle?.slug || "",
      }),
    [initialVersions, editArticle, presetCategorySlug, availableCategories],
  );

  // Baseline the dirty check compares against. Starts at the loaded article
  // (initialSnapshot) and, after a successful save, advances to the saved
  // content — otherwise isDirty stays true once the form differs from the
  // originally loaded state, and the unsaved-changes guard keeps firing its
  // beforeunload warning even though everything is already saved.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const currentSnapshot = JSON.stringify({ versions, categorySlug, slug });
  const isDirty =
    saving === null && currentSnapshot !== (savedSnapshot ?? initialSnapshot);

  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const dictionaryCommon = dictionary.common;
  const coAuthorsDict = dictionary.coAuthors;
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
          "Форматуйте текст і додавайте заголовки, списки, цитати, посилання та медіа.",
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
        slug: "URL-адреса (slug)",
        slugOptional: "Необов'язково.",
        slugTooltipLabel: "Пояснення про URL-адресу",
        slugTooltip:
          "Латиниця, цифри й дефіси. Якщо порожнє — згенерується з назви.",
        slugPlaceholder: "напр. moya-korotka-adresa",
        slugLockedHint:
          "Slug зафіксовано після публікації, щоб не ламати наявні посилання.",
        status: "Статус",
        draft: "Чернетка",
        published: "Опублікувати",
        coverTitle: "Обкладинка",
        coverTooltipLabel: "Пояснення про обкладинку",
        coverTooltip:
          "Широке фото для картки статті та верхнього блоку. Після вибору файлу скадруєте його під рекомендований формат 16:9 — саме так обкладинка й показується.",
        coAuthorsTooltipLabel: "Пояснення про співавторів",
        uploadCover: "Завантажити обкладинку",
        replaceCover: "Замінити обкладинку",
        coverDropTitle: "Перетягніть фото сюди",
        coverDropActive: "Відпустіть фото",
        coverDropOr: "або",
        coverFormats: "JPG, PNG або WebP · рекомендовано 16:9",
        coverInvalidType:
          "Обкладинкою може бути лише фото — оберіть файл JPG, PNG або WebP.",
        uploading: "Завантаження...",
        saveDraft: "Зберегти чернетку",
        publishNow: "Опублікувати",
        saveChanges: "Зберегти зміни",
        moveToDraft: "Перевести в чернетку",
        remove: "Прибрати",
        error: "Не вдалося зберегти статтю.",
        toastDraftSaved: "Статтю збережено як чернетку",
        toastPublished: "Статтю опубліковано",
        autoModerationRemoved:
          "Статтю автоматично приховано: вміст не пройшов перевірку (нецензурна лексика, образи або спам). Відредагуйте текст і спробуйте ще раз.",
        placeholder:
          "Почніть писати, додайте заголовки, цитати, списки й вставляйте медіа прямо в полотно.",
      }
    : {
        pageTitle: isEditing ? "Edit article" : "New article",
        editorLabel: "Content",
        editorHint:
          "Format your text and add headings, lists, quotes, links, and media.",
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
        slug: "URL slug",
        slugOptional: "Optional.",
        slugTooltipLabel: "About the URL slug",
        slugTooltip:
          "Latin letters, digits and hyphens. Leave empty to generate it from the title.",
        slugPlaceholder: "e.g. my-short-url",
        slugLockedHint:
          "The slug is locked after publishing so existing links keep working.",
        status: "Status",
        draft: "Draft",
        published: "Publish",
        coverTitle: "Cover image",
        coverTooltipLabel: "About the cover image",
        coverTooltip:
          "A wide photo for the article card and the top of the article. After picking a file you frame it into the recommended 16:9 — exactly how the cover is displayed.",
        coAuthorsTooltipLabel: "About co-authors",
        uploadCover: "Upload cover",
        replaceCover: "Replace cover",
        coverDropTitle: "Drag & drop a photo here",
        coverDropActive: "Drop the photo",
        coverDropOr: "or",
        coverFormats: "JPG, PNG or WebP · 16:9 recommended",
        coverInvalidType:
          "The cover has to be a photo — choose a JPG, PNG, or WebP file.",
        uploading: "Uploading...",
        saveDraft: "Save draft",
        publishNow: "Publish now",
        saveChanges: "Save changes",
        moveToDraft: "Move to draft",
        remove: "Remove",
        error: "Could not save the article.",
        toastDraftSaved: "Article saved as a draft",
        toastPublished: "Article published",
        autoModerationRemoved:
          "This article was automatically hidden: the content did not pass the check (profanity, slurs, or spam). Edit the text and try again.",
        placeholder:
          "Start writing, add headings, quotes, lists, and drop media right into the canvas.",
      };

  // Gate on the type before the crop editor opens. `accept="image/*"` is only a
  // filter — the OS picker lets you switch to "all files", and a drop bypasses
  // it entirely, which used to hand the editor a file it could never decode.
  const handleCoverFile = (file: File | null | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast.error(ui.coverInvalidType);
      return;
    }

    setCoverEditorFile(file);
  };

  const uploadAsset = async (rawFile: File, mode: "cover" | "inline") => {
    setUploadingAsset(mode);

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

      return {
        url: publicUrl,
        label: file.name,
        kind,
      };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ui.error);
      return null;
    } finally {
      setUploadingAsset(null);
    }
  };

  // Turn a heading-outline problem into a reader-facing warning. When both
  // language versions are filled it is prefixed with the language name so the
  // author knows which one to fix.
  const headingIssueMessage = (issue: HeadingOrderIssue, langName?: string) => {
    const quoted = issue.text
      ? isUkrainian
        ? ` — «${issue.text}»`
        : ` — “${issue.text}”`
      : "";
    const body =
      issue.kind === "first"
        ? isUkrainian
          ? `Заголовки мають починатися з «Заголовок 2» (H2), а не з H${issue.level}${quoted}.`
          : `Headings must start with “Heading 2” (H2), not H${issue.level}${quoted}.`
        : isUkrainian
          ? `Порушено порядок заголовків: після H${issue.from} йде H${issue.to}${quoted}. Не пропускайте рівні (H2 → H3 → H4).`
          : `Heading order is broken: H${issue.to} follows H${issue.from}${quoted}. Don't skip levels (H2 → H3 → H4).`;
    return langName ? `${langName}: ${body}` : body;
  };

  const saveArticle = async (nextStatus: "draft" | "published") => {
    // A language version counts as present once it has a title.
    const filledLocales = LOCALES.filter(
      (loc) => versions[loc].title.trim().length > 0,
    );

    if (filledLocales.length === 0) {
      toast.warning(ui.needTitle);
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
        toast.warning(
          isUkrainian
            ? `Додайте текст статті для версії «${lang}».`
            : `Add the article body for the ${lang} version.`,
        );
        setActiveLocale(loc);
        return;
      }
    }

    // Warn (and stop) when a version's heading outline is out of order — a body
    // that opens below H2, or one that skips a level (e.g. H2 straight to H4).
    // A clean H2 → H3 → H4 hierarchy keeps the article readable and SEO-friendly.
    const showLang = filledLocales.length > 1;
    for (const loc of filledLocales) {
      const issue = findHeadingOrderIssue(versions[loc].content);
      if (issue) {
        toast.warning(
          headingIssueMessage(issue, showLang ? LOCALE_NAMES[loc] : undefined),
        );
        setActiveLocale(loc);
        return;
      }
    }

    // Pick the primary (canonical) version. When editing, keep the article's
    // original primary language — otherwise saving from the other UI language
    // would flip content_locale (and the slug, for a not-yet-published draft)
    // to the wrong language. For a new article, or when the original primary
    // was cleared, fall back to the site language / first filled version.
    const existingPrimary: ArticleLocale | null = editArticle
      ? editArticle.contentLocale === "en"
        ? "en"
        : "uk"
      : null;
    const primaryLocale: ArticleLocale =
      existingPrimary && filledLocales.includes(existingPrimary)
        ? existingPrimary
        : filledLocales.includes(siteLocale)
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
      moderationReason?: string | null;
    }>(url, {
      method,
      body: {
        ...toPayload(versions[primaryLocale]),
        category_slug: categorySlug,
        slug: slug.trim() || undefined,
        status: nextStatus,
        content_locale: primaryLocale,
        translations,
        coAuthorUserIds: coAuthors.map((c) => c.userId),
      },
    });

    setSaving(null);

    if (!result.ok) {
      toast.error(result.error || ui.error);
      return;
    }

    // Auto-moderation removed the just-saved article; keep the draft on screen
    // and show the precise reason (which rule + example) returned by the API.
    if (result.data.autoRemoved) {
      toast.error(result.data.moderationReason || ui.autoModerationRemoved);
      return;
    }

    toast.success(
      nextStatus === "published" ? ui.toastPublished : ui.toastDraftSaved,
    );

    // The content is now persisted server-side — advance the dirty baseline so
    // isDirty goes false and the unsaved-changes guard doesn't warn during the
    // refresh or on the next navigation.
    if (isEditing) {
      setSavedSnapshot(JSON.stringify({ versions, categorySlug, slug }));
      router.refresh();
      return;
    }

    // New article saved — mark the form clean so the unsaved-changes guard
    // stays quiet during the transition, then send the author to the articles
    // list.
    setSavedSnapshot(JSON.stringify({ versions, categorySlug, slug }));
    router.push(`/${siteLocale}/articles`);
  };

  return (
    <div className="space-y-6">
      {showHeading ? (
        <h2 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
          {ui.pageTitle}
        </h2>
      ) : null}

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

        {/* Scrolls on its own once taller than the viewport — a sticky column
            without a height cap pins in place and hides its own overflow. */}
        <aside className="app-sticky-pane order-1 rounded-panel border app-border bg-[color:var(--surface)]/92 shadow-[0_22px_80px_rgba(2,6,23,0.22)] xl:order-2 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:self-start">
          <div className="space-y-5 p-5">
            <div className="flex flex-col gap-1.5">
              <div
                className="flex w-full items-center gap-1 rounded-full border app-border bg-[color:var(--surface-muted)] p-1"
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
                        "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
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
              <p className="text-xs leading-5 app-soft">{ui.languageHint}</p>
            </div>

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

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  {ui.slug}
                </label>
                <span className="text-xs font-normal app-soft">
                  {ui.slugOptional}
                </span>
                <InfoHint label={ui.slugTooltipLabel}>{ui.slugTooltip}</InfoHint>
              </div>
              <input
                className="app-input w-full bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={ui.slugPlaceholder}
                value={slug}
                disabled={isPublished}
                onChange={(event) => setSlug(event.target.value)}
                aria-describedby={isPublished ? "article-slug-hint" : undefined}
              />
              {isPublished ? (
                <p id="article-slug-hint" className="text-xs leading-5 app-soft">
                  {ui.slugLockedHint}
                </p>
              ) : null}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  {coAuthorsDict.sectionTitle}
                </label>
                <InfoHint label={ui.coAuthorsTooltipLabel}>
                  <span className="block">{coAuthorsDict.formHint}</span>
                  <span className="mt-1.5 block">
                    {coAuthorsDict.pickerHint.replace(
                      "{max}",
                      String(MAX_CO_AUTHORS),
                    )}
                  </span>
                </InfoHint>
              </div>
              <div className="mt-2">
                <CoAuthorPicker
                  value={coAuthors}
                  onChange={setCoAuthors}
                  locale={locale}
                  showHint={false}
                />
              </div>
            </div>

            {/* Drag-and-drop works over the whole block, so a photo can be
                dropped onto the empty zone or onto an existing cover to
                replace it. */}
            <div
              className="space-y-3 rounded-[1.4rem] border app-border bg-[color:var(--surface-muted)] p-4"
              onDragOver={(event) => {
                event.preventDefault();
                setCoverDragActive(true);
              }}
              onDragLeave={() => setCoverDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setCoverDragActive(false);

                if (uploadingAsset === null) {
                  handleCoverFile(event.dataTransfer.files?.[0]);
                }
              }}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {ui.coverTitle}
                </p>
                <InfoHint label={ui.coverTooltipLabel}>
                  {ui.coverTooltip}
                </InfoHint>
              </div>

              {current.coverImageUrl ? (
                <>
                  <div className="relative overflow-hidden rounded-[1.15rem] border app-border bg-[color:var(--surface)]">
                    {/* Shown in the same 16:9 box the card and the article hero
                        use, so the framing chosen in the editor is what the
                        author sees here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={current.coverImageUrl}
                      alt=""
                      className="block aspect-video w-full object-cover"
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
                  <label className="inline-flex cursor-pointer">
                    <span className="inline-flex items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]">
                      {uploadingAsset === "cover"
                        ? ui.uploading
                        : ui.replaceCover}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploadingAsset !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        handleCoverFile(file);
                      }}
                    />
                  </label>
                </>
              ) : (
                <label
                  className={cx(
                    "flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.15rem] border border-dashed px-4 text-center transition-colors",
                    coverDragActive
                      ? "border-[color:var(--accent)] bg-[color:var(--surface)]"
                      : "app-border hover:border-[color:var(--accent)] hover:bg-[color:var(--surface)]",
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7 app-soft"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {coverDragActive ? ui.coverDropActive : ui.coverDropTitle}
                  </p>
                  <p className="text-xs app-soft">{ui.coverDropOr}</p>
                  <span className="inline-flex items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
                    {uploadingAsset === "cover" ? ui.uploading : ui.uploadCover}
                  </span>
                  <p className="text-[11px] app-soft">{ui.coverFormats}</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingAsset !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      handleCoverFile(file);
                    }}
                  />
                </label>
              )}
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
                {saving === "draft"
                  ? ui.uploading
                  : isPublished
                    ? ui.moveToDraft
                    : ui.saveDraft}
              </Button>
              <Button
                disabled={saving !== null}
                variant="primary"
                onClick={() => void saveArticle("published")}
                className="w-full justify-center"
              >
                {saving === "published"
                  ? ui.uploading
                  : isPublished
                    ? ui.saveChanges
                    : ui.publishNow}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {coverEditorFile ? (
        <CoverCropEditor
          file={coverEditorFile}
          dictionary={dictionary}
          presetKeys={["16:9"]}
          hint={dictionary.forms.coverEditorFixedHint}
          onCancel={() => setCoverEditorFile(null)}
          onConfirm={(cropped) => {
            setCoverEditorFile(null);
            void uploadAsset(cropped, "cover");
          }}
        />
      ) : null}

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
