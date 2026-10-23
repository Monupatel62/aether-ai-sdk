import { describe, expect, it } from "vitest";
import { parseServerSentEvents } from "../src/sse.js";

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(new TextEncoder().encode(chunks[index++]));
    }
  });
}

describe("parseServerSentEvents", () => {
  it("parses multiline data and event metadata across chunks", async () => {
    const events = [];
    for await (const event of parseServerSentEvents(byteStream([
      ": keepalive\r\nevent: update\r\ndata: hello\r",
      "\ndata: world\r\nid: 7\r\nretry: 1500\r\n\r\n"
    ]))) events.push(event);

    expect(events).toEqual([{ data: "hello\nworld", event: "update", id: "7", retry: 1500 }]);
  });

  it("ignores comments and does not dispatch events without data", async () => {
    const events = [];
    for await (const event of parseServerSentEvents(byteStream([": ping\nfoo: bar\n\ndata: ok\n\n"]))) events.push(event);
    expect(events).toEqual([{ data: "ok" }]);
  });

  it("enforces an event size limit", async () => {
    const parser = parseServerSentEvents(byteStream(["data: too large\n\n"]), { maxEventBytes: 3 });
    await expect(parser.next()).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});
