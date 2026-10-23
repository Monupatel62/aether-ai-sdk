# Project Specification — aether-ai-sdk

## Purpose
Typed client SDK and shared public API schemas for external developers and first-party apps.

## Scope
- Public typed client, auth configuration helpers, safe retries, typed errors, pagination, streaming client when approved, examples, semantic versioning and release policy.
- Keep public APIs versioned and document supported runtime environments.
- Provide minimal examples that never contain real credentials.

## Out of scope
Server-side authorization decisions, database access, provider execution, and private API implementation details.

## Acceptance criteria
- Public types match the reviewed API contract.
- Authentication secrets are handled securely and never logged.
- Retry behavior never replays unsafe operations without an idempotency contract.
- Compatibility changes have migration notes and tests.

## Status
Documentation only; no SDK source, package manifest, tests, or release pipeline were found in the inspected default-branch tree.
