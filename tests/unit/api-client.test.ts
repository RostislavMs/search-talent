import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-client";

const NETWORK_ERROR = "Network error. Please check your connection.";

type FakeResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function response(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch — success", () => {
  it("returns ok:true with parsed data on 2xx", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { bookmarked: true }));
    const result = await apiFetch<{ bookmarked: boolean }>("/api/bookmarks");
    expect(result).toEqual({ ok: true, data: { bookmarked: true } });
  });

  it("falls back to an empty object when the body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    const result = await apiFetch("/api/thing");
    expect(result).toEqual({ ok: true, data: {} });
  });
});

describe("apiFetch — request shaping", () => {
  it("defaults to GET and sends no body or content-type", async () => {
    fetchMock.mockResolvedValueOnce(response(200, {}));
    await apiFetch("/api/x");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("serializes the body and sets Content-Type when a body is given", async () => {
    fetchMock.mockResolvedValueOnce(response(200, {}));
    await apiFetch("/api/x", { method: "POST", body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("merges caller-supplied headers", async () => {
    fetchMock.mockResolvedValueOnce(response(200, {}));
    await apiFetch("/api/x", { headers: { "X-Test": "1" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Test"]).toBe("1");
  });
});

describe("apiFetch — errors", () => {
  it("maps a thrown fetch to a network error with status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await apiFetch("/api/x");
    expect(result).toEqual({ ok: false, error: NETWORK_ERROR, status: 0 });
  });

  it("uses the server error message on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(response(403, { error: "Forbidden" }));
    const result = await apiFetch("/api/x");
    expect(result).toEqual({ ok: false, error: "Forbidden", status: 403 });
  });

  it("appends details when present", async () => {
    fetchMock.mockResolvedValueOnce(
      response(500, { error: "Failed", details: "AI timeout" }),
    );
    const result = await apiFetch("/api/x");
    expect(result).toEqual({
      ok: false,
      error: "Failed — AI timeout",
      status: 500,
    });
  });

  it("synthesizes a generic message when the error field is missing", async () => {
    fetchMock.mockResolvedValueOnce(response(404, {}));
    const result = await apiFetch("/api/x");
    expect(result).toEqual({
      ok: false,
      error: "Request failed (404)",
      status: 404,
    });
  });

  it("handles a non-ok response whose body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("no json");
      },
    });
    const result = await apiFetch("/api/x");
    expect(result).toEqual({
      ok: false,
      error: "Request failed (502)",
      status: 502,
    });
  });
});
