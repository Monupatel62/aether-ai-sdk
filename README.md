# aether-ai-sdk

**Status:** Initial public HTTP client implemented on a feature branch. The API contract is still evolving; production SDK readiness is not claimed.

## Implemented

- [SDK source](src/index.js): authenticated chat-completion request, HTTPS enforcement outside localhost, injected token retrieval, tenant selector header, request timeout/abort, bounded response size, and normalized safe errors.
- [Unit tests](test/sdk.test.js): auth headers, error codes/request IDs, unsafe URLs/tokens, invalid input, network failure, and abort/timeout.
- Dependency-free Node.js package with Node 20/22 CI.

## Limitations

- Streaming is deliberately rejected until the API streaming contract is implemented.
- Token acquisition and refresh are delegated to the caller; this SDK does not persist credentials.
- Generated OpenAPI types, retries, pagination, upload/download APIs, and compatibility guarantees remain unimplemented.
- The server must treat `x-tenant-id` as an untrusted selector and independently enforce membership and authorization.

## Documentation

- [Repository specification](docs/REPOSITORY_SPECIFICATION.md)
- [Project specification](docs/PROJECT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Dependencies and contracts](docs/DEPENDENCIES_AND_CONTRACTS.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Master catalog](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/REPOSITORY_CATALOG.md)
