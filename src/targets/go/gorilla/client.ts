import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";
import { buildWsUrl } from "../../../helpers/ws-url.js";

/** Renders a JS value as a Go composite literal (map[string]interface{}/[]interface{}/string/float64/bool/nil), nested with `indentUnit` per level. */
function goLiteral(value: unknown, indentUnit: string, level = 0): string {
  const pad = indentUnit.repeat(level);
  const childPad = indentUnit.repeat(level + 1);

  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]interface{}{}";
    const items = value.map((item) => `${childPad}${goLiteral(item, indentUnit, level + 1)}`);
    return `[]interface{}{\n${items.join(",\n")},\n${pad}}`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "map[string]interface{}{}";
  const items = entries.map(
    ([key, val]) => `${childPad}${JSON.stringify(key)}: ${goLiteral(val, indentUnit, level + 1)}`,
  );
  return `map[string]interface{}{\n${items.join(",\n")},\n${pad}}`;
}

export const gorilla: Client = {
  info: {
    key: "gorilla",
    title: "gorilla/websocket",
    description: "Go WebSocket client using the gorilla/websocket package's Dialer API.",
    link: "https://github.com/gorilla/websocket",
    extname: ".go",
    protocol: "ws",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "\t", ...inputOpts };
    const { push, blank, join } = new CodeBuilder({ indent: opts.indent });

    if (request.placeholders.length > 0) {
      push("// NOTE: some values could not be resolved from the AsyncAPI document's");
      push("// default/examples and were filled with a placeholder — replace them");
      push("// with real values before running this snippet:");
      for (const placeholder of request.placeholders) {
        push(`//   - ${placeholder}`);
      }
      blank();
    }

    const url = buildWsUrl(request.serverUrl, request.channelAddress, request.query);
    const headerEntries = Object.entries(request.headers);

    push("package main");
    blank();
    push("import (");
    if (request.action === "send") {
      push('"encoding/json"', 1);
    }
    push('"log"', 1);
    if (headerEntries.length > 0) {
      push('"net/http"', 1);
    }
    blank();
    push('"github.com/gorilla/websocket"', 1);
    push(")");
    blank();
    push("func main() {");
    push(`url := ${JSON.stringify(url)}`, 1);
    blank();

    if (headerEntries.length > 0) {
      push("header := http.Header{}", 1);
      for (const [name, value] of headerEntries) {
        push(`header.Set(${JSON.stringify(name)}, ${JSON.stringify(value)})`, 1);
      }
      blank();
      push("conn, _, err := websocket.DefaultDialer.Dial(url, header)", 1);
    } else {
      push("conn, _, err := websocket.DefaultDialer.Dial(url, nil)", 1);
    }
    push("if err != nil {", 1);
    push('log.Fatal("dial:", err)', 2);
    push("}", 1);
    push("defer conn.Close()", 1);
    blank();

    if (request.action === "send") {
      const payloadLines = goLiteral(request.message.payload, opts.indent).split("\n");
      push(`payload := ${payloadLines[0]}`, 1);
      for (const line of payloadLines.slice(1)) {
        push(line, 1);
      }
      blank();
      push("data, err := json.Marshal(payload)", 1);
      push("if err != nil {", 1);
      push('log.Fatal("marshal:", err)', 2);
      push("}", 1);
      push("if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {", 1);
      push('log.Fatal("write:", err)', 2);
      push("}", 1);
      blank();
      push("_, message, err := conn.ReadMessage()", 1);
      push("if err != nil {", 1);
      push('log.Fatal("read:", err)', 2);
      push("}", 1);
      push("log.Println(string(message))", 1);
    } else {
      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`, 1);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`, 1);
      }
      blank();
      push("for {", 1);
      push("_, message, err := conn.ReadMessage()", 2);
      push("if err != nil {", 2);
      push('log.Println("read:", err)', 3);
      push("return", 3);
      push("}", 2);
      push("log.Println(string(message))", 2);
      push("}", 1);
    }

    push("}");

    return join();
  },
};
