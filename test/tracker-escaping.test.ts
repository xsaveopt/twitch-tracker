import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it, mock } from "node:test";

const channel = "a&b<c";
const title = "Chaos & <mayhem> ]]> finale";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? JSON.stringify([channel])
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { generateRSS, updateFeeds } = await import("../src/tracker.ts");

let xml = "";

describe("generateRSS escaping", () => {
  before(async () => {
    mock.method(console, "log", () => {});
    mock.method(
      globalThis,
      "fetch",
      async () =>
        ({
          ok: true,
          json: async () => ({
            data: {
              user: { stream: { id: "x1", title, createdAt: new Date().toISOString() } },
            },
          }),
        }) as unknown as Response,
    );

    await updateFeeds();
    xml = generateRSS();
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("escapes markup in the item title", () => {
    assert.match(
      xml,
      /<title>LIVE: a&amp;b&lt;c - Chaos &amp; &lt;mayhem&gt; \]\]&gt; finale<\/title>/,
    );
  });

  it("keeps the whole description inside its CDATA section", () => {
    const open = xml.indexOf("<![CDATA[");
    const close = xml.indexOf("]]>", open);
    const payload = xml.slice(open + "<![CDATA[".length, close);

    assert.ok(
      payload.endsWith("</p>"),
      `description CDATA section ended early, payload was: ${payload}`,
    );
    assert.equal(xml.split("]]>").length - 1, 1);
  });

  it("escapes markup in the item link", () => {
    const link = /<item>[\s\S]*?<link>([\s\S]*?)<\/link>/.exec(xml);

    assert.ok(link);
    assert.equal(link[1], "https://www.twitch.tv/a&amp;b&lt;c");
  });
});
