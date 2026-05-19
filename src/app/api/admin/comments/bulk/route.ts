import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const itemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["article", "project"]),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
});

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();
  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }

  const articleIds: string[] = [];
  const projectIds: string[] = [];
  for (const item of parsed.data.items) {
    if (item.kind === "article") {
      articleIds.push(item.id);
    } else {
      projectIds.push(item.id);
    }
  }

  const { supabase } = context;

  if (articleIds.length > 0) {
    const { error } = await supabase
      .from("article_comments")
      .delete()
      .in("id", articleIds);
    if (error) {
      return NextResponse.json(
        { error: error.message || "Delete failed" },
        { status: 400 },
      );
    }
  }

  if (projectIds.length > 0) {
    const { error } = await supabase
      .from("project_comments")
      .delete()
      .in("id", projectIds);
    if (error) {
      return NextResponse.json(
        { error: error.message || "Delete failed" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    deleted: parsed.data.items.length,
  });
}
