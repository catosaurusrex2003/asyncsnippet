# asyncsnippet — Roadmap / TODOs

Generated 2026-08-03 via `/plan-ceo-review` (selective expansion mode).
Baseline: v1 scope as shipped in `0.1.1` and locked in the `/office-hours`
design doc (`~/.gstack/projects/asyncsnippet/catosaurusrex-unknown-design-20260802-141326.md`).
That baseline is **not** up for debate here — this file is the "what's next"
list, organized so you can cherry-pick.

Legend: **Effort** is S / M / L (human-hours-equivalent; Claude Code
compresses most of these to well under that). **Priority** is now / next / later.

---

## 0. Bugs / correctness (do these regardless of roadmap direction)

- [x] **README documents an error class that doesn't exist.** The "Error
  handling" section lists `InvalidDocumentError` as one of the typed errors
  `convert()` throws. `src/errors.ts` has no such class — it never did after
  `@asyncapi/parser` was dropped in `d9a4abb` (that commit removed the only
  code path that would have validated/rejected a malformed document). Either
  add the class back with real behavior, or delete the claim from the README.
  Right now the docs promise something the library doesn't do.
  **Effort: S. Priority: now.** — _Fixed: removed the `InvalidDocumentError`
  claim from README (the library intentionally doesn't parse/validate
  documents, per its own "Usage" section, so adding real validation would
  contradict the stated design)._

- [x] **Zero test coverage for the six error paths.** `src/fixtures.test.ts`
  is snapshot-only and never asserts a `throw`. `UnknownOperationError`,
  `UnsupportedTargetError`, `MissingChannelError`, `MissingBindingError`,
  `MissingExampleError` all have zero tests. These are the library's public
  contract (README leads with them) — an untested contract is not a contract.
  **Effort: S. Priority: now.** — _Fixed: added `src/errors.test.ts` with
  explicit `toThrow()` assertions (class + message) for all five error
  classes actually reachable from `convert()`._

- [x] **Channel-level-only WS binding precedence isn't documented.**
  AsyncAPI 3.x allows `bindings.ws` at server/channel/operation/message
  level; `request.ts` only reads `channel.bindings?.ws`. This was flagged as
  an open design-doc reviewer concern and resolved in code, but the README
  never states the resolution rule. A user with an operation-level binding
  will get silently-wrong output (no binding applied, no error) and have no
  way to know why. **Effort: S. Priority: now.** — _Fixed: added a bullet to
  README's "v1 scope" section stating the channel-only resolution rule._

## 1. Infrastructure the design doc already promised but never shipped

- [x] **CI.** Release-on-push-to-`main` via GitHub Actions (`.github/workflows/release.yml`):
  publish the version in `package.json` via trusted publishing (OIDC) when it
  isn't already on npm; skip otherwise.
  **Effort: S. Priority: now.**

- [x] **CHANGELOG.md.** Two versions shipped (`0.1.0`→`0.1.1`) with no record
  of what changed. Cheap to start now, expensive to reconstruct later.
  **Effort: S. Priority: now.**

- [x] **CONTRIBUTING.md.** If target support (below) grows via community PRs
  the way httpsnippet's did, contributors need the `addTarget`-equivalent
  contract spelled out before they can add one. Write this alongside
  whichever target work happens first, not before. **Effort: S. Priority: next.**

## 2. Targets / clients — "what should we support next"

Current state: exactly one target/client pair, hardcoded
(`targets/javascript/ws/client.ts`), with the registry comment in
`src/targets/index.ts` explicitly noting this is a placeholder for a real
plugin system. Candidates, in the order the design doc itself already flagged
them as fast-follows:

- [ ] **Real target/client registry (`addTarget`/`addClient`).** This is the
  prerequisite for everything else in this section — right now adding a
  second client means editing the hardcoded `targets` object, not extending
  it. Mirrors httpsnippet's `Target`/`Client` registration pattern (already
  referenced in this codebase's own type names). Do this *before* adding a
  second client, not after — retrofitting a registry under two clients is
  more work than designing it for two from the start.
  **Effort: M. Priority: next.**

