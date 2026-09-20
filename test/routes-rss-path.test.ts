import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";

process.env.RSS_PATH = "/feed.xml";

const router = (await import("../src/routes.ts")).default;

const app = express();
app.use("/", router);

let server: Server;
let base: string;

describe("routes with RSS_PATH", () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("serves the feed on the overridden path", async () => {
    const response = await fetch(`${base}/feed.xml`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/rss\+xml/);
    assert.match(body, /<rss version="2\.0"/);
  });

  it("no longer serves the default path", async () => {
    const response = await fetch(`${base}/rss`);

    assert.equal(response.status, 404);
  });
});
