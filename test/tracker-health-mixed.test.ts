import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, before, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? JSON.stringify(["alpha", "beta"])
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { isHealthy, startTracking } = await import("../src/tracker.ts");

const interval = 5 * 60 * 1000;

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function mockPoll(healthy: Set<string>) {
  return mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const login = [...healthy].find((name) => String(init.body).includes(name));
    if (!login) {
      throw new Error("upstream unreachable");
    }
    return {
      ok: true,
      json: async () => ({ data: { user: { stream: null } } }),
    } as unknown as Response;
  });
}

describe("isHealthy with mixed poll results", () => {
  before(() => {
    mock.timers.enable({ apis: ["setInterval", "Date"] });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    mock.timers.reset();
    fs.readFileSync = realReadFileSync;
  });

  it("stays healthy past the stale threshold while one channel keeps succeeding", async () => {
    mock.method(console, "log", () => {});
    mock.method(console, "error", () => {});
    mockPoll(new Set(["beta"]));

    startTracking(5);
    await flush();

    for (let step = 0; step < 4; step++) {
      mock.timers.tick(interval);
      await flush();
    }

    assert.equal(isHealthy(), true);
  });

  it("degrades once every channel fails for longer than the threshold", async () => {
    mock.method(console, "error", () => {});
    mockPoll(new Set());

    for (let step = 0; step < 3; step++) {
      mock.timers.tick(interval);
      await flush();
    }
    mock.timers.tick(1);
    await flush();

    assert.equal(isHealthy(), false);
  });

  it("recovers when a single channel succeeds again", async () => {
    mock.method(console, "error", () => {});
    mockPoll(new Set(["alpha"]));

    mock.timers.tick(interval);
    await flush();

    assert.equal(isHealthy(), true);
  });
});
