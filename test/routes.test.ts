import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, afterEach, before, describe, it, mock } from "node:test";
import router from "../src/routes.ts";

const app = express();

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.headers["x-break-request"]) {
    (req as unknown as { get: () => string }).get = () => {
      throw new Error("broken request");
    };
  }
  next();
});

app.use("/", router);

let server: Server;
let base: string;

describe("routes", () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("serves the feed on the default path", async () => {
    const response = await fetch(`${base}/rss`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/rss\+xml/);
    assert.match(body, /<rss version="2\.0"/);
    assert.match(body, /<title>Twitch Live Status<\/title>/);
  });

  it("points the atom self link at the requested url", async () => {
    const response = await fetch(`${base}/rss`);
    const body = await response.text();

    assert.match(body, new RegExp(`atom:link href="${base}/rss"`));
  });

  it("answers 404 on any other path", async () => {
    const response = await fetch(`${base}/feed.xml`);

    assert.equal(response.status, 404);
  });

  it("answers 500 when the feed cannot be built", async () => {
    const errors = mock.method(console, "error", () => {});
    const response = await fetch(`${base}/rss`, { headers: { "x-break-request": "1" } });
    const body = await response.text();

    assert.equal(response.status, 500);
    assert.equal(body, "Error generating RSS feed");
    assert.equal(errors.mock.callCount(), 1);
  });
});
