import test from "node:test";
import assert from "node:assert/strict";
import { AetherApiError, createAetherClient } from "../src/index.js";

const input = { model: "model-a", messages: [{ role: "user", content: "hello" }] };
function response(status, body, requestId = "req-1") {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), headers: { get: (name) => name === "x-request-id" ? requestId : null } };
}

test("sends bearer auth and tenant selector and returns JSON", async () => {
  let captured;
  const client = createAetherClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "safe-token", tenantId: "tenant-a", fetchImpl: async (url, options) => { captured = { url, options }; return response(200, { choices: [] }); } });
  assert.deepEqual(await client.createChatCompletion(input), { choices: [] });
  assert.equal(captured.options.headers.authorization, "Bearer safe-token");
  assert.equal(captured.options.headers["x-tenant-id"], "tenant-a");
  assert.equal(captured.url, "https://api.example.test/v1/chat/completions");
});

test("normalizes API errors without losing request id", async () => {
  const client = createAetherClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "token", fetchImpl: async () => response(403, { error: { code: "forbidden", message: "Denied" } }) });
  await assert.rejects(client.createChatCompletion(input), (e) => e instanceof AetherApiError && e.status === 403 && e.code === "forbidden" && e.requestId === "req-1");
});

test("rejects unsafe URLs, missing auth callback, malformed input, and unsupported streaming", async () => {
  assert.throws(() => createAetherClient({ baseUrl: "http://api.example.test", getAccessToken: async () => "token" }), TypeError);
  assert.throws(() => createAetherClient({ baseUrl: "https://user:pass@example.test", getAccessToken: async () => "token" }), TypeError);
  assert.throws(() => createAetherClient({ baseUrl: "https://api.example.test" }), TypeError);
  const client = createAetherClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "token", fetchImpl: async () => response(200, {}) });
  await assert.rejects(client.createChatCompletion({ model: "x", messages: [], stream: false }), TypeError);
  await assert.rejects(client.createChatCompletion({ ...input, stream: true }), TypeError);
});

test("does not leak network exceptions and rejects unsafe token strings", async () => {
  const broken = createAetherClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "token", fetchImpl: async () => { throw new Error("private URL details"); } });
  await assert.rejects(broken.createChatCompletion(input), (e) => e.code === "network_error" && !e.message.includes("private"));
  const badToken = createAetherClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "token\r\nX-Fake: yes", fetchImpl: async () => response(200, {}) });
  await assert.rejects(badToken.createChatCompletion(input), (e) => e.code === "token_unavailable");
});

test("maps aborts and timeouts to stable error codes", async () => {
  const client = createAetherClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "token", timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))) ) });
  await assert.rejects(client.createChatCompletion(input), (e) => e.code === "request_aborted_or_timed_out");
});
