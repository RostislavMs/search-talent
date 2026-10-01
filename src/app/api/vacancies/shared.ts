import { NextResponse } from "next/server";
import {
  collectVacancyModerationText,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { holdVacancyForReview } from "@/lib/db/vacancies";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import {
  VACANCY_LIMITS,
  vacancyWriteErrorCode,
  type VacancyWriteErrorCode,
} from "@/lib/vacancies";

const WRITE_ERROR_STATUS: Record<VacancyWriteErrorCode, number> = {
  daily_limit: 409,
  invalid_status: 409,
  pay_required: 400,
  skills_limit: 400,
  forbidden: 403,
  invalid: 400,
};

/** A failed insert or update, as the form understands it. */
export function vacancyWriteErrorResponse(
  error: { code?: string | null; message?: string | null } | null,
  fallback: string,
) {
  const code = vacancyWriteErrorCode(error) ?? "invalid";
  return NextResponse.json(
    { error: error?.message || fallback, code },
    { status: WRITE_ERROR_STATUS[code] },
  );
}

/**
 * The editor's HTML as it is stored: sanitized, and within the column's limit
 * (sanitizing rarely makes it longer, but the check has to hold).
 */
export function sanitizeVacancyDescription(
  html: string,
): { ok: true; html: string } | { ok: false } {
  const clean = html.trim() ? sanitizeRichTextHtml(html) : "";
  return clean.length <= VACANCY_LIMITS.descriptionMax ? { ok: true, html: clean } : { ok: false };
}

/**
 * Screens the text of a vacancy that is out (or going out). Flagged text keeps
 * the vacancy for a moderator; the team still sees it. Returns whether it was
 * held.
 */
export async function screenVacancy(
  vacancyId: string,
  text: { title: string; description: string; city: string | null },
): Promise<boolean> {
  const screen = screenContentForModeration(collectVacancyModerationText(text), { scam: true });
  return screen.flagged ? holdVacancyForReview(vacancyId, screen.note) : false;
}
