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
