import { describe, expect, it } from "vitest";

import type { AsyncApiDocument } from "../asyncapi-types.js";
import {
  addTarget,
  addTargetClient,
  getCompatibleTargets,
  getSupportedTargets,
  targets,
} from "./index.js";

describe("target/client registry", () => {
  it("ships the default javascript, python, rust, and go targets", () => {
    expect(Object.keys(targets)).toEqual(
      expect.arrayContaining(["javascript", "python", "rust", "go"]),
    );
    expect(Object.keys(targets.javascript!.clientsById)).toEqual(
      expect.arrayContaining(["ws", "websocket", "kafkajs"]),
    );
    expect(Object.keys(targets.python!.clientsById)).toEqual(
      expect.arrayContaining(["websockets", "confluent-kafka"]),
    );
    expect(Object.keys(targets.rust!.clientsById)).toEqual(
      expect.arrayContaining(["tokio-tungstenite", "rdkafka"]),
    );
    expect(Object.keys(targets.go!.clientsById)).toEqual(
      expect.arrayContaining(["gorilla", "kafka-go"]),
    );
  });

  it("addTarget registers a new target", () => {
    addTarget({
      info: { key: "csharp", title: "C#", default: "websocket-client" },
      clientsById: {},
    });
    expect(targets.csharp).toBeDefined();
  });

  it("addTarget throws when the key is already registered", () => {
    expect(() =>
      addTarget({
        info: { key: "javascript", title: "JavaScript", default: "ws" },
        clientsById: {},
      }),
    ).toThrow(/already registered/);
  });

  it("addTargetClient registers a client under an existing target", () => {
    addTarget({ info: { key: "kotlin", title: "Kotlin", default: "okhttp" }, clientsById: {} });
    addTargetClient("kotlin", {
      info: {
        key: "okhttp",
        title: "OkHttp",
        description: "",
        link: "",
        extname: ".kt",
        protocol: "ws",
      },
      convert: () => "",
    });
    expect(targets.kotlin!.clientsById.okhttp).toBeDefined();
  });

  it("addTargetClient throws when the target isn't registered", () => {
    expect(() =>
      addTargetClient("doesNotExist", {
        info: { key: "x", title: "x", description: "", link: "", extname: "", protocol: "ws" },
        convert: () => "",
      }),
    ).toThrow(/is not registered/);
  });

  it("addTargetClient throws when the client key already exists on the target", () => {
    expect(() =>
      addTargetClient("javascript", {
        info: {
          key: "ws",
          title: "dup",
          description: "",
          link: "",
          extname: ".js",
          protocol: "ws",
        },
        convert: () => "",
      }),
    ).toThrow(/already registered/);
  });
});

describe("getSupportedTargets", () => {
  it("returns a read-only snapshot of every registered target/client/protocol", () => {
    const supported = getSupportedTargets();
    const javascript = supported.find((t) => t.key === "javascript");
    const python = supported.find((t) => t.key === "python");

    expect(javascript).toMatchObject({ key: "javascript", title: "JavaScript", default: "ws" });
    expect(javascript?.clients.map((c) => c.key)).toEqual(
      expect.arrayContaining(["ws", "websocket", "kafkajs"]),
    );
    expect(javascript?.clients.find((c) => c.key === "ws")?.protocol).toBe("ws");
    expect(javascript?.clients.find((c) => c.key === "websocket")?.protocol).toBe("ws");
    expect(javascript?.clients.find((c) => c.key === "kafkajs")?.protocol).toBe("kafka");

    expect(python).toMatchObject({ key: "python", title: "Python", default: "websockets" });
    expect(python?.clients.map((c) => c.key)).toEqual(expect.arrayContaining(["websockets"]));
  });

  it("reflects newly registered targets/clients", () => {
    addTarget({ info: { key: "swift", title: "Swift", default: "starscream" }, clientsById: {} });
    addTargetClient("swift", {
      info: {
        key: "starscream",
        title: "Starscream",
        description: "",
        link: "",
        extname: ".swift",
        protocol: "ws",
      },
      convert: () => "",
    });

    const swift = getSupportedTargets().find((t) => t.key === "swift");
    expect(swift?.clients.map((c) => c.key)).toEqual(["starscream"]);
  });
});

describe("getCompatibleTargets", () => {
  const wsDocument: AsyncApiDocument = {
    servers: { production: { host: "chat.example.com", protocol: "wss" } },
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

  const kafkaDocument: AsyncApiDocument = {
    servers: { production: { host: "broker.example.com:9092", protocol: "kafka-secure" } },
    channels: {
      events: {
        address: "events.topic",
        messages: { event: { examples: [{ payload: { id: 1 } }] } },
      },
    },
    operations: {
      publishEvent: { action: "send", channel: { $ref: "#/channels/events" } },
    },
  };

  it("keeps ws-protocol clients and drops kafkajs for a ws-only operation", () => {
    const compatible = getCompatibleTargets(wsDocument, "sendGreeting");
    const javascript = compatible.find((t) => t.key === "javascript");

    expect(javascript?.clients.map((c) => c.key)).toEqual(
      expect.arrayContaining(["ws", "websocket"]),
    );
    expect(javascript?.clients.map((c) => c.key)).not.toContain("kafkajs");
    expect(javascript?.default).toBe("ws");

    const python = compatible.find((t) => t.key === "python");
    expect(python?.clients.map((c) => c.key)).toEqual(["websockets"]);
    const rust = compatible.find((t) => t.key === "rust");
    expect(rust?.clients.map((c) => c.key)).toEqual(["tokio-tungstenite"]);
    const go = compatible.find((t) => t.key === "go");
    expect(go?.clients.map((c) => c.key)).toEqual(["gorilla"]);
  });

  it("keeps only each target's kafka client, recomputes `default` to it, and drops their ws-only clients for a kafka-only operation", () => {
    const compatible = getCompatibleTargets(kafkaDocument, "publishEvent");
    const javascript = compatible.find((t) => t.key === "javascript");
    const python = compatible.find((t) => t.key === "python");
    const rust = compatible.find((t) => t.key === "rust");
    const go = compatible.find((t) => t.key === "go");

    expect(javascript?.clients.map((c) => c.key)).toEqual(["kafkajs"]);
    // The registered target-level default is "ws" (see the registry setup at
    // the bottom of index.ts) — it's not itself compatible with a
    // kafka-only operation, so it must not leak through unchanged.
    expect(javascript?.default).toBe("kafkajs");

    expect(python?.clients.map((c) => c.key)).toEqual(["confluent-kafka"]);
    expect(python?.default).toBe("confluent-kafka");
    expect(rust?.clients.map((c) => c.key)).toEqual(["rdkafka"]);
    expect(rust?.default).toBe("rdkafka");
    expect(go?.clients.map((c) => c.key)).toEqual(["kafka-go"]);
    expect(go?.default).toBe("kafka-go");
  });

  it("returns an empty array for an unknown operationId", () => {
    expect(getCompatibleTargets(wsDocument, "doesNotExist")).toEqual([]);
  });

  it("returns an empty array when no registered client's protocol matches (e.g. an mqtt-only operation)", () => {
    const document: AsyncApiDocument = {
      servers: { production: { host: "broker.example.com", protocol: "mqtt" } },
      channels: {
        events: {
          address: "events/topic",
          messages: { event: { examples: [{ payload: { id: 1 } }] } },
        },
      },
      operations: {
        publishEvent: { action: "send", channel: { $ref: "#/channels/events" } },
      },
    };
    expect(getCompatibleTargets(document, "publishEvent")).toEqual([]);
  });
});
