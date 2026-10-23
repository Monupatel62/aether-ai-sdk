export interface AetherClientOptions {
  /** API base URL. HTTPS is required except for localhost development. */
  baseUrl: string;
  /** Return a short-lived access token; never pass a long-lived secret into browser code. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  /** Injectable Fetch-compatible implementation, useful for tests and custom runtimes. */
  fetchImpl?: typeof fetch;
  /** Per-attempt timeout in milliseconds (1–120000). */
  timeoutMs?: number;
  /** Retries for GET/HEAD only (0–3); unsafe methods are never automatically replayed. */
  maxSafeRetries?: number;
}

export interface AetherRequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface AetherApiErrorOptions {
  status?: number;
  code?: string;
  correlationId?: string;
  retryable?: boolean;
}

export declare class AetherApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  readonly retryable: boolean;
  constructor(message: string, options?: AetherApiErrorOptions);
}

export declare class AetherClient {
  constructor(options: AetherClientOptions);
  request<T = unknown>(path: string, options?: AetherRequestOptions): Promise<T | undefined>;
  get<T = unknown>(path: string, options?: Omit<AetherRequestOptions, "method" | "body">): Promise<T | undefined>;
  post<T = unknown>(path: string, body?: unknown, options?: Omit<AetherRequestOptions, "method" | "body">): Promise<T | undefined>;
  put<T = unknown>(path: string, body?: unknown, options?: Omit<AetherRequestOptions, "method" | "body">): Promise<T | undefined>;
  patch<T = unknown>(path: string, body?: unknown, options?: Omit<AetherRequestOptions, "method" | "body">): Promise<T | undefined>;
  delete<T = unknown>(path: string, options?: Omit<AetherRequestOptions, "method" | "body">): Promise<T | undefined>;
}
