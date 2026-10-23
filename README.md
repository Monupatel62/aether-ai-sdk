# @aether-ai/sdk

Typed JavaScript/TypeScript client foundation for Aether AI's versioned public API.

## Status

Initial implementation is in review. The SDK is **not production-certified** until CI, security review, API-contract alignment, dependency audit, and release gates pass. The final Aether API schema and identity strategy are still architecture decisions.

## Requirements

- Node.js 20 or newer.
- HTTPS for non-local API endpoints. HTTP is allowed only for localhost development.
- Supply credentials through a runtime token callback; never hard-code or log access tokens.

## Basic usage

```ts
import { AetherClient } from "@aether-ai/sdk";

const client = new AetherClient({
  baseUrl: "https://api.example.com",
  getAccessToken: async () => tokenProvider.getAccessToken(),
  timeoutMs: 15_000
});

const result = await client.request<{ models: Array<{ id: string }> }>("v1/models");
console.log(result.data.models);
```

The example route and response type are illustrative only; they are not a declaration of the final Aether API contract.

## Request safety

- Request paths must be relative to the configured API base path.
- Response bodies have a bounded default size (2 MiB).
- Automatic retries are restricted to GET requests and are opt-in.
- Mutations are not automatically retried. Pass an idempotency key only for endpoints whose reviewed API contract supports it.
- Error messages do not include arbitrary server response bodies; request IDs are exposed when present.
- Caller cancellation and request timeouts are represented as stable AetherError codes.

## Server-Sent Events

The `parseServerSentEvents(stream)` helper parses the standard SSE wire format, including multiline data, event IDs, retry fields, comments, CRLF chunk boundaries, and a configurable per-event byte limit. It does not define Aether application event names or payload schemas.

```ts
import { parseServerSentEvents } from "@aether-ai/sdk";

for await (const event of parseServerSentEvents(response.body!)) {
  // Validate event.data against the versioned API event schema before use.
  handleEvent(event);
}
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

CI is configured for Node.js 20 and 22. Do not treat the SDK as releasable until all checks pass and the final API contract is reviewed.
