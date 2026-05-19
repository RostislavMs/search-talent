"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";

type FollowUnfollowButtonProps = {
  followingUserId: string;
};

export default function FollowUnfollowButton({
  followingUserId,
}: FollowUnfollowButtonProps) {
  const dictionary = useDictionary();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const handleUnfollow = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (loading || pending) return;
    setLoading(true);

    const result = await apiFetch("/api/follows", {
      method: "POST",
      body: { followingUserId },
    });

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || dictionary.follows.toggleError);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleUnfollow}
      disabled={loading || pending}
      className="inline-flex items-center gap-1.5 rounded-full border app-border px-3 py-1 text-xs font-medium app-muted hover:text-[color:var(--foreground)] disabled:opacity-60"
    >
      {loading || pending
        ? dictionary.follows.unfollowing
        : dictionary.follows.unfollow}
    </button>
  );
}
