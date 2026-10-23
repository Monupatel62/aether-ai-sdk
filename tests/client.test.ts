import { describe, expect, it, vi } from "vitest";
import { AetherClient, AetherError } from "../src/index.js";

describe("AetherClient", () => {
  it("rejects insecure non-local base URLs", () => {
    expect(() => new AetherClient({ baseUrl: "http://api.example.com" })).toThrow(AetherError);
  });

  it("allows localhost HTTP for local development", () => {
    expect(() => new AetherClient({ baseUrl: "http://localhost:3000" })).not.toThrow();
  });

  it("does not retry mutations even if maxRetries is set", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 503 }));
    const client = new AetherClient({ baseUrl: "https://api.example.com", fetch: fetchMock });
    await expect(client.request("v1/runs", { method: "POST", body: {}, maxRetries: 3 })).rejects.toMatchObject({ code: "HTTP" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redacts server response bodies from error messages", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ secret: "never show" }), { status: 500 }));
    const client = new AetherClient({ baseUrl: "https://api.example.com", fetch: fetchMock });
    let caught: unknown;
    try {
      await client.request("v1/models");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AetherError);
    expect((caught as Error).message).toContain("HTTP 500");
    expect((caught as Error).message).not.toContain("never show");
  });

  it("rejects absolute URLs in request paths", async () => {
    const client = new AetherClient({ baseUrl: "https://api.example.com" });
    await expect(client.request("https://attacker.example/steal")).rejects.toMatchObject({ code: "CONFIGURATION" });
  });

  it("rejects responses above the configured byte limit", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("123456", { status: 200 }));
    const client = new AetherClient({ baseUrl: "https://api.example.com", fetch: fetchMock, maxResponseBytes: 4 });
    await expect(client.request("v1/models")).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});
