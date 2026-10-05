import { describe, expect, it } from "vitest";
import type { PublicProfilePageData } from "@/lib/db/public";
import {
  getProfileVisitorViewHref,
  isProfileHiddenFromVisitors,
  isProfileVisitorViewRequested,
  toProfileVisitorView,
} from "@/lib/profile-visitor-view";

function ownerData(moderationStatus = "approved"): PublicProfilePageData {
  return {
    profile: { username: "olena", moderation_status: moderationStatus },
    contact: { hasEmail: true, hasPhone: true, email: "olena@example.com", phone: "+380000000000" },
    salary: { amount: "2000", currency: "usd" },
    hourlyRate: null,
    voteSummary: { likes: 3, dislikes: 1, score: 2, currentVote: null },
    isAuthenticated: true,
    isOwner: true,
    isBookmarked: false,
    isFollowing: false,
  } as unknown as PublicProfilePageData;
}

describe("profile visitor view", () => {
  it("links to the page with the visitor parameter", () => {
    expect(getProfileVisitorViewHref("olena")).toBe("/u/olena?view=visitor");
    expect(isProfileVisitorViewRequested("visitor")).toBe(true);
    expect(isProfileVisitorViewRequested(["visitor"])).toBe(false);
    expect(isProfileVisitorViewRequested(undefined)).toBe(false);
  });

  it("turns the owner's data into a signed-out guest's", () => {
    const data = toProfileVisitorView(ownerData());

    expect(data.isOwner).toBe(false);
    expect(data.isAuthenticated).toBe(false);
    expect(data.isBookmarked).toBe(false);
    expect(data.isFollowing).toBe(false);
    expect(data.voteSummary).toEqual({ likes: 3, dislikes: 1, score: 2, currentVote: null });
    // Guests learn that an email and phone exist, not what they are.
    expect(data.contact).toEqual({ hasEmail: true, hasPhone: true, email: null, phone: null });
    // Shown to everyone already, so it stays.
    expect(data.salary).toEqual({ amount: "2000", currency: "usd" });
  });

  it("says when guests can't see the page at all", () => {
    expect(isProfileHiddenFromVisitors(ownerData("approved"))).toBe(false);
    expect(isProfileHiddenFromVisitors(ownerData("under_review"))).toBe(true);
  });
});
