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
    await expect(client.request("v1/models")).rejects.toThrow("HTTP 500");
    await expect(client.request("v1/models")).rejects.not.toThrow("never show");
  });

  it("rejects paths that escape the configured base origin", async () => {
    const client = new AetherClient({ baseUrl: "https://api.example.com" });
    await expect(client.request("https://attacker.example/steal")).rejects.toMatchObject({ code: "CONFIGURATION" });
  });
});
