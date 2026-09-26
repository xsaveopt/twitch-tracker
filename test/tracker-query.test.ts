import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, afterEach, describe, it, mock } from "node:test";

const dataFile = path.join(import.meta.dirname, "../data/channels.json");
const realReadFileSync = fs.readFileSync;
let channelsJson = JSON.stringify(["alpha"]);

fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) =>
  typeof target !== "number" && path.resolve(target.toString()) === dataFile
    ? channelsJson
    : realReadFileSync(target, options as never)) as typeof fs.readFileSync;

const { updateFeeds } = await import("../src/tracker.ts");

interface GqlBody {
  query: string;
  variables?: Record<string, unknown>;
}

function mockPoll() {
  return mock.method(
    globalThis,
    "fetch",
    async () =>
      ({
        ok: true,
        json: async () => ({ data: { user: { stream: null } } }),
      }) as unknown as Response,
  );
}

function requestedLogin(body: GqlBody): unknown {
  const variable = /user\(\s*login:\s*\$(\w+)\s*\)/.exec(body.query);
  assert.ok(variable, "login must be passed as a graphql variable");
  return body.variables?.[variable[1]];
}

async function pollFor(name: string): Promise<GqlBody> {
  channelsJson = JSON.stringify([name]);
  const poll = mockPoll();

  await updateFeeds();

  assert.equal(poll.mock.callCount(), 1);
  const init = poll.mock.calls[0].arguments[1] as RequestInit;
  return JSON.parse(String(init.body)) as GqlBody;
}

describe("checkChannel graphql query", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    fs.readFileSync = realReadFileSync;
  });

  it("asks for the plain channel login", async () => {
    const body = await pollFor("alpha");

    assert.equal(requestedLogin(body), "alpha");
  });

  it("keeps a double quote inside the requested login", async () => {
    const body = await pollFor('al"pha');

    assert.equal(requestedLogin(body), 'al"pha');
  });

  it("keeps a backslash inside the requested login", async () => {
    const body = await pollFor("al\\pha");

    assert.equal(requestedLogin(body), "al\\pha");
  });

  it("does not let a channel name inject extra graphql fields", async () => {
    const name = 'x") { id } other: user(login: "y';
    const body = await pollFor(name);

    assert.equal(requestedLogin(body), name);
    assert.equal(body.query.match(/user\(/g)?.length, 1);
    assert.ok(!body.query.includes(name));
    assert.ok(!body.query.includes("other:"));
  });
});
