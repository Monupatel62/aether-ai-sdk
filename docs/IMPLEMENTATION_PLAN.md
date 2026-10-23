# Implementation Plan — aether-ai-sdk

## Phase 0 — contract gate
- [ ] Validate the OpenAPI contract with a dedicated OpenAPI 3.1 validator.
- [ ] Resolve API authentication, idempotency, errors, limits, and streaming decisions.

## Phase 1 — client core
- [ ] Add transport abstraction, credential provider interface, request IDs, typed errors, timeout and cancellation support.
- [ ] Add typed methods for the approved first vertical slice only.

## Phase 2 — safety and usability
- [ ] Add safe retry policy, redaction, pagination and examples.
- [ ] Generate or verify types against a pinned API contract.

## Phase 3 — release gate
- [ ] Compatibility tests against synthetic fixtures.
- [ ] Package audit, license/dependency scan, secret scan, and release workflow.

No implementation phase is marked complete.
