# asyncsnippet

Generates client code snippets from an [AsyncAPI](https://www.asyncapi.com/) operation, across multiple protocol bindings (WebSocket, Kafka) — the async counterpart to [httpsnippet](https://github.com/readmeio/httpsnippet).

Built specifically for internal use by [apiuikit](https://github.com/AceTheCreator/apiuikit).

## Install

```sh
npm install asyncsnippet
```

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

The result:

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

Dynamic fields (path params, query, headers, payload, and — for Kafka — message key/groupId/clientId) resolve from `default`, then `examples`, then a `<placeholder>`. A message with no `examples` causes `convert()` to throw.

### Binding precedence

Which level of the AsyncAPI document a binding is read from depends on the protocol:

- **WebSocket (`ws`)**: channel-level only (`channel.bindings.ws`). An operation- or message-level `ws` binding is silently ignored.
- **Kafka (`kafka`)**: three levels, each for a different concern — channel-level (`channel.bindings.kafka.topic`, both the presence gate and an optional topic-name override), operation-level (`operation.bindings.kafka.groupId` / `.clientId`), and message-level (`message.bindings.kafka.key`).

## Supported targets

A **target** is a language (`targetId`); a **client** is a concrete library or API under that language (`clientId`). Pass both to
`convert(operationId, targetId, clientId)`.

### Available now

| `targetId`   | `clientId`          | Runtime            | Notes                                                                                                                                                   |
| ------------ | ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `javascript` | `ws`                | Node.js            | Default JS client. Requires the [`ws`](https://github.com/websockets/ws) package.                                                                       |
| `javascript` | `websocket`         | Browser            | WHATWG `WebSocket` — no dependency. Header bindings are omitted with a comment in the snippet; use `ws` when auth needs headers.                        |
| `python`     | `websockets`        | Python 3 (asyncio) | Default Python client. Requires the [`websockets`](https://websockets.readthedocs.io/) package.                                                         |
| `rust`       | `tokio-tungstenite` | Rust (Tokio)       | Default Rust client. Requires the [`tokio-tungstenite`](https://github.com/snapview/tokio-tungstenite) crate (plus `futures-util` and `serde_json`).    |
| `go`         | `gorilla`           | Go                 | Default Go client. Requires the [`gorilla/websocket`](https://github.com/gorilla/websocket) package.                                                    |
| `javascript` | `kafkajs`           | Node.js            | Kafka producer/consumer client. Requires the [`kafkajs`](https://kafka.js.org/) package. Not the default JS client — `javascript`'s default stays `ws`. |

Examples:

```js
snippet.convert("sendMessage", "javascript", "ws");
snippet.convert("sendMessage", "javascript", "websocket");
snippet.convert("sendMessage", "python", "websockets");
snippet.convert("sendMessage", "rust", "tokio-tungstenite");
snippet.convert("sendMessage", "go", "gorilla");
snippet.convert("publishOrderCreated", "javascript", "kafkajs");
```

### Planned

| Protocol          | Language | Client |
| ----------------- | -------- | ------ |
| MQTT / AMQP / SSE | —        | —      |

### Custom targets

Targets/clients are registered via `addTarget` / `addTargetClient` (`asyncsnippet` exports both), so you can add your own without forking the library. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the contract.

### Discovering supported targets at runtime

The tables above are only accurate for the version of `asyncsnippet` they were written against. To build something dynamic (a picker UI, a CLI `--list` flag, validation before calling `convert()`), call `getSupportedTargets()` instead of hardcoding ids — it reflects exactly what's registered in the running process, including any custom targets/clients added via `addTarget` / `addTargetClient`:

```js
import { getSupportedTargets } from "asyncsnippet";

for (const target of getSupportedTargets()) {
  console.log(`${target.title} (default: ${target.default})`);
  for (const client of target.clients) {
    console.log(`  - ${client.title} [${client.protocol}] (${client.key})`);
  }
}
```

```
JavaScript (default: ws)
  - ws [ws] (ws)
  - WebSocket (browser) [ws] (websocket)
  - kafkajs [kafka] (kafkajs)
Python (default: websockets)
  - websockets [ws] (websockets)
Rust (default: tokio-tungstenite)
  - tokio-tungstenite [ws] (tokio-tungstenite)
Go (default: gorilla)
  - gorilla/websocket [ws] (gorilla)
```

Each client's `protocol` is the AsyncAPI channel binding it generates code for — `ws` for the WebSocket clients, `kafka` for `javascript/kafkajs`. MQTT/AMQP/SSE won't appear here until those clients exist.

## License

[Apache-2.0](./LICENSE)
