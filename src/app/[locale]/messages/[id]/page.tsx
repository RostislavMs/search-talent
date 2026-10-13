import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import ConversationList from "@/components/conversation-list";
import ConversationThread from "@/components/conversation-thread";
import MessagesLayout from "@/components/messages-layout";
import { buildLoginHref } from "@/lib/auth/redirect";
import {
  getConversationView,
  getMessagingSummary,
  listConversationMessages,
  listConversations,
  listMessagingScopes,
} from "@/lib/db/messages";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildConversationPath,
  buildMessagesQuery,
  isUuid,
  MESSAGES_PAGE_SIZE,
  parseConversationBox,
  parseFocusSeq,
  parseSearchParam,
  type ChatMessage,
} from "@/lib/messages";
import { buildMetadata } from "@/lib/seo";
import { isPrivateStorageConfigured } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ locale: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveParams(params: RouteParams): Promise<{ locale: Locale; id: string }> {
  const { locale, id } = await params;
  if (!isLocale(locale) || !isUuid(id)) notFound();
  return { locale, id };
}

// One read per request, shared by the metadata and the page. The function
// answers only someone in the conversation.
const loadView = cache(async (id: string) => {
  const supabase = await createClient();
  return getConversationView(supabase, id);
});

/** A few messages above a found one, so it is read in its place. */
const CONTEXT_BEFORE_FOCUS = 10;
/** Everything from a found message to the newest, when it is not further back than this. */
const MAX_FROM_FOCUS = 200;

/**
 * The messages to open with: the latest page, or — when a search opened the
 * conversation at an older message — from a little above that message to the
 * newest one, in one unbroken run (new messages keep arriving below it).
 */
async function loadOpeningMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  focusSeq: number | null,
): Promise<{ messages: ChatMessage[]; hasOlder: boolean; focusSeq: number | null }> {
  const latest = await listConversationMessages(supabase, id);
  const loaded = { messages: latest, hasOlder: latest.length >= MESSAGES_PAGE_SIZE };

  if (focusSeq === null || latest.length === 0) {
    return { ...loaded, focusSeq: null };
  }

  if (focusSeq >= latest[0].seq) {
    return { ...loaded, focusSeq: latest.some((message) => message.seq === focusSeq) ? focusSeq : null };
  }

  const fromFocus = await listConversationMessages(supabase, id, { after: focusSeq - 1, limit: MAX_FROM_FOCUS });

  if (fromFocus.length >= MAX_FROM_FOCUS || fromFocus[0]?.seq !== focusSeq) {
    return { ...loaded, focusSeq: null };
  }

  const before = await listConversationMessages(supabase, id, { before: focusSeq, limit: CONTEXT_BEFORE_FOCUS });
  return { messages: [...before, ...fromFocus], hasOlder: before.length >= CONTEXT_BEFORE_FOCUS, focusSeq };
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, id } = await resolveParams(params);
  const copy = getDictionary(locale).messages.meta;

  return buildMetadata({
    locale,
    pathname: buildConversationPath(id),
    title: `${copy.conversationTitle} · ${copy.title}`,
    description: copy.description,
    noindex: true,
  });
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { locale, id } = await resolveParams(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, buildConversationPath(id)));
  }

  const view = await loadView(id);

  // Not the caller's, or gone: the same "not found" either way.
  if (!view) {
    notFound();
  }

  const query = await searchParams;
  const box = parseConversationBox(query.box);
  const search = parseSearchParam(query.q);
  // The list next to it is the inbox the conversation belongs to.
  const companyId = view.side === "company" ? (view.company?.id ?? null) : null;
  const copy = getDictionary(locale).messages;

  const [opening, conversations, summary] = await Promise.all([
    loadOpeningMessages(supabase, id, parseFocusSeq(query.m)),
    listConversations(supabase, { box, companyId }),
    getMessagingSummary(supabase),
  ]);
  const scopes = await listMessagingScopes(supabase, user.id, summary, copy.scopePersonal);

  return (
    <MessagesLayout
      userId={user.id}
      threadOpen
      list={
        <ConversationList
          key={`${box}:${companyId ?? "me"}`}
          initialConversations={conversations}
          box={box}
          companyId={companyId}
          activeId={id}
          scopes={scopes}
          requestsCount={summary.requests}
          locale={locale}
          initialQuery={search}
        />
      }
      thread={
        <ConversationThread
          key={`${id}:${opening.focusSeq ?? ""}`}
          initialView={view}
          initialMessages={opening.messages}
          initialHasOlder={opening.hasOlder}
          focusSeq={opening.focusSeq}
          locale={locale}
          listQuery={buildMessagesQuery(box, companyId, search)}
          isAuthenticated
          filesEnabled={isPrivateStorageConfigured()}
        />
      }
    />
  );
}
