import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { generateRSS, updateFeeds } from "../src/tracker.ts";

describe("tracker", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("renders an empty feed before any updates", () => {
    const xml = generateRSS();
    assert.match(xml, /<title>Twitch Live Status<\/title>/);
    assert.doesNotMatch(xml, /<item>/);
  });

  it("includes a self atom link when given one", () => {
    const xml = generateRSS("https://example.com/rss");
    assert.match(xml, /atom:link href="https:\/\/example\.com\/rss"/);
  });

  it("adds a LIVE item when a tracked channel goes live", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () =>
        ({
          ok: true,
          json: async () => ({
            data: {
              user: {
                stream: { id: "42", title: "Test Stream", createdAt: "2026-01-01T00:00:00Z" },
              },
            },
          }),
        }) as unknown as Response,
    );

    await updateFeeds();

    const xml = generateRSS();
    assert.match(xml, /LIVE: .* - Test Stream/);
    assert.match(xml, /twitch:.*:42/);
  });
});
