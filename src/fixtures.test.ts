import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import type { AsyncApiDocument } from "./asyncapi-types.js";

import { AsyncSnippet } from "./index.js";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): AsyncApiDocument {
  const contents = fs.readFileSync(path.join(fixturesDir, "fixtures", name), "utf8");
  return yaml.load(contents) as AsyncApiDocument;
}

describe("fixtures (snapshot)", () => {
  it("simple.yaml — send-only, no bindings, no channel parameters", () => {
    const snippet = new AsyncSnippet(loadFixture("simple.yaml"));
    const result = snippet.convert("sendPing", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).not.toContain("headers:");
  });

  it("with-bindings.yaml — query param, header, and channel parameter all resolve", () => {
    const snippet = new AsyncSnippet(loadFixture("with-bindings.yaml"));
    const result = snippet.convert("sendMessage", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain("/rooms/general?token=abc123token");
    expect(result).toContain("'X-Client-Version': '1.0'");
  });

  it("pubsub.yaml — send operation", () => {
    const snippet = new AsyncSnippet(loadFixture("pubsub.yaml"));
    const result = snippet.convert("sendHeartbeat", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain("socket.send(");
  });

  it("pubsub.yaml — receive-only operation has no send call, shows example as a comment, and flags the unresolved query param", () => {
    const snippet = new AsyncSnippet(loadFixture("pubsub.yaml"));
    const result = snippet.convert("subscribeToAlerts", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).not.toContain("socket.send(");
    expect(result).toContain("socket.on('message'");
    expect(result).toContain("Example message shape");
    expect(result).toContain('query param "region"');
  });

  it("multi-message.yaml — operation with multiple messages uses the first message", () => {
    const snippet = new AsyncSnippet(loadFixture("multi-message.yaml"));
    const result = snippet.convert("sendOrderCommand", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain('"symbol": "ACME"');
    expect(result).not.toContain('"orderId"');
  });

  it("channel-messages-only.yaml — omitted operation.messages falls back to channel messages", () => {
    const snippet = new AsyncSnippet(loadFixture("channel-messages-only.yaml"));
    const result = snippet.convert("sendPing", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain("1735689600");
  });
});

describe("fixtures (snapshot) — javascript/websocket (browser)", () => {
  it("simple.yaml — send-only, no bindings", () => {
    const snippet = new AsyncSnippet(loadFixture("simple.yaml"));
    const result = snippet.convert("sendPing", "javascript", "websocket");
    expect(result).toMatchSnapshot();
    expect(result).toContain("new WebSocket(");
    expect(result).not.toContain("import WebSocket");
  });

  it("with-bindings.yaml — query param resolves, header is documented as unsupported and omitted", () => {
    const snippet = new AsyncSnippet(loadFixture("with-bindings.yaml"));
    const result = snippet.convert("sendMessage", "javascript", "websocket");
    expect(result).toMatchSnapshot();
    expect(result).toContain("/rooms/general?token=abc123token");
    expect(result).toContain("cannot");
    expect(result).not.toContain("'X-Client-Version'");
  });

  it("pubsub.yaml — receive-only operation uses addEventListener", () => {
    const snippet = new AsyncSnippet(loadFixture("pubsub.yaml"));
    const result = snippet.convert("subscribeToAlerts", "javascript", "websocket");
    expect(result).toMatchSnapshot();
    expect(result).toContain("addEventListener('message'");
    expect(result).not.toContain("socket.send(");
  });
});

describe("fixtures (snapshot) — python/websockets", () => {
  it("simple.yaml — send-only, no bindings", () => {
    const snippet = new AsyncSnippet(loadFixture("simple.yaml"));
    const result = snippet.convert("sendPing", "python", "websockets");
    expect(result).toMatchSnapshot();
    expect(result).toContain("import websockets");
    expect(result).toContain("asyncio.run(main())");
  });

  it("with-bindings.yaml — query param and header both resolve", () => {
    const snippet = new AsyncSnippet(loadFixture("with-bindings.yaml"));
    const result = snippet.convert("sendMessage", "python", "websockets");
    expect(result).toMatchSnapshot();
    expect(result).toContain("/rooms/general?token=abc123token");
    expect(result).toContain('"X-Client-Version": "1.0"');
    expect(result).toContain("additional_headers=");
  });

  it("pubsub.yaml — receive-only operation uses async for", () => {
    const snippet = new AsyncSnippet(loadFixture("pubsub.yaml"));
    const result = snippet.convert("subscribeToAlerts", "python", "websockets");
    expect(result).toMatchSnapshot();
    expect(result).toContain("async for message in websocket:");
    expect(result).not.toContain("websocket.send(");
  });
});

describe("fixtures (snapshot) — rust/tokio-tungstenite", () => {
  it("simple.yaml — send-only, no bindings", () => {
    const snippet = new AsyncSnippet(loadFixture("simple.yaml"));
    const result = snippet.convert("sendPing", "rust", "tokio-tungstenite");
    expect(result).toMatchSnapshot();
    expect(result).toContain("connect_async(url)");
    expect(result).toContain("#[tokio::main]");
  });

  it("with-bindings.yaml — query param and header both resolve", () => {
    const snippet = new AsyncSnippet(loadFixture("with-bindings.yaml"));
    const result = snippet.convert("sendMessage", "rust", "tokio-tungstenite");
    expect(result).toMatchSnapshot();
    expect(result).toContain("/rooms/general?token=abc123token");
    expect(result).toContain('"X-Client-Version"');
    expect(result).toContain("into_client_request()");
    expect(result).toContain("connect_async(request)");
  });

  it("pubsub.yaml — receive-only operation loops over read without sending", () => {
    const snippet = new AsyncSnippet(loadFixture("pubsub.yaml"));
    const result = snippet.convert("subscribeToAlerts", "rust", "tokio-tungstenite");
    expect(result).toMatchSnapshot();
    expect(result).toContain("while let Some(msg) = read.next().await {");
    expect(result).not.toContain(".send(Message::Text");
    expect(result).toContain("Example message shape");
  });
});

describe("fixtures (snapshot) — go/gorilla", () => {
  it("simple.yaml — send-only, no bindings", () => {
    const snippet = new AsyncSnippet(loadFixture("simple.yaml"));
    const result = snippet.convert("sendPing", "go", "gorilla");
    expect(result).toMatchSnapshot();
    expect(result).toContain("websocket.DefaultDialer.Dial(url, nil)");
    expect(result).not.toContain("net/http");
  });

  it("with-bindings.yaml — query param and header both resolve", () => {
    const snippet = new AsyncSnippet(loadFixture("with-bindings.yaml"));
    const result = snippet.convert("sendMessage", "go", "gorilla");
    expect(result).toMatchSnapshot();
    expect(result).toContain("/rooms/general?token=abc123token");
    expect(result).toContain('header.Set("X-Client-Version", "1.0")');
    expect(result).toContain("websocket.DefaultDialer.Dial(url, header)");
  });

  it("pubsub.yaml — receive-only operation loops over ReadMessage without writing", () => {
    const snippet = new AsyncSnippet(loadFixture("pubsub.yaml"));
    const result = snippet.convert("subscribeToAlerts", "go", "gorilla");
    expect(result).toMatchSnapshot();
    expect(result).toContain("conn.ReadMessage()");
    expect(result).not.toContain("WriteMessage");
    expect(result).toContain("Example message shape");
  });
});

describe("fixtures (snapshot) — javascript/kafkajs", () => {
  it("kafka.yaml — send operation resolves the topic override and message key", () => {
    const snippet = new AsyncSnippet(loadFixture("kafka.yaml"));
    const result = snippet.convert("publishOrderCreated", "javascript", "kafkajs");
    expect(result).toMatchSnapshot();
    expect(result).toContain("new Kafka(");
    expect(result).toContain("producer.send(");
    expect(result).toContain("order.events.v1");
    expect(result).toContain("key: 'order-42'");
    expect(result).not.toContain("groupId:");
  });

  it("kafka.yaml — receive operation subscribes and consumes, without sending", () => {
    const snippet = new AsyncSnippet(loadFixture("kafka.yaml"));
    const result = snippet.convert("consumeOrderCreated", "javascript", "kafkajs");
    expect(result).toMatchSnapshot();
    expect(result).toContain("consumer.subscribe(");
    expect(result).toContain("consumer.run(");
    expect(result).toContain("groupId: 'order-processing-service'");
    expect(result).not.toContain("producer.send(");
  });
});
