import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";

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

export const confluentKafka: Client = {
  info: {
    key: "confluent-kafka",
    title: "confluent-kafka",
    description:
      "Kafka producer/consumer client using the confluent-kafka package — a librdkafka-backed client for Python.",
    link: "https://github.com/confluentinc/confluent-kafka-python",
    extname: ".py",
    protocol: "kafka",
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

    push("import json");
    blank();
    if (request.action === "send") {
      push("from confluent_kafka import Producer");
    } else {
      push("from confluent_kafka import Consumer");
    }
    blank();
    blank();

    const clientId = request.kafka?.clientId ?? "";

    if (request.action === "send") {
      push("producer = Producer({", 0);
      push(`"bootstrap.servers": ${JSON.stringify(request.serverHost)},`, 1);
      push(`"client.id": ${JSON.stringify(clientId)},`, 1);
      push("})");
      blank();

      const payloadLines = pythonLiteral(request.message.payload, opts.indent).split("\n");
      payloadLines[payloadLines.length - 1] += ")";
      push(`payload = json.dumps(${payloadLines[0]}`);
      for (const line of payloadLines.slice(1)) {
        push(line);
      }
      blank();

      push("producer.produce(", 0);
      push(`${JSON.stringify(request.channelAddress)},`, 1);
      push("value=payload.encode('utf-8'),", 1);
      if (request.kafka?.key !== undefined) {
        push(`key=${JSON.stringify(request.kafka.key)},`, 1);
      }
      push(")");
      push("producer.flush()");
    } else {
      const groupId = request.kafka?.groupId ?? "";
      push("consumer = Consumer({", 0);
      push(`"bootstrap.servers": ${JSON.stringify(request.serverHost)},`, 1);
      push(`"group.id": ${JSON.stringify(groupId)},`, 1);
      push(`"client.id": ${JSON.stringify(clientId)},`, 1);
      push('"auto.offset.reset": "earliest",', 1);
      push("})");
      blank();

      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`# Example message shape for this operation${messageLabel}:`);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`# ${line}`);
      }
      blank();

      push(`consumer.subscribe([${JSON.stringify(request.channelAddress)}])`);
      blank();
      push("try:");
      push("while True:", 1);
      push("msg = consumer.poll(1.0)", 2);
      push("if msg is None:", 2);
      push("continue", 3);
      push("if msg.error():", 2);
      push("print(msg.error())", 3);
      push("continue", 3);
      push("print(msg.value().decode('utf-8'))", 2);
      push("finally:");
      push("consumer.close()", 1);
    }

    return join();
  },
};
