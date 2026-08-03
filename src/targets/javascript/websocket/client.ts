import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";
import { buildWsUrl } from "../../../helpers/ws-url.js";

export const websocket: Client = {
  info: {
    key: "websocket",
    title: "WebSocket (browser)",
    description:
      "Browser-native WHATWG WebSocket API — no dependency to install, but it cannot set custom handshake headers, so only query-param bindings are supported.",
    link: "https://developer.mozilla.org/en-US/docs/Web/API/WebSocket",
    extname: ".js",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "  ", ...inputOpts };
    const { push, blank, join } = new CodeBuilder({ indent: opts.indent });

    const headerNames = Object.keys(request.headers);
    if (headerNames.length > 0) {
      push('// NOTE: this operation\'s "ws" binding declares handshake headers');
      push(`// (${headerNames.join(", ")}), but the browser-native WebSocket API cannot`);
      push("// set custom headers on the handshake request — they are omitted below.");
      push("// Move any required auth into the query string, or generate a Node.js");
      push('// snippet instead (targetId: "javascript", clientId: "ws").');
      blank();
    }

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
    push(`const socket = new WebSocket('${url}');`);
    blank();

    if (request.action === "send") {
      push("socket.addEventListener('open', () => {");
      const payloadLines = JSON.stringify(request.message.payload, null, 2).split("\n");
      payloadLines[payloadLines.length - 1] += "));";
      push(`socket.send(JSON.stringify(${payloadLines[0]}`, 1);
      for (const line of payloadLines.slice(1)) {
        push(line, 1);
      }
      push("});");
      blank();
      push("socket.addEventListener('message', (event) => {");
      push("console.log(event.data);", 1);
      push("});");
    } else {
      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`);
      }
      blank();
      push("socket.addEventListener('message', (event) => {");
      push("console.log(event.data);", 1);
      push("});");
    }

    return join();
  },
};
