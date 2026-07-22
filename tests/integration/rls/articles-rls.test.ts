import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasTestDb } from "../helpers/env";
import { anonClient, serviceClient, userClient } from "../helpers/clients";
import { cleanupUser, createArticle, createTestUser, type TestUser } from "../helpers/seed";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Guards the article UPDATE authorization. The base policy `articles_update_compat`
 * (supabase/06 + 19) currently grants UPDATE to `anon`/`authenticated` when
 * `status='published' AND moderation_status='approved'` — meaning ANYONE can
 * edit a published article. These tests assert the SECURE expectation, so:
 *   - "anon cannot edit" and "other user cannot edit" are EXPECTED TO FAIL
 *     against the current (unpatched) schema — they document the open hole and
 *     turn green once the published-disjunct is removed from the policy.
 *   - "author can edit" pins the legitimate path.
 */
suite("RLS: articles UPDATE authorization", () => {
  let admin: SupabaseClient;
  let author: TestUser;
  let other: TestUser;
  let articleId: string;

  beforeAll(async () => {
    admin = serviceClient();
    author = await createTestUser(admin);
    other = await createTestUser(admin);
    const article = await createArticle(admin, author.id, {
      title: "Original",
      status: "published",
      moderation_status: "approved",
    });
    articleId = article.id;
  });

  afterAll(async () => {
    if (author) await cleanupUser(admin, author.id);
    if (other) await cleanupUser(admin, other.id);
  });

  it("lets the author update their own article", async () => {
    const client = await userClient(author.email, author.password);
    const { error } = await client
      .from("articles")
      .update({ title: "Edited by author" })
      .eq("id", articleId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("articles")
      .select("title")
      .eq("id", articleId)
      .single();
    expect(data?.title).toBe("Edited by author");
  });

  it("blocks an anonymous client from editing a published article [KNOWN HOLE until RLS fix]", async () => {
    const { data: before } = await admin
      .from("articles")
      .select("title")
      .eq("id", articleId)
      .single();

    // RLS-blocked UPDATE affects 0 rows and returns no error; verify via admin.
    await anonClient().from("articles").update({ title: "HACKED BY ANON" }).eq("id", articleId);

    const { data: after } = await admin
      .from("articles")
      .select("title")
      .eq("id", articleId)
      .single();
    expect(after?.title).toBe(before?.title);
  });

  it("blocks a different authenticated user from editing someone else's article [KNOWN HOLE until RLS fix]", async () => {
    const { data: before } = await admin
      .from("articles")
      .select("title")
      .eq("id", articleId)
      .single();

    const client = await userClient(other.email, other.password);
    await client.from("articles").update({ title: "HACKED BY OTHER" }).eq("id", articleId);

    const { data: after } = await admin
      .from("articles")
      .select("title")
      .eq("id", articleId)
      .single();
    expect(after?.title).toBe(before?.title);
  });
});
