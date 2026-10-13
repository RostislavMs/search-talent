// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createPolledValue } from "@/lib/polled-value";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createPolledValue", () => {
  it("sends one request however many subscribers ask at once", async () => {
    const load = vi.fn(async () => 7);
    const store = createPolledValue(load, 60_000);
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = store.subscribe(first);
    const stopSecond = store.subscribe(second);

    await Promise.all([store.refresh(), store.refresh()]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(7);
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    stopFirst();
    stopSecond();
  });

  it("keeps the value when the server answers nothing usable", async () => {
    const store = createPolledValue(async () => null as number | null, 60_000);
    const stop = store.subscribe(() => {});
    store.update(() => 3);

    await store.refresh();

    expect(store.getSnapshot()).toBe(3);
    stop();
  });

  it("forgets everything once the last subscriber leaves", async () => {
    const stale = deferred<number | null>();
    const load = vi
      .fn<() => Promise<number | null>>()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(2);
    const store = createPolledValue(load, 60_000);

    const stop = store.subscribe(() => {});
    void store.refresh();
    stop();

    // A new subscriber asks again instead of waiting on the old request...
    const stopAgain = store.subscribe(() => {});
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toBe(2);

    // ...and the old answer, arriving late, does not overwrite the new one.
    stale.resolve(99);
    await stale.promise;
    await Promise.resolve();
    expect(store.getSnapshot()).toBe(2);
    stopAgain();
  });
});
