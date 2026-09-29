import { NextResponse } from "next/server";
import { loadViewerAffinity } from "@/lib/db/affinity";
import { searchDiscovery } from "@/lib/db/search";
import { normalizeOpenTo, openToFromEmploymentTypes } from "@/lib/open-to";
import { normalizeProjectKind } from "@/lib/projects";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/view-tracking";

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

// Open to guests, and every call runs several queries. The discovery page sends
// one request per filter change, so 60 a minute per address is far above a
// person clicking and well below a scraper.
const SEARCH_LIMIT_PER_MINUTE = 60;

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  if (ip) {
    const limited = await dbRateLimit(`search:${ip}`, SEARCH_LIMIT_PER_MINUTE, 60_000);
    if (limited) {
      return limited;
    }
  }

  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  const sort = searchParams.get("sort") || undefined;

  // Only load the viewer's behavioural profile when the request actually asks
  // for a personalised order — every other sort is impersonal, and the
  // affinity load is several extra queries.
  const {
    data: { user },
  } = sort === "forYou"
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  const viewer = user ? await loadViewerAffinity(supabase, user.id) : null;

  const result = await searchDiscovery(
    {
      q: searchParams.get("q") || undefined,
      scope: searchParams.get("scope") || undefined,
      sort,
      countryId: parseNumber(searchParams.get("countryId")),
      categoryId: parseNumber(searchParams.get("categoryId")),
      skillIds: parseNumberArray(searchParams.get("skillIds")),
      languageIds: parseNumberArray(searchParams.get("languageIds")),
      experienceLevel: (searchParams.get("experienceLevel") || "").trim() || null,
      // `employmentTypes` is the field «Відкрито до…» replaced; old links and
      // saved searches still send it.
      openTo: normalizeOpenTo([
        ...parseStringArray(searchParams.get("openTo")),
        ...openToFromEmploymentTypes(parseStringArray(searchParams.get("employmentTypes"))),
      ]),
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
    viewer,
  );

  return NextResponse.json(result);
}
