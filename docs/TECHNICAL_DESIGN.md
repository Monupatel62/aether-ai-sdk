# Technical Design — aether-ai-sdk

## Proposed modules
- Client configuration and credential provider.
- HTTP transport with timeout/cancellation.
- Typed request/response models tied to an explicit contract version.
- Safe error mapping and operation-aware retry policy.
- Optional streaming adapter only after protocol semantics are approved.

## Security invariants
- Never trust SDK-provided tenant, role, or authorization metadata as a grant.
- Never log authorization headers, API keys, prompt bodies, or raw upstream errors.
- Treat server responses as untrusted input and bound response sizes.
- Do not retry mutations without a stable idempotency key and documented server semantics.

## Open decisions
Language, packaging target, code generation tool, supported runtimes, and release registry remain unselected pending ADR review.
