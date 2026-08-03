# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.2]: https://github.com/catosaurusrex2003/asyncsnippet/compare/5a6f810...v0.1.2
[0.1.1]: https://github.com/catosaurusrex2003/asyncsnippet/compare/e5b20a2...5a6f810
[0.1.0]: https://github.com/catosaurusrex2003/asyncsnippet/tree/e5b20a2
