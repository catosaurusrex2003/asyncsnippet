# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[0.1.4]: https://github.com/catosaurusrex2003/asyncsnippet/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/catosaurusrex2003/asyncsnippet/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/catosaurusrex2003/asyncsnippet/compare/5a6f810...v0.1.2
[0.1.1]: https://github.com/catosaurusrex2003/asyncsnippet/compare/e5b20a2...5a6f810
[0.1.0]: https://github.com/catosaurusrex2003/asyncsnippet/tree/e5b20a2
