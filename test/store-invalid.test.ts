import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const dataDir = path.dirname(dataFile);
const tmpDir = path.join(import.meta.dirname, "../.tmp/store-invalid-test");
const tmpFile = path.join(tmpDir, "channels.json");

const realFs = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
};

let failRead = false;

function redirect(target: fs.PathOrFileDescriptor): fs.PathOrFileDescriptor {
  if (typeof target === "number") return target;
  const resolved = path.resolve(target.toString());
  if (resolved === dataFile) return tmpFile;
  if (resolved === dataDir) return tmpDir;
  return target;
}

fs.rmSync(tmpDir, { recursive: true, force: true });

fs.existsSync = ((target: fs.PathLike) =>
  realFs.existsSync(redirect(target) as fs.PathLike)) as typeof fs.existsSync;
fs.mkdirSync = ((target: fs.PathLike, options?: unknown) =>
  realFs.mkdirSync(redirect(target) as fs.PathLike, options as never)) as typeof fs.mkdirSync;
fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) => {
  const redirected = redirect(target);
  if (failRead && redirected === tmpFile) {
    throw Object.assign(new Error("permission denied"), { code: "EACCES" });
  }
  return realFs.readFileSync(redirected, options as never);
}) as typeof fs.readFileSync;
fs.writeFileSync = ((target: fs.PathOrFileDescriptor, data: unknown, options?: unknown) =>
  realFs.writeFileSync(
    redirect(target),
    data as string,
    options as never,
  )) as typeof fs.writeFileSync;

const store = await import("../src/store.ts");

function readRaw(): string {
  return realFs.readFileSync(tmpFile, "utf8") as string;
}

describe("store with unexpected file contents", () => {
  beforeEach(() => {
    failRead = false;
    realFs.writeFileSync(tmpFile, JSON.stringify(["alpha", "beta"]));
  });

  afterEach(() => {
    failRead = false;
    mock.restoreAll();
  });

  after(() => {
    fs.existsSync = realFs.existsSync;
    fs.mkdirSync = realFs.mkdirSync;
    fs.readFileSync = realFs.readFileSync;
    fs.writeFileSync = realFs.writeFileSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty list when the file holds a JSON object", () => {
    mock.method(console, "error", () => {});
    realFs.writeFileSync(tmpFile, JSON.stringify({ channels: ["alpha"] }));

    assert.deepEqual(store.getChannels(), []);
  });

  it("returns an empty list when the file holds a JSON string", () => {
    mock.method(console, "error", () => {});
    realFs.writeFileSync(tmpFile, JSON.stringify("alpha"));

    assert.deepEqual(store.getChannels(), []);
  });

  it("returns an empty list when the file holds JSON null", () => {
    mock.method(console, "error", () => {});
    realFs.writeFileSync(tmpFile, "null");

    assert.deepEqual(store.getChannels(), []);
  });

  it("does not overwrite a file it could not read when adding a channel", () => {
    mock.method(console, "error", () => {});
    const original = readRaw();
    failRead = true;

    try {
      store.addChannel("gamma");
    } catch (error) {
      assert.ok(error instanceof Error);
    }

    failRead = false;
    assert.equal(readRaw(), original);
    assert.deepEqual(store.getChannels(), ["alpha", "beta"]);
  });
});
