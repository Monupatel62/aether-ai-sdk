const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
export class AetherApiError extends Error {
  constructor(status, code, message, requestId = null) { super(message); this.name = "AetherApiError"; this.status = status; this.code = code; this.requestId = requestId; }
}
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
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
    let token;
    try { token = await getAccessToken(); } catch { throw new AetherApiError(401, "token_unavailable", "Access token is unavailable"); }
    if (typeof token !== "string" || !token.trim() || /[\r\n]/.test(token)) throw new AetherApiError(401, "token_unavailable", "Access token is unavailable");

    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);
    try {
      const headers = { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" };
      if (tenantId) headers["x-tenant-id"] = tenantId;
      const response = await fetchImpl(`${root}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
      const raw = await response.text();
      if (Buffer.byteLength(raw) > MAX_RESPONSE_BYTES) throw new AetherApiError(502, "response_too_large", "API response exceeds the configured limit", response.headers?.get?.("x-request-id") ?? null);
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
      if (controller.signal.aborted) throw new AetherApiError(408, "request_aborted_or_timed_out", "API request was aborted or timed out");
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
