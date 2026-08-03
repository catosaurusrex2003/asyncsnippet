import { describe, expect, it } from "vitest";

import { addTarget, addTargetClient, getSupportedTargets, targets } from "./index.js";

describe("target/client registry", () => {
  it("ships the default javascript and python targets", () => {
    expect(Object.keys(targets)).toEqual(expect.arrayContaining(["javascript", "python"]));
    expect(Object.keys(targets.javascript!.clientsById)).toEqual(
      expect.arrayContaining(["ws", "websocket"]),
    );
    expect(Object.keys(targets.python!.clientsById)).toEqual(
      expect.arrayContaining(["websockets"]),
    );
  });

  it("addTarget registers a new target", () => {
    addTarget({
      info: { key: "rust", title: "Rust", default: "tokio-tungstenite" },
      clientsById: {},
    });
    expect(targets.rust).toBeDefined();
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
    addTarget({ info: { key: "go", title: "Go", default: "gorilla" }, clientsById: {} });
    addTargetClient("go", {
      info: {
        key: "gorilla",
        title: "gorilla/websocket",
        description: "",
        link: "",
        extname: ".go",
        protocol: "ws",
      },
      convert: () => "",
    });
    expect(targets.go!.clientsById.gorilla).toBeDefined();
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
      expect.arrayContaining(["ws", "websocket"]),
    );
    expect(javascript?.clients.every((c) => c.protocol === "ws")).toBe(true);

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
