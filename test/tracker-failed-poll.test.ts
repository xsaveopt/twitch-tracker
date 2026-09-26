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

const stream = {
  id: "s1",
  title: "Long session",
  createdAt: new Date(Date.now() - (3600000 + 30000)).toISOString(),
};

function mockStream(value: typeof stream | null): void {
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

describe("failed poll while live", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("records the live item", async () => {
    mock.method(console, "log", () => {});
    mockStream(stream);

    await updateFeeds();

    const all = items(generateRSS());
    assert.equal(all.length, 1);
    assert.match(all[0], /twitch:alpha:s1</);
  });

  it("keeps the session when the response is not ok", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: false, status: 502 }) as unknown as Response,
    );

    await updateFeeds();

    const all = items(generateRSS());
    assert.equal(all.length, 1);
    assert.doesNotMatch(all[0], /OFFLINE/);
  });

  it("keeps the session when the request throws", async () => {
    mock.method(console, "error", () => {});
    mock.method(globalThis, "fetch", async () => {
      throw new Error("network down");
    });

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 1);
  });

  it("keeps the session when the response carries graphql errors", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () =>
        ({
          ok: true,
          json: async () => ({ errors: [{ message: "timeout" }] }),
        }) as unknown as Response,
    );

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 1);
  });

  it("does not announce the same stream again once polling recovers", async () => {
    mock.method(console, "log", () => {});
    mockStream(stream);

    await updateFeeds();

    assert.equal(items(generateRSS()).length, 1);
  });

  it("measures the offline duration from the original stream start", async () => {
    mock.method(console, "log", () => {});
    mockStream(null);

    await updateFeeds();

    const all = items(generateRSS());
    assert.equal(all.length, 2);
    assert.match(all[0], /<title>OFFLINE: alpha \(Streamed for 1h 0m\)<\/title>/);
  });
});
