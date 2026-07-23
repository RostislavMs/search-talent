import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { isR2Url } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";

const MAX_ATTACHMENTS = 5;

const attachmentSchema = z.object({
  url: z.string().url().max(1000),
  contentType: z.string().max(100).optional().default(""),
  name: z.string().max(255).optional().default(""),
});

const feedbackSchema = z.object({
  name: z.string().max(100).optional().default(""),
  email: z.string().max(254).optional().default(""),
  category: z.enum(["idea", "bug", "feedback", "complaint"]),
  message: z.string().min(1).max(5000),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional().default([]),
});

export async function POST(request: Request) {
  const limited = rateLimit("feedback", 5, 60_000);

  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  const parsed = await parseJsonRequest(request, feedbackSchema);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error || "Invalid request" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const attachments = parsed.data.attachments;

  if (attachments.length > 0) {
    // Media uploads require authentication (see the presign route), so an
    // anonymous submission carrying attachments is invalid by construction.
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to attach media" },
        { status: 401 },
      );
    }

    // Only accept URLs that actually live on our R2 storage — never arbitrary
    // remote URLs a client might inject.
    if (!attachments.every((item) => isR2Url(item.url))) {
      return NextResponse.json(
        { error: "Invalid attachment" },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user?.id || null,
    name: parsed.data.name || null,
    email: parsed.data.email || null,
    category: parsed.data.category,
    message: parsed.data.message,
    attachments,
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not save feedback" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
