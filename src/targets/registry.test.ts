import { describe, expect, it } from "vitest";

import { addTarget, addTargetClient, targets } from "./index.js";

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
      },
      convert: () => "",
    });
    expect(targets.go!.clientsById.gorilla).toBeDefined();
  });

  it("addTargetClient throws when the target isn't registered", () => {
    expect(() =>
      addTargetClient("doesNotExist", {
        info: { key: "x", title: "x", description: "", link: "", extname: "" },
        convert: () => "",
      }),
    ).toThrow(/is not registered/);
  });

  it("addTargetClient throws when the client key already exists on the target", () => {
    expect(() =>
      addTargetClient("javascript", {
        info: { key: "ws", title: "dup", description: "", link: "", extname: ".js" },
        convert: () => "",
      }),
    ).toThrow(/already registered/);
  });
});