- [ ] **Browser-safe JS client** (`javascript/websocket` — WHATWG
  `WebSocket`, no `ws` dependency). Explicitly named as "a candidate
  fast-follow, not v1" in the design doc's Constraints. Scope: query-param-only
  bindings, with a documented, thrown/warned limitation when the operation
  needs custom headers (browser `WebSocket` can't set them). This is the
  most-requested shape for a docs "try it in your browser console" widget —
  arguably higher value than a second language. **Effort: M. Priority: next.**

- [ ] **Python client** (`python/websockets`, using the `websockets`
  package). Named directly in the design doc's Approach B client list.
  Straightforward once the registry exists — same `Request` object, new
  `CodeBuilder`-equivalent template. **Effort: M. Priority: next.**

- [ ] **A couple more language clients** once the registry + 2 clients have
  proven the abstraction: Rust (`tokio-tungstenite`, also named in the design
  doc), Go (`gorilla/websocket` or stdlib `net/http` + `x/net/websocket`),
  or a `curl`/`wscat`-equivalent CLI-snippet target (zero-dependency, good
  for terminal-first docs). Pick based on actual user requests, not
  speculatively — this is exactly the kind of item that's cheap to add later
  once the registry exists, so there's no cost to deferring it.
  **Effort: M each. Priority: later.**

- [ ] **Other AsyncAPI protocol bindings — Kafka, MQTT, AMQP, SSE.** This is
  the design doc's stated 10x vision ("httpsnippet for everything that isn't
  request/response HTTP") and the real differentiator if it lands — nobody
  else has built this. It is also a materially bigger lift than a new WS
  client: each protocol has its own binding shape (AsyncAPI's Kafka bindings
  ≠ MQTT bindings ≠ WS bindings), so `Request` normalization needs a second
  look before the first non-WS protocol, not a bolt-on. Don't start this
  until the WS wedge (registry + 2-3 clients) has real usage — the design
  doc's own sequencing logic ("prove the wedge before expanding") still
  holds. **Effort: L per protocol. Priority: later.**

## 3. Feature gaps (deferred in v1, tracked as open questions in the design doc)

- [ ] **Multi-server override.** v1 always picks `servers` entry #0
  (`request.ts`). Design doc flagged the override shape as an open question
  (`options.server: string`?) — worth deciding once someone hits a
  multi-server document, not speculatively. **Effort: S. Priority: next.**

- [ ] **Message selection for multi-message operations.** v1 always uses the
  first `messages` entry (tested, documented, intentional) but exposes no
  way to pick a different one. Natural extension of `convert()`'s `options`
  param. **Effort: S. Priority: next.**

- [ ] **JSON-Schema-driven payload/value synthesis** as a fallback when
  `examples` is absent, instead of throwing `MissingExampleError`. Explicitly
  deferred in the design doc pending a library choice (e.g.
  `json-schema-faker`). Real value-add, but changes the "no fabricated
  values" guarantee the README currently makes — needs an explicit
  opt-in flag, not a default-behavior change. **Effort: M. Priority: later.**

- [ ] **Security scheme resolution** (`apiKey`, `http`, `oauth2` from
  AsyncAPI's `security` object). Currently only binding-level `query`/
  `headers` are read. Real gap for any authenticated API — likely the
  single most-requested feature once this gets real users, since "how do I
  auth" is the first question anyone asks of a WS snippet.
  **Effort: M. Priority: next** (re-prioritize to now if/when a user hits this).

## 4. Documentation — making the library more readable/discoverable

- [ ] Fix the `InvalidDocumentError` mismatch and document binding precedence
  (see §0 — these are doc bugs, not enhancements, do them first).
- [ ] **Add a "why AsyncAPI 3.x, and what does resolution actually look
  like" worked example** to the README — right now the README's usage
  example is good but the "How values get resolved" section is prose-only.
  A second example fixture showing an *unresolved* placeholder in the output
  (the `<fieldName>` comment behavior) would make the resolution rule
  concrete instead of described. **Effort: S. Priority: now.**
- [ ] **Turn `scripts/gallery.ts` into published output.** It already
  generates a clean live preview of every fixture × every target/client —
  right now that only exists as a local dev script. Piping its output into a
  committed `EXAMPLES.md` (or a GitHub Pages page once there's >1 target)
  gives prospective users something to skim before installing, and it's
  nearly free since the script already exists. **Effort: S. Priority: now.**
- [ ] **API reference docs (TypeDoc or similar) once the registry ships.**
  Premature before §2's registry work — the current single-class,
  single-method surface is small enough that the README covers it. Revisit
  once `addTarget`/multiple clients exist and there's a real API surface to
  document. **Effort: S. Priority: later.**
- [ ] **Badges + repo hygiene**: npm version badge, CI status badge (once
  §1's CI exists), license badge. Cheap, standard, currently absent.
  **Effort: S. Priority: next.**

## NOT in scope (raised and deliberately excluded)

- Hosted "try it now" playground / SaaS product — the design doc's Premise
  #4 explicitly scopes this as a library, not a hosted service. Revisit only
  if the library gets real adoption and a platform wants to embed it as a
  UI, not as a standalone product asyncsnippet builds itself.
- Full project-scaffolding output (competing with `@asyncapi/generator`) —
  explicitly the *not-this* in the design doc's Problem Statement. Don't
  drift toward it even if a client feels "close" to a scaffolder.

---

### Suggested next PR (if you want the highest-leverage single change)

CI (§1) + the two doc bugs (§0, `InvalidDocumentError` + binding precedence)
+ error-path tests (§0). All four are S-effort, all four are correctness/
trust issues rather than new scope, and CI is what makes every subsequent
item on this list safe to merge quickly.
