"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";

type FollowButtonProps = {
  followingUserId: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
};

export default function FollowButton({
  followingUserId,
  initialFollowing,
  isAuthenticated,
}: FollowButtonProps) {
  const dictionary = useDictionary();
  const toast = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);

    const result = await apiFetch<{ following: boolean }>("/api/follows", {
      method: "POST",
      body: { followingUserId },
    });

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || dictionary.follows.toggleError);
      return;
    }

    setFollowing(result.data.following);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Button
      onClick={toggle}
      disabled={loading}
      variant={following ? "primary" : "ghost"}
      size="sm"
      aria-pressed={following}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill={following ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={following ? 0 : 1.5}
        className="mr-1.5 h-4 w-4"
        aria-hidden="true"
      >
        {following ? (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
          />
        )}
      </svg>
      {following ? dictionary.follows.following : dictionary.follows.follow}
    </Button>
  );
}
