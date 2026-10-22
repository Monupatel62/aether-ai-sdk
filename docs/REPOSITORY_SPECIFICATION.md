# Repository specification: aether-ai-sdk

**Status:** Documentation baseline copied from the Aether AI master specification. Implementation status must be verified separately.

## Mission

Typed client SDK and shared public API schemas for external developers and first-party apps.

## Dependencies and connections

Aether API OpenAPI/event schemas.

## Owned capabilities

Versioning, authentication helpers, typed errors, retries that avoid unsafe replay, streaming client, examples, semver and release policy.

## Must not own

- Responsibilities assigned to another repository in the master catalog.
- Secrets, identity decisions, or authorization bypasses outside its documented boundary.
- Private database tables owned by another service.
- Unversioned contracts or undocumented side effects.

## Required contracts

- Typed schemas, explicit versioning, stable error categories, limits, and compatibility policy.
- Tenant/user context and authorization rules for any scoped data/action.
- Correlation IDs, safe telemetry, and explicit failure/timeout/retry behavior.
- Retention/deletion semantics whenever data is persisted.

## Security and privacy checklist

- [ ] Threat model and abuse cases documented.
- [ ] Least privilege and tenant isolation defined.
- [ ] Sensitive fields excluded or redacted in logs.
- [ ] Input size/type validation and rate/usage limits defined.
- [ ] Deletion, retention, export, and audit requirements defined where applicable.

## Test plan

Unit tests, contract tests, authorization/tenant isolation tests, malformed-input tests, dependency failure tests, and a non-production integration smoke test are required before release. Tests use synthetic or sanitized data only.

## Implementation gates

1. Create the repository only when the owner and direct dependencies are ready.
2. Review this specification against [the master catalog](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/REPOSITORY_CATALOG.md).
3. Record an ADR for unresolved technology choices before selecting a database, identity provider, queue, cache, vector store, or payment provider.
4. Implement a minimal vertical slice with tests and operational docs.
5. Update the master catalog and this spec when the contract changes.

## Research references

- [Aether AI master catalog](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/REPOSITORY_CATALOG.md)
- [WoHo AI DevKit](https://github.com/Monupatel62/woho-ai-devkit) — separate dependency; verify exact package APIs and license.
- [AI DIAL Core](https://github.com/epam/ai-dial-core) — model gateway reference; verify exact release/license before reuse.
- [AI DIAL Chat](https://github.com/epam/ai-dial-chat) — UI/BFF reference; verify file-level notices before reuse.
- [Model Context Protocol](https://modelcontextprotocol.io/) — relevant for MCP/tool integration.

These links are research inputs, not proof that the Aether implementation exists or that all referenced code is reusable under one license.

## Related documentation

- [Master repository catalog](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/REPOSITORY_CATALOG.md)
- [Master architecture](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/MASTER_ARCHITECTURE.md)
- [Architecture audit](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/ARCHITECTURE_AUDIT.md)
- [Security threat model](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/SECURITY_THREAT_MODEL.md)
- [Open decisions and research](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/OPEN_DECISIONS_RESEARCH.md)
- [Continuity handoff](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/WORK_HANDOFF.md)
