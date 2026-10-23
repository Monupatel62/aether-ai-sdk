const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
export class AetherApiError extends Error {
  constructor(status, code, message, requestId = null) { super(message); this.name = "AetherApiError"; this.status = status; this.code = code; this.requestId = requestId; }
}
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
async function readBoundedResponse(response, maxBytes) {
  if (!response || !response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new AetherApiError(502, "response_too_large", "API response exceeds the configured limit", response.headers?.get?.("x-request-id") ?? null);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new AetherApiError(502, "response_too_large", "API response exceeds the configured limit", response.headers?.get?.("x-request-id") ?? null);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export function createAetherClient({ baseUrl, getAccessToken, fetchImpl = globalThis.fetch, timeoutMs = 30_000, tenantId }) {
  if (typeof baseUrl !== "string") throw new TypeError("baseUrl is required");
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new TypeError("baseUrl must be an absolute URL"); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new TypeError("baseUrl is invalid");
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) throw new TypeError("HTTPS is required outside localhost");
  if (typeof getAccessToken !== "function") throw new TypeError("getAccessToken callback is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new TypeError("timeoutMs must be between 1 and 120000");
  if (tenantId !== undefined && (typeof tenantId !== "string" || !tenantId.trim() || tenantId.length > 256)) throw new TypeError("tenantId is invalid");

  const root = parsed.toString().replace(/\/$/, "");
  async function request(path, body, signal) {
    if (signal?.aborted) throw new AetherApiError(408, "request_aborted", "API request was aborted");
    let serialized;
    try { serialized = JSON.stringify(body); } catch { throw new AetherApiError(400, "invalid_request", "Request body is not JSON-serializable"); }
    if (typeof serialized !== "string" || new TextEncoder().encode(serialized).byteLength > 1_048_576) {
      throw new AetherApiError(413, "request_too_large", "API request exceeds the configured limit");
    }

    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    let timeout;
    let rejectAbort;
    const aborted = new Promise((_, reject) => {
      rejectAbort = reject;
      controller.signal.addEventListener("abort", () => {
        reject(new AetherApiError(408, timedOut ? "request_timeout" : "request_aborted", timedOut ? "API request timed out" : "API request was aborted"));
      }, { once: true });
    });
    timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      let token;
      try {
        token = await Promise.race([Promise.resolve().then(() => getAccessToken()), aborted]);
      } catch (error) {
        if (error instanceof AetherApiError) throw error;
        throw new AetherApiError(401, "token_unavailable", "Access token is unavailable");
      }
      if (typeof token !== "string" || !token.trim() || /[\\r\\n]/.test(token)) throw new AetherApiError(401, "token_unavailable", "Access token is unavailable");

      const headers = { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" };
      if (tenantId) headers["x-tenant-id"] = tenantId;
      const response = await Promise.race([
        Promise.resolve().then(() => fetchImpl(`${root}${path}`, { method: "POST", headers, body: serialized, signal: controller.signal })),
        aborted,
      ]);
      const raw = await Promise.race([readBoundedResponse(response, MAX_RESPONSE_BYTES), aborted]);
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch { throw new AetherApiError(502, "invalid_response", "API returned an invalid response", response.headers?.get?.("x-request-id") ?? null); }
      const requestId = response.headers?.get?.("x-request-id") ?? null;
      if (!response.ok) {
        const error = isRecord(data) && isRecord(data.error) ? data.error : {};
        throw new AetherApiError(response.status, typeof error.code === "string" ? error.code : "api_error", typeof error.message === "string" ? error.message : "API request failed", requestId);
      }
      return data;
    } catch (error) {
      if (error instanceof AetherApiError) throw error;
      if (controller.signal.aborted) throw new AetherApiError(408, timedOut ? "request_timeout" : "request_aborted", timedOut ? "API request timed out" : "API request was aborted");
      throw new AetherApiError(0, "network_error", "Could not reach the Aether API");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return Object.freeze({
    async createChatCompletion(input, { signal } = {}) {
      if (!isRecord(input) || typeof input.model !== "string" || !Array.isArray(input.messages) || input.messages.length === 0) throw new TypeError("model and non-empty messages are required");
      if (input.stream === true) throw new TypeError("Streaming is not supported by this client version");
      return request("/v1/chat/completions", input, signal);
    },
  });
}
