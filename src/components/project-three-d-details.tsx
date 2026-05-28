import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  getThreeDEmbedUrl,
  type ThreeDKindMetadata,
  type ThreeDRole,
  type ThreeDStyle,
} from "@/lib/project-kind-metadata";

function getThreeDRoleLabel(role: ThreeDRole, dictionary: Dictionary) {
  switch (role) {
    case "modeling":
      return dictionary.forms.threeDRoleModeling;
    case "sculpting":
      return dictionary.forms.threeDRoleSculpting;
    case "rigging":
      return dictionary.forms.threeDRoleRigging;
    case "animation":
      return dictionary.forms.threeDRoleAnimation;
    case "texturing":
      return dictionary.forms.threeDRoleTexturing;
    case "lighting":
      return dictionary.forms.threeDRoleLighting;
    case "fx":
      return dictionary.forms.threeDRoleFx;
    case "look_dev":
      return dictionary.forms.threeDRoleLookDev;
    case "generalist":
      return dictionary.forms.threeDRoleGeneralist;
    case "concept":
      return dictionary.forms.threeDRoleConcept;
    default:
      return role;
  }
}

function getThreeDStyleLabel(value: ThreeDStyle, dictionary: Dictionary) {
  switch (value) {
    case "realistic":
      return dictionary.forms.threeDStyleRealistic;
    case "stylized":
      return dictionary.forms.threeDStyleStylized;
    case "lowpoly":
      return dictionary.forms.threeDStyleLowpoly;
    case "voxel":
      return dictionary.forms.threeDStyleVoxel;
    case "anime":
      return dictionary.forms.threeDStyleAnime;
    case "hard_surface":
      return dictionary.forms.threeDStyleHardSurface;
    case "organic":
      return dictionary.forms.threeDStyleOrganic;
    case "sculpt":
      return dictionary.forms.threeDStyleSculpt;
    case "abstract":
      return dictionary.forms.threeDStyleAbstract;
    default:
      return value;
  }
}

function formatPolygonCount(count: number, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale).format(count);
  } catch {
    return String(count);
  }
}

export default function ProjectThreeDDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: ThreeDKindMetadata;
}) {
  const embedUrl = getThreeDEmbedUrl(meta.modelUrl);

  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.threeDSectionTitle}
      </h3>

      {embedUrl ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          <div className="relative aspect-video">
            <iframe
              src={embedUrl}
              title={dictionary.forms.threeDModelUrlLabel}
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : meta.modelUrl ? (
        <a
          href={meta.modelUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border app-border px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {dictionary.forms.threeDModelUrlLabel}
        </a>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.threeDRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getThreeDRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.renderEngine && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.threeDRenderEngineLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.renderEngine}
            </p>
          </div>
        )}
        {meta.polygonCount !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.threeDPolygonCountLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatPolygonCount(meta.polygonCount)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.threeDClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
      </div>

      {meta.software.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.threeDSoftwareLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.software.map((item) => (
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

      {meta.styles.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.threeDStylesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.styles.map((style) => (
              <span
                key={style}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {getThreeDStyleLabel(style, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
