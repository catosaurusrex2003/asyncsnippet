import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";
import { buildWsUrl } from "../../../helpers/ws-url.js";

export const tokioTungstenite: Client = {
  info: {
    key: "tokio-tungstenite",
    title: "tokio-tungstenite",
    description:
      "Rust WebSocket client built on tokio-tungstenite, driven with async/await on the Tokio runtime.",
    link: "https://github.com/snapview/tokio-tungstenite",
    extname: ".rs",
    protocol: "ws",
  },
  convert: (request, inputOpts?: CodeBuilderOptions) => {
    const opts = { indent: "    ", ...inputOpts };
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

    push("use futures_util::{SinkExt, StreamExt};");
    if (headerEntries.length > 0) {
      push(
        "use tokio_tungstenite::{connect_async, tungstenite::client::IntoClientRequest, tungstenite::Message};",
      );
    } else {
      push("use tokio_tungstenite::{connect_async, tungstenite::Message};");
    }
    blank();
    blank();
    push("#[tokio::main]");
    push("async fn main() {");
    push(`let url = ${JSON.stringify(url)};`, 1);
    blank();

    if (headerEntries.length > 0) {
      push('let mut request = url.into_client_request().expect("Invalid URL");', 1);
      for (const [name, value] of headerEntries) {
        push("request", 1);
        push(".headers_mut()", 2);
        push(
          `.insert(${JSON.stringify(name)}, ${JSON.stringify(value)}.parse().expect("Invalid header value"));`,
          2,
        );
      }
      blank();
      push('let (ws_stream, _) = connect_async(request).await.expect("Failed to connect");', 1);
    } else {
      push('let (ws_stream, _) = connect_async(url).await.expect("Failed to connect");', 1);
    }
    const writeBinding = request.action === "send" ? "mut write" : "_write";
    push(`let (${writeBinding}, mut read) = ws_stream.split();`, 1);
    blank();

    if (request.action === "send") {
      const payloadLines = JSON.stringify(request.message.payload, null, 2).split("\n");
      payloadLines[payloadLines.length - 1] += ");";
      push(`let payload = serde_json::json!(${payloadLines[0]}`, 1);
      for (const line of payloadLines.slice(1)) {
        push(line, 1);
      }
      blank();
      push("write", 1);
      push(".send(Message::Text(payload.to_string().into()))", 2);
      push(".await", 2);
      push('.expect("Failed to send message");', 2);
      blank();
      push("if let Some(msg) = read.next().await {", 1);
      push('println!("{}", msg.expect("Failed to read message"));', 2);
      push("}", 1);
    } else {
      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`, 1);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`, 1);
      }
      blank();
      push("while let Some(msg) = read.next().await {", 1);
      push('println!("{}", msg.expect("Failed to read message"));', 2);
      push("}", 1);
    }

    push("}");

    return join();
  },
};
