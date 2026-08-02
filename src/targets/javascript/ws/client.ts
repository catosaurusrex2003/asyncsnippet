import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";

function buildUrl(
  serverUrl: string,
  channelAddress: string,
  query: Record<string, string>,
): string {
  const base = serverUrl.replace(/\/$/, "");
  const path = channelAddress.startsWith("/") ? channelAddress : `/${channelAddress}`;
  const search = new URLSearchParams(query).toString();
  return search ? `${base}${path}?${search}` : `${base}${path}`;
}

export const ws: Client = {
  info: {
    key: "ws",
    title: "ws",
    description:
      "WebSocket client for Node.js — chosen over the browser-native WebSocket API because it supports custom handshake headers",
    link: "https://github.com/websockets/ws",
    extname: ".js",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "  ", ...inputOpts };
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

    push("import WebSocket from 'ws';");
    blank();

    const url = buildUrl(request.serverUrl, request.channelAddress, request.query);
    const hasHeaders = Object.keys(request.headers).length > 0;

    if (hasHeaders) {
      push(`const socket = new WebSocket('${url}', {`);
      push("headers: {", 1);
      const headerEntries = Object.entries(request.headers);
      headerEntries.forEach(([name, value], i) => {
        const comma = i < headerEntries.length - 1 ? "," : "";
        push(`'${name}': '${value}'${comma}`, 2);
      });
      push("},", 1);
      push("});");
    } else {
      push(`const socket = new WebSocket('${url}');`);
    }
    blank();

    if (request.action === "send") {
      push("socket.on('open', () => {");
      const payloadLines = JSON.stringify(request.message.payload, null, 2).split("\n");
      payloadLines[payloadLines.length - 1] += "));";
      push(`socket.send(JSON.stringify(${payloadLines[0]}`, 1);
      for (const line of payloadLines.slice(1)) {
        push(line, 1);
      }
      push("});");
      blank();
      push("socket.on('message', (data) => {");
      push("console.log(data.toString());", 1);
      push("});");
    } else {
      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`);
      }
      blank();
      push("socket.on('message', (data) => {");
      push("console.log(data.toString());", 1);
      push("});");
    }

    return join();
  },
};
