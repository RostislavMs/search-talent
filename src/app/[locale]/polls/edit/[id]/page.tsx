import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { redirect, notFound } from "next/navigation";
import type { QuestionDraft } from "@/components/poll-question-builder";
import { getPollCategories } from "@/lib/db/polls";
import { loadCoAuthorsForEditor } from "@/lib/db/co-authors";
import { createLocalePath, isLocale } from "@/lib/i18n/config";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { normalizePollQuestionType } from "@/lib/polls";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const PollComposer = nextDynamic(() => import("@/components/poll-composer"), {
  loading: () => (
    <div className="animate-pulse space-y-4 py-4">
      <div className="h-12 w-2/3 rounded-xl bg-[color:var(--surface-muted)]" />
      <div className="h-64 rounded-xl bg-[color:var(--surface-muted)]" />
    </div>
  ),
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const isUk = locale === "uk";
  return buildMetadata({
    locale,
    pathname: "/polls/edit",
    title: isUk ? "Редагування опитування" : "Edit poll",
    description: isUk ? "Редагування опитування на SearchTalent." : "Edit a poll on SearchTalent.",
    noindex: true,
  });
}

export default async function EditPollPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const viewer = await getCurrentViewerRole();

  if (!viewer.user) {
    redirect(createLocalePath(safeLocale, "/login"));
  }

  const supabase = await createClient();
  const { data: poll } = await supabase
    .from("polls")
    .select(
      "id, author_user_id, category_id, title, slug, excerpt, content, cover_image_url, cover_image_storage_path, status, content_locale, translations, closes_at, responses_count",
    )
    .eq("id", id)
    .maybeSingle();

  if (!poll) {
    notFound();
  }

  if (poll.author_user_id !== viewer.user.id && !viewer.isAdmin) {
    notFound();
  }

  const [categories, questionsResponse, optionsResponse] = await Promise.all([
    getPollCategories(),
    supabase
      .from("poll_questions")
      .select("id, position, question_type, prompt, rating_min, rating_max")
      .eq("poll_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("poll_options")
      .select("id, question_id, position, label")
      .eq("poll_id", id)
      .order("position", { ascending: true }),
  ]);

  const optionRows = (optionsResponse.data || []) as Array<{
    id: string;
    question_id: string;
    position: number;
    label: string;
  }>;

  const questions: QuestionDraft[] = (
    (questionsResponse.data || []) as Array<{
      id: string;
      position: number;
      question_type: string;
      prompt: string;
      rating_min: number | null;
      rating_max: number | null;
    }>
  ).map((question) => ({
    id: question.id,
    type: normalizePollQuestionType(question.question_type),
    prompt: question.prompt,
    options: optionRows
      .filter((option) => option.question_id === question.id)
      .map((option) => ({ id: option.id, label: option.label })),
    ratingMin: question.rating_min ?? 1,
    ratingMax: question.rating_max ?? 5,
  }));

  const categoryRow = poll.category_id
    ? categories.find((c) => c.id === poll.category_id)
    : null;
  const coAuthors = await loadCoAuthorsForEditor(supabase, "poll", poll.id);

  type StoredVersion = {
    title?: string | null;
    excerpt?: string | null;
    content?: string | null;
    cover_image_url?: string | null;
    cover_image_storage_path?: string | null;
  };

  const rawTranslations = (poll.translations || {}) as Record<string, StoredVersion>;
  const translations = Object.fromEntries(
    Object.entries(rawTranslations).map(([loc, version]) => [
      loc,
      {
        title: version?.title || "",
        excerpt: version?.excerpt || null,
        content: version?.content || "",
        coverImageUrl: version?.cover_image_url || null,
        coverImageStoragePath: version?.cover_image_storage_path || null,
      },
    ]),
  );

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <PollComposer
        locale={safeLocale}
        categories={categories}
        isAdmin={viewer.isAdmin}
        editPoll={{
          id: poll.id,
          title: poll.title,
          excerpt: poll.excerpt || null,
          content: poll.content || "",
          categorySlug: categoryRow?.slug || categories[0]?.slug || "",
          status: poll.status === "published" ? "published" : "draft",
          coverImageUrl: poll.cover_image_url || null,
          coverImageStoragePath: poll.cover_image_storage_path || null,
          contentLocale: poll.content_locale === "en" ? "en" : "uk",
          translations,
          closesAt: poll.closes_at || null,
          questions,
          locked: (poll.responses_count ?? 0) > 0,
          coAuthors,
        }}
      />
    </main>
  );
}
