import { unstable_noStore as noStore } from "next/cache";
import {
  normalizePollSort,
  normalizePollStatus,
  normalizePollQuestionType,
  slugifyPollTitle,
  isPollClosed,
  type PollAuthor,
  type PollCategory,
  type PollComment,
  type PollDashboardItem,
  type PollDetail,
  type PollFeedItem,
  type PollOption,
  type PollQuestion,
} from "@/lib/polls";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { loadAcceptedCoAuthorsMap } from "@/lib/db/co-authors";

// Shape of one localized version of the poll body (title/excerpt/content/cover),
// stored in the `translations` jsonb column and accepted from the API payload.
export type PollLocalizedFields = {
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  cover_image_storage_path: string | null;
};

export type PollTranslationInput = {
  title: string;
  excerpt?: string | null;
  content?: string;
  cover_image_url?: string | null;
  cover_image_storage_path?: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type PollRow = {
  id: string;
  author_user_id: string | null;
  category_id: number | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  cover_image_storage_path: string | null;
  status: string | null;
  moderation_status: string | null;
  moderation_note: string | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  responses_count: number | null;
  pinned_until: string | null;
  closes_at: string | null;
  published_at: string | null;
  created_at: string | null;
  content_locale: string | null;
  translations: Record<string, Partial<PollLocalizedFields>> | null;
};

type PollCategoryRow = {
  id: number;
  slug: string;
  name: string;
  name_uk: string | null;
  description: string | null;
  admin_only: boolean | null;
};

type PollQuestionRow = {
  id: string;
  poll_id: string;
  position: number;
  question_type: string;
  prompt: string;
  prompt_uk: string | null;
  rating_min: number | null;
  rating_max: number | null;
  multi_min: number | null;
  multi_max: number | null;
  responses_count: number | null;
  rating_sum: number | null;
  rating_count: number | null;
};

type PollOptionRow = {
  id: string;
  question_id: string;
  position: number;
  label: string;
  label_uk: string | null;
  votes_count: number | null;
};

type PollCommentRow = {
  id: string;
  poll_id: string;
  author_user_id: string | null;
  parent_id: string | null;
  body: string | null;
  created_at: string | null;
};

type ProfileSummaryRow = {
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
};

const POLL_COLUMNS =
  "id, author_user_id, category_id, title, slug, excerpt, content, cover_image_url, cover_image_storage_path, status, moderation_status, moderation_note, views_count, likes_count, comments_count, responses_count, pinned_until, closes_at, published_at, created_at, content_locale, translations";

function mapCategory(row: PollCategoryRow | null | undefined): PollCategory | null {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameUk: row.name_uk || null,
    description: row.description || null,
    adminOnly: Boolean(row.admin_only),
  };
}

function mapAuthor(row: ProfileSummaryRow | null | undefined): PollAuthor | null {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username || null,
    name: row.name || null,
    avatarUrl: row.avatar_url || null,
  };
}

function pickText(base: string, alt: string | null, locale?: string | null) {
  if (locale === "uk" && alt && alt.trim()) return alt;
  return base;
}

function pickLocalizedBody(row: PollRow, locale?: string | null): PollLocalizedFields {
  const primary: PollLocalizedFields = {
    title: row.title,
    excerpt: row.excerpt,
    content: row.content ?? "",
    cover_image_url: row.cover_image_url,
    cover_image_storage_path: row.cover_image_storage_path,
  };

  const primaryLocale = row.content_locale || "uk";
  if (!locale || locale === primaryLocale) {
    return primary;
  }

  const alt = row.translations?.[locale];
  if (alt && (alt.title?.trim() || alt.content?.trim())) {
    return {
      title: alt.title?.trim() ? alt.title : primary.title,
      excerpt: alt.excerpt ?? null,
      content: alt.content?.trim() ? alt.content : primary.content,
      cover_image_url: alt.cover_image_url ?? null,
      cover_image_storage_path: alt.cover_image_storage_path ?? null,
    };
  }

  return primary;
}

async function getCategoriesMap(supabase: SupabaseClient, categoryIds: number[]) {
  if (categoryIds.length === 0) return new Map<number, PollCategory>();
  const { data } = await supabase
    .from("poll_categories")
    .select("id, slug, name, name_uk, description, admin_only")
    .in("id", categoryIds);
  return new Map(
    ((data || []) as PollCategoryRow[]).map((item) => [item.id, mapCategory(item)!]),
  );
}

