export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AetherClientOptions {
  /** Absolute HTTPS URL in production; HTTP is allowed only for localhost development. */
  readonly baseUrl: string;
  /** Token supplier keeps refresh policy outside the SDK and avoids storing credentials in the client. */
  readonly getAccessToken?: () => string | Promise<string>;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
}

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: JsonValue;
  readonly signal?: AbortSignal;
  /** Only send this when the API contract defines idempotency semantics for the operation. */
  readonly idempotencyKey?: string;
  /** Opt-in retries are restricted to GET requests. */
  readonly maxRetries?: number;
}

export interface AetherResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly requestId?: string;
}
