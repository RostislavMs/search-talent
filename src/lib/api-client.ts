/**
 * Small typed wrapper around `fetch` for internal `/api/*` calls.
 *
 * Returns a discriminated union so callers handle network and HTTP errors
 * uniformly without repeating try/catch + response.json() boilerplate.
 *
 * Example:
 *   const result = await apiFetch<{ bookmarked: boolean }>("/api/bookmarks", {
 *     method: "POST",
 *     body: { targetType, targetId },
 *   });
 *   if (!result.ok) {
 *     toast.error(result.error);
 *     return;
 *   }
 *   setBookmarked(result.data.bookmarked);
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

const NETWORK_ERROR_MESSAGE = "Network error. Please check your connection.";

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, signal, headers } = options;

  const init: RequestInit = {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, error: NETWORK_ERROR_MESSAGE, status: 0 };
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; details?: string })
    | null;

  if (!response.ok) {
    const baseError =
      (payload && typeof payload.error === "string" && payload.error) ||
      `Request failed (${response.status})`;
    // The API may include extra `details` in non-production builds.
    // Surface them inline so the wizard surfaces enough info to debug
    // AI/integration failures without opening the network tab.
    const details =
      payload && typeof payload.details === "string" ? payload.details : "";
    return {
      ok: false,
      error: details ? `${baseError} — ${details}` : baseError,
      status: response.status,
    };
  }

  return { ok: true, data: (payload ?? {}) as T };
}
