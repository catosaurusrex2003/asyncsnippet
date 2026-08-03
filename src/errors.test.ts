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

  it("throws MissingBindingError when the channel has no ws binding", () => {
    const document: AsyncApiDocument = {
      ...baseDocument,
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
      /Operation "sendPing" has no "ws" channel binding/,
    );
  });

  it("throws MissingBindingError when the channel has no kafka binding", () => {
    const snippet = new AsyncSnippet(baseDocument);
    expect(() => snippet.convert("sendPing", "javascript", "kafkajs")).toThrow(MissingBindingError);
    expect(() => snippet.convert("sendPing", "javascript", "kafkajs")).toThrow(
      /Operation "sendPing" has no "kafka" channel binding/,
    );
  });

  it("throws MissingExampleError when the message has no examples entry", () => {
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
      /Operation "sendPing"'s message has no "examples" entry/,
    );
  });
});
