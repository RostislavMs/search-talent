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
import { buildConversationPath, buildMessagesQuery, isUuid, parseConversationBox } from "@/lib/messages";
import { buildMetadata } from "@/lib/seo";
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
  // The list next to it is the inbox the conversation belongs to.
  const companyId = view.side === "company" ? (view.company?.id ?? null) : null;
  const copy = getDictionary(locale).messages;

  const [messages, conversations, summary] = await Promise.all([
    listConversationMessages(supabase, id),
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
        />
      }
      thread={
        <ConversationThread
          key={id}
          initialView={view}
          initialMessages={messages}
          locale={locale}
          listQuery={buildMessagesQuery(box, companyId)}
          isAuthenticated
        />
      }
    />
  );
}
