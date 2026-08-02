import { fileURLToPath } from "node:url";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AsyncSnippet } from "./index.js";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));

describe("fixtures (snapshot)", () => {
  it("simple.yaml — send-only, no bindings, no channel parameters", async () => {
    const snippet = await AsyncSnippet.fromFile(path.join(fixturesDir, "fixtures/simple.yaml"));
    const result = snippet.convert("sendPing", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).not.toContain("headers:");
  });

  it("with-bindings.yaml — query param, header, and channel parameter all resolve", async () => {
    const snippet = await AsyncSnippet.fromFile(
      path.join(fixturesDir, "fixtures/with-bindings.yaml"),
    );
    const result = snippet.convert("sendMessage", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain("/rooms/general?token=abc123token");
    expect(result).toContain("'X-Client-Version': '1.0'");
  });

  it("pubsub.yaml — send operation", async () => {
    const snippet = await AsyncSnippet.fromFile(path.join(fixturesDir, "fixtures/pubsub.yaml"));
    const result = snippet.convert("sendHeartbeat", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain("socket.send(");
  });

  it("pubsub.yaml — receive-only operation has no send call, shows example as a comment, and flags the unresolved query param", async () => {
    const snippet = await AsyncSnippet.fromFile(path.join(fixturesDir, "fixtures/pubsub.yaml"));
    const result = snippet.convert("subscribeToAlerts", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).not.toContain("socket.send(");
    expect(result).toContain("socket.on('message'");
    expect(result).toContain("Example message shape");
    expect(result).toContain('query param "region"');
  });

  it("multi-message.yaml — operation with multiple messages uses the first message", async () => {
    const snippet = await AsyncSnippet.fromFile(
      path.join(fixturesDir, "fixtures/multi-message.yaml"),
    );
    const result = snippet.convert("sendOrderCommand", "javascript", "ws");
    expect(result).toMatchSnapshot();
    expect(result).toContain('"symbol": "ACME"');
    expect(result).not.toContain('"orderId"');
  });
});
