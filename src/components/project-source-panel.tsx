import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  getProviderIntegrationDescriptor,
  type IntegrationStat,
  type ProjectSourceLink,
} from "@/lib/constants/provider-integrations";

function getStatLabel(stat: IntegrationStat, dictionary: Dictionary): string {
  const labels = dictionary.providerIntegrations.stats;

  switch (stat.key) {
    case "stars":
      return labels.stars;
    case "forks":
      return labels.forks;
    case "openIssues":
      return labels.openIssues;
    case "contributors":
      return labels.contributors;
    case "branch":
      return labels.branch;
    case "lastActivity":
      return labels.lastActivity;
    case "license":
      return labels.license;
    case "languages":
      return labels.languages;
    case "pages":
      return labels.pages;
    case "components":
      return labels.components;
    case "styles":
      return labels.styles;
    case "version":
      return labels.version;
    case "lastModified":
      return labels.lastModified;
    default:
      return stat.key;
  }
}

/** Dates arrive as ISO strings from the provider; show them, not the raw stamp. */
function formatStatValue(
  stat: IntegrationStat,
  locale: string,
): string {
  if (stat.key !== "lastActivity" && stat.key !== "lastModified") {
    return stat.value;
  }

  const parsed = new Date(stat.value);

  if (Number.isNaN(parsed.getTime())) {
    return stat.value;
  }

  return parsed.toLocaleDateString(locale === "uk" ? "uk-UA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "Imported from GitLab / Figma" card on the project page: the live numbers the
 * last sync pulled, plus a link back to the source.
 */
export default function ProjectSourcePanel({
  dictionary,
  locale,
  link,
}: {
  dictionary: Dictionary;
  locale: string;
  link: ProjectSourceLink;
}) {
  const descriptor = getProviderIntegrationDescriptor(link.provider);

  return (
    <div className="mt-6 rounded-2xl border app-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.providerIntegrations.panelTitle.replace(
            "{provider}",
            descriptor.label,
          )}
        </h3>
        {link.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[color:var(--foreground)] underline-offset-4 hover:underline"
          >
            {link.name || link.ref}
          </a>
        ) : (
          <span className="text-sm app-muted">{link.name || link.ref}</span>
        )}
      </div>

      {link.stats.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {link.stats.map((stat) => (
            <div key={stat.key}>
              <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {getStatLabel(stat, dictionary)}
              </dt>
              <dd className="mt-1 truncate text-sm text-[color:var(--foreground)]">
                {formatStatValue(stat, locale)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm app-muted">
          {dictionary.providerIntegrations.panelEmpty}
        </p>
      )}
    </div>
  );
}
