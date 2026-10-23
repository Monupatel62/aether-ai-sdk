import { AetherError } from "./errors.js";

export interface ServerSentEvent {
  readonly data: string;
  readonly event?: string;
  readonly id?: string;
  readonly retry?: number;
}

export interface ServerSentEventOptions {
  readonly signal?: AbortSignal;
  readonly maxEventBytes?: number;
}

/**
 * Parse the standard Server-Sent Events wire format from a response body.
 * This is transport-only: application event names and payload schemas belong to the API contract.
 */
export async function* parseServerSentEvents(
  stream: ReadableStream<Uint8Array>,
  options: ServerSentEventOptions = {}
): AsyncGenerator<ServerSentEvent> {
  const maxEventBytes = options.maxEventBytes ?? 1024 * 1024;
  if (!Number.isInteger(maxEventBytes) || maxEventBytes < 1 || maxEventBytes > 10 * 1024 * 1024) {
    throw new AetherError("CONFIGURATION", "maxEventBytes must be an integer between 1 and 10485760.");
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  let eventType: string | undefined;
  let lastEventId: string | undefined;
  let retry: number | undefined;
  let eventBytes = 0;

  const dispatch = (): ServerSentEvent | undefined => {
    if (dataLines.length === 0) {
      eventType = undefined;
      retry = undefined;
      eventBytes = 0;
      return undefined;
    }
    const event: ServerSentEvent = {
      data: dataLines.join("\n"),
      ...(eventType === undefined ? {} : { event: eventType }),
      ...(lastEventId === undefined ? {} : { id: lastEventId }),
      ...(retry === undefined ? {} : { retry })
    };
    dataLines = [];
    eventType = undefined;
    retry = undefined;
    eventBytes = 0;
    return event;
  };

  try {
    while (true) {
      if (options.signal?.aborted) throw new AetherError("ABORTED", "SSE stream parsing was aborted.");
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      let lineBreak = buffer.search(/[\r\n]/);
      while (lineBreak !== -1) {
        // Keep a trailing CR buffered until the next chunk can tell us whether it is CRLF.
        if (buffer[lineBreak] === "\r" && lineBreak === buffer.length - 1 && !done) break;
        let line = buffer.slice(0, lineBreak);
        const separator = buffer[lineBreak];
        buffer = buffer.slice(lineBreak + 1);
        if (separator === "\r" && buffer.startsWith("\n")) buffer = buffer.slice(1);

        if (line === "") {
          const event = dispatch();
          if (event) yield event;
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          let valueText = colon === -1 ? "" : line.slice(colon + 1);
          if (valueText.startsWith(" ")) valueText = valueText.slice(1);
          if (field === "data") {
            eventBytes += new TextEncoder().encode(valueText).byteLength + 1;
            if (eventBytes > maxEventBytes) {
              throw new AetherError("RESPONSE_TOO_LARGE", "SSE event exceeded the configured size limit.");
            }
            dataLines.push(valueText);
          } else if (field === "event") {
            eventType = valueText;
          } else if (field === "id" && !valueText.includes("\0")) {
            lastEventId = valueText;
          } else if (field === "retry" && /^\d+$/.test(valueText)) {
            const parsed = Number(valueText);
            if (Number.isSafeInteger(parsed)) retry = parsed;
          }
        }

        lineBreak = buffer.search(/[\r\n]/);
      }

      // A carriage return may be the last byte of a chunk; wait for a possible LF.
      if (done) break;
    }

    // The spec dispatches only after a blank line; a trailing unterminated line is not an event.
  } catch (error) {
    if (error instanceof AetherError) throw error;
    if (options.signal?.aborted) throw new AetherError("ABORTED", "SSE stream parsing was aborted.", { cause: error });
    throw new AetherError("NETWORK", "Failed while reading the SSE stream.", { cause: error });
  } finally {
    reader.releaseLock();
  }
}
