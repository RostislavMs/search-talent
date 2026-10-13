import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { localeNameCopy } from "@/lib/i18n/copy/locale-name";
import { siteCopy } from "@/lib/i18n/copy/site";
import { themeCopy } from "@/lib/i18n/copy/theme";
import { languageCopy } from "@/lib/i18n/copy/language";
import { shareCopy } from "@/lib/i18n/copy/share";
import { navCopy } from "@/lib/i18n/copy/nav";
import { adminCopy } from "@/lib/i18n/copy/admin";
import { footerCopy } from "@/lib/i18n/copy/footer";
import { cookieConsentCopy } from "@/lib/i18n/copy/cookie-consent";
import { sitePopupCopy } from "@/lib/i18n/copy/site-popup";
import { commonCopy } from "@/lib/i18n/copy/common";
import { metadataCopy } from "@/lib/i18n/copy/metadata";
import { homeCopy } from "@/lib/i18n/copy/home";
import { searchCopy } from "@/lib/i18n/copy/search";
import { articlesPageCopy } from "@/lib/i18n/copy/articles-page";
import { newsPageCopy } from "@/lib/i18n/copy/news-page";
import { projectPageCopy } from "@/lib/i18n/copy/project-page";
import { projectCommentsCopy } from "@/lib/i18n/copy/project-comments";
import { discussionsCopy } from "@/lib/i18n/copy/discussions";
import { commentGifCopy } from "@/lib/i18n/copy/comment-gif";
import { reactionsCopy } from "@/lib/i18n/copy/reactions";
import { mentionsCopy } from "@/lib/i18n/copy/mentions";
import { linkPreviewCopy } from "@/lib/i18n/copy/link-preview";
import { coAuthorsCopy } from "@/lib/i18n/copy/co-authors";
import { companiesCopy } from "@/lib/i18n/copy/companies";
import { vacanciesCopy } from "@/lib/i18n/copy/vacancies";
import { applicationsCopy } from "@/lib/i18n/copy/applications";
import { jobAlertsCopy } from "@/lib/i18n/copy/job-alerts";
import { messagesCopy } from "@/lib/i18n/copy/messages";
import { emailSettingsCopy } from "@/lib/i18n/copy/email-settings";
import { projectContextCopy } from "@/lib/i18n/copy/project-context";
import { notificationsCopy } from "@/lib/i18n/copy/notifications";
import { providerIntegrationsCopy } from "@/lib/i18n/copy/provider-integrations";
import { githubIntegrationCopy } from "@/lib/i18n/copy/github-integration";
import { aiDraftCopy } from "@/lib/i18n/copy/ai-draft";
import { aiProfileSummaryCopy } from "@/lib/i18n/copy/ai-profile-summary";
import { verifiedBadgeCopy } from "@/lib/i18n/copy/verified-badge";
import { emailVerificationCopy } from "@/lib/i18n/copy/email-verification";
import { bookmarksCopy } from "@/lib/i18n/copy/bookmarks";
import { followsCopy } from "@/lib/i18n/copy/follows";
import { emailsCopy } from "@/lib/i18n/copy/emails";
import { pdfExportCopy } from "@/lib/i18n/copy/pdf-export";
import { mySpaceCopy } from "@/lib/i18n/copy/my-space";
import { onboardingCopy } from "@/lib/i18n/copy/onboarding";
import { profileShareCopy } from "@/lib/i18n/copy/profile-share";
import { profileThemesCopy } from "@/lib/i18n/copy/profile-themes";
import { profileTemplatesCopy } from "@/lib/i18n/copy/profile-templates";
import { profileStyleFileCopy } from "@/lib/i18n/copy/profile-style-file";
import { openToCopy } from "@/lib/i18n/copy/open-to";
import { analyticsCopy } from "@/lib/i18n/copy/analytics";
import { dashboardProjectsCopy } from "@/lib/i18n/copy/dashboard-projects";
import { dashboardProfileCopy } from "@/lib/i18n/copy/dashboard-profile";
import { authCopy } from "@/lib/i18n/copy/auth";
import { creatorProfileCopy } from "@/lib/i18n/copy/creator-profile";
import { formsCopy } from "@/lib/i18n/copy/forms";
import { aboutPageCopy } from "@/lib/i18n/copy/about-page";
import { faqPageCopy } from "@/lib/i18n/copy/faq-page";
import { feedbackPageCopy } from "@/lib/i18n/copy/feedback-page";
import { contactsPageCopy } from "@/lib/i18n/copy/contacts-page";

// Each namespace lives in its own module under ./copy with both languages side
// by side, so a client component imports only the parts it shows (see
// useDictionary in ./client) instead of every string of both languages. Server
// code keeps reading the whole dictionary assembled here.
const namespaces = {
  localeName: localeNameCopy,
  site: siteCopy,
  theme: themeCopy,
  language: languageCopy,
  share: shareCopy,
  nav: navCopy,
  admin: adminCopy,
  footer: footerCopy,
  cookieConsent: cookieConsentCopy,
  sitePopup: sitePopupCopy,
  common: commonCopy,
  metadata: metadataCopy,
  home: homeCopy,
  search: searchCopy,
  articlesPage: articlesPageCopy,
  newsPage: newsPageCopy,
  projectPage: projectPageCopy,
  projectComments: projectCommentsCopy,
  discussions: discussionsCopy,
  commentGif: commentGifCopy,
  reactions: reactionsCopy,
  mentions: mentionsCopy,
  linkPreview: linkPreviewCopy,
  coAuthors: coAuthorsCopy,
  companies: companiesCopy,
  vacancies: vacanciesCopy,
  applications: applicationsCopy,
  jobAlerts: jobAlertsCopy,
  messages: messagesCopy,
  emailSettings: emailSettingsCopy,
  projectContext: projectContextCopy,
  notifications: notificationsCopy,
  providerIntegrations: providerIntegrationsCopy,
  githubIntegration: githubIntegrationCopy,
  aiDraft: aiDraftCopy,
  aiProfileSummary: aiProfileSummaryCopy,
  verifiedBadge: verifiedBadgeCopy,
  emailVerification: emailVerificationCopy,
  bookmarks: bookmarksCopy,
  follows: followsCopy,
  emails: emailsCopy,
  pdfExport: pdfExportCopy,
  mySpace: mySpaceCopy,
  onboarding: onboardingCopy,
  profileShare: profileShareCopy,
  profileThemes: profileThemesCopy,
  profileTemplates: profileTemplatesCopy,
  profileStyleFile: profileStyleFileCopy,
  openTo: openToCopy,
  analytics: analyticsCopy,
  dashboardProjects: dashboardProjectsCopy,
  dashboardProfile: dashboardProfileCopy,
  auth: authCopy,
  creatorProfile: creatorProfileCopy,
  forms: formsCopy,
  aboutPage: aboutPageCopy,
  faqPage: faqPageCopy,
  feedbackPage: feedbackPageCopy,
  contactsPage: contactsPageCopy,
};

type Namespaces = typeof namespaces;

type LocaleDictionary<L extends Locale> = {
  readonly [Name in keyof Namespaces]: Namespaces[Name][L];
};

function assemble<L extends Locale>(locale: L): LocaleDictionary<L> {
  return Object.fromEntries(
    Object.entries(namespaces).map(([name, copy]) => [name, copy[locale]]),
  ) as LocaleDictionary<L>;
}

export const dictionaries = {
  en: assemble("en"),
  uk: assemble("uk"),
};

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