async function getAuthorsMap(supabase: SupabaseClient, authorIds: string[]) {
  if (authorIds.length === 0) return new Map<string, PollAuthor>();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url")
    .in("user_id", authorIds);
  return new Map(
    ((data || []) as ProfileSummaryRow[]).map((item) => [item.user_id, mapAuthor(item)!]),
  );
}

function buildCommentTree(
  rows: PollCommentRow[],
  authorMap: Map<string, PollAuthor>,
): PollComment[] {
  const commentMap = new Map<string, PollComment>();
  const roots: PollComment[] = [];

  for (const row of rows) {
    commentMap.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      authorUserId: row.author_user_id,
      body: row.body || "",
      createdAt: row.created_at,
      author: row.author_user_id ? authorMap.get(row.author_user_id) || null : null,
      authorDeleted: row.author_user_id === null,
      replies: [],
    });
  }

  for (const row of rows) {
    const comment = commentMap.get(row.id);
    if (!comment) continue;
    if (row.parent_id && commentMap.has(row.parent_id)) {
      commentMap.get(row.parent_id)?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

function toFeedItem(
  row: PollRow,
  categoryMap: Map<number, PollCategory>,
  authorMap: Map<string, PollAuthor>,
  questionCount: number,
  locale?: string | null,
): PollFeedItem {
  const localized = pickLocalizedBody(row, locale);
  return {
    id: row.id,
    slug: row.slug,
    title: localized.title,
    excerpt: localized.excerpt,
    content: localized.content,
    coverImageUrl: localized.cover_image_url,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    closesAt: row.closes_at,
    viewsCount: row.views_count ?? 0,
    likesCount: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    responsesCount: row.responses_count ?? 0,
    questionCount,
    category: row.category_id ? categoryMap.get(row.category_id) || null : null,
    author: row.author_user_id ? authorMap.get(row.author_user_id) || null : null,
    authorDeleted: row.author_user_id === null,
    pinnedUntil: row.pinned_until,
  };
}

/**
 * Loads the question/option tree for a poll, folding in vote tallies (only when
 * `resultsVisible`) and the viewer's own selections (when they have voted).
 */
async function loadPollQuestions(
  supabase: SupabaseClient,
  pollId: string,
  viewerUserId: string | null,
  resultsVisible: boolean,
  locale?: string | null,
): Promise<PollQuestion[]> {
  const [questionsResponse, optionsResponse, answersResponse, answerOptionsResponse] =
    await Promise.all([
      supabase
        .from("poll_questions")
        .select(
          "id, poll_id, position, question_type, prompt, prompt_uk, rating_min, rating_max, multi_min, multi_max, responses_count, rating_sum, rating_count",
        )
        .eq("poll_id", pollId)
        .order("position", { ascending: true }),
      supabase
        .from("poll_options")
        .select("id, question_id, position, label, label_uk, votes_count")
        .eq("poll_id", pollId)
        .order("position", { ascending: true }),
      viewerUserId
        ? supabase
            .from("poll_response_answers")
            .select("question_id, rating_value")
            .eq("poll_id", pollId)
            .eq("user_id", viewerUserId)
        : Promise.resolve({ data: [] }),
      viewerUserId
        ? supabase
            .from("poll_answer_options")
            .select("question_id, option_id")
            .eq("user_id", viewerUserId)
        : Promise.resolve({ data: [] }),
    ]);

  const questionRows = (questionsResponse.data || []) as PollQuestionRow[];
  const optionRows = (optionsResponse.data || []) as PollOptionRow[];
  const answerRows = (answersResponse.data || []) as Array<{
    question_id: string;
    rating_value: number | null;
  }>;
  const answerOptionRows = (answerOptionsResponse.data || []) as Array<{
    question_id: string;
    option_id: string;
  }>;

  const ratingByQuestion = new Map<string, number | null>();
  for (const answer of answerRows) {
    ratingByQuestion.set(answer.question_id, answer.rating_value);
  }

  const selectedByQuestion = new Map<string, Set<string>>();
  for (const row of answerOptionRows) {
    if (!selectedByQuestion.has(row.question_id)) {
      selectedByQuestion.set(row.question_id, new Set());
    }
    selectedByQuestion.get(row.question_id)!.add(row.option_id);
  }

  const optionsByQuestion = new Map<string, PollOptionRow[]>();
  for (const option of optionRows) {
    if (!optionsByQuestion.has(option.question_id)) {
      optionsByQuestion.set(option.question_id, []);
    }
    optionsByQuestion.get(option.question_id)!.push(option);
  }

  return questionRows.map((question): PollQuestion => {
    const selected = selectedByQuestion.get(question.id) ?? new Set<string>();
    const ratingCount = question.rating_count ?? 0;
    const ratingSum = question.rating_sum ?? 0;

    const options: PollOption[] = (optionsByQuestion.get(question.id) ?? []).map((option) => ({
      id: option.id,
      label: pickText(option.label, option.label_uk, locale),
      position: option.position,
      votesCount: resultsVisible ? option.votes_count ?? 0 : 0,
      selected: selected.has(option.id),
    }));

    return {
      id: question.id,
      type: normalizePollQuestionType(question.question_type),
      prompt: pickText(question.prompt, question.prompt_uk, locale),
      position: question.position,
      ratingMin: question.rating_min,
      ratingMax: question.rating_max,
      multiMin: question.multi_min,
      multiMax: question.multi_max,
      options,
      responsesCount: resultsVisible ? question.responses_count ?? 0 : 0,
      ratingAverage:
        resultsVisible && ratingCount > 0 ? ratingSum / ratingCount : null,
      selectedOptionIds: Array.from(selected),
      selectedRating: ratingByQuestion.get(question.id) ?? null,
    };
  });
}

export async function getPollCategories() {
  noStore();
  const supabase = await createClient();
  const { data } = await supabase
    .from("poll_categories")
    .select("id, slug, name, name_uk, description, admin_only")
    .order("name", { ascending: true });
  return ((data || []) as PollCategoryRow[]).map((item) => mapCategory(item)!);
}

export async function getPollFeed(params?: {
  categorySlug?: string | null;
  authorQuery?: string | null;
  sort?: string | null;
  locale?: string | null;
}) {
  noStore();
  const viewer = await getCurrentViewerRole();
  const supabase = viewer.supabase;
  const sort = normalizePollSort(params?.sort);

  let query = supabase.from("polls").select(POLL_COLUMNS).eq("status", "published").limit(60);

  if (params?.categorySlug) {
    const { data: category } = await supabase
      .from("poll_categories")
      .select("id")
      .eq("slug", params.categorySlug)
      .maybeSingle();

    if (!category) {
      return {
        items: [] as PollFeedItem[],
        categories: await getPollCategories(),
        viewerUserId: viewer.user?.id || null,
      };
    }

    query = query.eq("category_id", category.id);
  }

  const { data } = await query.order(
    sort === "popular" ? "responses_count" : "published_at",
    { ascending: false },
  );

  let rows = ((data || []) as PollRow[]).filter((item) => {
    const isOwner = viewer.user?.id === item.author_user_id;
    return isPublicModerationStatus(item.moderation_status) || viewer.isAdmin || isOwner;
  });

  if (params?.authorQuery?.trim()) {
    const authorQuery = params.authorQuery.trim().toLowerCase();
    const authorsMap = await getAuthorsMap(
      supabase,
      Array.from(
        new Set(rows.map((item) => item.author_user_id).filter((id): id is string => Boolean(id))),
      ),
    );

    rows = rows.filter((item) => {
      if (!item.author_user_id) return false;
      const author = authorsMap.get(item.author_user_id);
      const candidate = `${author?.name || ""} ${author?.username || ""}`.toLowerCase();
      return candidate.includes(authorQuery);
    });
  }

  // Question counts per poll (single grouped read instead of N detail loads).
  const pollIds = rows.map((item) => item.id);
  const questionCountByPoll = new Map<string, number>();
  if (pollIds.length > 0) {
    const { data: questionRows } = await supabase
      .from("poll_questions")
      .select("poll_id")
      .in("poll_id", pollIds);
    for (const row of (questionRows || []) as Array<{ poll_id: string }>) {
      questionCountByPoll.set(row.poll_id, (questionCountByPoll.get(row.poll_id) ?? 0) + 1);
    }
  }

  const [categoryMap, authorMap, categories] = await Promise.all([
    getCategoriesMap(
      supabase,
      Array.from(
        new Set(
          rows.map((item) => item.category_id).filter((item): item is number => typeof item === "number"),
        ),
      ),
    ),
    getAuthorsMap(
      supabase,
      Array.from(
        new Set(rows.map((item) => item.author_user_id).filter((id): id is string => Boolean(id))),
      ),
    ),
    getPollCategories(),
  ]);

  const now = Date.now();
  const items = rows
    .map((item) =>
      toFeedItem(item, categoryMap, authorMap, questionCountByPoll.get(item.id) ?? 0, params?.locale),
    )
    .sort((left, right) => {
      const leftPinned = left.pinnedUntil && new Date(left.pinnedUntil).getTime() > now ? 1 : 0;
      const rightPinned = right.pinnedUntil && new Date(right.pinnedUntil).getTime() > now ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;

      if (sort === "popular") {
        return right.responsesCount - left.responsesCount || right.viewsCount - left.viewsCount;
      }
      if (sort === "discussed") {
        return right.commentsCount - left.commentsCount || right.responsesCount - left.responsesCount;
      }
      return (
        new Date(right.publishedAt || right.createdAt || 0).getTime() -
        new Date(left.publishedAt || left.createdAt || 0).getTime()
      );
    });

  const coAuthorsMap = await loadAcceptedCoAuthorsMap(
    supabase,
    "poll",
    items.map((item) => item.id),
  );
  for (const item of items) {
    item.coAuthors = coAuthorsMap.get(item.id) ?? [];
  }

  return {
    items,
    categories,
    viewerUserId: viewer.user?.id || null,
  };
}

export async function getPollDetail(slug: string, locale?: string | null) {
  noStore();
  const viewer = await getCurrentViewerRole();
  const supabase = viewer.supabase;

  const { data: row } = await supabase
    .from("polls")
    .select(POLL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (!row) return null;

  const poll = row as PollRow;
  const status = normalizePollStatus(poll.status);
  const isOwner = viewer.user?.id === poll.author_user_id;
  const canSeeByStatus = status === "published" || isOwner || viewer.isAdmin;
  const canSeeByModeration =
    isPublicModerationStatus(poll.moderation_status) || isOwner || viewer.isAdmin;

  if (!canSeeByStatus || !canSeeByModeration) {
    return null;
  }

  // Has the viewer voted? Drives result visibility.
  const hasVotedResponse = viewer.user
    ? await supabase
        .from("poll_responses")
        .select("id")
        .eq("poll_id", poll.id)
        .eq("user_id", viewer.user.id)
        .maybeSingle()
    : { data: null };
  const hasVoted = Boolean(hasVotedResponse.data);
  const isClosed = isPollClosed(poll.closes_at);
  const resultsVisible = hasVoted || isClosed || isOwner || viewer.isAdmin;

  const [categoryMap, authorMap, questions, commentsResponse, likeResponse] = await Promise.all([
    getCategoriesMap(supabase, poll.category_id ? [poll.category_id] : []),
    getAuthorsMap(supabase, poll.author_user_id ? [poll.author_user_id] : []),
    loadPollQuestions(supabase, poll.id, viewer.user?.id ?? null, resultsVisible, locale),
    supabase
      .from("poll_comments")
      .select("id, poll_id, author_user_id, parent_id, body, created_at")
      .eq("poll_id", poll.id)
      .order("created_at", { ascending: true }),
    viewer.user
      ? supabase
          .from("poll_likes")
          .select("poll_id")
          .eq("poll_id", poll.id)
          .eq("user_id", viewer.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const commentRows = (commentsResponse.data || []) as PollCommentRow[];
  const commentAuthorMap = await getAuthorsMap(
    supabase,
    Array.from(
      new Set(commentRows.map((item) => item.author_user_id).filter((id): id is string => Boolean(id))),
    ),
  );

  const feedItem = toFeedItem(poll, categoryMap, authorMap, questions.length, locale);
  const localized = pickLocalizedBody(poll, locale);

  const coAuthorsMap = await loadAcceptedCoAuthorsMap(supabase, "poll", [poll.id]);

  const detail: PollDetail = {
    ...feedItem,
    coAuthors: coAuthorsMap.get(poll.id) ?? [],
    status,
    moderationStatus: poll.moderation_status,
    moderationNote: poll.moderation_note,
    content: localized.content || "",
    coverImageStoragePath: localized.cover_image_storage_path,
    currentUserLiked: Boolean(likeResponse.data),
    hasVoted,
    isClosed,
    resultsVisible,
    questions,
    comments: buildCommentTree(commentRows, commentAuthorMap),
  };

  return {
    poll: detail,
    viewerUserId: viewer.user?.id || null,
    isOwner,
    isAdmin: viewer.isAdmin,
  };
}

/**
 * Fresh question tallies + the viewer's selections, used by the vote API to
 * return updated results immediately after a successful vote.
 */
export async function getPollResults(
  supabase: SupabaseClient,
  pollId: string,
  viewerUserId: string | null,
  locale?: string | null,
): Promise<PollQuestion[]> {
  noStore();
  return loadPollQuestions(supabase, pollId, viewerUserId, true, locale);
}

export async function getDashboardPolls(locale?: string | null) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("polls")
    .select(
      "id, category_id, title, slug, status, moderation_status, moderation_note, views_count, likes_count, comments_count, responses_count, closes_at, published_at, created_at, content_locale, translations",
    )
    .eq("author_user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data || []) as Array<{
    id: string;
    category_id: number | null;
    title: string;
    slug: string;
    status: string | null;
    moderation_status: string | null;
    moderation_note: string | null;
    views_count: number | null;
    likes_count: number | null;
    comments_count: number | null;
    responses_count: number | null;
    closes_at: string | null;
    published_at: string | null;
    created_at: string | null;
    content_locale: string | null;
    translations: Record<string, Partial<PollLocalizedFields>> | null;
  }>;

  const [categoryMap, categories] = await Promise.all([
    getCategoriesMap(
      supabase,
      Array.from(
        new Set(
          rows.map((item) => item.category_id).filter((item): item is number => typeof item === "number"),
        ),
      ),
    ),
    getPollCategories(),
  ]);

  return {
    userId: user.id,
    items: rows.map((item): PollDashboardItem => {
      const primaryLocale = item.content_locale || "uk";
      const localizedTitle =
        locale && locale !== primaryLocale
          ? item.translations?.[locale]?.title?.trim() || item.title
          : item.title;

      return {
        id: item.id,
        slug: item.slug,
        title: localizedTitle,
        status: normalizePollStatus(item.status),
        createdAt: item.created_at,
        publishedAt: item.published_at,
        closesAt: item.closes_at,
        viewsCount: item.views_count ?? 0,
        likesCount: item.likes_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        responsesCount: item.responses_count ?? 0,
        category: item.category_id ? categoryMap.get(item.category_id) || null : null,
        moderationStatus: item.moderation_status,
        moderationNote: item.moderation_note,
      };
    }),
    categories,
  };
}

export async function getPollModerationQueue(locale?: string | null) {
  noStore();
  const viewer = await getCurrentViewerRole();

  if (!viewer.user || !viewer.isAdmin) {
    return null;
  }

  const supabase = viewer.supabase;
  const { data } = await supabase
    .from("polls")
    .select(POLL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (data || []) as PollRow[];
  const [categoryMap, authorMap] = await Promise.all([
    getCategoriesMap(
      supabase,
      Array.from(
        new Set(
          rows.map((item) => item.category_id).filter((item): item is number => typeof item === "number"),
        ),
      ),
    ),
    getAuthorsMap(
      supabase,
      Array.from(
        new Set(rows.map((item) => item.author_user_id).filter((id): id is string => Boolean(id))),
      ),
    ),
  ]);

  const moderationRank = {
    under_review: 3,
    restricted: 2,
    removed: 1,
    approved: 0,
  } as const;

  return rows
    .map((item) => ({
      ...toFeedItem(item, categoryMap, authorMap, 0, locale),
      status: normalizePollStatus(item.status),
      moderationStatus: item.moderation_status,
      moderationNote: item.moderation_note,
    }))
    .sort(
      (left, right) =>
        (moderationRank[right.moderationStatus as keyof typeof moderationRank] || 0) -
          (moderationRank[left.moderationStatus as keyof typeof moderationRank] || 0) ||
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
    );
}

export async function ensureUniquePollSlug(title: string, excludeId?: string) {
  const supabase = await createClient();
  const baseSlug = slugifyPollTitle(title);
  const { data } = await supabase.from("polls").select("id, slug").ilike("slug", `${baseSlug}%`);

  const existing = new Set(
    ((data || []) as Array<{ id: string; slug: string | null }>)
      .filter((item) => item.id !== excludeId)
      .map((item) => item.slug)
      .filter((item): item is string => Boolean(item)),
  );

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}
