import { AetherError } from "./errors.js";
import type { AetherClientOptions, AetherResponse, RequestOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_RETRIES = 3;

function validateBaseUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch (cause) {
    throw new AetherError("CONFIGURATION", "Aether baseUrl must be an absolute URL.", { cause });
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new AetherError("CONFIGURATION", "Aether baseUrl must use HTTPS (HTTP is allowed only on localhost).");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new AetherError("CONFIGURATION", "Aether baseUrl must not contain credentials, query parameters, or a fragment.");
  }
  return new URL(url.toString().replace(/\/$/, ""));
}

function requestIdFrom(response: Response): string | undefined {
  return response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AetherError("RESPONSE_TOO_LARGE", "Aether response exceeded the configured size limit.", { status: response.status });
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AetherError("RESPONSE_TOO_LARGE", "Aether response exceeded the configured size limit.", { status: response.status });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AetherError("ABORTED", "Aether request was aborted."));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new AetherError("ABORTED", "Aether request was aborted."));
    }, { once: true });
  });
}

export class AetherClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly getAccessToken?: () => string | Promise<string>;
  private readonly defaultHeaders: Readonly<Record<string, string>>;

  constructor(options: AetherClientOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120_000) {
      throw new AetherError("CONFIGURATION", "timeoutMs must be an integer between 1 and 120000.");
    }
    if (!Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1 || this.maxResponseBytes > 20 * 1024 * 1024) {
      throw new AetherError("CONFIGURATION", "maxResponseBytes must be an integer between 1 and 20971520.");
    }
    this.getAccessToken = options.getAccessToken;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<AetherResponse<T>> {
    const method = options.method ?? "GET";
    const retries = method === "GET" ? Math.max(0, Math.min(MAX_RETRIES, options.maxRetries ?? 0)) : 0;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//") || path.includes(String.fromCharCode(92))) {
      throw new AetherError("CONFIGURATION", "Request path must be a relative API path, not an absolute URL.");
    }
    const url = new URL(path.replace(/^\/+/, ""), this.baseUrl.toString() + "/");
    if (url.origin !== this.baseUrl.origin || !url.pathname.startsWith(this.baseUrl.pathname.replace(/\/$/, "") + "/")) {
      throw new AetherError("CONFIGURATION", "Request path must remain within the configured Aether API base path.");
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.performRequest<T>(url, method, options);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof AetherError && error.retryable;
        if (!retryable || attempt >= retries || options.signal?.aborted) throw error;
        await delay(Math.min(250 * 2 ** attempt, 2_000), options.signal);
      }
    }
    throw lastError;
  }

  private async performRequest<T>(url: URL, method: NonNullable<RequestOptions["method"]>, options: RequestOptions): Promise<AetherResponse<T>> {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromCaller();
    else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("timeout")), this.timeoutMs);

    try {
      const headers = new Headers(this.defaultHeaders);
      headers.set("accept", "application/json");
      if (options.body !== undefined) headers.set("content-type", "application/json");
      if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
      const token = await this.getAccessToken?.();
      if (token) headers.set("authorization", `Bearer ${token}`);
      for (const [key, value] of Object.entries(options.headers ?? {})) headers.set(key, value);

      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });
      const requestId = requestIdFrom(response);
      const text = await readBoundedText(response, this.maxResponseBytes);
      if (!response.ok) {
        throw new AetherError("HTTP", `Aether API returned HTTP ${response.status}.`, {
          status: response.status,
          ...(requestId ? { requestId } : {}),
          retryable: response.status === 408 || response.status === 429 || response.status >= 500
        });
      }
      if (response.status === 204 || text.length === 0) {
        return { data: undefined as T, status: response.status, ...(requestId ? { requestId } : {}) };
      }
      try {
        return { data: JSON.parse(text) as T, status: response.status, ...(requestId ? { requestId } : {}) };
      } catch (cause) {
        throw new AetherError("INVALID_RESPONSE", "Aether API returned an invalid JSON response.", { status: response.status, ...(requestId ? { requestId } : {}), cause });
      }
    } catch (error) {
      if (error instanceof AetherError) throw error;
      if (controller.signal.aborted) {
        const timedOut = !options.signal?.aborted;
        throw new AetherError(timedOut ? "TIMEOUT" : "ABORTED", timedOut ? "Aether request timed out." : "Aether request was aborted.", { cause: error });
      }
      throw new AetherError("NETWORK", "Aether API request failed.", { retryable: true, cause: error });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
