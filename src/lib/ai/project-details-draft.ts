// The part of an AI draft beyond the story: the project kind's details section
// (code: architecture, language, hosting…; QA: test types, tools…) and the
// technology tags. Shared by the GitHub and the provider (GitLab) drafts.
//
// Pure — no Gemini SDK, no `server-only` — so the prompt text and the checks
// on the model's answer stay unit-testable. The model only picks from the
// closed lists below; anything else is dropped. Facts the source states
// outright (its languages, its license) win over the model, and a link is kept
// only when it appears word for word in the source text.

import {
  codeArchitectures,
  codeDatabases,
  codeHostings,
  codeLanguages,
  codeLicenses,
  qaMethodologies,
  qaRoles,
  qaTestTypes,
  qaTools,
  type CodeKindMetadata,
  type QaKindMetadata,
} from "@/lib/project-kind-metadata";
import type { ProjectKind } from "@/lib/projects";

export const MAX_DRAFT_TECHNOLOGIES = 12;

/** The details fields an AI draft fills, per kind. */
export const DRAFT_CODE_DETAIL_KEYS = [
  "architecture",
  "primaryLanguage",
  "hosting",
  "databases",
  "license",
  "docsUrl",
  "storybookUrl",
  "apiPlaygroundUrl",
] as const satisfies ReadonlyArray<keyof CodeKindMetadata>;

export const DRAFT_QA_DETAIL_KEYS = [
  "role",
  "testTypes",
  "tools",
  "methodologies",
  "reportUrl",
] as const satisfies ReadonlyArray<keyof QaKindMetadata>;

/** One extra field of the model's answer: a value or a list of values. */
export type DetailDraftField = {
  key: string;
  list: boolean;
  description: string;
};

export type DraftDetails = {
  code?: Partial<CodeKindMetadata>;
  qa?: Partial<QaKindMetadata>;
};

export type DetailsDraft = {
  details: DraftDetails;
  technologies: string[];
};

/** What the source states outright; it overrides the model. */
export type DetailsDraftFacts = {
  /** Languages, most used first. */
  languages: string[];
  /** License as the source names it (an SPDX id or a display name), null when there is none. */
  license: string | null;
  /** Everything the model was shown, to check links against. */
  sourceText: string;
};

const oneOf = (values: readonly string[]) => `One of: ${values.join(", ")}.`;
const anyOf = (values: readonly string[]) => `Any of: ${values.join(", ")}.`;
const LINK_RULE =
  "Copy the URL exactly as it appears in the input. Empty string if the input has none.";

const TECHNOLOGIES_FIELD: DetailDraftField = {
  key: "technologies",
  list: true,
  description: `Frameworks, libraries, languages, databases and tools the project clearly uses, by their usual names (e.g. React, Next.js, PostgreSQL, Docker). Only what the input shows, at most ${MAX_DRAFT_TECHNOLOGIES}.`,
};

const CODE_FIELDS: DetailDraftField[] = [
  {
    key: "codeArchitecture",
    list: false,
    description: `What kind of software this is. ${oneOf(codeArchitectures)} Empty string if unclear.`,
  },
  {
    key: "codePrimaryLanguage",
    list: false,
    description: `The main programming language, from the language breakdown. ${oneOf(codeLanguages)}`,
  },
  {
    key: "codeHosting",
    list: true,
    description: `Where the project is deployed, only if the input says so. ${anyOf(codeHostings)}`,
  },
  {
    key: "codeDatabases",
    list: true,
    description: `Databases and data stores it uses, only if the input says so. ${anyOf(codeDatabases)}`,
  },
  {
    key: "codeLicense",
    list: false,
    description: `The license. ${oneOf(codeLicenses)} Empty string if none.`,
  },
  { key: "codeDocsUrl", list: false, description: `Link to the documentation. ${LINK_RULE}` },
  { key: "codeStorybookUrl", list: false, description: `Link to a Storybook. ${LINK_RULE}` },
  {
    key: "codeApiPlaygroundUrl",
    list: false,
    description: `Link to an API playground (Swagger, Postman…). ${LINK_RULE}`,
  },
];

