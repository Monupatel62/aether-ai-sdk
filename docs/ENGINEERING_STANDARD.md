# Engineering Standard — aether-ai-sdk

- Keep public API types aligned to a pinned versioned contract.
- Use strict typing and explicit runtime validation at network boundaries.
- Keep transport, serialization, error mapping, and retry policy independently testable.
- Do not hide network calls in constructors or getters.
- Redact credentials and sensitive request/response content by default.
- Add tests and migration notes with every contract change.
- Use reproducible builds and lockfiles once the package manager is selected.
- Do not claim compatibility or release readiness without executed CI evidence.
