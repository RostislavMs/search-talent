import { NextResponse } from "next/server";
import { searchDiscovery } from "@/lib/db/search";
import { normalizeProjectKind } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseNumberArray(value: string | null) {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0),
  )];
}

function parseStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  const result = await searchDiscovery(
    {
      q: searchParams.get("q") || undefined,
      scope: searchParams.get("scope") || undefined,
      sort: searchParams.get("sort") || undefined,
      countryId: parseNumber(searchParams.get("countryId")),
      categoryId: parseNumber(searchParams.get("categoryId")),
      skillIds: parseNumberArray(searchParams.get("skillIds")),
      languageIds: parseNumberArray(searchParams.get("languageIds")),
      experienceLevel: (searchParams.get("experienceLevel") || "").trim() || null,
      employmentTypes: parseStringArray(searchParams.get("employmentTypes")),
      workFormats: parseStringArray(searchParams.get("workFormats")),
      projectStatus: (searchParams.get("projectStatus") || "").trim() || null,
      projectKind: normalizeProjectKind(searchParams.get("kind")),
      hasMedia: searchParams.get("hasMedia") === "1",
      hasAvatar: searchParams.get("hasAvatar") === "1",
      minScore: parseNumber(searchParams.get("minScore")),
      maxScore: parseNumber(searchParams.get("maxScore")),
      perPage: parseNumber(searchParams.get("perPage")),
      page: parseNumber(searchParams.get("page")),
    },
    supabase,
  );

  return NextResponse.json(result);
}
