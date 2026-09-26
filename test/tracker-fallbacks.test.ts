import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, before, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? JSON.stringify(["alpha"])
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { generateRSS, updateFeeds } = await import("../src/tracker.ts");

const start = Date.UTC(2026, 0, 2, 3, 4, 5);

function mockStream(value: Record<string, unknown> | null): void {
  mock.method(
    globalThis,
    "fetch",
    async () =>
      ({
        ok: true,
        json: async () => ({ data: { user: { stream: value } } }),
      }) as unknown as Response,
  );
}

function items(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
}

function pubDate(item: string): string {
  const match = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(item);
  assert.ok(match);
  return match[1];
}

async function goOffline(): Promise<void> {
  mockStream(null);
  await updateFeeds();
}

describe("checkChannel fallbacks", () => {
  before(() => {
    mock.timers.enable({ apis: ["Date"], now: start });
  });

  afterEach(async () => {
    mock.restoreAll();
    mock.method(console, "log", () => {});
    await goOffline();
    mock.restoreAll();
  });

  after(() => {
    mock.timers.reset();
    fs.readFileSync = realReadFileSync;
  });

  it("uses a placeholder title when the stream has none", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "untitled", createdAt: new Date(start).toISOString() });

    await updateFeeds();

    const latest = items(generateRSS())[0];
    assert.match(latest, /<title>LIVE: alpha - No Title<\/title>/);
    assert.match(latest, /is live playing: No Title/);
  });

  it("uses a placeholder title when the stream title is empty", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "blank", title: "", createdAt: new Date(start).toISOString() });

    await updateFeeds();

    assert.match(items(generateRSS())[0], /<title>LIVE: alpha - No Title<\/title>/);
  });

  it("dates the live item at poll time when createdAt is missing", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "undated", title: "Chill" });

    await updateFeeds();

    assert.equal(pubDate(items(generateRSS())[0]), new Date(start).toUTCString());
  });

  it("measures the duration from poll time when createdAt is missing", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "undated-duration", title: "Chill" });
    await updateFeeds();

    mock.timers.tick(90 * 60000);
    await goOffline();

    assert.match(items(generateRSS())[0], /<title>OFFLINE: alpha \(Streamed for 1h 30m\)<\/title>/);
  });

  it("treats a stream without an id as offline", async () => {
    mock.method(console, "log", () => {});
    const before = items(generateRSS()).length;
    mockStream({ title: "Ghost", createdAt: new Date(start).toISOString() });

    await updateFeeds();
    await goOffline();

    assert.equal(items(generateRSS()).length, before);
  });

  it("dates the live item at poll time when createdAt is not a valid date", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "garbled", title: "Chill", createdAt: "not a date" });

    await updateFeeds();

    const date = pubDate(items(generateRSS())[0]);
    assert.notEqual(date, "Invalid Date");
    assert.equal(date, new Date(Date.now()).toUTCString());
  });

  it("reports a real duration when createdAt was not a valid date", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "garbled-duration", title: "Chill", createdAt: "not a date" });
    await updateFeeds();

    mock.timers.tick(45 * 60000);
    await goOffline();

    const latest = items(generateRSS())[0];
    assert.doesNotMatch(latest, /NaN/);
    assert.match(latest, /<title>OFFLINE: alpha \(Streamed for 0h 45m\)<\/title>/);
  });
});
