"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { DISCUSSIONS_CATEGORY_SLUG } from "@/lib/articles";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const RichTextComposer = dynamic(
  () => import("@/components/rich-text-composer"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="min-h-[320px] animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]"
      />
    ),
  },
);

type TopicStatus = "draft" | "published";

export type TopicDraft = {
  id: string;
  title: string;
  content: string;
  status: TopicStatus;
};

/**
 * A topic is one continuous thought, not a document: it needs emphasis, links,
 * quotes, lists and code, but not a heading hierarchy competing with the page's
 * own h1, and not decorative rules. Declared at module scope so the editor's
 * feature memo is not invalidated on every render.
 */
const TOPIC_EDITOR_FEATURES = { headings: false, divider: false } as const;

/**
 * The whole form for a discussion topic: a title and a body. Nothing else.
 *
 * Topics are stored as articles in the Discussions category, but that is an
 * implementation detail the author never sees — no cover, no category picker,
 * no translations, no SEO fields, no co-authors, and no draft state. A topic
 * exists to start a conversation, so it publishes straight away; there is
 * nowhere to lose one.
 */
export default function TopicComposer({
  locale,
  editTopic,
}: {
  locale: Locale;
  editTopic?: TopicDraft;
}) {
  const router = useRouter();
  const toast = useToast();
  const dictionary = getDictionary(locale);
  const ui = dictionary.discussions;

  const [title, setTitle] = useState(editTopic?.title ?? "");
  const [content, setContent] = useState(editTopic?.content ?? "");
  const [saving, setSaving] = useState<null | TopicStatus>(null);

  const isEditing = Boolean(editTopic);
  // A published topic cannot be pulled back to a draft: it may already have
  // replies, and unpublishing would hide other people's comments.
  const isPublished = editTopic?.status === "published";
  const isDirty =
    title !== (editTopic?.title ?? "") || content !== (editTopic?.content ?? "");
  const canSubmit = title.trim().length >= 3 && content.trim().length >= 20;

  const { isWarningOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    isDirty && saving === null,
  );

  const submit = async (nextStatus: TopicStatus) => {
    if (!canSubmit || saving) {
      return;
    }

    setSaving(nextStatus);

    const result = await apiFetch<{
      article?: { slug?: string };
      autoRemoved?: boolean;
      moderationReason?: string | null;
    }>(isEditing ? `/api/articles/${editTopic!.id}` : "/api/articles", {
      method: isEditing ? "PUT" : "POST",
      body: {
        title: title.trim(),
        excerpt: null,
        content,
        category_slug: DISCUSSIONS_CATEGORY_SLUG,
        status: nextStatus,
        content_locale: locale,
      },
    });

    setSaving(null);

    if (!result.ok) {
      toast.error(result.error || ui.composerError);
      return;
    }

    // Auto-moderation pulled the topic straight back down; keep the text on
    // screen and show which rule tripped instead of a blank success.
    if (result.data.autoRemoved) {
      toast.error(result.data.moderationReason || ui.composerError);
      return;
    }

    toast.success(
      nextStatus === "published" ? ui.composerPublished : ui.composerDraftSaved,
    );

    // A draft has no public listing, so both cases land on the topic page —
    // where the author sees the draft badge and can keep editing.
    const slug = result.data.article?.slug;
    router.push(
      slug ? `/${locale}/discussions/${slug}` : `/${locale}/discussions`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Same split as the article and poll composers: the writing surface takes
          the width, everything you do to it lives in the sticky right column. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="order-2 xl:order-1">
          <RichTextComposer
            locale={locale}
            value={content}
            onChange={setContent}
            label={ui.composerBodyLabel}
            placeholder={ui.composerBodyPlaceholder}
            minHeight={520}
            maxLength={50000}
            stickyToolbar
            features={TOPIC_EDITOR_FEATURES}
            contentClassName="min-h-[32rem] text-[15px] leading-8"
          />
        </section>

        {/* Scrolls on its own once taller than the viewport — a sticky column
            without a height cap pins in place and hides its own overflow. */}
        <aside className="app-sticky-pane order-1 rounded-panel border app-border bg-[color:var(--surface)]/92 shadow-[0_22px_80px_rgba(2,6,23,0.22)] xl:order-2 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:self-start">
          <div className="space-y-5 p-5">
            <div>
              <label
                htmlFor="topic-title"
                className="block text-sm font-medium text-[color:var(--foreground)]"
              >
                {ui.composerTitleLabel}
              </label>
              <input
                id="topic-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={ui.composerTitlePlaceholder}
                maxLength={180}
                className="mt-2 w-full rounded-xl border app-border bg-[color:var(--surface-muted)] px-4 py-3 text-base text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </div>

            <div className="space-y-3 border-t app-border pt-5">
              <Button
                onClick={() => void submit("published")}
                disabled={!canSubmit || saving !== null}
                className="w-full"
              >
                {saving === "published"
                  ? ui.composerSaving
                  : isPublished
                    ? ui.composerSave
                    : ui.composerPublish}
              </Button>

              {/* Drafts only make sense before the first publish — see the
                  isPublished note above. */}
              {!isPublished ? (
                <Button
                  variant="secondary"
                  onClick={() => void submit("draft")}
                  disabled={!canSubmit || saving !== null}
                  className="w-full"
                >
                  {saving === "draft"
                    ? ui.composerSaving
                    : ui.composerSaveDraft}
                </Button>
              ) : null}

              {/* Says what is still missing while the buttons are dead, and what
                  pressing publish will do once they are live. */}
              <p className="text-xs leading-5 app-soft">
                {canSubmit ? ui.composerPublishNote : ui.composerRequirements}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {isWarningOpen ? (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-panel app-card p-5">
            <p className="text-sm text-[color:var(--foreground)]">
              {ui.composerLeaveWarning}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelLeave}>
                {dictionary.projectComments.cancel}
              </Button>
              <Button size="sm" onClick={confirmLeave}>
                {ui.composerLeaveConfirm}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
