export class AetherApiError extends Error {
  constructor(message, { status = 0, code = "NETWORK_ERROR", correlationId, retryable = false } = {}) {
    super(message);
    this.name = "AetherApiError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD"]);
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_SAFE_RETRIES = 2;

function validBaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function normalizePath(path) {
  if (typeof path !== "string" || !path.trim()) throw new TypeError("path must be a non-empty string");
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new TypeError("path must be relative to the configured base URL");
  }
  return path.replace(/^\/+/, "");
}

function parseErrorCode(body) {
  if (!body || typeof body !== "object") return "API_ERROR";
  const candidate = body.code ?? body.error?.code;
  return typeof candidate === "string" && /^[A-Z0-9_]{1,64}$/.test(candidate)
    ? candidate
    : "API_ERROR";
}

export class AetherClient {
  constructor({ baseUrl, getAccessToken, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, maxSafeRetries = DEFAULT_MAX_SAFE_RETRIES } = {}) {
    if (!validBaseUrl(baseUrl)) throw new TypeError("baseUrl must be an HTTPS URL (HTTP is allowed only for localhost)");
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new RangeError("timeoutMs must be between 1 and 120000");
    if (!Number.isInteger(maxSafeRetries) || maxSafeRetries < 0 || maxSafeRetries > 3) throw new RangeError("maxSafeRetries must be between 0 and 3");
    if (getAccessToken !== undefined && typeof getAccessToken !== "function") throw new TypeError("getAccessToken must be a function");
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    this.getAccessToken = getAccessToken;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxSafeRetries = maxSafeRetries;
  }

  async request(path, { method = "GET", headers = {}, body, signal, correlationId } = {}) {
    const relativePath = normalizePath(path);
    const verb = String(method).toUpperCase();
    if (!/^[A-Z]+$/.test(verb)) throw new TypeError("method must be a valid HTTP method");
    if (headers === null || typeof headers !== "object" || Array.isArray(headers)) throw new TypeError("headers must be an object");
    const url = new URL(relativePath, this.baseUrl);
    if (url.origin !== new URL(this.baseUrl).origin) throw new TypeError("request path must stay within the configured API origin");

    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
    if (correlationId) requestHeaders.set("X-Correlation-ID", correlationId);
    if (body !== undefined && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");

    const retries = SAFE_METHODS.has(verb) ? this.maxSafeRetries : 0;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(new Error("Request timed out")), this.timeoutMs);
      const combined = new AbortController();
      const abortCombined = (source) => combined.abort(source.reason);
      timeout.signal.addEventListener("abort", () => abortCombined(timeout.signal), { once: true });
      signal?.addEventListener("abort", () => abortCombined(signal), { once: true });
      if (signal?.aborted) abortCombined(signal);
      try {
        const response = await this.fetchImpl(url, {
          method: verb,
          headers: requestHeaders,
          ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
          signal: combined.signal,
        });
        if (!response.ok) {
          let payload;
          try { payload = await response.json(); } catch { payload = undefined; }
          const error = new AetherApiError(
            `Aether API request failed with status ${response.status}`,
            {
              status: response.status,
              code: parseErrorCode(payload),
              correlationId: response.headers?.get?.("X-Correlation-ID") ?? correlationId,
              retryable: response.status === 429 || response.status >= 500,
            },
          );
          if (attempt < retries && error.retryable) {
            lastError = error;
            continue;
          }
          throw error;
        }
        if (response.status === 204 || verb === "HEAD") return undefined;
        const contentType = response.headers?.get?.("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new AetherApiError("Aether API returned an unexpected content type", {
            status: response.status,
            code: "INVALID_RESPONSE_TYPE",
            correlationId,
          });
        }
        return await response.json();
      } catch (error) {
        if (error instanceof AetherApiError) {
          if (attempt < retries && error.retryable) { lastError = error; continue; }
          throw error;
        }
        if (signal?.aborted) throw new AetherApiError("Aether API request was cancelled", { code: "REQUEST_CANCELLED", correlationId });
        lastError = new AetherApiError(
          timeout.signal.aborted ? "Aether API request timed out" : "Aether API network request failed",
          { code: timeout.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR", correlationId, retryable: true },
        );
        if (attempt >= retries) throw lastError;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", () => {});
      }
    }
    throw lastError ?? new AetherApiError("Aether API request failed");
  }

  get(path, options) { return this.request(path, { ...options, method: "GET" }); }
  post(path, body, options) { return this.request(path, { ...options, method: "POST", body }); }
  put(path, body, options) { return this.request(path, { ...options, method: "PUT", body }); }
  patch(path, body, options) { return this.request(path, { ...options, method: "PATCH", body }); }
  delete(path, options) { return this.request(path, { ...options, method: "DELETE" }); }
}
