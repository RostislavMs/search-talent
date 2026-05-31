"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextComposer from "@/components/rich-text-composer";
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
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";

function inferAssetKind(file: File) {
  return file.type.startsWith("video/") ? "video" : "image";
}

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
};

export default function ArticleComposer({
  locale,
  categories,
  isAdmin,
  editArticle,
}: {
  locale: string;
  categories: ArticleCategory[];
  isAdmin: boolean;
  editArticle?: EditableArticle | null;
}) {
  const router = useRouter();
  const isUkrainian = locale === "uk";
  const availableCategories = useMemo(
    () =>
      sortArticleCategories(
        categories.filter((item) => isAdmin || !item.adminOnly),
        locale,
      ),
    [categories, isAdmin, locale],
  );
  const [title, setTitle] = useState(editArticle?.title || "");
  const [excerpt, setExcerpt] = useState(editArticle?.excerpt || "");
  const [content, setContent] = useState(editArticle?.content || "");
  const [categorySlug, setCategorySlug] = useState(
    editArticle?.categorySlug ||
      availableCategories[0]?.slug ||
      "",
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(editArticle?.coverImageUrl || null);
  const [coverImageStoragePath, setCoverImageStoragePath] = useState<
    string | null
  >(editArticle?.coverImageStoragePath || null);
  const [heroVideoUrl, setHeroVideoUrl] = useState<string | null>(editArticle?.heroVideoUrl || null);
  const [heroVideoStoragePath, setHeroVideoStoragePath] = useState<
    string | null
  >(editArticle?.heroVideoStoragePath || null);
  const [saving, setSaving] = useState<null | "draft" | "published">(null);
  const [uploadingAsset, setUploadingAsset] = useState<
    null | "cover" | "hero" | "inline"
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isEditing = Boolean(editArticle?.id);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: editArticle?.title || "",
        excerpt: editArticle?.excerpt || "",
        content: editArticle?.content || "",
        categorySlug:
          editArticle?.categorySlug || availableCategories[0]?.slug || "",
        coverImageUrl: editArticle?.coverImageUrl || null,
        heroVideoUrl: editArticle?.heroVideoUrl || null,
      }),
    [editArticle, availableCategories],
  );

  const currentSnapshot = JSON.stringify({
    title,
    excerpt,
    content,
    categorySlug,
    coverImageUrl,
    heroVideoUrl,
  });
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
        contentNote:
          "Контент зберігається як rich text із форматуванням та медіа.",
        saveDraft: "Зберегти чернетку",
        publishNow: "Опублікувати",
        remove: "Прибрати",
        error: "Не вдалося зберегти статтю.",
        placeholder:
          "Почніть писати, додайте заголовки, цитати, списки й вставляйте медіа прямо в полотно.",
      }
    : {
        pageTitle: isEditing ? "Edit article" : "New article",
        editorLabel: "Content",
        editorHint:
          "One editor for headings, quotes, lists, emphasis, links, and media blocks. It behaves like a real writing canvas.",
        sidebarTitle: "Article settings",
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
        contentNote:
          "The body is stored as rich text with formatting and media support.",
        saveDraft: "Save draft",
        publishNow: "Publish now",
        remove: "Remove",
        error: "Could not save the article.",
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
        setCoverImageUrl(publicUrl);
        setCoverImageStoragePath(storagePath);
        return null;
      }

      if (mode === "hero") {
        setHeroVideoUrl(publicUrl);
        setHeroVideoStoragePath(storagePath);
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
    setSaving(nextStatus);
    setErrorMessage(null);

    const url = isEditing ? `/api/articles/${editArticle!.id}` : "/api/articles";
    const method = isEditing ? "PUT" : "POST";

    const result = await apiFetch<{ article?: { slug?: string } }>(url, {
      method,
      body: {
        title,
        excerpt: excerpt.trim() || null,
        content,
        category_slug: categorySlug,
        status: nextStatus,
        cover_image_url: coverImageUrl,
        cover_image_storage_path: coverImageStoragePath,
        hero_video_url: heroVideoUrl,
        hero_video_storage_path: heroVideoStoragePath,
      },
    });

    setSaving(null);

    if (!result.ok) {
      setErrorMessage(result.error || ui.error);
      return;
    }

    if (isEditing) {
      router.refresh();
      return;
    }

    setTitle("");
    setExcerpt("");
    setContent("");
    setCoverImageUrl(null);
    setCoverImageStoragePath(null);
    setHeroVideoUrl(null);
    setHeroVideoStoragePath(null);
    router.refresh();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-5">
        <div>
          <h2 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {ui.pageTitle}
          </h2>
        </div>

        <RichTextComposer
          locale={locale}
          value={content}
          onChange={setContent}
          label={ui.editorLabel}
          hint={ui.editorHint}
          placeholder={ui.placeholder}
          minHeight={520}
          maxLength={50000}
          showYouTube
          contentClassName="min-h-[32rem] text-[15px] leading-8"
          toolbarSuffix={
            <span className="rounded-full border app-border px-3 py-2 text-xs font-medium app-soft">
              {ui.contentNote}
            </span>
          }
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

      <aside className="rounded-panel border app-border bg-[color:var(--surface)]/92 shadow-[0_22px_80px_rgba(2,6,23,0.22)]">
        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {ui.sidebarTitle}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--foreground)]">
              {ui.title}
            </label>
            <input
              className="app-input w-full bg-[color:var(--surface-muted)]"
              placeholder={ui.titlePlaceholder}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[color:var(--foreground)]">
              {ui.excerpt}
            </label>
            <FormTextarea
              className="min-h-28 w-full bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)]"
              placeholder={ui.excerptPlaceholder}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
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
            {coverImageUrl ? (
              <div className="relative overflow-hidden rounded-[1.15rem] border app-border bg-[color:var(--surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt=""
                  className="block max-h-56 w-full object-contain"
                />
                <button
                  type="button"
                  aria-label={ui.remove}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                  onClick={() => {
                    setCoverImageUrl(null);
                    setCoverImageStoragePath(null);
                  }}
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
            {heroVideoUrl ? (
              <div className="relative overflow-hidden rounded-[1.15rem] border app-border bg-[color:var(--surface)]">
                <video
                  src={heroVideoUrl}
                  controls
                  preload="metadata"
                  className="block max-h-56 w-full object-contain"
                />
                <button
                  type="button"
                  aria-label={ui.remove}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                  onClick={() => {
                    setHeroVideoUrl(null);
                    setHeroVideoStoragePath(null);
                  }}
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
