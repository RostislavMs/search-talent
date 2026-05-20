import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  getZodErrorMessage,
  parseJsonRequest,
} from "@/lib/validation/request";

function makeRequest(body: unknown, raw?: string): Request {
  const text = raw ?? JSON.stringify(body);
  return new Request("https://example.com/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: text,
  });
}

const schema = z.object({
  name: z.string().min(2, "name_too_short"),
  age: z.number().int().nonnegative(),
});

describe("parseJsonRequest", () => {
  it("returns parsed data when payload matches schema", async () => {
    const result = await parseJsonRequest(
      makeRequest({ name: "Alice", age: 30 }),
      schema,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns first schema error message on validation failure", async () => {
    const result = await parseJsonRequest(
      makeRequest({ name: "A", age: -1 }),
      schema,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("name_too_short");
    }
  });

  it("returns an Invalid JSON error for unparseable bodies", async () => {
    const result = await parseJsonRequest(
      makeRequest(null, "{not json"),
      schema,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid JSON body");
    }
  });
});

describe("getZodErrorMessage", () => {
  it("returns the first issue's message", () => {
    const parsed = schema.safeParse({ name: "", age: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(getZodErrorMessage(parsed.error)).toBe("name_too_short");
    }
  });

  it("falls back to a generic message when issue has no message", () => {
    const fakeError = { issues: [] } as unknown as z.ZodError;
    expect(getZodErrorMessage(fakeError)).toBe("Invalid request data");
  });
});
