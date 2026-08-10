# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-08-10

### Added

- `agent` target with `ws` (default) and `kafka` clients — not runnable code, but a self-contained Markdown prompt (intro, every reachable server with its own authorization, the operation, and raw payload/headers JSON Schema) meant for an LLM agent to read and act on. Registered first so pickers built on `getSupportedTargets()` / `getCompatibleTargets()` list and default to it ahead of code-sample targets.
- Documentation-oriented fields on `Request`: `info`, `servers` (every reachable server with name/url/description and its own resolved `security`), `channelTemplate`, `operationSummary`/`operationDescription`, `security` (matched server), and richer `message` metadata (`title`/`summary`/`description`/`contentType`/`payloadSchema`/`headersSchema`).
- AsyncAPI `SecurityScheme` typing plus `resolveServerSecurity` — fully derefs a server's `security` list against `components.securitySchemes` for human/agent-facing summaries.
- Deep `$ref` resolution for payload/headers JSON Schema (`resolveSchemaDeep`) so agent prompts and callers can surface the full schema graph, not just leaf `$ref` pointers.
- Fixtures covering security schemes and the streetlights example; snapshot coverage for agent prompts.

### Changed

- `Request` is additive for existing code clients — new fields are available to custom targets, but the built-in JavaScript/Python/Rust/Go clients are unchanged in emitted snippets.

## [0.2.0] - 2026-08-10

### Added

- Kafka clients for every existing target, not just `javascript`: `python`/`confluent-kafka` (librdkafka-backed), `rust`/`rdkafka` (Tokio async/await), `go`/`kafka-go` (pure Go, no cgo). Same producer/consumer semantics as `javascript`/`kafkajs` — topic override, message key, consumer `groupId`/`clientId` resolution. None of these change their target's default client (`python` stays `websockets`, `rust` stays `tokio-tungstenite`, `go` stays `gorilla`).
- Schema-generated message payloads: when a message has no explicit `examples` entry, `convert()` now generates a representative payload from its `payload` JSON Schema (object/array recursion, format-aware strings, `$ref` resolution, `enum`/`const`/`default`) instead of throwing. `MissingExampleError` now only fires when there's neither an explicit example nor a usable payload schema. Generated payloads are flagged in the snippet's placeholder comment, distinguishing them from real document-authored examples.
- `isProtocolCompatible(document, operationId, protocol)` and `getCompatibleTargets(document, operationId)` — check/filter target-registry entries down to only those actually reachable for a given operation's channel, so a picker UI built on `getSupportedTargets()` doesn't have to offer options guaranteed to fail `convert()` (e.g. WebSocket clients for a Kafka-only operation). Never throw; an unresolvable operation/channel just resolves to `false`/`[]`.

### Fixed

- Protocol eligibility no longer requires an explicit `channel.bindings[protocol]` object. Most real-world Kafka channels never declare `channel.bindings.kafka` (it's only needed for a topic override), which meant `convert()` rejected nearly every real Kafka document with `MissingBindingError` even though the server clearly declared `protocol: kafka`. Eligibility is now derived from the channel's resolved server(s) first, falling back to explicit binding presence only when no server confirms the protocol.
- Secure-transport protocol variants (`kafka-secure`, `wss`) now normalize to their base protocol (`kafka`, `ws`) for eligibility purposes — a server declaring `protocol: kafka-secure` is now recognized as Kafka. The document's own protocol string is unaffected elsewhere (still shown as-is, e.g. `kafka-secure://...`, in generated snippets).
- A channel reachable through multiple servers of different protocols now uses the server that actually matches the requested client's protocol for the generated URL/host, instead of always the first listed server.

## [0.1.5] - 2026-08-03

### Added

- `javascript`/`kafkajs` client — the first non-WebSocket protocol. Kafka
  producer/consumer code generation using the `kafkajs` package, with topic
  override, message key, and consumer `groupId`/`clientId` resolution.
- `Request`/`buildRequest` generalized to dispatch binding resolution per
  protocol (`Request` gained `protocol`, `serverHost`, and an optional
  `kafka` field); `MissingBindingError` now names the missing protocol
  instead of hardcoding `"ws"`.

## [0.1.4] - 2026-08-03

### Added

- `rust`/`tokio-tungstenite` client using Tokio async/await,
  `serde_json::json!` for payloads, and `IntoClientRequest` for handshake
  headers.
- `go`/`gorilla` client using `gorilla/websocket`'s `DefaultDialer`,
  `map[string]interface{}` payload literals, and `http.Header` for handshake
  headers.

## [0.1.3] - 2026-08-03

### Added

- Real `addTarget` / `addTargetClient` target/client registry
  (`src/targets/index.ts`), replacing the hardcoded single-entry `targets`
  object. Both are exported from the package root for consumers who want to
  register their own target/client.
- Browser-safe `javascript`/`websocket` client using the WHATWG `WebSocket`
  API — no runtime dependency. Query-param bindings only; if the operation's
  `ws` binding declares custom headers, the generated snippet keeps the
  query string but documents the dropped headers in a comment (the browser
  API can't set handshake headers).
- `python`/`websockets` client using the `websockets` package's asyncio API.

## [0.1.2] - 2026-08-03

### Added

- GitHub Actions release workflow: pushes to `main` publish the version in
  `package.json` to npm via trusted publishing (OIDC) when that version is not
  already on the registry.
- Unit tests for the public error classes thrown by `convert()`.

## [0.1.1] - 2026-08-02

### Changed

- `AsyncSnippet` now takes an already-parsed AsyncAPI 3.x document (plain
  object). Parsing and validation are the caller's responsibility.
- Dropped the `@asyncapi/parser` runtime dependency; `$ref` resolution is
  handled internally.
- Corrected the GitHub repository URLs in `package.json`.

## [0.1.0] - 2026-08-02

### Added

- Initial release: generate Node.js `ws` client snippets from an AsyncAPI 3.x
  WebSocket operation (`javascript` / `ws` only).

[0.1.5]: https://github.com/catosaurusrex2003/asyncsnippet/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/catosaurusrex2003/asyncsnippet/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/catosaurusrex2003/asyncsnippet/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/catosaurusrex2003/asyncsnippet/compare/5a6f810...v0.1.2
[0.1.1]: https://github.com/catosaurusrex2003/asyncsnippet/compare/e5b20a2...5a6f810
[0.1.0]: https://github.com/catosaurusrex2003/asyncsnippet/tree/e5b20a2
