import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { respondToCoAuthorInvitation } from "@/lib/db/co-authors";
import { CO_AUTHOR_CONTENT_TYPES } from "@/lib/co-authors";

const routeSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  contentType: z.enum(CO_AUTHOR_CONTENT_TYPES),
  action: z.enum(["accept", "decline"]),
});

/**
 * PATCH /api/co-author-invitations/:id
 * Accept or decline a co-author invitation. The invitation id is opaque across
 * content types, so the client passes `contentType` (known from the listing or
 * the notification metadata) to locate the right junction table.
 *
 * The response work runs server-side with the service-role client, which both
 * verifies the caller owns the invitation and lets the final acceptance publish
 * a held draft without granting co-authors write access to the content.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedParams = routeSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await respondToCoAuthorInvitation({
    contentType: parsedBody.data.contentType,
    invitationId: parsedParams.data.id,
    userId: user.id,
    accept: parsedBody.data.action === "accept",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Invitation not found or already handled" },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
