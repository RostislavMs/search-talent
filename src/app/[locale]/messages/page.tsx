import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ConversationList from "@/components/conversation-list";
import MessagesLayout from "@/components/messages-layout";
import { buildLoginHref } from "@/lib/auth/redirect";
import { getMessagingSummary, listConversations, listMessagingScopes } from "@/lib/db/messages";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { MESSAGES_PATH, parseCompanyParam, parseConversationBox, parseSearchParam } from "@/lib/messages";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).messages.meta;

  return buildMetadata({
    locale,
    pathname: MESSAGES_PATH,
    title: copy.title,
    description: copy.description,
    noindex: true,
  });
}

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const locale = await resolveLocale(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, MESSAGES_PATH));
  }

  const query = await searchParams;
  const box = parseConversationBox(query.box);
  const companyId = parseCompanyParam(query.company);
  const search = parseSearchParam(query.q);
  const dictionary = getDictionary(locale);
  const copy = dictionary.messages;

  const [conversations, summary] = await Promise.all([
    listConversations(supabase, { box, companyId }),
    getMessagingSummary(supabase),
  ]);
  const scopes = await listMessagingScopes(supabase, user.id, summary, copy.scopePersonal);

  return (
    <MessagesLayout
      userId={user.id}
      threadOpen={false}
      list={
        <ConversationList
          key={`${box}:${companyId ?? "me"}`}
          initialConversations={conversations}
          box={box}
          companyId={companyId}
          scopes={scopes}
          requestsCount={summary.requests}
          locale={locale}
          initialQuery={search}
        />
      }
      thread={
        <div className="flex h-full items-center justify-center p-8 text-center">
          <p className="max-w-xs text-sm leading-6 app-muted">{copy.chooseConversation}</p>
        </div>
      }
    />
  );
}
