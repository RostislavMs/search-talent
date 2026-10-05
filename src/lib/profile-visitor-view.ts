import type { PublicProfilePageData } from "@/lib/db/public";
import { isPublicModerationStatus } from "@/lib/moderation";

/** `/u/{username}?view=visitor`: the owner's own page as a guest sees it. */
export const PROFILE_VISITOR_VIEW_PARAM = "view";
export const PROFILE_VISITOR_VIEW_VALUE = "visitor";

export function getProfileVisitorViewHref(username: string) {
  return `/u/${username}?${PROFILE_VISITOR_VIEW_PARAM}=${PROFILE_VISITOR_VIEW_VALUE}`;
}

export function isProfileVisitorViewRequested(value: string | string[] | undefined) {
  return value === PROFILE_VISITOR_VIEW_VALUE;
}

/**
 * The owner's page data turned into what a guest who hasn't signed in gets:
 * no owner buttons, no email or phone (guests open those through "Contact"),
 * no own vote, follow or bookmark. Salary and the hourly rate already reach
 * the page only when shown to everyone, and so does the author's look.
 */
export function toProfileVisitorView(data: PublicProfilePageData): PublicProfilePageData {
  return {
    ...data,
    contact: { ...data.contact, email: null, phone: null },
    voteSummary: { ...data.voteSummary, currentVote: null },
    isAuthenticated: false,
    isOwner: false,
    isBookmarked: false,
    isFollowing: false,
  };
}

/** While the page is on review, guests get "not found" instead of it. */
export function isProfileHiddenFromVisitors(data: PublicProfilePageData) {
  return !isPublicModerationStatus(data.profile.moderation_status);
}
