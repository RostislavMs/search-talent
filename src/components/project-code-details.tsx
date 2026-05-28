import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type CodeArchitecture,
  type CodeKindMetadata,
} from "@/lib/project-kind-metadata";

function getCodeArchitectureLabel(
  value: CodeArchitecture,
  dictionary: Dictionary,
) {
  switch (value) {
    case "web_app":
      return dictionary.forms.codeArchitectureWebApp;
    case "mobile_app":
      return dictionary.forms.codeArchitectureMobileApp;
    case "desktop_app":
      return dictionary.forms.codeArchitectureDesktopApp;
    case "browser_extension":
      return dictionary.forms.codeArchitectureBrowserExtension;
    case "cli_tool":
      return dictionary.forms.codeArchitectureCliTool;
    case "library":
      return dictionary.forms.codeArchitectureLibrary;
    case "sdk":
      return dictionary.forms.codeArchitectureSdk;
    case "api":
      return dictionary.forms.codeArchitectureApi;
    case "microservices":
      return dictionary.forms.codeArchitectureMicroservices;
    case "monolith":
      return dictionary.forms.codeArchitectureMonolith;
    case "monorepo":
      return dictionary.forms.codeArchitectureMonorepo;
    case "bot":
      return dictionary.forms.codeArchitectureBot;
    case "game":
      return dictionary.forms.codeArchitectureGame;
    case "plugin":
      return dictionary.forms.codeArchitecturePlugin;
    case "framework":
      return dictionary.forms.codeArchitectureFramework;
    case "data_pipeline":
      return dictionary.forms.codeArchitectureDataPipeline;
    case "ml_model":
      return dictionary.forms.codeArchitectureMlModel;
    case "other":
      return dictionary.forms.codeArchitectureOther;
    default:
      return value;
  }
}

export default function ProjectCodeDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: CodeKindMetadata;
}) {
  const externalLinks: Array<{ label: string; href: string }> = [];
  if (meta.docsUrl) {
    externalLinks.push({
      label: dictionary.forms.codeDocsUrlLabel,
      href: meta.docsUrl,
    });
  }
  if (meta.storybookUrl) {
    externalLinks.push({
      label: dictionary.forms.codeStorybookUrlLabel,
      href: meta.storybookUrl,
    });
  }
  if (meta.apiPlaygroundUrl) {
    externalLinks.push({
      label: dictionary.forms.codeApiPlaygroundUrlLabel,
      href: meta.apiPlaygroundUrl,
    });
  }

  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.codeSectionTitle}
      </h3>

      <div className="grid gap-4 sm:grid-cols-3">
        {meta.architecture && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.codeArchitectureLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getCodeArchitectureLabel(meta.architecture, dictionary)}
            </p>
          </div>
        )}
        {meta.primaryLanguage && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.codePrimaryLanguageLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.primaryLanguage}
            </p>
          </div>
        )}
        {meta.license && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.codeLicenseLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.license}
            </p>
          </div>
        )}
      </div>

      {meta.hosting.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.codeHostingLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.hosting.map((item) => (
              <span
                key={item}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.databases.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.codeDatabasesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.databases.map((item) => (
              <span
                key={item}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {externalLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {externalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
