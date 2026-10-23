# Architecture — aether-ai-sdk

## Boundary
The SDK is a client-side contract consumer, not an authority for identity, tenant membership, authorization, billing, or data persistence.

## Logical flow
1. Construct a client with an explicit base URL and credential provider.
2. Validate local arguments and serialize the reviewed request shape.
3. Send requests with request correlation and idempotency headers where required.
4. Parse typed responses and map safe error envelopes.
5. Apply bounded timeout/retry policy based on operation semantics.

## Reliability
Never retry a non-idempotent mutation unless the API contract defines idempotency. Respect cancellation, timeouts, and server retry hints. Avoid hidden background network activity.
