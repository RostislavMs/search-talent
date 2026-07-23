import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  EMPTY_MESSAGE_ERROR,
  isEmptyMessageContent,
  popupInputToRow,
  popupUpdateSchema,
} from "@/lib/validation/popup";
import { parseJsonRequest } from "@/lib/validation/request";

const routeSchema = z.object({
  id: z.string().uuid("Invalid popup id"),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routeParams = routeSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid popup id" },
      { status: 400 },
    );
  }

  const parsed = await parseJsonRequest(request, popupUpdateSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { supabase } = context;
  const { id } = routeParams.data;

  // Guard against activating a message popup that has nothing to show. The
  // toggle sends only { isActive }, so merge the incoming fields over the
  // stored row before checking.
  if (parsed.data.isActive === true) {
    const { data: current } = await supabase
      .from("site_popups")
      .select(
        "kind, title_en, title_uk, body_en, body_uk, cta_label_en, cta_label_uk",
      )
      .eq("id", id)
      .maybeSingle();

    const kind = parsed.data.kind ?? (current?.kind as string | undefined);

    if (kind === "message") {
      const merged = {
        titleEn: parsed.data.titleEn ?? current?.title_en,
        titleUk: parsed.data.titleUk ?? current?.title_uk,
        bodyEn: parsed.data.bodyEn ?? current?.body_en,
        bodyUk: parsed.data.bodyUk ?? current?.body_uk,
        ctaLabelEn: parsed.data.ctaLabelEn ?? current?.cta_label_en,
        ctaLabelUk: parsed.data.ctaLabelUk ?? current?.cta_label_uk,
      };

      if (isEmptyMessageContent(merged)) {
        return NextResponse.json(
          { error: EMPTY_MESSAGE_ERROR },
          { status: 400 },
        );
      }
    }
  }

  // Activating this popup? Deactivate every other active popup first so the
  // single-active index is never violated by two simultaneously-true rows.
  if (parsed.data.isActive === true) {
    const { error: deactivateError } = await supabase
      .from("site_popups")
      .update({ is_active: false })
      .eq("is_active", true)
      .neq("id", id);

    if (deactivateError) {
      return NextResponse.json(
        { error: deactivateError.message || "Could not update popups" },
        { status: 400 },
      );
    }
  }

  const row = popupInputToRow(parsed.data);
  row.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("site_popups")
    .update(row)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not update popup" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routeParams = routeSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid popup id" },
      { status: 400 },
    );
  }

  const { error } = await context.supabase
    .from("site_popups")
    .delete()
    .eq("id", routeParams.data.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not delete popup" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
