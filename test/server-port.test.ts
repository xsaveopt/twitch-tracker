import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";

const realSetInterval = globalThis.setInterval;
const realFetch = globalThis.fetch;
const realListen = express.application.listen;

globalThis.setInterval = (() =>
  ({ unref: () => {} }) as unknown as NodeJS.Timeout) as unknown as typeof setInterval;

globalThis.fetch = (async () =>
  ({ ok: false, status: 503 }) as unknown as Response) as typeof fetch;

const probe = createServer();
await new Promise<void>((resolve) => {
  probe.listen(0, "127.0.0.1", resolve);
});
const port = (probe.address() as AddressInfo).port;
await new Promise<void>((resolve) => {
  probe.close(() => resolve());
});

process.env.PORT = String(port);
process.env.RSS_PATH = "/feed.xml";

let started: Server | undefined;

express.application.listen = function listen(this: express.Application, ...args: unknown[]) {
  started = (realListen as (...a: unknown[]) => Server).apply(this, args);
  return started;
} as typeof express.application.listen;

const realLog = console.log;
console.log = () => {};
await import("../src/server.ts");
await new Promise((resolve) => setTimeout(resolve, 10));
console.log = realLog;
globalThis.fetch = realFetch;

describe("server with PORT", () => {
  after(async () => {
    express.application.listen = realListen;
    globalThis.setInterval = realSetInterval;
    globalThis.fetch = realFetch;
    if (started) {
      await new Promise<void>((resolve) => {
        started?.close(() => resolve());
      });
    }
  });

  it("listens on the port from the environment", () => {
    assert.ok(started);
    assert.equal((started.address() as AddressInfo).port, port);
  });

  it("serves the feed through the mounted routes", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/feed.xml`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/rss\+xml/);
    assert.match(body, /<rss version="2\.0"/);
  });
});
