# Dependencies and Contracts — aether-ai-sdk

## Dependency boundary
Versioned aether-ai-api contracts; the API must not import its own SDK.

## Public contract
- Pin the OpenAPI/API contract version used to generate or author types.
- Document required/optional fields, nullability, error codes, pagination, timeouts, and cancellation.
- Keep client retry behavior aligned with server idempotency semantics.
- Keep server-owned fields and privileged instruction roles unavailable to ordinary client input types.

## Compatibility
Use semantic versioning; breaking changes require a major version and migration guide. Record generated artifacts and their source contract revision.
