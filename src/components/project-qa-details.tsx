import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type QaKindMetadata,
  type QaMethodology,
  type QaRole,
  type QaTestType,
} from "@/lib/project-kind-metadata";

function getQaRoleLabel(role: QaRole, dictionary: Dictionary) {
  switch (role) {
    case "manual_qa":
      return dictionary.forms.qaRoleManualQa;
    case "automation_qa":
      return dictionary.forms.qaRoleAutomationQa;
    case "qa_lead":
      return dictionary.forms.qaRoleQaLead;
    case "test_architect":
      return dictionary.forms.qaRoleTestArchitect;
    case "performance":
      return dictionary.forms.qaRolePerformance;
    case "security":
      return dictionary.forms.qaRoleSecurity;
    case "mobile":
      return dictionary.forms.qaRoleMobile;
    case "accessibility":
      return dictionary.forms.qaRoleAccessibility;
    case "usability":
      return dictionary.forms.qaRoleUsability;
    case "exploratory":
      return dictionary.forms.qaRoleExploratory;
    default:
      return role;
  }
}

function getQaTestTypeLabel(value: QaTestType, dictionary: Dictionary) {
  switch (value) {
    case "manual":
      return dictionary.forms.qaTestTypeManual;
    case "automation":
      return dictionary.forms.qaTestTypeAutomation;
    case "performance":
      return dictionary.forms.qaTestTypePerformance;
    case "load":
      return dictionary.forms.qaTestTypeLoad;
    case "security":
      return dictionary.forms.qaTestTypeSecurity;
    case "api":
      return dictionary.forms.qaTestTypeApi;
    case "ui":
      return dictionary.forms.qaTestTypeUi;
    case "mobile":
      return dictionary.forms.qaTestTypeMobile;
    case "accessibility":
      return dictionary.forms.qaTestTypeAccessibility;
    case "usability":
      return dictionary.forms.qaTestTypeUsability;
    case "regression":
      return dictionary.forms.qaTestTypeRegression;
    case "smoke":
      return dictionary.forms.qaTestTypeSmoke;
    case "exploratory":
      return dictionary.forms.qaTestTypeExploratory;
    case "integration":
      return dictionary.forms.qaTestTypeIntegration;
    case "unit":
      return dictionary.forms.qaTestTypeUnit;
    case "e2e":
      return dictionary.forms.qaTestTypeE2e;
    default:
      return value;
  }
}

function getQaMethodologyLabel(value: QaMethodology, dictionary: Dictionary) {
  switch (value) {
    case "agile":
      return dictionary.forms.qaMethodologyAgile;
    case "scrum":
      return dictionary.forms.qaMethodologyScrum;
    case "kanban":
      return dictionary.forms.qaMethodologyKanban;
    case "waterfall":
      return dictionary.forms.qaMethodologyWaterfall;
    case "bdd":
      return dictionary.forms.qaMethodologyBdd;
    case "tdd":
      return dictionary.forms.qaMethodologyTdd;
    case "shift_left":
      return dictionary.forms.qaMethodologyShiftLeft;
    case "risk_based":
      return dictionary.forms.qaMethodologyRiskBased;
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

export default function ProjectQaDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: QaKindMetadata;
}) {
  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.qaSectionTitle}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.qaRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getQaRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.qaClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
        {meta.testCasesCount !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.qaTestCasesCountLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatNumber(meta.testCasesCount)}
            </p>
          </div>
        )}
        {meta.bugsFoundCount !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.qaBugsFoundCountLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatNumber(meta.bugsFoundCount)}
            </p>
          </div>
        )}
        {meta.automationCoveragePercent !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.qaAutomationCoverageLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.automationCoveragePercent}%
            </p>
          </div>
        )}
      </div>

      {meta.testTypes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.qaTestTypesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.testTypes.map((item) => (
              <span
                key={item}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {getQaTestTypeLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.tools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.qaToolsLabel}
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

      {meta.methodologies.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.qaMethodologiesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.methodologies.map((item) => (
              <span
                key={item}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {getQaMethodologyLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.certifications.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.qaCertificationsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.certifications.map((cert) => (
              <span
                key={cert}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.reportUrl && (
        <a
          href={meta.reportUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border app-border px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {dictionary.forms.qaReportUrlLabel}
        </a>
      )}
    </div>
  );
}
