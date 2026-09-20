import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const dataDir = path.dirname(dataFile);
const tmpDir = path.join(import.meta.dirname, "../.tmp/store-test");
const tmpFile = path.join(tmpDir, "channels.json");

const realFs = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
};

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
fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  realFs.readFileSync(redirect(target), options as never)) as typeof fs.readFileSync;
fs.writeFileSync = ((target: fs.PathOrFileDescriptor, data: unknown, options?: unknown) =>
  realFs.writeFileSync(
    redirect(target),
    data as string,
    options as never,
  )) as typeof fs.writeFileSync;

const store = await import("../src/store.ts");

const bootstrapExists = realFs.existsSync(tmpFile);
const bootstrapContent = bootstrapExists ? realFs.readFileSync(tmpFile, "utf8") : "";

function readTmp(): string[] {
  return JSON.parse(realFs.readFileSync(tmpFile, "utf8") as string) as string[];
}

describe("store", () => {
  beforeEach(() => {
    realFs.writeFileSync(tmpFile, JSON.stringify(["xqc", "erobb221", "zoil"]));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    fs.existsSync = realFs.existsSync;
    fs.mkdirSync = realFs.mkdirSync;
    fs.readFileSync = realFs.readFileSync;
    fs.writeFileSync = realFs.writeFileSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the data file with the default channels on first import", () => {
    assert.ok(bootstrapExists);
    assert.deepEqual(JSON.parse(bootstrapContent) as string[], ["xqc", "erobb221", "zoil"]);
  });

  it("reads the stored channels", () => {
    assert.deepEqual(store.getChannels(), ["xqc", "erobb221", "zoil"]);
  });

  it("appends a new channel and persists it", () => {
    store.addChannel("forsen");
    assert.deepEqual(store.getChannels(), ["xqc", "erobb221", "zoil", "forsen"]);
    assert.deepEqual(readTmp(), ["xqc", "erobb221", "zoil", "forsen"]);
  });

  it("ignores a channel that is already tracked", () => {
    store.addChannel("zoil");
    assert.deepEqual(readTmp(), ["xqc", "erobb221", "zoil"]);
  });

  it("removes a tracked channel", () => {
    store.removeChannel("erobb221");
    assert.deepEqual(store.getChannels(), ["xqc", "zoil"]);
    assert.deepEqual(readTmp(), ["xqc", "zoil"]);
  });

  it("leaves the list untouched when removing an unknown channel", () => {
    store.removeChannel("nobody");
    assert.deepEqual(readTmp(), ["xqc", "erobb221", "zoil"]);
  });

  it("returns an empty list when the file holds invalid JSON", () => {
    const errors = mock.method(console, "error", () => {});
    realFs.writeFileSync(tmpFile, "{ not json");

    assert.deepEqual(store.getChannels(), []);
    assert.equal(errors.mock.callCount(), 1);
  });

  it("returns an empty list when the file cannot be read", () => {
    mock.method(console, "error", () => {});
    fs.rmSync(tmpFile, { force: true });

    assert.deepEqual(store.getChannels(), []);
  });
});
