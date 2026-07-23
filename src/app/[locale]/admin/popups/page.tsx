import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPopupsManager from "@/components/admin/admin-popups-manager";
import { listPopups } from "@/lib/db/popups";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin/popups",
    title: `${dictionary.admin.popups.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.popups.description,
    noindex: true,
  });
}

export default async function AdminPopupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.popups;

  // Feedback defaults come from both locales so the editor pre-fills the exact
  // bilingual copy the live popup would show.
  const enPopup = getDictionary("en").sitePopup;
  const ukPopup = getDictionary("uk").sitePopup;

  const supabase = await createClient();
  const popups = await listPopups(supabase);

  return (
    <div className="space-y-8">
      <section className="rounded-none sm:rounded-hero app-card p-5 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-2xl app-muted">{copy.description}</p>
      </section>

      <AdminPopupsManager
        locale={locale}
        popups={popups}
        feedbackDefaults={{
          titleEn: enPopup.feedbackDefaultTitle,
          titleUk: ukPopup.feedbackDefaultTitle,
          bodyEn: enPopup.feedbackDefaultBody,
          bodyUk: ukPopup.feedbackDefaultBody,
        }}
        copy={{
          createButton: copy.createButton,
          emptyState: copy.emptyState,
          activeBadge: copy.activeBadge,
          inactiveBadge: copy.inactiveBadge,
          activate: copy.activate,
          deactivate: copy.deactivate,
          edit: copy.edit,
          deleteButton: copy.deleteButton,
          save: copy.save,
          saving: copy.saving,
          cancel: copy.cancel,
          activeHint: copy.activeHint,
          newPopupTitle: copy.newPopupTitle,
          editPopupTitle: copy.editPopupTitle,
          kindMessage: copy.kindMessage,
          kindFeedback: copy.kindFeedback,
          delayUnit: copy.delayUnit,
          fields: copy.fields,
          sections: copy.sections,
          preview: copy.preview,
          popupCopy: {
            feedbackCta: dictionary.sitePopup.feedbackCta,
            feedbackDefaultTitle: dictionary.sitePopup.feedbackDefaultTitle,
            feedbackDefaultBody: dictionary.sitePopup.feedbackDefaultBody,
            dismiss: dictionary.sitePopup.dismiss,
          },
          confirmDeleteTitle: copy.confirmDeleteTitle,
          confirmDeleteMessage: copy.confirmDeleteMessage,
          confirmDeleteButton: copy.confirmDeleteButton,
          errorFallback: copy.errorFallback,
          messageEmptyError: copy.messageEmptyError,
        }}
      />
    </div>
  );
}
