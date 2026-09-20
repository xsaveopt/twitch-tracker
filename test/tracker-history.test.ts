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

function items(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
}

describe("rss history", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("keeps only the 50 newest items, newest first", async () => {
    mock.method(console, "log", () => {});
    let id = 0;
    mock.method(
      globalThis,
      "fetch",
      async () =>
        ({
          ok: true,
          json: async () => ({
            data: {
              user: {
                stream: {
                  id: `s${++id}`,
                  title: `Stream ${id}`,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          }),
        }) as unknown as Response,
    );

    for (let run = 0; run < 60; run++) {
      await updateFeeds();
    }

    const xml = generateRSS();
    const entries = items(xml);

    assert.equal(entries.length, 50);
    assert.match(entries[0], /<guid isPermaLink="false">twitch:alpha:s60<\/guid>/);
    assert.match(entries[49], /<guid isPermaLink="false">twitch:alpha:s11<\/guid>/);
    assert.doesNotMatch(xml, /twitch:alpha:s10<\/guid>/);
    assert.doesNotMatch(xml, /twitch:alpha:s1<\/guid>/);
  });
});
