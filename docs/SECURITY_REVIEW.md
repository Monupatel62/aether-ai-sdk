# Security Review — aether-ai-sdk

Status: review checklist; no implementation or test evidence is present.

## Threats
credential leakage, unsafe retries of non-idempotent requests, contract drift, accidental logging of prompts/results, and incompatible API changes.

## Required controls
- [ ] Credentials supplied at runtime and redacted from logs/errors.
- [ ] TLS required for non-local endpoints; unsafe certificate bypasses prohibited.
- [ ] URL/base-origin validation and bounded response bodies.
- [ ] Operation-aware retries and explicit idempotency support.
- [ ] No secrets in examples, fixtures, source history, or release artifacts.
- [ ] Dependency/license and secret scanning before release.

## Required tests
Test contract compatibility, token redaction, retry/idempotency behavior, malformed responses, timeouts, cancellation, pagination, and backward-compatible upgrades. Use synthetic data and fake endpoints only.
