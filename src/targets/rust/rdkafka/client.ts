import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";

export const rdkafka: Client = {
  info: {
    key: "rdkafka",
    title: "rdkafka",
    description:
      "Kafka producer/consumer client using the rdkafka crate, a librdkafka binding driven with async/await on the Tokio runtime.",
    link: "https://github.com/fede1024/rust-rdkafka",
    extname: ".rs",
    protocol: "kafka",
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

    const clientId = request.kafka?.clientId ?? "";

    if (request.action === "send") {
      push("use rdkafka::config::ClientConfig;");
      push("use rdkafka::producer::{FutureProducer, FutureRecord};");
      push("use std::time::Duration;");
      blank();
      blank();
      push("#[tokio::main]");
      push("async fn main() {");
      push("let producer: FutureProducer = ClientConfig::new()", 1);
      push(`.set("bootstrap.servers", ${JSON.stringify(request.serverHost)})`, 2);
      push(`.set("client.id", ${JSON.stringify(clientId)})`, 2);
      push(".create()", 2);
      push('.expect("Failed to create producer");', 2);
      blank();

      const payloadLines = JSON.stringify(request.message.payload, null, 2).split("\n");
      payloadLines[payloadLines.length - 1] += ");";
      push(`let payload = serde_json::json!(${payloadLines[0]}`, 1);
      for (const line of payloadLines.slice(1)) {
        push(line, 1);
      }
      blank();

      push(`let record = FutureRecord::to(${JSON.stringify(request.channelAddress)})`, 1);
      push(".payload(&payload.to_string())", 2);
      if (request.kafka?.key !== undefined) {
        push(`.key(${JSON.stringify(request.kafka.key)});`, 2);
      } else {
        push('.key("");', 2);
      }
      blank();

      push("producer", 1);
      push(".send(record, Duration::from_secs(0))", 2);
      push(".await", 2);
      push('.expect("Failed to send message");', 2);
      push("}");
    } else {
      const groupId = request.kafka?.groupId ?? "";
      push("use rdkafka::config::ClientConfig;");
      push("use rdkafka::consumer::{Consumer, StreamConsumer};");
      push("use rdkafka::Message;");
      push("use futures_util::StreamExt;");
      blank();
      blank();

      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`);
      }
      blank();

      push("#[tokio::main]");
      push("async fn main() {");
      push("let consumer: StreamConsumer = ClientConfig::new()", 1);
      push(`.set("bootstrap.servers", ${JSON.stringify(request.serverHost)})`, 2);
      push(`.set("group.id", ${JSON.stringify(groupId)})`, 2);
      push(`.set("client.id", ${JSON.stringify(clientId)})`, 2);
      push('.set("auto.offset.reset", "earliest")', 2);
      push(".create()", 2);
      push('.expect("Failed to create consumer");', 2);
      blank();

      push(
        `consumer.subscribe(&[${JSON.stringify(request.channelAddress)}]).expect("Failed to subscribe");`,
        1,
      );
      blank();

      push("let mut stream = consumer.stream();", 1);
      push("while let Some(message) = stream.next().await {", 1);
      push('let message = message.expect("Failed to read message");', 2);
      push("if let Some(payload) = message.payload_view::<str>().and_then(Result::ok) {", 2);
      push('println!("{}", payload);', 3);
      push("}", 2);
      push("}", 1);
      push("}");
    }

    return join();
  },
};
