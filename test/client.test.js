import test from "node:test";
import assert from "node:assert/strict";
import { AetherApiError, AetherClient } from "../src/index.js";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

test("rejects insecure non-local API base URLs", () => {
  assert.throws(() => new AetherClient({ baseUrl: "http://api.example.com" }), /HTTPS/);
  assert.doesNotThrow(() => new AetherClient({ baseUrl: "http://localhost:3000" }));
});

test("adds bearer token and correlation ID without logging them", async () => {
  let captured;
  const client = new AetherClient({
    baseUrl: "https://api.example.test/v1/",
    getAccessToken: () => "synthetic-token",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), headers: options.headers };
      return jsonResponse({ ok: true });
    },
  });
  assert.deepEqual(await client.get("health", { correlationId: "corr-test" }), { ok: true });
  assert.equal(captured.url, "https://api.example.test/v1/health");
  assert.equal(captured.headers.get("Authorization"), "Bearer synthetic-token");
  assert.equal(captured.headers.get("X-Correlation-ID"), "corr-test");
});

test("blocks absolute URLs and origin escape", async () => {
  const client = new AetherClient({ baseUrl: "https://api.example.test", fetchImpl: async () => jsonResponse({}) });
  await assert.rejects(client.get("https://evil.example/steal"), /relative/);
  await assert.rejects(client.get("../outside"), /origin/);
});

test("does not automatically retry unsafe POST requests", async () => {
  let calls = 0;
  const client = new AetherClient({
    baseUrl: "https://api.example.test",
    maxSafeRetries: 3,
    fetchImpl: async () => { calls++; throw new Error("synthetic network failure"); },
  });
  await assert.rejects(client.post("runs", { prompt: "synthetic" }), AetherApiError);
  assert.equal(calls, 1);
});

test("retries safe GET on a transient network failure", async () => {
  let calls = 0;
  const client = new AetherClient({
    baseUrl: "https://api.example.test",
    maxSafeRetries: 1,
    fetchImpl: async () => { if (++calls === 1) throw new Error("synthetic network failure"); return jsonResponse({ ok: true }); },
  });
  assert.deepEqual(await client.get("health"), { ok: true });
  assert.equal(calls, 2);
});

test("surfaces stable error code and correlation ID without echoing response body", async () => {
  const client = new AetherClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async () => jsonResponse({ code: "NOT_AUTHORIZED", message: "do not expose" }, { status: 403, headers: { "X-Correlation-ID": "corr-server" } }),
  });
  await assert.rejects(client.get("private"), error => {
    assert.equal(error.code, "NOT_AUTHORIZED");
    assert.equal(error.status, 403);
    assert.equal(error.correlationId, "corr-server");
    assert.equal(error.message.includes("do not expose"), false);
    return true;
  });
});

test("returns undefined for 204 responses", async () => {
  const client = new AetherClient({ baseUrl: "https://api.example.test", fetchImpl: async () => new Response(null, { status: 204 }) });
  assert.equal(await client.delete("resource/1"), undefined);
});
