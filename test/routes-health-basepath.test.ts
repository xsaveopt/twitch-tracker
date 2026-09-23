import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";

process.env.RSS_PATH = "/blabla";

const router = (await import("../src/routes.ts")).default;

const app = express();
app.use("/", router);

let server: Server;
let base: string;

describe("routes with RSS_PATH set to a base path", () => {
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

  it("serves health under RSS_PATH plus /health", async () => {
    const response = await fetch(`${base}/blabla/health`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, "up");
  });

  it("no longer serves health at the root", async () => {
    const response = await fetch(`${base}/health`);

    assert.equal(response.status, 404);
  });
});
