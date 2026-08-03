# asyncsnippet

Generates WebSocket client code snippets from an [AsyncAPI](https://www.asyncapi.com/) operation — the async counterpart to [httpsnippet](https://github.com/readmeio/httpsnippet).

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

Dynamic fields (path params, query, headers, payload) resolve from `default`, then `examples`, then a `<placeholder>`. A message with no `examples` causes `convert()` to throw.

## Supported targets

| Protocol  | Language   | Client        | Status    |
| --------- | ---------- | ------------- | --------- |
| WebSocket | JavaScript | `ws` (Node.js) | Supported |
| WebSocket | JavaScript | `websocket` (browser) | Planned |
| WebSocket | Python     | `websockets`  | Planned  |
| WebSocket | Rust       | `tokio-tungstenite` | Planned |
| WebSocket | Go         | `gorilla/websocket` | Planned |
| Kafka / MQTT / AMQP / SSE | — | — | Planned |

Call `convert(operationId, targetId, clientId)` — currently only `"javascript"` / `"ws"` is available.

## License

[Apache-2.0](./LICENSE)
