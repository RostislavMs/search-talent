import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type WritingFormat,
  type WritingKindMetadata,
  type WritingLanguage,
  type WritingRole,
  type WritingTopic,
} from "@/lib/project-kind-metadata";

function getWritingRoleLabel(role: WritingRole, dictionary: Dictionary) {
  switch (role) {
    case "author":
      return dictionary.forms.writingRoleAuthor;
    case "copywriter":
      return dictionary.forms.writingRoleCopywriter;
    case "technical_writer":
      return dictionary.forms.writingRoleTechnicalWriter;
    case "editor":
      return dictionary.forms.writingRoleEditor;
    case "translator":
      return dictionary.forms.writingRoleTranslator;
    case "proofreader":
      return dictionary.forms.writingRoleProofreader;
    case "ghostwriter":
      return dictionary.forms.writingRoleGhostwriter;
    case "journalist":
      return dictionary.forms.writingRoleJournalist;
    case "content_strategist":
      return dictionary.forms.writingRoleContentStrategist;
    case "ux_writer":
      return dictionary.forms.writingRoleUxWriter;
    default:
      return role;
  }
}

function getWritingFormatLabel(value: WritingFormat, dictionary: Dictionary) {
  switch (value) {
    case "article":
      return dictionary.forms.writingFormatArticle;
    case "blog_post":
      return dictionary.forms.writingFormatBlogPost;
    case "whitepaper":
      return dictionary.forms.writingFormatWhitepaper;
    case "ebook":
      return dictionary.forms.writingFormatEbook;
    case "documentation":
      return dictionary.forms.writingFormatDocumentation;
    case "tutorial":
      return dictionary.forms.writingFormatTutorial;
    case "case_study":
      return dictionary.forms.writingFormatCaseStudy;
    case "press_release":
      return dictionary.forms.writingFormatPressRelease;
    case "newsletter":
      return dictionary.forms.writingFormatNewsletter;
    case "script":
      return dictionary.forms.writingFormatScript;
    case "copywriting":
      return dictionary.forms.writingFormatCopywriting;
    case "ux_writing":
      return dictionary.forms.writingFormatUxWriting;
    case "technical_spec":
      return dictionary.forms.writingFormatTechnicalSpec;
    case "research_paper":
      return dictionary.forms.writingFormatResearchPaper;
    case "translation":
      return dictionary.forms.writingFormatTranslation;
    case "social_media":
      return dictionary.forms.writingFormatSocialMedia;
    default:
      return value;
  }
}

function getWritingTopicLabel(value: WritingTopic, dictionary: Dictionary) {
  switch (value) {
    case "technology":
      return dictionary.forms.writingTopicTechnology;
    case "design":
      return dictionary.forms.writingTopicDesign;
    case "marketing":
      return dictionary.forms.writingTopicMarketing;
    case "business":
      return dictionary.forms.writingTopicBusiness;
    case "science":
      return dictionary.forms.writingTopicScience;
    case "education":
      return dictionary.forms.writingTopicEducation;
    case "finance":
      return dictionary.forms.writingTopicFinance;
    case "health":
      return dictionary.forms.writingTopicHealth;
    case "lifestyle":
      return dictionary.forms.writingTopicLifestyle;
    case "gaming":
      return dictionary.forms.writingTopicGaming;
    case "travel":
      return dictionary.forms.writingTopicTravel;
    case "culture":
      return dictionary.forms.writingTopicCulture;
    case "politics":
      return dictionary.forms.writingTopicPolitics;
    case "sports":
      return dictionary.forms.writingTopicSports;
    default:
      return value;
  }
}

function getWritingLanguageLabel(
  value: WritingLanguage,
  dictionary: Dictionary,
) {
  switch (value) {
    case "uk":
      return dictionary.forms.writingLanguageUk;
    case "en":
      return dictionary.forms.writingLanguageEn;
    case "pl":
      return dictionary.forms.writingLanguagePl;
    case "de":
      return dictionary.forms.writingLanguageDe;
    case "es":
      return dictionary.forms.writingLanguageEs;
    case "fr":
      return dictionary.forms.writingLanguageFr;
    case "it":
      return dictionary.forms.writingLanguageIt;
    case "pt":
      return dictionary.forms.writingLanguagePt;
    case "cs":
      return dictionary.forms.writingLanguageCs;
    case "multi":
      return dictionary.forms.writingLanguageMulti;
    default:
      return value;
  }
}

function formatNumber(value: number, locale?: string) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

export default function ProjectWritingDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: WritingKindMetadata;
}) {
  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.writingSectionTitle}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.writingRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getWritingRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.writingClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
        {meta.language && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.writingLanguageLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getWritingLanguageLabel(meta.language, dictionary)}
            </p>
          </div>
        )}
        {meta.wordCount !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.writingWordCountLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatNumber(meta.wordCount)}
            </p>
          </div>
        )}
        {meta.readingTimeMinutes !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.writingReadingTimeLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.readingTimeMinutes}
            </p>
          </div>
        )}
      </div>

      {meta.formats.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.writingFormatsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.formats.map((item) => (
              <span
                key={item}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {getWritingFormatLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.topics.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.writingTopicsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.topics.map((item) => (
              <span
                key={item}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {getWritingTopicLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.tools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.writingToolsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.tools.map((tool) => (
              <span
                key={tool}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.articleUrl && (
        <a
          href={meta.articleUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border app-border px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {dictionary.forms.writingArticleUrlLabel}
        </a>
      )}
    </div>
  );
}
