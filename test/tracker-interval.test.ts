import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? JSON.stringify(["alpha"])
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { startTracking } = await import("../src/tracker.ts");

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function mockPoll() {
  return mock.method(
    globalThis,
    "fetch",
    async () => ({ ok: false, status: 503 }) as unknown as Response,
  );
}

describe("startTracking", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setInterval"] });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("polls once immediately and again on every interval", async () => {
    const logs = mock.method(console, "log", () => {});
    const poll = mockPoll();

    startTracking(5);
    await flush();

    assert.equal(poll.mock.callCount(), 1);
    assert.equal(logs.mock.calls[0].arguments[0], "Starting Twitch tracker (poll every 5 mins)...");

    mock.timers.tick(5 * 60 * 1000);
    await flush();
    assert.equal(poll.mock.callCount(), 2);

    mock.timers.tick(5 * 60 * 1000);
    await flush();
    assert.equal(poll.mock.callCount(), 3);
  });

  it("defaults to a two minute interval", async () => {
    mock.method(console, "log", () => {});
    const poll = mockPoll();

    startTracking();
    await flush();

    mock.timers.tick(119999);
    await flush();
    assert.equal(poll.mock.callCount(), 1);

    mock.timers.tick(1);
    await flush();
    assert.equal(poll.mock.callCount(), 2);
  });

  it("requests the twitch graphql endpoint for each tracked channel", async () => {
    mock.method(console, "log", () => {});
    const poll = mockPoll();

    startTracking(1);
    await flush();

    assert.equal(String(poll.mock.calls[0].arguments[0]), "https://gql.twitch.tv/gql");
    const init = poll.mock.calls[0].arguments[1] as RequestInit;
    assert.equal(init.method, "POST");
    assert.match(String(init.body), /user\(login: \\"alpha\\"\)/);
  });
});
