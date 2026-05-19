"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";

type BookmarkButtonProps = {
  targetType: "profile" | "project";
  targetId: string;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
};

export default function BookmarkButton({
  targetType,
  targetId,
  initialBookmarked,
  isAuthenticated,
}: BookmarkButtonProps) {
  const dictionary = useDictionary();
  const toast = useToast();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);

    const result = await apiFetch<{ bookmarked: boolean }>("/api/bookmarks", {
      method: "POST",
      body: { targetType, targetId },
    });

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || dictionary.bookmarks.toggleError);
      return;
    }

    setBookmarked(result.data.bookmarked);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Button
      onClick={toggle}
      disabled={loading}
      variant={bookmarked ? "primary" : "ghost"}
      size="sm"
      aria-pressed={bookmarked}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill={bookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={bookmarked ? 0 : 1.5}
        className="mr-1.5 h-4 w-4"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 2c-.414 0-.832.06-1.225.178a3.5 3.5 0 0 0-2.097 2.097C6.56 4.668 6.5 5.086 6.5 5.5v11a.5.5 0 0 0 .765.424L10 15.132l2.735 1.792A.5.5 0 0 0 13.5 16.5v-11c0-.414-.06-.832-.178-1.225a3.5 3.5 0 0 0-2.097-2.097A3.5 3.5 0 0 0 10 2Z"
          clipRule="evenodd"
        />
      </svg>
      {bookmarked ? dictionary.bookmarks.saved : dictionary.bookmarks.save}
    </Button>
  );
}
