import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, afterEach, before, describe, it, mock } from "node:test";

delete process.env.RSS_PATH;

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? JSON.stringify(["alpha"])
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const router = (await import("../src/routes.ts")).default;
const { startTracking } = await import("../src/tracker.ts");

const realFetch = globalThis.fetch;
const interval = 5 * 60 * 1000;

const app = express();
app.use("/", router);

let server: Server;
let base: string;

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function mockUpstream(ok: boolean) {
  return mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).startsWith(base)) {
      return realFetch(url, init);
    }
    if (!ok) {
      return { ok: false, status: 503 } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ data: { user: { stream: null } } }),
    } as unknown as Response;
  });
}

describe("health route when tracking is degraded", () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    mock.timers.enable({ apis: ["setInterval", "Date"] });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    mock.timers.reset();
    fs.readFileSync = realReadFileSync;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("reports up during the startup grace period", async () => {
    mock.method(console, "log", () => {});
    mockUpstream(false);

    startTracking(5);
    await flush();

    const response = await fetch(`${base}/rss/health`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "up");
  });

  it("answers 503 degraded once polls have been failing past the threshold", async () => {
    mockUpstream(false);

    mock.timers.tick(interval * 3 + 1);
    await flush();

    const response = await fetch(`${base}/rss/health`);

    assert.equal(response.status, 503);
    assert.match(response.headers.get("content-type") ?? "", /text\/plain/);
    assert.equal(await response.text(), "degraded");
  });

  it("keeps serving the feed while degraded", async () => {
    mockUpstream(false);

    const response = await fetch(`${base}/rss`);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /<rss version="2\.0"/);
  });

  it("answers up again after a successful poll", async () => {
    mockUpstream(true);

    mock.timers.tick(interval);
    await flush();

    const response = await fetch(`${base}/rss/health`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "up");
  });
});
