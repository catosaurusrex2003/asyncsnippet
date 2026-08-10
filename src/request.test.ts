import { describe, expect, it } from "vitest";

import type { AsyncApiDocument } from "./asyncapi-types.js";

import { AsyncSnippet } from "./index.js";
import { MissingBindingError, MissingExampleError } from "./errors.js";
import { isProtocolCompatible } from "./request.js";

describe("protocol eligibility", () => {
  it("derives ws eligibility from a `wss` server with no explicit channel binding", () => {
    const document: AsyncApiDocument = {
      servers: {
        production: { host: "chat.example.com", protocol: "wss" },
      },
      channels: {
        chat: {
          address: "/chat",
          messages: {
            greet: { examples: [{ name: "sample", payload: { text: "hi" } }] },
          },
        },
      },
      operations: {
        sendGreeting: {
          action: "send",
          channel: { $ref: "#/channels/chat" },
          messages: [{ $ref: "#/channels/chat/messages/greet" }],
        },
      },
    };

    const snippet = new AsyncSnippet(document);
    const result = snippet.convert("sendGreeting", "javascript", "ws");

    expect(result).toContain("wss://chat.example.com/chat");
    expect(result).toContain("hi");
  });

  it("derives kafka eligibility from a `kafka-secure` server with no explicit channel binding", () => {
    const document: AsyncApiDocument = {
      servers: {
        production: { host: "broker.example.com:9092", protocol: "kafka-secure" },
      },
      channels: {
        events: {
          address: "events.topic",
          messages: {
            event: { examples: [{ payload: { id: 1 } }] },
          },
        },
      },
      operations: {
        publishEvent: {
          action: "send",
          channel: { $ref: "#/channels/events" },
        },
      },
    };

    const snippet = new AsyncSnippet(document);
    const result = snippet.convert("publishEvent", "javascript", "kafkajs");

    expect(result).toContain("new Kafka(");
    expect(result).toContain("broker.example.com:9092");
    expect(result).toContain("events.topic");
  });

  it("keeps the document's own protocol string (unnormalized) in the generated server URL", () => {
    const document: AsyncApiDocument = {
      servers: {
        production: { host: "chat.example.com", protocol: "wss" },
      },
      channels: {
        chat: {
          address: "/chat",
          messages: { greet: { examples: [{ payload: { text: "hi" } }] } },
        },
      },
      operations: {
        sendGreeting: { action: "send", channel: { $ref: "#/channels/chat" } },
      },
    };

    const snippet = new AsyncSnippet(document);
    const result = snippet.convert("sendGreeting", "javascript", "ws");

    // Normalization only affects eligibility matching, not the protocol
    // string that ends up in the generated snippet.
    expect(result).toContain("wss://");
    expect(result).not.toContain("ws://chat.example.com");
  });

  it("still succeeds from an explicit channel binding alone when no server matches the protocol", () => {
    const document: AsyncApiDocument = {
      servers: {
        production: { host: "chat.example.com", protocol: "http" },
      },
      channels: {
        chat: {
          address: "/chat",
          bindings: { ws: {} },
          messages: { greet: { examples: [{ payload: { text: "hi" } }] } },
        },
      },
      operations: {
        sendGreeting: { action: "send", channel: { $ref: "#/channels/chat" } },
      },
    };

    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("sendGreeting", "javascript", "ws")).not.toThrow();
  });

  it("prefers the protocol-matched server over an unrelated first server on a multi-server channel", () => {
    const document: AsyncApiDocument = {
      servers: {
        webhooks: { host: "webhooks.example.com", protocol: "http" },
        broker: { host: "broker.example.com:9092", protocol: "kafka-secure" },
      },
      channels: {
        events: {
          address: "events.topic",
          servers: [{ $ref: "#/servers/webhooks" }, { $ref: "#/servers/broker" }],
          messages: { event: { examples: [{ payload: { id: 1 } }] } },
        },
      },
      operations: {
        publishEvent: { action: "send", channel: { $ref: "#/channels/events" } },
      },
    };

    const snippet = new AsyncSnippet(document);
    const result = snippet.convert("publishEvent", "javascript", "kafkajs");

    expect(result).toContain("broker.example.com:9092");
    expect(result).not.toContain("webhooks.example.com");
  });

  it("still reads an explicit kafka topic override even when eligibility comes from the server protocol", () => {
    const document: AsyncApiDocument = {
      servers: {
        production: { host: "broker.example.com:9092", protocol: "kafka-secure" },
      },
      channels: {
        events: {
          address: "events-address-unused",
          bindings: { kafka: { topic: "overridden.topic" } },
          messages: { event: { examples: [{ payload: { id: 1 } }] } },
        },
      },
      operations: {
        publishEvent: { action: "send", channel: { $ref: "#/channels/events" } },
      },
    };

    const snippet = new AsyncSnippet(document);
    const result = snippet.convert("publishEvent", "javascript", "kafkajs");

    expect(result).toContain("overridden.topic");
    expect(result).not.toContain("events-address-unused");
  });

  it("throws MissingBindingError when neither a matching server nor an explicit binding exists", () => {
    const document: AsyncApiDocument = {
      servers: {
        production: { host: "chat.example.com", protocol: "http" },
      },
      channels: {
        chat: {
          address: "/chat",
          messages: { greet: { examples: [{ payload: { text: "hi" } }] } },
        },
      },
      operations: {
        sendGreeting: { action: "send", channel: { $ref: "#/channels/chat" } },
      },
    };

    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("sendGreeting", "javascript", "ws")).toThrow(MissingBindingError);
  });
});

