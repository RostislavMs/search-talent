/**
 * Shared, call-recording Supabase client double for route-handler unit tests.
 *
 * It models the PostgREST builder chain (`.from(t).select().eq()…` plus
 * `.insert/.update/.delete/.upsert`, terminating at `.single/.maybeSingle/
 * .limit` or a direct `await`) and resolves each query through a caller-
 * supplied `resolve(call)` function. Every `.from()` is recorded in `calls`
 * for assertions. This is intentionally NOT a real database — it verifies the
 * handler's control flow (auth guards, branch selection, error mapping), not
 * RLS (that is covered by tests/integration).
 */

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

export type QueryVerb = "select" | "insert" | "update" | "delete" | "upsert";

export type QueryCall = {
  table: string;
  verb: QueryVerb;
  /** Filter operators applied (eq/neq/in/…) with their args. */
  filters: Array<{ method: string; args: unknown[] }>;
  /** Non-filter modifiers (select cols, order, limit, single, …). */
  modifiers: Array<{ method: string; args: unknown[] }>;
  /** Payload passed to insert/update/upsert. */
  payload?: unknown;
};

export type Resolver = (call: QueryCall) => QueryResult;

export type MockUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
} | null;

const FILTER_METHODS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
  "contains", "containedBy", "match", "filter", "not", "or",
]);

const CHAIN_METHODS = [
  "select", "order", "range", "returns", "overrideTypes",
  ...FILTER_METHODS,
];

export type SupabaseMock = {
  client: {
    auth: { getUser: () => Promise<{ data: { user: MockUser }; error: null }> };
    from: (table: string) => Record<string, unknown>;
    rpc: (fn: string, args?: unknown) => Promise<QueryResult>;
  };
  calls: QueryCall[];
};

export function createSupabaseMock(opts: {
  user?: MockUser;
  resolve: Resolver;
  rpc?: (fn: string, args?: unknown) => QueryResult;
}): SupabaseMock {
  const calls: QueryCall[] = [];
  const user = opts.user ?? null;

  function makeBuilder(table: string) {
    const call: QueryCall = { table, verb: "select", filters: [], modifiers: [] };
    calls.push(call);

    const settle = () =>
      Promise.resolve().then(() => {
        const r = opts.resolve(call);
        return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
      });

    const builder: Record<string, unknown> = {};

    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        (FILTER_METHODS.has(method) ? call.filters : call.modifiers).push({ method, args });
        return builder;
      };
    }

    builder.insert = (payload: unknown) => {
      call.verb = "insert";
      call.payload = payload;
      return builder;
    };
    builder.update = (payload: unknown) => {
      call.verb = "update";
      call.payload = payload;
      return builder;
    };
    builder.upsert = (payload: unknown) => {
      call.verb = "upsert";
      call.payload = payload;
      return builder;
    };
    builder.delete = () => {
      call.verb = "delete";
      return builder;
    };

    // Terminal accessors return the settled result.
    builder.single = () => {
      call.modifiers.push({ method: "single", args: [] });
      return settle();
    };
    builder.maybeSingle = () => {
      call.modifiers.push({ method: "maybeSingle", args: [] });
      return settle();
    };
    builder.limit = (...args: unknown[]) => {
      call.modifiers.push({ method: "limit", args });
      return settle();
    };
    // Thenable: `await supabase.from(t).delete().eq()…` resolves here.
    builder.then = (onFulfilled: unknown, onRejected: unknown) =>
      settle().then(onFulfilled as never, onRejected as never);

    return builder;
  }

  return {
    calls,
    client: {
      auth: {
        getUser: () => Promise.resolve({ data: { user }, error: null as null }),
      },
      from: (table: string) => makeBuilder(table),
      rpc: (fn: string, args?: unknown) => {
        const r = opts.rpc?.(fn, args) ?? {};
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null });
      },
    },
  };
}
