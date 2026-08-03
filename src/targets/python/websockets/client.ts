import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";
import { buildWsUrl } from "../../../helpers/ws-url.js";

/** Renders a JS value as a Python literal (dict/list/str/int/float/bool/None), nested with `indentUnit` per level. */
function pythonLiteral(value: unknown, indentUnit: string, level = 0): string {
  const pad = indentUnit.repeat(level);
  const childPad = indentUnit.repeat(level + 1);

  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${childPad}${pythonLiteral(item, indentUnit, level + 1)}`);
    return `[\n${items.join(",\n")},\n${pad}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const items = entries.map(
    ([key, val]) =>
      `${childPad}${JSON.stringify(key)}: ${pythonLiteral(val, indentUnit, level + 1)}`,
  );
  return `{\n${items.join(",\n")},\n${pad}}`;
}

export const websockets: Client = {
  info: {
    key: "websockets",
    title: "websockets",
    description: "Python WebSocket client using the `websockets` package's asyncio API.",
    link: "https://websockets.readthedocs.io/",
    extname: ".py",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "    ", ...inputOpts };
    const { push, blank, join } = new CodeBuilder({ indent: opts.indent });

    if (request.placeholders.length > 0) {
      push("# NOTE: some values could not be resolved from the AsyncAPI document's");
      push("# default/examples and were filled with a placeholder — replace them");
      push("# with real values before running this snippet:");
      for (const placeholder of request.placeholders) {
        push(`#   - ${placeholder}`);
      }
      blank();
    }

    push("import asyncio");
    if (request.action === "send") {
      push("import json");
    }
    blank();
    push("import websockets");
    blank();
    blank();
    push("async def main() -> None:");

    const url = buildWsUrl(request.serverUrl, request.channelAddress, request.query);
    const headerEntries = Object.entries(request.headers);

    if (headerEntries.length > 0) {
      push("async with websockets.connect(", 1);
      push(`${JSON.stringify(url)},`, 2);
      push("additional_headers={", 2);
      for (const [name, value] of headerEntries) {
        push(`${JSON.stringify(name)}: ${JSON.stringify(value)},`, 3);
      }
      push("},", 2);
      push(") as websocket:", 1);
    } else {
      push(`async with websockets.connect(${JSON.stringify(url)}) as websocket:`, 1);
    }
    blank();

    if (request.action === "send") {
      const payloadLines = pythonLiteral(request.message.payload, opts.indent).split("\n");
      payloadLines[payloadLines.length - 1] += ")";
      push("await websocket.send(", 2);
      push(`json.dumps(${payloadLines[0]}`, 3);
      for (const line of payloadLines.slice(1)) {
        push(line, 3);
      }
      push(")", 2);
      blank();
      push("message = await websocket.recv()", 2);
      push("print(message)", 2);
    } else {
      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`# Example message shape for this operation${messageLabel}:`, 2);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`# ${line}`, 2);
      }
      blank();
      push("async for message in websocket:", 2);
      push("print(message)", 3);
    }

    blank();
    blank();
    push("asyncio.run(main())");

    return join();
  },
};
