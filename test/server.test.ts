import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import { after, describe, it } from "node:test";

delete process.env.PORT;
delete process.env.RSS_PATH;

const realListen = express.application.listen;
const realSetInterval = globalThis.setInterval;
const realFetch = globalThis.fetch;

const listenCalls: { port: unknown; ready: () => void }[] = [];
const intervalDelays: unknown[] = [];
const fetchUrls: string[] = [];

express.application.listen = function listen(...args: unknown[]) {
  listenCalls.push({ port: args[0], ready: args[1] as () => void });
  return { close: () => {} } as unknown as Server;
} as typeof express.application.listen;

globalThis.setInterval = ((_handler: unknown, delay?: number) => {
  intervalDelays.push(delay);
  return { unref: () => {} } as unknown as NodeJS.Timeout;
}) as typeof setInterval;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchUrls.push(String(input));
  return { ok: false, status: 503 } as unknown as Response;
}) as typeof fetch;

async function captureLogs(run: () => Promise<void> | void): Promise<string[]> {
  const logs: string[] = [];
  const realLog = console.log;
  console.log = (message: string) => void logs.push(message);
  try {
    await run();
  } finally {
    console.log = realLog;
  }
  return logs;
}

const startupLogs = await captureLogs(async () => {
  await import("../src/server.ts");
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("server", () => {
  after(() => {
    express.application.listen = realListen;
    globalThis.setInterval = realSetInterval;
    globalThis.fetch = realFetch;
  });

  it("listens on port 3000 when PORT is unset", () => {
    assert.equal(listenCalls.length, 1);
    assert.equal(listenCalls[0].port, 3000);
    assert.equal(typeof listenCalls[0].ready, "function");
  });

  it("reports the port and feed path once listening", async () => {
    const logs = await captureLogs(() => {
      listenCalls[0].ready();
    });

    assert.deepEqual(logs, [
      "Server listening on port 3000",
      "RSS Feed available at http://localhost:3000/rss",
    ]);
  });

  it("starts the tracker with a two minute poll interval", () => {
    assert.deepEqual(intervalDelays, [120000]);
    assert.ok(startupLogs.includes("Starting Twitch tracker (poll every 2 mins)..."));
  });

  it("polls twitch once at startup without waiting for the interval", () => {
    assert.ok(fetchUrls.length > 0);
    for (const url of fetchUrls) {
      assert.equal(url, "https://gql.twitch.tv/gql");
    }
  });
});
