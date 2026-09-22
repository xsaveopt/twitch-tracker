import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, before, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;
let channelsJson = JSON.stringify(["alpha"]);

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? channelsJson
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { isHealthy, startTracking } = await import("../src/tracker.ts");

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function mockFailingPoll() {
  return mock.method(
    globalThis,
    "fetch",
    async () => ({ ok: false, status: 503 }) as unknown as Response,
  );
}

function mockSuccessfulPoll() {
  return mock.method(
    globalThis,
    "fetch",
    async () =>
      ({
        ok: true,
        json: async () => ({ data: { user: { stream: null } } }),
      }) as unknown as Response,
  );
}

describe("isHealthy", () => {
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

  it("reports healthy before tracking has started", () => {
    assert.equal(isHealthy(), true);
  });

  it("stays healthy during the startup grace period even without a successful poll", async () => {
    mock.method(console, "log", () => {});
    mockFailingPoll();

    startTracking(5);
    await flush();

    assert.equal(isHealthy(), true);
  });

  it("reports degraded once the stale threshold passes without a successful poll", async () => {
    mock.timers.tick(5 * 60 * 1000 * 3 + 1);
    await flush();

    assert.equal(isHealthy(), false);
  });

  it("reports healthy when no channels are tracked, regardless of staleness", () => {
    channelsJson = "[]";

    assert.equal(isHealthy(), true);

    channelsJson = JSON.stringify(["alpha"]);
  });

  it("returns to healthy once a poll succeeds", async () => {
    mockSuccessfulPoll();

    mock.timers.tick(5 * 60 * 1000);
    await flush();

    assert.equal(isHealthy(), true);
  });
});
