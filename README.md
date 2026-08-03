# asyncsnippet

[httpsnippet](https://github.com/readmeio/httpsnippet) generates copy-pasteable HTTP request code samples from a HAR entry. Asynchronous protocols — WebSocket, Kafka, MQTT, AMQP — have nothing like that. **asyncsnippet** fills that gap: it takes an **AsyncAPI operation** as the source of truth (in place of a HAR entry) and generates a working client code snippet.

v1 targets **WebSocket only**, and generates **JavaScript (Node.js, using [`ws`](https://github.com/websockets/ws))** snippets. It is explicitly a _snippet generator_ for docs and "try it now" experiences — not a project scaffolder. If you want a full generated client/server project, use the official [`@asyncapi/generator`](https://github.com/asyncapi/generator) instead; asyncsnippet is the httpsnippet-shaped tool that ecosystem doesn't have yet.

## Install

```sh
npm install asyncsnippet
```

## Usage

asyncsnippet does not parse or validate AsyncAPI documents itself — pass it an already-parsed document (a plain object; `$ref`s are resolved internally):

```js
import fs from "node:fs";
import yaml from "js-yaml";
import { AsyncSnippet } from "asyncsnippet";

const document = yaml.load(fs.readFileSync("./chat.asyncapi.yaml", "utf8"));
const snippet = new AsyncSnippet(document);

console.log(snippet.convert("sendMessage", "javascript", "ws"));
```

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

For a receive-only (subscribe) operation, the generated snippet connects and registers an `on('message', ...)` handler — no fabricated send call — with the expected message shape shown as a comment.

## How values get resolved

An AsyncAPI operation describes _shapes_ (JSON Schemas), not necessarily literal values. asyncsnippet resolves each dynamic field — channel path parameters, WS binding `query`/`headers`, and the message payload — using one rule:

1. Use the field's `default` if the document provides one.
2. Otherwise use its first `examples` entry.
3. Otherwise mark it as an unresolved placeholder (`<fieldName>`) and list it in a comment at the top of the generated snippet.

A message with **no** `examples` entry at all causes `convert()` to throw — v1 does not synthesize a payload from a JSON Schema.

## v1 scope

Deliberately narrow — see the design doc for the full reasoning:

- **WebSocket only.** Kafka, MQTT, AMQP, SSE are out of scope.
- **JSON/text payloads only.** No binary encodings (Avro, Protobuf).
- **No security schemes.** Only binding-level `query`/`headers` are resolved; AsyncAPI `security` objects are not.
- **Single server.** Uses the first entry in the document's `servers` map.
- **Channel-level `ws` binding only.** AsyncAPI 3.x allows `bindings.ws` at the server, channel, operation, or message level. asyncsnippet reads only `channel.bindings.ws` — server/operation/message-level `ws` bindings are ignored. If your `query`/`headers` are set anywhere other than the channel, they will not appear in the generated snippet and `MissingBindingError` will be thrown if the channel itself has no `ws` binding, even if another level does.
- **First message wins.** An operation with multiple `messages` uses the first one. If `operation.messages` is omitted, all channel messages apply (AsyncAPI 3.x).
- **Node.js + `ws`, not the browser.** The browser-native `WebSocket` API can't set custom handshake headers — `ws` can, and AsyncAPI WS bindings commonly need them.
- **`targetId`/`clientId` are hardcoded** to `"javascript"`/`"ws"` for v1 — the four-argument `convert()` signature is forward-compatible with a future target/client plugin registry (mirroring [httpsnippet's](https://github.com/readmeio/httpsnippet) `targets/` architecture), but v1 does not implement one.

## Error handling

`convert()` throws a typed, descriptive error (never a silent `false`) for:

- An unknown `operationId` (`UnknownOperationError`)
- An unsupported `targetId`/`clientId` (`UnsupportedTargetError`)
- An operation with no channels (`MissingChannelError`)
- An operation with no `ws` channel binding (`MissingBindingError`)
- A message with no `examples` entry (`MissingExampleError`)

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, adding targets/clients, and releases.

```sh
npm install
npm run build   # tsdown -> dist/
npm test        # vitest, snapshot tests against src/fixtures/
npm run lint    # oxlint + oxfmt --check + tsc
```

## License

[Apache-2.0](./LICENSE)
