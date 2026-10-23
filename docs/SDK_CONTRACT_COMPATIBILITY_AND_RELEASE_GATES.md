# SDK Contract Compatibility and Release Gates

**Status:** Proposed release policy; not evidence of an implemented SDK or completed release pipeline.

## Purpose

Define a repeatable gate for publishing a typed client SDK generated from or aligned with the versioned `aether-ai-api` contract. This document does not select a language, package registry, generator, or runtime; those remain subject to ADR review.

## Source-of-truth rules

1. Every SDK release candidate must identify the exact API contract revision (immutable commit or versioned artifact digest) used to generate or verify its public types.
2. The SDK must not become a second source of truth for endpoint behavior, authorization, limits, server-owned fields, or error semantics.
3. Generated output must be reproducible from a clean checkout and pinned toolchain. Record generator name/version, configuration digest, input contract revision, and output revision in the release evidence.
4. A changed API contract must trigger compatibility analysis before SDK publication. A manually edited generated artifact without a documented regeneration exception is a release blocker.
5. The API service must not depend on its own SDK package; this prevents a circular ownership boundary.

## Compatibility classification

Classify each contract change against the last supported release and record the evidence:

| Change | Default classification | Required action |
|---|---|---|
| Add optional response field | Usually compatible | Verify unknown-field handling and generated type behavior |
| Add required request field | Potentially breaking | Require migration analysis and major-version decision |
| Remove or rename public field/operation | Breaking | Major version plus migration guide |
| Narrow accepted values or nullability | Potentially breaking | Demonstrate compatibility against prior fixtures |
| Change error category/status or pagination semantics | Behaviorally breaking risk | Update error/behavior contract and tests |
| Change retry/idempotency semantics | Safety-critical behavior change | Require operation-level retry review and duplicate-side-effect tests |
| Add endpoint with no existing type changes | Usually additive | Verify auth scope, limits, and generated client exposure |

These are defaults, not automatic semantic-version decisions. Reviewers must inspect actual client and server behavior.

## Required pre-release evidence

A release candidate is blocked until the following evidence is attached to the pull request or release record:

- [ ] Contract revision is immutable and matches the checked-in generation/verification metadata.
- [ ] Clean regeneration produces no unexplained diff.
- [ ] Public API compatibility report identifies removed, added, and changed operations, fields, nullability, enums, and error shapes.
- [ ] Type checking and unit tests pass for the supported package targets.
- [ ] Contract tests cover success, malformed responses, documented errors, pagination, timeout, and cancellation.
- [ ] Retry tests prove that non-idempotent mutations are not automatically replayed without documented server semantics and a stable idempotency key.
- [ ] Credential and sensitive-field redaction tests pass; test output contains no real tokens or prompts.
- [ ] Dependency, license, and secret scans are reviewed; generated artifacts and package contents are inspected.
- [ ] Release notes explain breaking changes and include migration guidance where required.
- [ ] A reviewer verifies that the published artifact corresponds to the reviewed source revision.

## Minimum compatibility test matrix

| Scenario | Expected result |
|---|---|
| New optional response field from server | Older supported client handles it without crashing |
| Missing required response field | Client returns a bounded, typed protocol error; no unsafe assumption |
| Unknown enum value | Behavior follows an explicitly documented forward-compatibility policy |
| Server returns documented error envelope | Stable SDK error category and request/correlation metadata |
| Timeout or caller cancellation | Request stops locally; no claim that a remote mutation was rolled back |
| Transient failure on read-only operation | Retry only within documented attempt/time limits |
| Transient failure on mutation | No replay unless operation and idempotency contract explicitly permit it |
| Contract source revision changes | Compatibility report and regeneration gate run again |
| Generated output differs on clean rerun | Release blocked pending explanation or reproducible fix |
| Credential appears in server error text | Public error and logs redact it |

## Versioning and support policy

- Follow semantic versioning only after the public package name, release channel, and supported runtime matrix are approved.
- Maintain a documented compatibility window for API contract versions and SDK major versions before promising support durations.
- Publish a deprecation notice and migration path before removing public methods where feasible.
- Do not promise that SDK validation grants authorization: the server remains authoritative for identity, membership, permissions, resource scope, and current access.
- Do not promise exactly-once remote execution from client retries; timeouts can leave mutation outcomes uncertain.

## Ownership and unresolved decisions

The SDK owns client ergonomics, typed public models, safe transport behavior, compatibility reporting, and release metadata. The API owns endpoint semantics and server validation. Auth/security services own server-side identity and authorization decisions. Canonical tenant/workspace membership ownership remains unresolved under ADR-0021 and must not be inferred from SDK context fields.

Before implementation, record decisions for language, package format, generator, supported runtimes, package registry, signing/provenance mechanism, and API-version support window.

## Acceptance checklist for implementation

- [ ] CI pins the contract source and generator/toolchain.
- [ ] CI fails on unexplained regeneration drift.
- [ ] CI emits a compatibility report for contract changes.
- [ ] CI runs the minimum matrix above using fake endpoints and synthetic data.
- [ ] Release workflow publishes only artifacts built from the reviewed tag/commit and attaches provenance.
- [ ] Security review confirms secrets are absent from package, examples, logs, and release metadata.
- [ ] No runtime, package registry, or identity/tenancy owner is selected by this document.

## References

- [Aether AI API repository](https://github.com/Monupatel62/aether-ai-api)
- [Aether AI platform repository catalog](https://github.com/Monupatel62/aether-ai-platform/blob/main/docs/REPOSITORY_CATALOG.md)
- [Semantic Versioning 2.0.0](https://semver.org/)
