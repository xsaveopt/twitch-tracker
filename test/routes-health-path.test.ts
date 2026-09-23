import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healthPathFor } from "../src/routes.ts";

describe("healthPathFor", () => {
  it("appends /health to the default RSS_PATH", () => {
    assert.equal(healthPathFor("/rss"), "/rss/health");
  });

  it("appends /health to a base RSS_PATH with no rss segment", () => {
    assert.equal(healthPathFor("/blabla"), "/blabla/health");
  });

  it("appends /health to a nested RSS_PATH", () => {
    assert.equal(healthPathFor("/blabla/rss"), "/blabla/rss/health");
  });

  it("appends /health to a multi-segment RSS_PATH", () => {
    assert.equal(healthPathFor("/a/b/c/rss"), "/a/b/c/rss/health");
  });

  it("normalizes a trailing slash on RSS_PATH", () => {
    assert.equal(healthPathFor("/blabla/rss/"), "/blabla/rss/health");
  });

  it("never resolves to the bare root path", () => {
    assert.notEqual(healthPathFor("/rss"), "/health");
    assert.notEqual(healthPathFor("/blabla"), "/health");
  });
});
