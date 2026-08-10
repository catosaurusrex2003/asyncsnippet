import { describe, expect, it } from "vitest";

import type { AsyncApiDocument } from "./asyncapi-types.js";

import {
  MissingBindingError,
  MissingChannelError,
  MissingExampleError,
  UnknownOperationError,
  UnsupportedTargetError,
} from "./errors.js";
import { AsyncSnippet } from "./index.js";

const baseDocument: AsyncApiDocument = {
  servers: {
    production: { host: "ping.example.com", protocol: "wss" },
  },
  channels: {
    ping: {
      address: "/ping",
      bindings: { ws: {} },
      messages: {
        pingMessage: {
          examples: [{ name: "samplePing", payload: { timestamp: 1735689600 } }],
        },
      },
    },
  },
  operations: {
    sendPing: {
      action: "send",
      channel: { $ref: "#/channels/ping" },
      messages: [{ $ref: "#/channels/ping/messages/pingMessage" }],
    },
  },
};

describe("error paths", () => {
  it("throws UnknownOperationError for an operationId not in the document", () => {
    const snippet = new AsyncSnippet(baseDocument);
    expect(() => snippet.convert("doesNotExist", "javascript", "ws")).toThrow(
      UnknownOperationError,
    );
    expect(() => snippet.convert("doesNotExist", "javascript", "ws")).toThrow(
      /No operation found with id "doesNotExist"/,
    );
  });

  it("throws UnsupportedTargetError for an unsupported targetId/clientId", () => {
    const snippet = new AsyncSnippet(baseDocument);
    expect(() => snippet.convert("sendPing", "elixir", "gun")).toThrow(UnsupportedTargetError);
    expect(() => snippet.convert("sendPing", "elixir", "gun")).toThrow(
      /Unsupported target "elixir\/gun"/,
    );
  });

  it("throws MissingChannelError when the operation's channel doesn't resolve", () => {
    const document: AsyncApiDocument = {
      ...baseDocument,
      operations: {
        sendPing: {
          action: "send",
          channel: { $ref: "#/channels/doesNotExist" },
        },
      },
    };
    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(MissingChannelError);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(
      /Operation "sendPing" has no channels/,
    );
  });

  it("throws MissingBindingError when neither the server's protocol nor an explicit binding matches ws", () => {
    // Server protocol is unrelated to ws ("kafka"), and the channel declares
    // no explicit ws binding — no signal at all that this channel speaks ws.
    const document: AsyncApiDocument = {
      ...baseDocument,
      servers: {
        production: { host: "ping.example.com", protocol: "kafka" },
      },
      channels: {
        ping: {
          ...baseDocument.channels!.ping,
          bindings: undefined,
        },
      },
    };
    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(MissingBindingError);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(
      /Operation "sendPing" is not reachable over "ws"/,
    );
  });

  it("throws MissingBindingError when neither the server's protocol nor an explicit binding matches kafka", () => {
    // baseDocument's server is "wss" (normalizes to ws, not kafka), and its
    // channel only declares an explicit ws binding — no kafka signal either.
    const snippet = new AsyncSnippet(baseDocument);
    expect(() => snippet.convert("sendPing", "javascript", "kafkajs")).toThrow(MissingBindingError);
    expect(() => snippet.convert("sendPing", "javascript", "kafkajs")).toThrow(
      /Operation "sendPing" is not reachable over "kafka"/,
    );
  });

  it("throws MissingExampleError when the message has neither an examples entry nor a payload schema", () => {
    const document: AsyncApiDocument = {
      ...baseDocument,
      channels: {
        ping: {
          ...baseDocument.channels!.ping,
          messages: {
            pingMessage: {},
          },
        },
      },
    };
    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(MissingExampleError);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(
      /Operation "sendPing"'s message has no "examples" entry, and no "payload" schema/,
    );
  });

  it("throws MissingExampleError when the payload schema has no recognizable type to generate from", () => {
    const document: AsyncApiDocument = {
      ...baseDocument,
      channels: {
        ping: {
          ...baseDocument.channels!.ping,
          messages: {
            pingMessage: {
              payload: { oneOf: [{ type: "string" }, { type: "number" }] },
            },
          },
        },
      },
    };
    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("sendPing", "javascript", "ws")).toThrow(MissingExampleError);
  });
});
