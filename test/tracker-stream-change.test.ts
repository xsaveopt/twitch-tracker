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

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60000 + 30000)).toISOString();
}

function mockStream(value: Stream | null): void {
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

describe("stream id change while live", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("announces the first stream", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "first", title: "Opening", createdAt: minutesAgo(180) });

    await updateFeeds();

    const all = items(generateRSS());
    assert.equal(all.length, 1);
    assert.match(all[0], /<guid isPermaLink="false">twitch:alpha:first<\/guid>/);
  });

  it("announces a new live item when the stream id changes", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "second", title: "Restarted", createdAt: minutesAgo(10) });

    await updateFeeds();

    const all = items(generateRSS());
    assert.match(all[0], /<title>LIVE: alpha - Restarted<\/title>/);
    assert.match(all[0], /<guid isPermaLink="false">twitch:alpha:second<\/guid>/);
    assert.equal(all.filter((item) => item.includes("twitch:alpha:second<")).length, 1);
  });

  it("does not repeat the new stream on the next poll", async () => {
    mock.method(console, "log", () => {});
    mockStream({ id: "second", title: "Restarted", createdAt: minutesAgo(10) });
    const before = items(generateRSS()).length;

    await updateFeeds();

    assert.equal(items(generateRSS()).length, before);
  });

  it("measures the offline duration from the new stream start", async () => {
    mock.method(console, "log", () => {});
    mockStream(null);

    await updateFeeds();

    const all = items(generateRSS());
    assert.match(all[0], /<title>OFFLINE: alpha \(Streamed for 0h 10m\)<\/title>/);
  });
});
