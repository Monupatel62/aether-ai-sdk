/** Stable client-side error categories; server error bodies are never copied blindly into messages. */
export type AetherErrorCode =
  | "CONFIGURATION"
  | "HTTP"
  | "NETWORK"
  | "TIMEOUT"
  | "ABORTED"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_RESPONSE";

export interface AetherErrorOptions {
  readonly status?: number;
  readonly requestId?: string;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class AetherError extends Error {
  readonly code: AetherErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(code: AetherErrorCode, message: string, options: AetherErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AetherError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    if (options.status !== undefined) this.status = options.status;
    if (options.requestId !== undefined) this.requestId = options.requestId;
  }
}
