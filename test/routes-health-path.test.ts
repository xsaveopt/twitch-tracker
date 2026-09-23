import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healthPathFor } from "../src/routes.ts";

describe("healthPathFor", () => {
  it("stays at the root when RSS_PATH has no subpath", () => {
    assert.equal(healthPathFor("/rss"), "/health");
  });

  it("moves under the subpath when RSS_PATH is nested", () => {
    assert.equal(healthPathFor("/blabla/rss"), "/blabla/health");
  });

  it("handles a multi-segment RSS_PATH", () => {
    assert.equal(healthPathFor("/a/b/c/rss"), "/a/b/c/health");
  });

  it("ignores a trailing slash on RSS_PATH", () => {
    assert.equal(healthPathFor("/blabla/rss/"), "/blabla/health");
  });
});