const QA_FIELDS: DetailDraftField[] = [
  {
    key: "qaRole",
    list: false,
    description: `The author's QA role. ${oneOf(qaRoles)} Empty string if unclear.`,
  },
  { key: "qaTestTypes", list: true, description: `Kinds of testing done. ${anyOf(qaTestTypes)}` },
  { key: "qaTools", list: true, description: `Testing tools used. ${anyOf(qaTools)}` },
  {
    key: "qaMethodologies",
    list: true,
    description: `Ways of working, only if the input says so. ${anyOf(qaMethodologies)}`,
  },
  { key: "qaReportUrl", list: false, description: `Link to a test report. ${LINK_RULE}` },
];

/** The extra fields to ask for, given the project's kind. */
export function getDetailDraftFields(kind: ProjectKind | null): DetailDraftField[] {
  if (kind === "code") return [...CODE_FIELDS, TECHNOLOGIES_FIELD];
  if (kind === "qa") return [...QA_FIELDS, TECHNOLOGIES_FIELD];
  return [TECHNOLOGIES_FIELD];
}

/** The prompt paragraph that explains those fields. */
export function buildDetailsPromptSection(kind: ProjectKind | null): string {
  return [
    "PROJECT DETAILS AND TECHNOLOGIES",
    "Also fill these fields. Pick values only from the lists given; an empty string or an empty list is the right answer when the input does not show it. Never guess hosting, databases or links.",
    ...getDetailDraftFields(kind).map((field) => `- ${field.key}: ${field.description}`),
  ].join("\n");
}

function matchOne<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const needle = value.trim().toLowerCase();
  if (!needle) return null;
  return allowed.find((item) => item.toLowerCase() === needle) ?? null;
}

function matchMany<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    const match = matchOne(item, allowed);
    if (match && !result.includes(match)) result.push(match);
  }
  return result;
}

function sourcedLink(value: unknown, sourceText: string): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > 2048) return null;
  return sourceText.includes(url) ? url : null;
}

function licenseFromFacts(license: string): CodeKindMetadata["license"] {
  const direct = matchOne(license, codeLicenses);
  if (direct) return direct;
  // "MIT License" → "MIT"
  return matchOne(license.replace(/\s+license$/i, ""), codeLicenses);
}

function technologiesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    const key = name.toLowerCase();
    if (!name || name.length > 40 || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= MAX_DRAFT_TECHNOLOGIES) break;
  }
  return result;
}

/** Checks the model's extra fields against the lists and the source's facts. */
export function normalizeDetailsDraft(
  kind: ProjectKind | null,
  raw: Record<string, unknown>,
  facts: DetailsDraftFacts,
): DetailsDraft {
  const details: DraftDetails = {};

  if (kind === "code") {
    const factLanguage =
      facts.languages
        .map((language) => matchOne(language, codeLanguages))
        .find((language) => language && language !== "Other") ?? null;
    const modelLicense = matchOne(raw.codeLicense, codeLicenses);

    details.code = {
      architecture: matchOne(raw.codeArchitecture, codeArchitectures),
      primaryLanguage: factLanguage ?? matchOne(raw.codePrimaryLanguage, codeLanguages),
      hosting: matchMany(raw.codeHosting, codeHostings),
      databases: matchMany(raw.codeDatabases, codeDatabases),
      // A source without a license has none — the model must not invent one.
      license: facts.license ? (licenseFromFacts(facts.license) ?? modelLicense) : null,
      docsUrl: sourcedLink(raw.codeDocsUrl, facts.sourceText),
      storybookUrl: sourcedLink(raw.codeStorybookUrl, facts.sourceText),
      apiPlaygroundUrl: sourcedLink(raw.codeApiPlaygroundUrl, facts.sourceText),
    };
  }

  if (kind === "qa") {
    details.qa = {
      role: matchOne(raw.qaRole, qaRoles),
      testTypes: matchMany(raw.qaTestTypes, qaTestTypes),
      tools: matchMany(raw.qaTools, qaTools),
      methodologies: matchMany(raw.qaMethodologies, qaMethodologies),
      reportUrl: sourcedLink(raw.qaReportUrl, facts.sourceText),
    };
  }

  return { details, technologies: technologiesFrom(raw.technologies) };
}
