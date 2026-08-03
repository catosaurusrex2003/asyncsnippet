import type { Client } from "../../index.js";
import { CodeBuilder, type CodeBuilderOptions } from "../../../helpers/code-builder.js";

export const kafkajs: Client = {
  info: {
    key: "kafkajs",
    title: "kafkajs",
    description:
      "Kafka producer/consumer client using the kafkajs package — a pure JavaScript Kafka client for Node.js (no native build step, unlike node-rdkafka).",
    link: "https://kafka.js.org/",
    extname: ".js",
    protocol: "kafka",
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

    push("import { Kafka } from 'kafkajs';");
    blank();

    const brokers = request.serverHost
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean);
    const clientId = request.kafka?.clientId ?? "";

    push("const kafka = new Kafka({");
    push(`clientId: '${clientId}',`, 1);
    push(`brokers: [${brokers.map((broker) => `'${broker}'`).join(", ")}],`, 1);
    push("});");
    blank();

    if (request.action === "send") {
      push("const producer = kafka.producer();");
      blank();
      push("async function main() {");
      push("await producer.connect();", 1);
      push("await producer.send({", 1);
      push(`topic: '${request.channelAddress}',`, 2);
      push("messages: [", 2);
      push("{", 3);
      if (request.kafka?.key !== undefined) {
        push(`key: '${request.kafka.key}',`, 4);
      }
      const payloadLines = JSON.stringify(request.message.payload, null, 2).split("\n");
      payloadLines[payloadLines.length - 1] += "),";
      push(`value: JSON.stringify(${payloadLines[0]}`, 4);
      for (const line of payloadLines.slice(1)) {
        push(line, 4);
      }
      push("},", 3);
      push("],", 2);
      push("});", 1);
      push("await producer.disconnect();", 1);
      push("}");
      blank();
      push("main();");
    } else {
      push(`const consumer = kafka.consumer({ groupId: '${request.kafka?.groupId ?? ""}' });`);
      blank();

      const messageLabel = request.message.name ? ` ("${request.message.name}")` : "";
      push(`// Example message shape for this operation${messageLabel}:`);
      for (const line of JSON.stringify(request.message.payload, null, 2).split("\n")) {
        push(`// ${line}`);
      }
      blank();

      push("async function main() {");
      push("await consumer.connect();", 1);
      push(
        `await consumer.subscribe({ topic: '${request.channelAddress}', fromBeginning: true });`,
        1,
      );
      blank();
      push("await consumer.run({", 1);
      push("eachMessage: async ({ message }) => {", 2);
      push("console.log(message.value?.toString());", 3);
      push("},", 2);
      push("});", 1);
      push("}");
      blank();
      push("main();");
    }

    return join();
  },
};
