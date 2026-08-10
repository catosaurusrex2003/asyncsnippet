# asyncsnippet

Generates client code snippets from an [AsyncAPI](https://www.asyncapi.com/) operation across multiple protocol bindings (WebSocket, Kafka) — the async counterpart to [httpsnippet](https://github.com/readmeio/httpsnippet).

Built specifically for internal use by [apiuikit](https://github.com/AceTheCreator/apiuikit).

## Contents

- [Install](#install)
- [Usage](#usage)
- [Message payload](#message-payload)
- [Protocol eligibility](#protocol-eligibility)
- [Binding precedence](#binding-precedence)
- [Supported targets](#supported-targets)
- [Discovering targets at runtime](#discovering-supported-targets-at-runtime)
- [Filtering by protocol](#filtering-targets-by-protocol-compatibility)
- [License](#license)

## Install

```sh
npm install asyncsnippet
```

[`asyncsnippet` on npm](https://www.npmjs.com/package/asyncsnippet)

## Usage

Pass an already-parsed AsyncAPI document (plain object; `$ref`s are resolved internally):

```js
import fs from "node:fs";
import yaml from "js-yaml";
import { AsyncSnippet } from "asyncsnippet";

const document = yaml.load(fs.readFileSync("./chat.asyncapi.yaml", "utf8"));
const snippet = new AsyncSnippet(document);

console.log(snippet.convert("sendMessage", "javascript", "ws"));
```

**Result:**

```js
import WebSocket from "ws";

const socket = new WebSocket("wss://chat.example.com/rooms/general?token=abc123token", {
  headers: {
    "X-Client-Version": "1.0",
  },
});

socket.on("open", () => {
  socket.send(
    JSON.stringify({
      text: "hello world",
      from: "alice",
    }),
  );
});

socket.on("message", (data) => {
  console.log(data.toString());
});
```

### Placeholder resolution

Dynamic fields resolve in this order:

| Field | Sources (first wins) |
| ----- | -------------------- |
| Path params, query, headers | `default` → `examples` → `<placeholder>` |
| Kafka key / groupId / clientId | `default` → `examples` → `<placeholder>` |
| Message payload | See [Message payload](#message-payload) below |

## Message payload

A message's payload resolves in this order:

### 1. Explicit example

Uses the message's own `examples[0].payload` as-is, when present.

### 2. Generated from schema

When there's no explicit example, a payload is synthesized from the message's `payload` JSON Schema.

**Per schema node**, try in order:

1. `examples[0]`
2. `default`
3. `const`
4. `enum[0]`
5. Type-driven synthesis:

| Type | Generated value |
| ---- | --------------- |
| `object` | Recurses into `properties` |
| `array` | One-item array from `items` |
| `string` | Format-aware (`date-time`, `date`, `time`, `email`, `uuid`, `uri`, `hostname`, `ipv4`, `ipv6`) or `"string"` |
| `integer` / `number` | `0` |
| `boolean` | `false` |
| `null` | `null` |

`$ref`s are resolved at every level (common for shared component schemas, as in the AsyncAPI Streetlights examples). Cyclic / self-referential schemas are bounded by a depth guard.

**Composition keywords** (`oneOf` / `anyOf` / `allOf` / `not`) are **not** resolved — picking or merging branches is outside a code-sample generator's job. A node built only from those, with no plain `type` / `enum` / `const`, contributes nothing:

- An object property built that way is omitted (not written as `undefined`)
- A whole payload built that way falls through to step 3

Schema-generated payloads are flagged in `placeholders` as:

```
message payload (no explicit example — generated from its schema)
```

so they stay visually distinct from document-authored examples in the snippet comment.

### 3. Neither available

`convert()` throws `MissingExampleError`.

## Protocol eligibility

`convert(operationId, targetId, clientId)` only succeeds when the client's `info.protocol` (e.g. `"ws"`, `"kafka"`) matches the operation's channel.

A channel is eligible for a protocol when **either** holds:

1. **Server protocol** — a server the channel (or operation) is reachable through declares that protocol.
   - Secure variants normalize to their base: `kafka-secure` → `kafka`, `wss` → `ws`.
   - When `channel.servers` / `operation.servers` is omitted, every server in the document is considered (AsyncAPI 3.x: no `servers` means reachable through all).
   - If more than one server resolves, the one whose protocol actually matches is used for the generated URL/host — not just the first listed.
2. **Channel binding** — the channel declares `channel.bindings[protocol]` (e.g. `channel.bindings.ws` / `channel.bindings.kafka`), even with no matching server.

Either signal alone is enough. That matters in practice: most real documents only add `channel.bindings.kafka` / `.ws` when they need the extra data (topic override, `ws` query/headers) — not to declare the protocol. Relying on binding presence alone would reject the majority of Kafka channels, which often have no channel-level Kafka binding at all.

If neither signal holds, `convert()` throws `MissingBindingError`.

## Binding precedence

Which level of the document a binding is read from depends on the protocol:

| Protocol | Level | What it provides |
| -------- | ----- | ---------------- |
| **WebSocket (`ws`)** | Channel only (`channel.bindings.ws`) | Query params and headers. Operation- or message-level `ws` bindings are silently ignored. |
| **Kafka (`kafka`)** | Channel (`channel.bindings.kafka.topic`) | Optional topic-name override |
| | Operation (`operation.bindings.kafka.groupId` / `.clientId`) | Consumer group / client id |
| | Message (`message.bindings.kafka.key`) | Message key |

None of the Kafka bindings are required for [eligibility](#protocol-eligibility).

## Supported targets

A **target** is a language (`targetId`); a **client** is a concrete library or API under that language (`clientId`). Pass both to `convert(operationId, targetId, clientId)`.

### WebSocket

| `targetId`   | `clientId`          | Runtime            | Notes |
| ------------ | ------------------- | ------------------ | ----- |
| `javascript` | `ws`                | Node.js            | **Default** JS client. Requires [`ws`](https://github.com/websockets/ws). |
| `javascript` | `websocket`         | Browser            | WHATWG `WebSocket` — no dependency. Header bindings are omitted with a comment; use `ws` when auth needs headers. |
| `python`     | `websockets`        | Python 3 (asyncio) | **Default** Python client. Requires [`websockets`](https://websockets.readthedocs.io/). |
| `rust`       | `tokio-tungstenite` | Rust (Tokio)       | **Default** Rust client. Requires [`tokio-tungstenite`](https://github.com/snapview/tokio-tungstenite) (plus `futures-util`, `serde_json`). |
| `go`         | `gorilla`           | Go                 | **Default** Go client. Requires [`gorilla/websocket`](https://github.com/gorilla/websocket). |

### Kafka

| `targetId`   | `clientId`        | Runtime     | Notes |
| ------------ | ----------------- | ----------- | ----- |
| `javascript` | `kafkajs`         | Node.js     | Requires [`kafkajs`](https://kafka.js.org/). Default for `javascript` stays `ws`. |
| `python`     | `confluent-kafka` | Python      | Requires [`confluent-kafka`](https://github.com/confluentinc/confluent-kafka-python) (librdkafka). Default for `python` stays `websockets`. |
| `rust`       | `rdkafka`         | Rust (Tokio)| Requires [`rdkafka`](https://github.com/fede1024/rust-rdkafka) (plus `futures-util`, `serde_json`). Default for `rust` stays `tokio-tungstenite`. |
| `go`         | `kafka-go`        | Go          | Requires [`segmentio/kafka-go`](https://github.com/segmentio/kafka-go) (pure Go, no cgo). Default for `go` stays `gorilla`. |

**Examples:**

```js
// WebSocket
snippet.convert("sendMessage", "javascript", "ws");
snippet.convert("sendMessage", "javascript", "websocket");
snippet.convert("sendMessage", "python", "websockets");
snippet.convert("sendMessage", "rust", "tokio-tungstenite");
snippet.convert("sendMessage", "go", "gorilla");

// Kafka
snippet.convert("publishOrderCreated", "javascript", "kafkajs");
snippet.convert("publishOrderCreated", "python", "confluent-kafka");
snippet.convert("publishOrderCreated", "rust", "rdkafka");
snippet.convert("publishOrderCreated", "go", "kafka-go");
```

### Agent Prompt

Not a code snippet — a self-contained Markdown document (intro, every reachable server with its own authorization, the operation, and the raw payload/headers JSON Schema) meant for an LLM agent to read and act on directly, plus an explicit agent-facing intro sentence and step-by-step instructions.

| `targetId` | `clientId` | Notes |
| ---------- | ---------- | ----- |
| `agent`    | `ws`       | **Default** for `agent`. For operations reachable over `ws`/`wss`. |
| `agent`    | `kafka`    | For operations reachable over `kafka`/`kafka-secure`. |

```js
snippet.convert("sendMessage", "agent", "ws");
snippet.convert("publishOrderCreated", "agent", "kafka");
```

### Planned

| Protocol          | Language | Client |
| ----------------- | -------- | ------ |
| MQTT / AMQP / SSE | —        | —      |

### Custom targets

Register your own without forking via `addTarget` / `addTargetClient` (both exported). See [CONTRIBUTING.md](./CONTRIBUTING.md) for the contract.

## Discovering supported targets at runtime

The tables above are only accurate for the version they were written against. For a picker UI, CLI `--list` flag, or validation before `convert()`, call `getSupportedTargets()` — it reflects what's registered in the running process, including custom targets/clients:

```js
import { getSupportedTargets } from "asyncsnippet";

for (const target of getSupportedTargets()) {
  console.log(`${target.title} (default: ${target.default})`);
  for (const client of target.clients) {
    console.log(`  - ${client.title} [${client.protocol}] (${client.key})`);
  }
}
```

**Example output:**

```
Agent Prompt (default: ws)
  - Agent Prompt (WebSocket) [ws] (ws)
  - Agent Prompt (Kafka) [kafka] (kafka)
JavaScript (default: ws)
  - ws [ws] (ws)
  - WebSocket (browser) [ws] (websocket)
  - kafkajs [kafka] (kafkajs)
Python (default: websockets)
  - websockets [ws] (websockets)
  - confluent-kafka [kafka] (confluent-kafka)
Rust (default: tokio-tungstenite)
  - tokio-tungstenite [ws] (tokio-tungstenite)
  - rdkafka [kafka] (rdkafka)
Go (default: gorilla)
  - gorilla/websocket [ws] (gorilla)
  - kafka-go [kafka] (kafka-go)
```

Each client's `protocol` is the AsyncAPI channel binding it generates for — `ws` or `kafka`. MQTT / AMQP / SSE won't appear until those clients exist.

## Filtering targets by protocol compatibility

`getSupportedTargets()` is global — every registered client, regardless of what the document/operation actually supports. A picker built on it will offer options that fail (e.g. WebSocket clients for a Kafka-only operation).

Use `getCompatibleTargets(document, operationId)` for the same shape, pre-filtered to reachable clients (same rule as [Protocol eligibility](#protocol-eligibility)):

```js
import { getCompatibleTargets } from "asyncsnippet";

for (const target of getCompatibleTargets(document, "publishOrderCreated")) {
  console.log(`${target.title} (default: ${target.default})`);
  for (const client of target.clients) {
    console.log(`  - ${client.title} (${client.key})`);
  }
}
```

**For a Kafka-only operation:**

```
Agent Prompt (default: kafka)
  - Agent Prompt (Kafka) (kafka)
JavaScript (default: kafkajs)
  - kafkajs (kafkajs)
Python (default: confluent-kafka)
  - confluent-kafka (confluent-kafka)
Rust (default: rdkafka)
  - rdkafka (rdkafka)
Go (default: kafka-go)
  - kafka-go (kafka-go)
```

Two intentional differences from `getSupportedTargets()`:

1. A target left with zero compatible clients is **dropped entirely** (not returned with an empty `clients` array).
2. Each surviving target's `default` is **recomputed** to its first surviving client's key. The registered default (`javascript` → `"ws"`) may not be compatible with this operation — reusing it unchanged would preselect an option that isn't in the filtered list.

### Lower-level check

`isProtocolCompatible(document, operationId, protocol)` is the boolean primitive behind `getCompatibleTargets`. Pass a client's `protocol` field:

```js
import { isProtocolCompatible } from "asyncsnippet";

isProtocolCompatible(document, "publishOrderCreated", "kafka"); // true
isProtocolCompatible(document, "publishOrderCreated", "ws"); // false
```

Both functions never throw — unknown `operationId`, unresolvable channel, or other resolution failures return `false` / `[]`, so they're safe to call while building a picker.

## License

[Apache-2.0](./LICENSE)
