import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type DesignDeliverable,
  type DesignKindMetadata,
  type DesignRole,
  type DesignTool,
} from "@/lib/project-kind-metadata";

function getDesignRoleLabel(role: DesignRole, dictionary: Dictionary) {
  switch (role) {
    case "ui":
      return dictionary.forms.designRoleUi;
    case "ux":
      return dictionary.forms.designRoleUx;
    case "product":
      return dictionary.forms.designRoleProduct;
    case "brand":
      return dictionary.forms.designRoleBrand;
    case "web":
      return dictionary.forms.designRoleWeb;
    case "mobile":
      return dictionary.forms.designRoleMobile;
    case "illustration":
      return dictionary.forms.designRoleIllustration;
    case "motion":
      return dictionary.forms.designRoleMotion;
    case "type":
      return dictionary.forms.designRoleType;
    case "packaging":
      return dictionary.forms.designRolePackaging;
    case "icon":
      return dictionary.forms.designRoleIcon;
    default:
      return role;
  }
}

function getDesignToolLabel(tool: DesignTool, dictionary: Dictionary) {
  switch (tool) {
    case "figma":
      return dictionary.forms.designToolFigma;
    case "sketch":
      return dictionary.forms.designToolSketch;
    case "adobe_xd":
      return dictionary.forms.designToolAdobeXd;
    case "photoshop":
      return dictionary.forms.designToolPhotoshop;
    case "illustrator":
      return dictionary.forms.designToolIllustrator;
    case "indesign":
      return dictionary.forms.designToolIndesign;
    case "after_effects":
      return dictionary.forms.designToolAfterEffects;
    case "framer":
      return dictionary.forms.designToolFramer;
    case "webflow":
      return dictionary.forms.designToolWebflow;
    case "procreate":
      return dictionary.forms.designToolProcreate;
    case "blender":
      return dictionary.forms.designToolBlender;
    case "spline":
      return dictionary.forms.designToolSpline;
    default:
      return tool;
  }
}

function getDesignDeliverableLabel(
  value: DesignDeliverable,
  dictionary: Dictionary,
) {
  switch (value) {
    case "logo":
      return dictionary.forms.designDeliverableLogo;
    case "brand_book":
      return dictionary.forms.designDeliverableBrandBook;
    case "ui_kit":
      return dictionary.forms.designDeliverableUiKit;
    case "design_system":
      return dictionary.forms.designDeliverableDesignSystem;
    case "landing":
      return dictionary.forms.designDeliverableLanding;
    case "website":
      return dictionary.forms.designDeliverableWebsite;
    case "mobile_screens":
      return dictionary.forms.designDeliverableMobileScreens;
    case "prototype":
      return dictionary.forms.designDeliverablePrototype;
    case "icon_set":
      return dictionary.forms.designDeliverableIconSet;
    case "illustration":
      return dictionary.forms.designDeliverableIllustration;
    case "packaging":
      return dictionary.forms.designDeliverablePackaging;
    case "print":
      return dictionary.forms.designDeliverablePrint;
    case "animation":
      return dictionary.forms.designDeliverableAnimation;
    default:
      return value;
  }
}

export default function ProjectDesignDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: DesignKindMetadata;
}) {
  const sourceLinks: Array<{ label: string; href: string }> = [];
  if (meta.figmaUrl) {
    sourceLinks.push({ label: "Figma", href: meta.figmaUrl });
  }
  if (meta.behanceUrl) {
    sourceLinks.push({ label: "Behance", href: meta.behanceUrl });
  }
  if (meta.dribbbleUrl) {
    sourceLinks.push({ label: "Dribbble", href: meta.dribbbleUrl });
  }

  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.designSectionTitle}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.designRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getDesignRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.designClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
      </div>

      {meta.tools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.designToolsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.tools.map((tool) => (
              <span
                key={tool}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {getDesignToolLabel(tool, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.deliverables.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.designDeliverablesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.deliverables.map((item) => (
              <span
                key={item}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {getDesignDeliverableLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {sourceLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sourceLinks.map((link) => (
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