describe("isProtocolCompatible", () => {
  const wsDocument: AsyncApiDocument = {
    servers: {
      production: { host: "chat.example.com", protocol: "wss" },
    },
    channels: {
      chat: {
        address: "/chat",
        messages: { greet: { examples: [{ payload: { text: "hi" } }] } },
      },
    },
    operations: {
      sendGreeting: { action: "send", channel: { $ref: "#/channels/chat" } },
    },
  };

  it("is true when a resolved server's normalized protocol matches", () => {
    expect(isProtocolCompatible(wsDocument, "sendGreeting", "ws")).toBe(true);
  });

  it("is true from an explicit channel binding alone, with no matching server", () => {
    const document: AsyncApiDocument = {
      servers: { production: { host: "chat.example.com", protocol: "http" } },
      channels: {
        chat: {
          address: "/chat",
          bindings: { ws: {} },
          messages: { greet: { examples: [{ payload: { text: "hi" } }] } },
        },
      },
      operations: {
        sendGreeting: { action: "send", channel: { $ref: "#/channels/chat" } },
      },
    };
    expect(isProtocolCompatible(document, "sendGreeting", "ws")).toBe(true);
  });

  it("is false for a protocol mismatch, not a thrown error", () => {
    expect(isProtocolCompatible(wsDocument, "sendGreeting", "kafka")).toBe(false);
  });

  it("is false for an unknown operationId", () => {
    expect(isProtocolCompatible(wsDocument, "doesNotExist", "ws")).toBe(false);
  });

  it("is false when the operation's channel doesn't resolve", () => {
    const document: AsyncApiDocument = {
      ...wsDocument,
      operations: {
        sendGreeting: { action: "send", channel: { $ref: "#/channels/doesNotExist" } },
      },
    };
    expect(isProtocolCompatible(document, "sendGreeting", "ws")).toBe(false);
  });

  it("doesn't throw for a malformed/cyclic $ref", () => {
    const document: AsyncApiDocument = {
      operations: {
        sendGreeting: { action: "send", channel: { $ref: "#/channels/sendGreeting" } },
      },
    };
    expect(() => isProtocolCompatible(document, "sendGreeting", "ws")).not.toThrow();
    expect(isProtocolCompatible(document, "sendGreeting", "ws")).toBe(false);
  });
});

describe("schema-generated examples", () => {
  const kafkaDocument: AsyncApiDocument = {
    servers: {
      production: { host: "broker.example.com:9092", protocol: "kafka" },
    },
    channels: {
      lightingMeasured: {
        address: "lighting.measured",
        messages: {
          lightMeasured: {
            payload: {
              type: "object",
              properties: {
                lumens: { type: "integer" },
                sentAt: { $ref: "#/components/schemas/sentAt" },
              },
            },
          },
        },
      },
    },
    operations: {
      receiveLightMeasurement: {
        action: "receive",
        channel: { $ref: "#/channels/lightingMeasured" },
      },
    },
  };
  (kafkaDocument as unknown as { components: unknown }).components = {
    schemas: { sentAt: { type: "string", format: "date-time" } },
  };

  it("generates a payload from the message's schema when no explicit example exists", () => {
    const snippet = new AsyncSnippet(kafkaDocument);
    const result = snippet.convert("receiveLightMeasurement", "javascript", "kafkajs");

    expect(result).toContain('"lumens": 0');
    expect(result).toContain('"sentAt": "2024-01-01T00:00:00Z"');
  });

  it("flags the generated payload as a placeholder note, distinct from a real document example", () => {
    const snippet = new AsyncSnippet(kafkaDocument);
    const result = snippet.convert("receiveLightMeasurement", "javascript", "kafkajs");

    expect(result).toContain("generated from its schema");
  });

  it("prefers an explicit example over the payload schema when both are present", () => {
    const document: AsyncApiDocument = {
      ...kafkaDocument,
      channels: {
        lightingMeasured: {
          ...kafkaDocument.channels!.lightingMeasured,
          messages: {
            lightMeasured: {
              payload: (
                kafkaDocument.channels!.lightingMeasured as {
                  messages: { lightMeasured: { payload: unknown } };
                }
              ).messages.lightMeasured.payload,
              examples: [
                { name: "realExample", payload: { lumens: 900, sentAt: "2020-01-01T00:00:00Z" } },
              ],
            },
          },
        },
      },
    };

    const snippet = new AsyncSnippet(document);
    const result = snippet.convert("receiveLightMeasurement", "javascript", "kafkajs");

    expect(result).toContain('"lumens": 900');
    expect(result).not.toContain("generated from its schema");
  });

  it("throws MissingExampleError when there's neither an explicit example nor a payload schema", () => {
    const document: AsyncApiDocument = {
      ...kafkaDocument,
      channels: {
        lightingMeasured: {
          ...kafkaDocument.channels!.lightingMeasured,
          messages: { lightMeasured: {} },
        },
      },
    };

    const snippet = new AsyncSnippet(document);
    expect(() => snippet.convert("receiveLightMeasurement", "javascript", "kafkajs")).toThrow(
      MissingExampleError,
    );
  });
});
