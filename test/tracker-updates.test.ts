import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? JSON.stringify(["alpha"])
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { generateRSS, updateFeeds } = await import("../src/tracker.ts");

interface Stream {
  id: string;
  title: string;
  createdAt: string;
}

let stream: Stream | null = null;

function mockFetch(): void {
  mock.method(
    globalThis,
    "fetch",
    async () =>
      ({
        ok: true,
        json: async () => ({ data: { user: { stream } } }),
      }) as unknown as Response,
  );
}

function items(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
}

describe("updateFeeds", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("skips a channel whose response is not ok", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: false, status: 503 }) as unknown as Response,
    );

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 0);
  });

  it("skips a channel whose response carries graphql errors", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () =>
        ({
          ok: true,
          json: async () => ({ errors: [{ message: "service unavailable" }] }),
        }) as unknown as Response,
    );

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 0);
  });

  it("skips a channel whose request throws and logs the failure", async () => {
    const errors = mock.method(console, "error", () => {});
    mock.method(globalThis, "fetch", async () => {
      throw new Error("network down");
    });

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 0);
    assert.equal(errors.mock.callCount(), 1);
    assert.equal(errors.mock.calls[0].arguments[0], "Error checking alpha:");
  });

  it("adds a live item when a tracked channel starts streaming", async () => {
    mock.method(console, "log", () => {});
    stream = {
      id: "s1",
      title: "Ranked grind",
      createdAt: new Date(Date.now() - (2 * 3600000 + 30 * 60000 + 30000)).toISOString(),
    };
    mockFetch();

    await updateFeeds();

    const live = items(generateRSS());
    assert.equal(live.length, 1);
    assert.match(live[0], /<title>LIVE: alpha - Ranked grind<\/title>/);
    assert.match(live[0], /<guid isPermaLink="false">twitch:alpha:s1<\/guid>/);
  });

  it("does not repeat the live item while the same stream runs", async () => {
    mock.method(console, "log", () => {});
    mockFetch();

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 1);
  });

  it("adds an offline item with the stream duration when the stream ends", async () => {
    const logs = mock.method(console, "log", () => {});
    stream = null;
    mockFetch();

    await updateFeeds();

    const all = items(generateRSS());
    assert.equal(all.length, 2);
    assert.match(all[0], /<title>OFFLINE: alpha \(Streamed for 2h 30m\)<\/title>/);
    assert.match(all[0], /Total stream duration: 2h 30m/);
    assert.match(all[0], /<guid isPermaLink="false">twitch:alpha:offline:\d+<\/guid>/);
    assert.match(all[0], /<link>https:\/\/www\.twitch\.tv\/alpha<\/link>/);
    assert.match(
      String(logs.mock.calls[0].arguments[0]),
      /alpha went offline \(Duration: 2h 30m\)/,
    );
  });

  it("ignores an offline channel that has no tracked session", async () => {
    mock.method(console, "log", () => {});
    mockFetch();

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 2);
  });
});
